from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    message: Message
    # Earlier turns of this conversation; the server keeps no chat state.
    history: list[ChatTurn] = Field(default_factory=list, max_length=40)


class MonthInsight(BaseModel):
    month: date
    income: Decimal
    expense: Decimal
    net: Decimal
    savings_rate: float | None


class CategoryInsight(BaseModel):
    name: str
    average: Decimal
    last_month: Decimal
    change_pct: float | None
    predicted_next: Decimal


class BudgetInsight(BaseModel):
    category: str | None
    limit: Decimal
    spent: Decimal
    projected: Decimal
    at_risk: bool


class Insights(BaseModel):
    has_data: bool
    currency: str
    months: list[MonthInsight]
    categories: list[CategoryInsight]
    month_to_date: Decimal
    projected_this_month: Decimal
    predicted_next_month: Decimal
    budgets: list[BudgetInsight]
    patterns: list[str]
    suggestions: list[str]
