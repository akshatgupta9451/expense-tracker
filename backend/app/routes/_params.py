from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from app.authentication.dependencies import CurrentUser
from app.schemas.budget import MONTH_PATTERN
from app.utils.dates import current_month, parse_month


def month_param(
    user: CurrentUser,
    month: Annotated[str | None, Query(pattern=MONTH_PATTERN, examples=["2026-10"])] = None,
) -> date:
    """`?month=YYYY-MM`, defaulting to the current month in the user's timezone."""
    return parse_month(month) if month else current_month(user.timezone)


Month = Annotated[date, Depends(month_param)]
