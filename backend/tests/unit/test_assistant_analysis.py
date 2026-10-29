from datetime import date
from decimal import Decimal

from app.assistant.analysis import BudgetLine, Txn, analyze
from app.assistant.chain import build_retriever
from app.assistant.knowledge import overview
from app.models import TransactionType

EXPENSE, INCOME = TransactionType.EXPENSE, TransactionType.INCOME
TODAY = date(2026, 10, 27)


def _history() -> list[Txn]:
    txns = []
    for month in range(5, 11):
        txns.append(Txn(date(2026, month, 1), "Salary", "Salary", Decimal("5000"), INCOME))
        txns.append(Txn(date(2026, month, 2), "Rent", "Housing & Rent", Decimal("1500"), EXPENSE))
        if month < 10:  # not charged yet this month
            txns.append(
                Txn(date(2026, month, 28), "Netflix", "Subscriptions", Decimal("16"), EXPENSE)
            )
        for day in (3, 10, 17, 24):
            amount = Decimal(40 + month * 10)  # food delivery creeping up every month
            txns.append(
                Txn(date(2026, month, day), "Swiggy order", "Food & Dining", amount, EXPENSE)
            )
    return txns


def test_monthly_totals_and_savings_rate():
    s = analyze(_history(), [], "USD", TODAY)
    september = s.months[-2]
    assert september.month == date(2026, 9, 1)
    assert september.income == Decimal("5000")
    assert september.expense == Decimal("1500") + Decimal("16") + 4 * Decimal("130")
    assert september.savings_rate == 59.3


def test_recurring_payments_exclude_frequent_merchants():
    s = analyze(_history(), [], "USD", TODAY)
    assert [m.title for m in s.recurring] == ["Rent", "Netflix"]


def test_projection_does_not_extrapolate_one_off_rent():
    s = analyze(_history(), [], "USD", TODAY)
    # Spent so far + Netflix still due + 4 days of usual food spending; not rent x 31/27.
    assert s.month_to_date == Decimal("2060.00")
    assert Decimal("2076") < s.projected_this_month < Decimal("2160")


def test_next_month_prediction_weights_recent_months():
    s = analyze(_history(), [], "USD", TODAY)
    food = next(c for c in s.categories if c.name == "Food & Dining")
    # Weighted (1, 2, 3) average of Jul 440, Aug 480, Sep 520.
    assert food.predicted_next == Decimal("493.33")
    assert s.predicted_next_month == sum(c.predicted_next for c in s.categories)


def test_patterns_and_suggestions():
    budgets = [BudgetLine("Food & Dining", Decimal("250")), BudgetLine(None, Decimal("5000"))]
    s = analyze(_history(), budgets, "USD", TODAY)
    assert any("Housing & Rent is your biggest expense" in p for p in s.patterns)
    assert any("Food & Dining spending rose" in p for p in s.patterns)
    assert [b.at_risk for b in s.budgets] == [True, False]
    assert any("exceed your Food & Dining budget" in x for x in s.suggestions)
    assert any("Cutting Food & Dining by 20%" in x for x in s.suggestions)
    assert any("subscriptions (Netflix)" in x for x in s.suggestions)


def test_empty_history():
    s = analyze([], [], "INR", TODAY)
    assert not s.has_data
    assert s.patterns == s.suggestions == []
    assert s.projected_this_month == s.predicted_next_month == Decimal("0.00")
    assert "no transactions" in overview(s)


def test_retriever_finds_relevant_user_records_and_guides():
    s = analyze(_history(), [BudgetLine("Food & Dining", Decimal("250"))], "USD", TODAY)
    docs = build_retriever(s).invoke("How much do I spend on Swiggy food delivery?")
    kinds = {d.metadata["kind"] for d in docs}
    assert {"merchant", "guide"} <= kinds
    assert any("Swiggy order" in d.page_content for d in docs)
