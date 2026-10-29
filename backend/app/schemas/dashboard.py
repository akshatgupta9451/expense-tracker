"""Dashboard responses shaped for charts.

Money is returned as JSON numbers (rounded to 2 dp) so values can go straight into a chart.
Every chart-capable response has a `chart` object in Chart.js format:

    new Chart(ctx, { type: "bar", data: response.chart })
"""

import uuid
from datetime import date

from pydantic import BaseModel


class ChartDataset(BaseModel):
    key: str
    label: str
    data: list[float]
    backgroundColor: str | list[str]  # noqa: N815  (Chart.js property name)
    borderColor: str | list[str] | None = None  # noqa: N815


class ChartData(BaseModel):
    labels: list[str]
    datasets: list[ChartDataset]


# ---------- GET /dashboard/summary ----------


class MonthTotals(BaseModel):
    month: str
    income: float
    expense: float
    net: float
    savings_rate: float | None  # % of income kept; null when there was no income
    income_change_pct: float | None  # vs previous month; null when previous month was 0
    expense_change_pct: float | None
    transaction_count: int


class SummaryResponse(BaseModel):
    currency: str
    as_of: date
    total_income: float
    total_expense: float
    current_balance: float
    transaction_count: int
    this_month: MonthTotals
    chart: ChartData


# ---------- GET /dashboard/monthly ----------


class MonthRow(BaseModel):
    month: str  # "2026-10"
    label: str  # "Oct 2026"
    income: float
    expense: float
    net: float
    transaction_count: int


class MonthAmount(BaseModel):
    month: str
    label: str
    expense: float


class MonthlyStats(BaseModel):
    total_income: float
    total_expense: float
    total_net: float
    average_monthly_expense: float
    highest_expense_month: MonthAmount | None
    lowest_expense_month: MonthAmount | None


class MonthlyResponse(BaseModel):
    currency: str
    start_month: str
    end_month: str
    months: list[MonthRow]
    summary: MonthlyStats
    chart: ChartData


# ---------- GET /dashboard/category ----------


class CategoryRow(BaseModel):
    category_id: uuid.UUID | None  # null for the grouped "Other" row
    name: str
    color: str
    icon: str | None
    total: float
    percentage: float
    transaction_count: int


class CategoryResponse(BaseModel):
    currency: str
    type: str
    start_date: date
    end_date: date
    total: float
    categories: list[CategoryRow]
    chart: ChartData
