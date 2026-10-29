import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.models.enums import PaymentMethod, TransactionType
from app.schemas.category import CategoryBrief
from app.schemas.common import ORMModel

Amount = Field(gt=0, max_digits=12, decimal_places=2)
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class TransactionCreate(BaseModel):
    category_id: uuid.UUID
    # Optional: the category already decides income vs expense. If sent, it must match.
    type: TransactionType | None = None
    title: Title
    amount: Decimal = Amount
    transaction_date: date
    description: Description | None = None
    payment_method: PaymentMethod | None = None


class TransactionReplace(TransactionCreate):
    """PUT body: the full transaction. Omitted optional fields are cleared."""


class TransactionUpdate(BaseModel):
    """PATCH body: only the fields sent are changed."""

    category_id: uuid.UUID | None = None
    type: TransactionType | None = None
    title: Title | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    transaction_date: date | None = None
    description: Description | None = None
    payment_method: PaymentMethod | None = None


class TransactionRead(ORMModel):
    id: uuid.UUID
    title: str
    type: TransactionType
    amount: Decimal
    currency: str
    transaction_date: date
    description: str | None
    payment_method: PaymentMethod | None
    category: CategoryBrief
    created_at: datetime


class TransactionSort(StrEnum):
    DATE_DESC = "-transaction_date"
    DATE_ASC = "transaction_date"
    AMOUNT_DESC = "-amount"
    AMOUNT_ASC = "amount"


class TransactionFilters(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    type: TransactionType | None = None
    category_id: list[uuid.UUID] | None = None
    min_amount: Decimal | None = Field(default=None, ge=0)
    max_amount: Decimal | None = Field(default=None, ge=0)
    q: str | None = Field(default=None, max_length=100)
    sort: TransactionSort = TransactionSort.DATE_DESC
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @model_validator(mode="after")
    def check_ranges(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        if self.min_amount and self.max_amount and self.min_amount > self.max_amount:
            raise ValueError("min_amount must be less than or equal to max_amount")
        return self


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
