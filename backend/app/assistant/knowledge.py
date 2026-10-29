"""RAG knowledge base: the user's financial data and saving guidance as LangChain Documents."""

from collections import defaultdict

from langchain_core.documents import Document

from app.assistant.analysis import Snapshot


def _month(m) -> str:
    return m.strftime("%B %Y")


def overview(s: Snapshot) -> str:
    """Compact always-in-context summary; detail comes from retrieval."""
    if not s.has_data:
        return "The user has no transactions in the last six months."
    lines = [
        f"Currency: {s.currency}. Today: {s.today.isoformat()}.",
        "Monthly income / expenses / net (savings rate):",
    ]
    for m in s.months:
        rate = f"{m.savings_rate}%" if m.savings_rate is not None else "n/a"
        partial = " (month to date)" if m.month == s.current_month else ""
        lines.append(
            f"- {_month(m.month)}{partial}: {s.money(m.income)} / {s.money(m.expense)} / "
            f"{s.money(m.net)} ({rate})"
        )
    lines.append("Average monthly spending by category (full months), with last-month change:")
    for c in [c for c in s.categories if c.average][:8]:
        change = f"{c.change_pct:+.0f}%" if c.change_pct is not None else "n/a"
        lines.append(f"- {c.name}: {s.money(c.average)} (last month {change})")
    lines += [
        f"Spent so far this month: {s.money(s.month_to_date)}; "
        f"projected for the full month: {s.money(s.projected_this_month)}.",
        f"Predicted spending next month: {s.money(s.predicted_next_month)} "
        "(weighted average of the last 3 full months per category).",
    ]
    if s.patterns:
        lines.append("Detected patterns:")
        lines += [f"- {p}" for p in s.patterns]
    if s.suggestions:
        lines.append("Computed saving opportunities:")
        lines += [f"- {p}" for p in s.suggestions]
    return "\n".join(lines)


def user_documents(s: Snapshot) -> list[Document]:
    docs = []
    for m in s.months:
        cats = sorted(
            ((c.name, c.by_month[m.month]) for c in s.categories if c.by_month[m.month]),
            key=lambda x: x[1],
            reverse=True,
        )
        breakdown = ", ".join(f"{name} {s.money(v)}" for name, v in cats) or "no expenses"
        docs.append(
            Document(
                page_content=(
                    f"Monthly summary for {_month(m.month)}: income {s.money(m.income)}, "
                    f"expenses {s.money(m.expense)}, net savings {s.money(m.net)}. "
                    f"Spending by category: {breakdown}."
                ),
                metadata={"kind": "month", "month": m.month.isoformat()},
            )
        )

    for c in s.categories:
        history = ", ".join(f"{_month(m)} {s.money(v)}" for m, v in c.by_month.items())
        top = [x for x in s.merchants if x.category == c.name][:5]
        where = "; ".join(f"{x.title} ({x.count}x, {s.money(x.total)})" for x in top)
        change = f"{c.change_pct:+.0f}%" if c.change_pct is not None else "not comparable"
        docs.append(
            Document(
                page_content=(
                    f"Category {c.name} spending trend: {history}. Average {s.money(c.average)} "
                    f"per month; last month changed {change} versus earlier months. "
                    f"Predicted next month: {s.money(c.predicted_next)}. "
                    f"Top merchants/items: {where or 'none'}."
                ),
                metadata={"kind": "category", "category": c.name},
            )
        )

    for x in s.merchants:
        recurring = " This looks like a recurring payment." if x in s.recurring else ""
        docs.append(
            Document(
                page_content=(
                    f"Merchant or item '{x.title}' ({x.category}): {x.count} transactions "
                    f"totalling {s.money(x.total)} across {x.months} month(s).{recurring}"
                ),
                metadata={"kind": "merchant", "category": x.category},
            )
        )

    for b in s.budgets:
        label = f"{b.category} budget" if b.category else "Overall monthly budget"
        status = "on track to EXCEED the limit" if b.at_risk else "on track"
        docs.append(
            Document(
                page_content=(
                    f"{label} for {_month(s.current_month)}: limit {s.money(b.limit)}, "
                    f"spent {s.money(b.spent)}, projected {s.money(b.projected)} - {status}."
                ),
                metadata={"kind": "budget"},
            )
        )

    if s.weekday_daily or s.weekend_daily:
        docs.append(
            Document(
                page_content=(
                    f"Weekday vs weekend spending: average {s.money(s.weekday_daily)} per weekday "
                    f"and {s.money(s.weekend_daily)} per weekend day."
                ),
                metadata={"kind": "pattern"},
            )
        )
    if s.largest:
        items = "; ".join(
            f"{t.day.isoformat()} {t.title} ({t.category}) {s.money(t.amount)}" for t in s.largest
        )
        docs.append(
            Document(
                page_content=f"Largest single expenses in the last six months: {items}.",
                metadata={"kind": "pattern"},
            )
        )

    # Raw transactions, chunked per month and category so specific questions can be answered.
    chunks: dict[tuple, list[str]] = defaultdict(list)
    for t in s.transactions:
        chunks[(t.day.replace(day=1), t.category, t.type)].append(
            f"{t.day.isoformat()} {t.title} {s.money(t.amount)}"
        )
    for (month, category, type_), lines in chunks.items():
        docs.append(
            Document(
                page_content=(
                    f"{type_.value.title()} transactions in {category} during {_month(month)}: "
                    + "; ".join(lines)
                ),
                metadata={"kind": "transactions", "category": category},
            )
        )
    return docs


SAVING_GUIDES = [
    (
        "Food & Dining",
        "Food delivery and eating out: cook in batches on weekends, cap delivery apps to a "
        "weekly allowance, and pack lunch for work. Restaurant meals usually cost 3-5x home "
        "cooking.",
    ),
    (
        "Groceries",
        "Groceries: plan meals for the week, shop with a list, buy staples in bulk, prefer "
        "store brands, and avoid shopping hungry. Track food waste.",
    ),
    (
        "Subscriptions",
        "Subscriptions audit: list every recurring charge, cancel services unused in the last "
        "month, rotate streaming services instead of keeping all at once, and prefer annual "
        "plans only for services you use daily.",
    ),
    (
        "Shopping",
        "Impulse shopping: use a 48-hour rule before non-essential purchases, unsubscribe from "
        "sale emails, remove saved cards from shopping apps, and keep a wishlist instead of "
        "buying immediately.",
    ),
    (
        "Transport",
        "Transport costs: combine errands, use public transport or monthly passes for regular "
        "commutes, carpool, and compare ride-hailing with metro or bus for frequent routes.",
    ),
    (
        "Utilities",
        "Utility bills: switch to LED lighting, set the AC a couple of degrees warmer, unplug idle "
        "devices, and review mobile/internet plans yearly for cheaper equivalents.",
    ),
    (
        "Entertainment",
        "Entertainment: set a monthly fun budget, look for free events, use matinee or weekday "
        "discounts, and host at home instead of going out every weekend.",
    ),
    (
        "Travel",
        "Travel: book flights and trains early, travel off-peak, use price alerts, and set a "
        "separate sinking fund so trips don't hit one month's budget.",
    ),
    (
        None,
        "50/30/20 budgeting rule: about 50% of take-home income for needs (rent, groceries, "
        "utilities, transport), 30% for wants (dining, shopping, entertainment), and at least "
        "20% for savings and debt repayment.",
    ),
    (
        None,
        "Pay yourself first: automate a transfer to savings or investments on payday so saving "
        "happens before spending. Increase it whenever income rises.",
    ),
    (
        None,
        "Emergency fund: keep 3-6 months of essential expenses in an easily accessible savings "
        "account before taking on investment risk.",
    ),
    (
        None,
        "Weekend spending: plan weekend activities in advance, set a weekend cash limit, and "
        "prefer low-cost plans; unplanned weekends drive most discretionary overspending.",
    ),
    (
        None,
        "Sinking funds: for irregular yearly costs (insurance, festivals, gifts, travel), divide "
        "the annual amount by 12 and set it aside monthly to avoid spikes.",
    ),
    (
        None,
        "Budget tracking: review spending weekly rather than monthly so you can correct course "
        "before a budget is exceeded. Set category budgets for your top three expenses.",
    ),
]


def guide_documents() -> list[Document]:
    return [
        Document(
            page_content=f"Saving guidance: {text}",
            metadata={"kind": "guide", "category": category},
        )
        for category, text in SAVING_GUIDES
    ]
