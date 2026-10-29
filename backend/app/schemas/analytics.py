import uuid
from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel


class Granularity(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class CategoryTotal(BaseModel):
    category_id: uuid.UUID
    name: str
    color: str
    total: Decimal
    percentage: float


class TrendPoint(BaseModel):
    period: date
    income: Decimal
    expense: Decimal
    net: Decimal


class CategoryComparison(BaseModel):
    category_id: uuid.UUID
    name: str
    color: str
    current: Decimal
    previous: Decimal
    change_pct: float | None
