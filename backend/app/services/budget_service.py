import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppError, ConflictError, NotFoundError
from app.models import Budget, Transaction, TransactionType, User
from app.schemas.budget import (
    BudgetCreate,
    BudgetRead,
    BudgetStatus,
    BudgetSummary,
    BudgetUpdate,
)
from app.services.category_service import get_visible_category
from app.utils.dates import format_month, month_bounds, parse_month, previous_month, today
from app.utils.money import ZERO, percent_of, quantize


async def _spending_by_category(
    db: AsyncSession, user_id: uuid.UUID, month_start: date
) -> dict[uuid.UUID, object]:
    start, end = month_bounds(month_start)
    rows = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.type == TransactionType.EXPENSE,
            Transaction.transaction_date.between(start, end),
        )
        .group_by(Transaction.category_id)
    )
    return {category_id: total for category_id, total in rows.all()}


def _to_read(budget: Budget, spent) -> BudgetRead:
    spent = quantize(spent)
    pct = percent_of(spent, budget.monthly_limit)
    if pct >= 100:
        status = BudgetStatus.EXCEEDED
    elif pct >= budget.alert_threshold:
        status = BudgetStatus.WARNING
    else:
        status = BudgetStatus.ON_TRACK
    return BudgetRead(
        id=budget.id,
        category=budget.category,
        monthly_limit=budget.monthly_limit,
        period_month=budget.period_month,
        alert_threshold=budget.alert_threshold,
        spent=spent,
        remaining=quantize(budget.monthly_limit - spent),
        percent_used=pct,
        status=status,
    )


async def list_budgets(db: AsyncSession, user: User, month_start: date) -> list[BudgetRead]:
    budgets = (
        await db.scalars(
            select(Budget)
            .where(Budget.user_id == user.id, Budget.period_month == month_start)
            .order_by(Budget.category_id.is_not(None), Budget.created_at)
        )
    ).all()
    spending = await _spending_by_category(db, user.id, month_start)
    total_spent = sum(spending.values(), ZERO)
    return [
        _to_read(b, total_spent if b.category_id is None else spending.get(b.category_id, ZERO))
        for b in budgets
    ]


async def _get_budget(db: AsyncSession, user: User, budget_id: uuid.UUID) -> Budget:
    budget = await db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if budget is None:
        raise NotFoundError("Budget not found")
    return budget


async def _read_one(db: AsyncSession, user: User, budget: Budget) -> BudgetRead:
    spending = await _spending_by_category(db, user.id, budget.period_month)
    spent = (
        sum(spending.values(), ZERO)
        if budget.category_id is None
        else spending.get(budget.category_id, ZERO)
    )
    return _to_read(budget, spent)


async def _exists(db: AsyncSession, user_id, category_id, month_start) -> bool:
    stmt = select(Budget.id).where(Budget.user_id == user_id, Budget.period_month == month_start)
    stmt = stmt.where(
        Budget.category_id.is_(None) if category_id is None else Budget.category_id == category_id
    )
    return await db.scalar(stmt) is not None


async def create_budget(db: AsyncSession, user: User, data: BudgetCreate) -> BudgetRead:
    month_start = parse_month(data.month)
    if data.category_id is not None:
        category = await get_visible_category(db, user, data.category_id)
        if category.type != TransactionType.EXPENSE:
            raise AppError("Budgets can only be set on expense categories")

    if await _exists(db, user.id, data.category_id, month_start):
        raise ConflictError("A budget for this category and month already exists")

    budget = Budget(
        user_id=user.id,
        category_id=data.category_id,
        monthly_limit=data.monthly_limit,
        period_month=month_start,
        alert_threshold=data.alert_threshold,
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget, ["category"])
    return await _read_one(db, user, budget)


async def update_budget(
    db: AsyncSession, user: User, budget_id: uuid.UUID, data: BudgetUpdate
) -> BudgetRead:
    budget = await _get_budget(db, user, budget_id)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(budget, field, value)
    await db.flush()
    return await _read_one(db, user, budget)


async def delete_budget(db: AsyncSession, user: User, budget_id: uuid.UUID) -> None:
    await db.delete(await _get_budget(db, user, budget_id))


async def copy_budgets(db: AsyncSession, user: User, from_month: str, to_month: str) -> int:
    """Copy budgets from one month to another, skipping ones that already exist."""
    source, target = parse_month(from_month), parse_month(to_month)
    if source == target:
        raise AppError("Source and target month must differ")

    existing = set(
        await db.scalars(
            select(Budget.category_id).where(
                Budget.user_id == user.id, Budget.period_month == target
            )
        )
    )
    copied = 0
    for b in await db.scalars(
        select(Budget).where(Budget.user_id == user.id, Budget.period_month == source)
    ):
        if b.category_id in existing:
            continue
        db.add(
            Budget(
                user_id=user.id,
                category_id=b.category_id,
                monthly_limit=b.monthly_limit,
                period_month=target,
                alert_threshold=b.alert_threshold,
            )
        )
        copied += 1
    await db.flush()
    return copied


async def budget_summary(db: AsyncSession, user: User, month_start: date) -> BudgetSummary:
    budgets = await list_budgets(db, user, month_start)
    spending = await _spending_by_category(db, user.id, month_start)
    overall = next((b for b in budgets if b.category is None), None)
    categories = sorted(
        (b for b in budgets if b.category is not None), key=lambda b: b.percent_used, reverse=True
    )

    total_spent = quantize(sum(spending.values(), ZERO))
    budgeted_ids = {b.category.id for b in categories}
    unbudgeted = quantize(sum((v for k, v in spending.items() if k not in budgeted_ids), ZERO))

    # Pacing, in the user's timezone: how far through the month are we?
    start, end = month_bounds(month_start)
    days_in_month = end.day
    now = today(user.timezone)
    if now < start:
        days_elapsed = 0
    elif now > end:
        days_elapsed = days_in_month
    else:
        days_elapsed = now.day
    is_current = start <= now <= end
    days_left = days_in_month - days_elapsed + (1 if is_current else 0)

    daily_allowance = projected = None
    if is_current:
        projected = quantize(total_spent / days_elapsed * days_in_month)
        if overall is not None:
            daily_allowance = quantize(max(overall.remaining, ZERO) / days_left)

    has_previous = (
        await db.scalar(
            select(Budget.id)
            .where(Budget.user_id == user.id, Budget.period_month == previous_month(month_start))
            .limit(1)
        )
        is not None
    )

    return BudgetSummary(
        month=format_month(month_start),
        currency=user.currency,
        overall=overall,
        categories=categories,
        total_spent=total_spent,
        unbudgeted_spent=unbudgeted,
        category_limits_total=quantize(sum((b.monthly_limit for b in categories), ZERO)),
        days_in_month=days_in_month,
        days_elapsed=days_elapsed,
        days_left=days_left,
        daily_allowance=daily_allowance,
        projected_spend=projected,
        previous_month_has_budgets=has_previous,
    )
