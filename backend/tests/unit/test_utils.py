from datetime import date
from decimal import Decimal

from app.utils.dates import month_bounds, next_month, parse_month, previous_month
from app.utils.money import percent_change, percent_of, quantize


def test_month_helpers():
    assert parse_month("2026-02") == date(2026, 2, 1)
    assert month_bounds(date(2028, 2, 1)) == (date(2028, 2, 1), date(2028, 2, 29))
    assert next_month(date(2026, 12, 1)) == date(2027, 1, 1)
    assert previous_month(date(2026, 1, 1)) == date(2025, 12, 1)


def test_money_helpers():
    assert quantize(Decimal("1.005")) == Decimal("1.01")
    assert quantize(None) == Decimal("0.00")
    assert percent_change(Decimal(150), Decimal(100)) == 50.0
    assert percent_change(Decimal(5), Decimal(0)) is None
    assert percent_of(Decimal(1), Decimal(3)) == 33.33
