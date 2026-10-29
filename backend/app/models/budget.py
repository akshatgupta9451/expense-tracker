import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, SmallInteger, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models import Category, User


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Monthly spending limit. category_id NULL means an overall limit for the month."""

    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("monthly_limit > 0", name="ck_budgets_monthly_limit_positive"),
        CheckConstraint(
            "alert_threshold BETWEEN 1 AND 100", name="ck_budgets_alert_threshold_range"
        ),
        CheckConstraint("EXTRACT(DAY FROM period_month) = 1", name="ck_budgets_period_first_day"),
        Index(
            "uq_budgets_user_category_month",
            "user_id",
            "category_id",
            "period_month",
            unique=True,
            postgresql_where=text("category_id IS NOT NULL"),
        ),
        Index(
            "uq_budgets_user_overall_month",
            "user_id",
            "period_month",
            unique=True,
            postgresql_where=text("category_id IS NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE")
    )
    period_month: Mapped[date] = mapped_column(Date, nullable=False)
    alert_threshold: Mapped[int] = mapped_column(SmallInteger, default=80, nullable=False)

    user: Mapped["User"] = relationship(back_populates="budgets")
    category: Mapped["Category | None"] = relationship(back_populates="budgets", lazy="joined")
