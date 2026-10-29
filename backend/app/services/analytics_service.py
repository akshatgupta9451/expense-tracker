from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Transaction, TransactionType, User
from app.schemas.analytics import (
    CategoryComparison,
    CategoryTotal,
    Granularity,
    TrendPoint,
)
from app.utils.dates import month_bounds, previous_month
from app.utils.money import ZERO, percent_change, percent_of, quantize


def _base_filter(user: User, start: date, end: date):
    return (
        Transaction.user_id == user.id,
        Transaction.deleted_at.is_(None),
        Transaction.transaction_date.between(start, end),
    )


_income_sum = func.coalesce(
    func.sum(case((Transaction.type == TransactionType.INCOME, Transaction.amount))), 0
)
_expense_sum = func.coalesce(
    func.sum(case((Transaction.type == TransactionType.EXPENSE, Transaction.amount))), 0
)


async def category_breakdown(
    db: AsyncSession, user: User, start: date, end: date, type_: TransactionType, limit: int | None
) -> list[CategoryTotal]:
    total_col = func.sum(Transaction.amount).label("total")
    stmt = (
        select(Category.id, Category.name, Category.color, total_col)
        .join(Category, Category.id == Transaction.category_id)
        .where(*_base_filter(user, start, end), Transaction.type == type_)
        .group_by(Category.id, Category.name, Category.color)
        .order_by(total_col.desc())
    )
    rows = (await db.execute(stmt)).all()
    grand_total = sum((r.total for r in rows), ZERO)
    if limit:
        rows = rows[:limit]
    return [
        CategoryTotal(
            category_id=r.id,
            name=r.name,
            color=r.color,
            total=quantize(r.total),
            percentage=percent_of(r.total, grand_total),
        )
        for r in rows
    ]


async def trend(
    db: AsyncSession, user: User, start: date, end: date, granularity: Granularity
) -> list[TrendPoint]:
    bucket = func.date_trunc(granularity.value, Transaction.transaction_date).label("period")
    stmt = (
        select(bucket, _income_sum.label("income"), _expense_sum.label("expense"))
        .where(*_base_filter(user, start, end))
        .group_by(bucket)
        .order_by(bucket)
    )
    points = []
    for r in (await db.execute(stmt)).all():
        income, expense = quantize(r.income), quantize(r.expense)
        points.append(
            TrendPoint(period=r.period.date(), income=income, expense=expense, net=income - expense)
        )
    return points


async def compare_with_previous(
    db: AsyncSession, user: User, month_start: date
) -> list[CategoryComparison]:
    current = await category_breakdown(
        db, user, *month_bounds(month_start), TransactionType.EXPENSE, None
    )
    previous = await category_breakdown(
        db, user, *month_bounds(previous_month(month_start)), TransactionType.EXPENSE, None
    )
    prev_by_id = {c.category_id: c for c in previous}
    seen = set()
    result = []
    for c in current:
        prev_total = prev_by_id[c.category_id].total if c.category_id in prev_by_id else ZERO
        result.append(
            CategoryComparison(
                category_id=c.category_id,
                name=c.name,
                color=c.color,
                current=c.total,
                previous=prev_total,
                change_pct=percent_change(c.total, prev_total),
            )
        )
        seen.add(c.category_id)
    for p in previous:
        if p.category_id not in seen:
            result.append(
                CategoryComparison(
                    category_id=p.category_id,
                    name=p.name,
                    color=p.color,
                    current=ZERO,
                    previous=p.total,
                    change_pct=-100.0,
                )
            )
    return result
