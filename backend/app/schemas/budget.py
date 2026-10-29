import uuid
from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.category import CategoryBrief
from app.schemas.common import ORMModel

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class BudgetCreate(BaseModel):
    category_id: uuid.UUID | None = None  # None = overall monthly budget
    monthly_limit: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    month: str = Field(pattern=MONTH_PATTERN, examples=["2026-10"])
    alert_threshold: int = Field(default=80, ge=1, le=100)


class BudgetUpdate(BaseModel):
    monthly_limit: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    alert_threshold: int | None = Field(default=None, ge=1, le=100)


class BudgetStatus(StrEnum):
    ON_TRACK = "on_track"
    WARNING = "warning"
    EXCEEDED = "exceeded"


class BudgetRead(ORMModel):
    id: uuid.UUID
    category: CategoryBrief | None
    monthly_limit: Decimal
    period_month: date
    alert_threshold: int
    spent: Decimal
    remaining: Decimal
    percent_used: float
    status: BudgetStatus


class CopyBudgetsRequest(BaseModel):
    from_month: str = Field(pattern=MONTH_PATTERN)
    to_month: str = Field(pattern=MONTH_PATTERN)


class BudgetSummary(BaseModel):
    """Everything the budgets page needs for one month, in one response."""

    month: str
    currency: str
    overall: BudgetRead | None  # the "monthly budget"; null until the user sets one
    categories: list[BudgetRead]  # per-category limits, highest % used first
    total_spent: Decimal  # all expenses in the month
    unbudgeted_spent: Decimal  # expenses in categories without their own budget
    category_limits_total: Decimal
    days_in_month: int
    days_elapsed: int  # 0 for future months, days_in_month for past months
    days_left: int  # includes today
    daily_allowance: Decimal | None  # remaining overall budget / days left (current month)
    projected_spend: Decimal | None  # spend-rate projection to month end (current month)
    previous_month_has_budgets: bool  # offer "copy last month's budgets"
