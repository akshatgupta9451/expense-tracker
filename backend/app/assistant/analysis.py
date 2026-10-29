"""Deterministic spending analysis that grounds the AI assistant.

Everything numeric the assistant says (patterns, predictions, budget risk) is computed here,
so the LLM explains real figures instead of doing arithmetic itself.
"""

import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Budget, Category, Transaction, TransactionType, User
from app.utils.dates import current_month, month_bounds, previous_month, today
from app.utils.money import ZERO, percent_change, quantize

HISTORY_MONTHS = 6  # current month + 5 full months before it
# Categories people can usually trim without changing fixed commitments.
DISCRETIONARY = {"Food & Dining", "Shopping", "Entertainment", "Subscriptions", "Travel"}
RISING_THRESHOLD = 20.0  # % rise vs. the earlier average that counts as "rising"


@dataclass(frozen=True)
class Txn:
    day: date
    title: str
    category: str
    amount: Decimal
    type: TransactionType


@dataclass(frozen=True)
class BudgetLine:
    category: str | None  # None = overall monthly budget
    limit: Decimal


@dataclass
class MonthSummary:
    month: date
    income: Decimal = ZERO
    expense: Decimal = ZERO

    @property
    def net(self) -> Decimal:
        return self.income - self.expense

    @property
    def savings_rate(self) -> float | None:
        if not self.income:
            return None
        return round(float(self.net / self.income * 100), 1)


@dataclass
class CategoryStats:
    name: str
    by_month: dict[date, Decimal]
    average: Decimal  # mean over full months
    last_month: Decimal
    change_pct: float | None  # last full month vs. the average of the months before it
    predicted_next: Decimal


@dataclass
class Merchant:
    title: str
    category: str
    count: int
    total: Decimal
    months: int


@dataclass
class BudgetStatus:
    category: str | None
    limit: Decimal
    spent: Decimal
    projected: Decimal

    @property
    def at_risk(self) -> bool:
        return self.projected > self.limit


@dataclass
class Snapshot:
    currency: str
    today: date
    current_month: date
    months: list[MonthSummary]
    categories: list[CategoryStats]
    merchants: list[Merchant]
    recurring: list[Merchant]
    largest: list[Txn]
    weekday_daily: Decimal
    weekend_daily: Decimal
    month_to_date: Decimal
    projected_this_month: Decimal
    predicted_next_month: Decimal
    budgets: list[BudgetStatus]
    transactions: list[Txn] = field(repr=False)
    patterns: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return bool(self.transactions)

    @property
    def full_months(self) -> list[MonthSummary]:
        return self.months[:-1]

    def money(self, value: Decimal) -> str:
        return f"{self.currency} {value:,.2f}"


def _weighted_average(values: list[Decimal]) -> Decimal:
    """Most recent month counts most: weights 1..n for oldest..newest."""
    if not values:
        return ZERO
    weights = range(1, len(values) + 1)
    return quantize(sum(v * w for v, w in zip(values, weights, strict=True)) / sum(weights))


def _normalize_title(title: str) -> str:
    return " ".join(title.lower().split())


def analyze(txns: list[Txn], budgets: list[BudgetLine], currency: str, today_: date) -> Snapshot:
    this_month = today_.replace(day=1)
    months = [this_month]
    for _ in range(HISTORY_MONTHS - 1):
        months.insert(0, previous_month(months[0]))
    full_months = months[:-1]

    summaries = {m: MonthSummary(m) for m in months}
    cat_month: dict[str, dict[date, Decimal]] = defaultdict(lambda: defaultdict(lambda: ZERO))
    merchants: dict[str, dict] = {}
    weekday_total = weekend_total = ZERO
    expenses = [t for t in txns if t.type == TransactionType.EXPENSE]

    for t in txns:
        m = t.day.replace(day=1)
        if m not in summaries:
            continue
        if t.type == TransactionType.INCOME:
            summaries[m].income += t.amount
            continue
        summaries[m].expense += t.amount
        cat_month[t.category][m] += t.amount
        if t.day.weekday() >= 5:
            weekend_total += t.amount
        else:
            weekday_total += t.amount
        key = _normalize_title(t.title)
        entry = merchants.setdefault(
            key, {"title": t.title, "category": t.category, "count": 0, "total": ZERO, "m": set()}
        )
        entry["count"] += 1
        entry["total"] += t.amount
        entry["m"].add(m)

    # Weekday vs weekend: average spend per calendar day of each kind in the window.
    window_start, window_end = months[0], today_
    weekday_days = weekend_days = 0
    day = window_start
    while day <= window_end:
        if day.weekday() >= 5:
            weekend_days += 1
        else:
            weekday_days += 1
        day = date.fromordinal(day.toordinal() + 1)

    categories = []
    for name, by_month in cat_month.items():
        history = [by_month.get(m, ZERO) for m in full_months]
        last = history[-1] if history else ZERO
        earlier = history[:-1]
        earlier_avg = sum(earlier, ZERO) / len(earlier) if earlier else ZERO
        categories.append(
            CategoryStats(
                name=name,
                by_month={m: quantize(by_month.get(m, ZERO)) for m in months},
                average=quantize(sum(history, ZERO) / len(history)) if history else ZERO,
                last_month=quantize(last),
                change_pct=percent_change(last, quantize(earlier_avg)),
                predicted_next=_weighted_average(history[-3:]),
            )
        )
    categories.sort(key=lambda c: (c.average, c.by_month[this_month]), reverse=True)

    merchant_list = sorted(
        (
            Merchant(e["title"], e["category"], e["count"], quantize(e["total"]), len(e["m"]))
            for e in merchants.values()
        ),
        key=lambda x: x.total,
        reverse=True,
    )
    # Recurring = charged in 3+ months, about once a month (rent, subscriptions, bills).
    recurring = [x for x in merchant_list if x.months >= 3 and x.count <= x.months * 1.5]
    recurring_keys = {_normalize_title(x.title) for x in recurring}

    # Month-end projection: spent so far + recurring charges not yet seen this month
    # + remaining days x usual daily spend outside recurring charges. Extrapolating the raw
    # run rate would count a once-a-month rent payment as if it were paid every day.
    days_in_month = calendar.monthrange(this_month.year, this_month.month)[1]
    remaining_days = days_in_month - today_.day
    rate_start = full_months[-3] if len(full_months) >= 3 else months[0]
    rate_days = (today_ - rate_start).days + 1

    def project(category: str | None) -> tuple[Decimal, Decimal]:
        """(spent this month, projected month total) overall or for one category."""
        spent = variable = ZERO
        seen_recurring = set()
        for t in expenses:
            if category and t.category != category:
                continue
            key = _normalize_title(t.title)
            if t.day >= this_month:
                spent += t.amount
                seen_recurring.add(key)
            if t.day >= rate_start and key not in recurring_keys:
                variable += t.amount
        pending = sum(
            (
                x.total / x.count
                for x in recurring
                if (category is None or x.category == category)
                and _normalize_title(x.title) not in seen_recurring
            ),
            ZERO,
        )
        projected = spent + pending + variable / rate_days * remaining_days
        return quantize(spent), quantize(projected)

    month_to_date, projected_this_month = project(None)
    predicted_next_month = quantize(sum((c.predicted_next for c in categories), ZERO))

    budget_status = []
    for b in budgets:
        spent, projected = project(b.category)
        budget_status.append(BudgetStatus(b.category, quantize(b.limit), spent, projected))

    snapshot = Snapshot(
        currency=currency,
        today=today_,
        current_month=this_month,
        months=[summaries[m] for m in months],
        categories=categories,
        merchants=merchant_list[:30],
        recurring=recurring[:15],
        largest=sorted(expenses, key=lambda t: t.amount, reverse=True)[:5],
        weekday_daily=quantize(weekday_total / weekday_days) if weekday_days else ZERO,
        weekend_daily=quantize(weekend_total / weekend_days) if weekend_days else ZERO,
        month_to_date=month_to_date,
        projected_this_month=projected_this_month,
        predicted_next_month=predicted_next_month,
        budgets=budget_status,
        transactions=txns,
    )
    snapshot.patterns = _patterns(snapshot)
    snapshot.suggestions = _suggestions(snapshot)
    return snapshot


def _patterns(s: Snapshot) -> list[str]:
    if not s.has_data:
        return []
    out = []
    spending = [c for c in s.categories if c.average]
    total_avg = sum((c.average for c in spending), ZERO)
    if spending and total_avg:
        top = spending[0]
        share = round(float(top.average / total_avg * 100))
        out.append(
            f"{top.name} is your biggest expense: about {s.money(top.average)} a month "
            f"({share}% of spending)."
        )
    for c in s.categories:
        if c.change_pct is not None and c.change_pct >= RISING_THRESHOLD and c.last_month >= 1:
            out.append(
                f"{c.name} spending rose {c.change_pct:.0f}% last month to {s.money(c.last_month)}."
            )
    if s.weekend_daily and s.weekday_daily and s.weekend_daily > s.weekday_daily * Decimal("1.3"):
        ratio = s.weekend_daily / s.weekday_daily
        out.append(
            f"You spend {ratio:.1f}x more per day on weekends "
            f"({s.money(s.weekend_daily)} vs {s.money(s.weekday_daily)})."
        )
    if s.recurring:
        total = sum((m.total / m.months for m in s.recurring), ZERO)
        out.append(
            f"{len(s.recurring)} recurring payments (e.g. {s.recurring[0].title}) "
            f"cost roughly {s.money(quantize(total))} a month."
        )
    rates = [m.savings_rate for m in s.full_months if m.savings_rate is not None]
    if rates:
        avg_rate = sum(rates) / len(rates)
        out.append(f"Your average savings rate is {avg_rate:.0f}% of income.")
    return out


def _suggestions(s: Snapshot) -> list[str]:
    if not s.has_data:
        return []
    out = []
    for b in s.budgets:
        if b.at_risk:
            label = f"{b.category} budget" if b.category else "overall budget"
            out.append(
                f"You're on track to exceed your {label} ({s.money(b.limit)}); projected "
                f"{s.money(b.projected)}. Slow down for the rest of the month."
            )
    discretionary = [c for c in s.categories if c.name in DISCRETIONARY and c.average]
    if discretionary:
        top = max(discretionary, key=lambda c: c.average)
        saving = quantize(top.average * Decimal("0.2"))
        out.append(
            f"Cutting {top.name} by 20% would save about {s.money(saving)} a month "
            f"({s.money(saving * 12)} a year)."
        )
    subs = [m for m in s.recurring if m.category == "Subscriptions"]
    if subs:
        names = ", ".join(m.title for m in subs[:3])
        out.append(f"Review your subscriptions ({names}) and cancel any you rarely use.")
    rates = [m.savings_rate for m in s.full_months if m.savings_rate is not None]
    if rates and sum(rates) / len(rates) < 20:
        out.append("Aim to save at least 20% of income: automate a transfer on payday.")
    if s.predicted_next_month and s.full_months and s.full_months[-1].income:
        if s.predicted_next_month > s.full_months[-1].income:
            out.append(
                f"Next month's predicted spending ({s.money(s.predicted_next_month)}) is above "
                f"last month's income. Plan cuts now to avoid dipping into savings."
            )
    return out


async def load_snapshot(db: AsyncSession, user: User) -> Snapshot:
    this_month = current_month(user.timezone)
    start = this_month
    for _ in range(HISTORY_MONTHS - 1):
        start = previous_month(start)
    _, end = month_bounds(this_month)

    rows = await db.execute(
        select(
            Transaction.transaction_date,
            Transaction.title,
            Category.name,
            Transaction.amount,
            Transaction.type,
        )
        .join(Category, Category.id == Transaction.category_id)
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.transaction_date.between(start, end),
        )
        .order_by(Transaction.transaction_date)
    )
    txns = [Txn(*row) for row in rows.all()]

    budget_rows = await db.execute(
        select(Category.name, Budget.monthly_limit)
        .select_from(Budget)
        .outerjoin(Category, Category.id == Budget.category_id)
        .where(Budget.user_id == user.id, Budget.period_month == this_month)
    )
    budgets = [BudgetLine(name, limit) for name, limit in budget_rows.all()]
    return analyze(txns, budgets, user.currency, today(user.timezone))
