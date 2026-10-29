from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Transaction, TransactionType, User
from app.schemas.dashboard import (
    CategoryResponse,
    CategoryRow,
    ChartData,
    ChartDataset,
    MonthAmount,
    MonthlyResponse,
    MonthlyStats,
    MonthRow,
    MonthTotals,
    SummaryResponse,
)
from app.utils.dates import format_month, month_bounds, next_month, previous_month, today
from app.utils.money import ZERO, percent_change, percent_of, quantize

INCOME_COLOR = "#16a34a"
EXPENSE_COLOR = "#dc2626"
NET_COLOR = "#2563eb"
OTHER_COLOR = "#94a3b8"

_income = func.coalesce(
    func.sum(Transaction.amount).filter(Transaction.type == TransactionType.INCOME), 0
)
_expense = func.coalesce(
    func.sum(Transaction.amount).filter(Transaction.type == TransactionType.EXPENSE), 0
)


def _num(value: Decimal | int | None) -> float:
    return float(quantize(value))


def _owned(user: User):
    return Transaction.user_id == user.id, Transaction.deleted_at.is_(None)


async def _totals(db: AsyncSession, user: User, *conditions) -> tuple[Decimal, Decimal, int]:
    row = (
        await db.execute(
            select(_income, _expense, func.count(Transaction.id)).where(*_owned(user), *conditions)
        )
    ).one()
    return quantize(row[0]), quantize(row[1]), row[2]


def _in_month(month_start: date):
    start, end = month_bounds(month_start)
    return Transaction.transaction_date.between(start, end)


# ---------- summary ----------


async def summary(db: AsyncSession, user: User, month_start: date) -> SummaryResponse:
    as_of = today(user.timezone)
    # Future-dated (scheduled) transactions don't count towards the balance yet.
    income, expense, count = await _totals(db, user, Transaction.transaction_date <= as_of)

    m_income, m_expense, m_count = await _totals(db, user, _in_month(month_start))
    p_income, p_expense, _ = await _totals(db, user, _in_month(previous_month(month_start)))
    m_net = m_income - m_expense

    return SummaryResponse(
        currency=user.currency,
        as_of=as_of,
        total_income=_num(income),
        total_expense=_num(expense),
        current_balance=_num(income - expense),
        transaction_count=count,
        this_month=MonthTotals(
            month=format_month(month_start),
            income=_num(m_income),
            expense=_num(m_expense),
            net=_num(m_net),
            savings_rate=percent_of(m_net, m_income) if m_income else None,
            income_change_pct=percent_change(m_income, p_income),
            expense_change_pct=percent_change(m_expense, p_expense),
            transaction_count=m_count,
        ),
        chart=ChartData(
            labels=["Income", "Expense"],
            datasets=[
                ChartDataset(
                    key="totals",
                    label="All time",
                    data=[_num(income), _num(expense)],
                    backgroundColor=[INCOME_COLOR, EXPENSE_COLOR],
                )
            ],
        ),
    )


# ---------- monthly ----------


def _month_label(month_start: date) -> str:
    return month_start.strftime("%b %Y")


async def monthly(db: AsyncSession, user: User, end_month: date, months: int) -> MonthlyResponse:
    start_month = end_month
    for _ in range(months - 1):
        start_month = previous_month(start_month)
    _, end = month_bounds(end_month)

    bucket = func.date_trunc("month", Transaction.transaction_date).label("bucket")
    rows = await db.execute(
        select(bucket, _income, _expense, func.count(Transaction.id))
        .where(*_owned(user), Transaction.transaction_date.between(start_month, end))
        .group_by(bucket)
    )
    by_month = {b.date(): (quantize(i), quantize(e), c) for b, i, e, c in rows.all()}

    # One row per month, including months with no transactions, so charts have no gaps.
    month_rows: list[MonthRow] = []
    cursor = start_month
    while cursor <= end_month:
        income, expense, count = by_month.get(cursor, (ZERO, ZERO, 0))
        month_rows.append(
            MonthRow(
                month=format_month(cursor),
                label=_month_label(cursor),
                income=_num(income),
                expense=_num(expense),
                net=_num(income - expense),
                transaction_count=count,
            )
        )
        cursor = next_month(cursor)

    total_income = sum((Decimal(str(r.income)) for r in month_rows), ZERO)
    total_expense = sum((Decimal(str(r.expense)) for r in month_rows), ZERO)
    with_spending = [r for r in month_rows if r.expense > 0]

    def amount(r: MonthRow | None) -> MonthAmount | None:
        return r and MonthAmount(month=r.month, label=r.label, expense=r.expense)

    labels = [r.label for r in month_rows]
    return MonthlyResponse(
        currency=user.currency,
        start_month=format_month(start_month),
        end_month=format_month(end_month),
        months=month_rows,
        summary=MonthlyStats(
            total_income=_num(total_income),
            total_expense=_num(total_expense),
            total_net=_num(total_income - total_expense),
            average_monthly_expense=_num(total_expense / len(month_rows)),
            highest_expense_month=amount(max(with_spending, key=lambda r: r.expense, default=None)),
            lowest_expense_month=amount(min(with_spending, key=lambda r: r.expense, default=None)),
        ),
        chart=ChartData(
            labels=labels,
            datasets=[
                ChartDataset(
                    key="expense",
                    label="Expense",
                    data=[r.expense for r in month_rows],
                    backgroundColor=EXPENSE_COLOR,
                    borderColor=EXPENSE_COLOR,
                ),
                ChartDataset(
                    key="income",
                    label="Income",
                    data=[r.income for r in month_rows],
                    backgroundColor=INCOME_COLOR,
                    borderColor=INCOME_COLOR,
                ),
                ChartDataset(
                    key="net",
                    label="Net",
                    data=[r.net for r in month_rows],
                    backgroundColor=NET_COLOR,
                    borderColor=NET_COLOR,
                ),
            ],
        ),
    )


# ---------- category ----------


async def by_category(
    db: AsyncSession,
    user: User,
    start: date,
    end: date,
    type_: TransactionType,
    limit: int | None,
) -> CategoryResponse:
    total_col = func.sum(Transaction.amount).label("total")
    rows = (
        await db.execute(
            select(
                Category.id,
                Category.name,
                Category.color,
                Category.icon,
                total_col,
                func.count(Transaction.id),
            )
            .join(Category, Category.id == Transaction.category_id)
            .where(
                *_owned(user),
                Transaction.type == type_,
                Transaction.transaction_date.between(start, end),
            )
            .group_by(Category.id, Category.name, Category.color, Category.icon)
            .order_by(total_col.desc(), Category.name)
        )
    ).all()

    grand_total = sum((quantize(r.total) for r in rows), ZERO)

    def row(category_id, name, color, icon, total, count) -> CategoryRow:
        return CategoryRow(
            category_id=category_id,
            name=name,
            color=color,
            icon=icon,
            total=_num(total),
            percentage=percent_of(quantize(total), grand_total),
            transaction_count=count,
        )

    categories = [row(r[0], r[1], r[2], r[3], r[4], r[5]) for r in rows]

    # Pie charts get unreadable with many slices: keep the top N, group the rest as "Other".
    if limit and len(rows) > limit:
        rest = rows[limit:]
        categories = categories[:limit] + [
            row(
                None,
                "Other",
                OTHER_COLOR,
                None,
                sum((quantize(r.total) for r in rest), ZERO),
                sum(r[5] for r in rest),
            )
        ]

    return CategoryResponse(
        currency=user.currency,
        type=type_.value,
        start_date=start,
        end_date=end,
        total=_num(grand_total),
        categories=categories,
        chart=ChartData(
            labels=[c.name for c in categories],
            datasets=[
                ChartDataset(
                    key=type_.value,
                    label=f"{type_.value.capitalize()} by category",
                    data=[c.total for c in categories],
                    backgroundColor=[c.color for c in categories],
                )
            ],
        ),
    )
