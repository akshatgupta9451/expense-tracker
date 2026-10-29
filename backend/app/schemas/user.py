import uuid
from datetime import datetime
from zoneinfo import available_timezones

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import ORMModel


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    currency: str
    timezone: str
    is_verified: bool
    created_at: datetime


class UserUpdate(ORMModel):
    name: str | None = Field(default=None, max_length=120)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, v: str | None) -> str | None:
        if v is not None and v not in available_timezones():
            raise ValueError("Unknown timezone")
        return v
