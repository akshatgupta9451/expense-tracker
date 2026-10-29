from datetime import date

from fastapi import APIRouter, Query

from app.authentication.dependencies import CurrentUser, DbSession
from app.exceptions import AppError
from app.models import TransactionType
from app.routes._params import Month
from app.schemas.analytics import (
    CategoryComparison,
    CategoryTotal,
    Granularity,
    TrendPoint,
)
from app.services import analytics_service
from app.utils.dates import current_month, month_bounds, previous_month

router = APIRouter(prefix="/analytics", tags=["analytics"])

MAX_RANGE_DAYS = 3 * 366


def _check_range(start: date, end: date) -> None:
    if start > end:
        raise AppError("start_date must be on or before end_date")
    if (end - start).days > MAX_RANGE_DAYS:
        raise AppError("Date range cannot exceed 3 years")


@router.get("/category-breakdown", response_model=list[CategoryTotal])
async def category_breakdown(
    user: CurrentUser,
    db: DbSession,
    start_date: date,
    end_date: date,
    type: TransactionType = TransactionType.EXPENSE,
):
    _check_range(start_date, end_date)
    return await analytics_service.category_breakdown(db, user, start_date, end_date, type, None)


@router.get("/trend", response_model=list[TrendPoint])
async def trend(
    user: CurrentUser,
    db: DbSession,
    start_date: date,
    end_date: date,
    granularity: Granularity = Granularity.MONTH,
):
    _check_range(start_date, end_date)
    return await analytics_service.trend(db, user, start_date, end_date, granularity)


@router.get("/income-vs-expense", response_model=list[TrendPoint])
async def income_vs_expense(
    user: CurrentUser, db: DbSession, months: int = Query(default=12, ge=1, le=36)
):
    end_month = current_month(user.timezone)
    start_month = end_month
    for _ in range(months - 1):
        start_month = previous_month(start_month)
    _, end = month_bounds(end_month)
    return await analytics_service.trend(db, user, start_month, end, Granularity.MONTH)


@router.get("/comparison", response_model=list[CategoryComparison])
async def comparison(month: Month, user: CurrentUser, db: DbSession):
    return await analytics_service.compare_with_previous(db, user, month)
