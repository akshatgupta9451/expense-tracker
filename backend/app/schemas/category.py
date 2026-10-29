import uuid

from pydantic import BaseModel, Field

from app.models.enums import TransactionType
from app.schemas.common import ORMModel

HEX_COLOR = r"^#[0-9a-fA-F]{6}$"


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    type: TransactionType
    color: str = Field(default="#64748b", pattern=HEX_COLOR)
    icon: str | None = Field(default=None, max_length=40)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None, pattern=HEX_COLOR)
    icon: str | None = Field(default=None, max_length=40)
    is_archived: bool | None = None


class CategoryRead(ORMModel):
    id: uuid.UUID
    name: str
    type: TransactionType
    color: str
    icon: str | None
    is_archived: bool
    is_system: bool


class CategoryBrief(ORMModel):
    id: uuid.UUID
    name: str
    color: str
    icon: str | None


class CategorySuggestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500, examples=["Bought burger from McDonald's"])


class CategoryScore(BaseModel):
    name: str
    confidence: float


class CategorySuggestion(BaseModel):
    name: str
    confidence: float
    # The matching system category, if seeded; use its id to prefill a transaction.
    category: CategoryBrief | None
    alternatives: list[CategoryScore]
