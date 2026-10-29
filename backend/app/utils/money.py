from decimal import ROUND_HALF_UP, Decimal

ZERO = Decimal("0.00")


def quantize(value: Decimal | int | None) -> Decimal:
    return Decimal(value or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def percent_change(current: Decimal, previous: Decimal) -> float | None:
    if not previous:
        return None
    return round(float((current - previous) / previous * 100), 2)


def percent_of(part: Decimal, whole: Decimal) -> float:
    if not whole:
        return 0.0
    return round(float(part / whole * 100), 2)
