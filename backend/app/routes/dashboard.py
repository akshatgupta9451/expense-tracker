from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.authentication.dependencies import CurrentUser, DbSession
from app.exceptions import ValidationError
from app.models import TransactionType
from app.routes._params import Month
from app.schemas.budget import MONTH_PATTERN
from app.schemas.dashboard import CategoryResponse, MonthlyResponse, SummaryResponse
from app.services import dashboard_service
from app.utils.dates import current_month, month_bounds, parse_month

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MAX_RANGE_DAYS = 3 * 366
MonthQuery = Annotated[str | None, Query(pattern=MONTH_PATTERN, examples=["2026-10"])]


@router.get("/summary", response_model=SummaryResponse)
async def summary(month: Month, user: CurrentUser, db: DbSession):
    """Total income, total expense and current balance (all transactions up to today),
    plus totals for `month` (default: current month) compared with the month before."""
    return await dashboard_service.summary(db, user, month)


@router.get("/monthly", response_model=MonthlyResponse)
async def monthly(
    user: CurrentUser,
    db: DbSession,
    months: Annotated[int, Query(ge=1, le=36)] = 12,
    end_month: MonthQuery = None,
):
    """Income, expense and net per month for the last `months` months ending at `end_month`
    (default: current month). Months without transactions are included as zeros."""
    end = parse_month(end_month) if end_month else current_month(user.timezone)
    return await dashboard_service.monthly(db, user, end, months)


@router.get("/category", response_model=CategoryResponse)
async def category(
    user: CurrentUser,
    db: DbSession,
    month: MonthQuery = None,
    start_date: date | None = None,
    end_date: date | None = None,
    type: TransactionType = TransactionType.EXPENSE,
    limit: Annotated[int | None, Query(ge=1, le=50)] = None,
):
    """Totals per category for a period: either `month`, or `start_date` + `end_date`
    (default: current month). `limit` keeps the top N and groups the rest as "Other"."""
    if month and (start_date or end_date):
        raise ValidationError("month", "Use either month or start_date/end_date, not both")
    if (start_date is None) != (end_date is None):
        missing = "end_date" if end_date is None else "start_date"
        raise ValidationError(missing, "start_date and end_date must be given together")

    if start_date and end_date:
        if start_date > end_date:
            raise ValidationError("start_date", "start_date must be on or before end_date")
        if (end_date - start_date).days > MAX_RANGE_DAYS:
            raise ValidationError("end_date", "Date range cannot exceed 3 years")
        start, end = start_date, end_date
    else:
        start, end = month_bounds(parse_month(month) if month else current_month(user.timezone))

    return await dashboard_service.by_category(db, user, start, end, type, limit)
