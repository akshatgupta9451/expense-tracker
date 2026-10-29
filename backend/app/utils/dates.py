from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def parse_month(value: str) -> date:
    """'2026-10' -> date(2026, 10, 1)."""
    year, month = value.split("-")
    return date(int(year), int(month), 1)


def format_month(value: date) -> str:
    return value.strftime("%Y-%m")


def next_month(month_start: date) -> date:
    return (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)


def previous_month(month_start: date) -> date:
    return (month_start - timedelta(days=1)).replace(day=1)


def month_bounds(month_start: date) -> tuple[date, date]:
    """Inclusive first and last day of the month."""
    return month_start, next_month(month_start) - timedelta(days=1)


def current_month(tz: str) -> date:
    return datetime.now(ZoneInfo(tz)).date().replace(day=1)


def today(tz: str) -> date:
    return datetime.now(ZoneInfo(tz)).date()
