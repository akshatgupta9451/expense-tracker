import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TransactionType

if TYPE_CHECKING:
    from app.models import Budget, Transaction, User

transaction_type_enum = Enum(
    TransactionType, name="transaction_type", values_callable=lambda e: [m.value for m in e]
)


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """user_id NULL means a system default category visible to every user."""

    __tablename__ = "categories"
    __table_args__ = (
        Index(
            "uq_categories_user_name_type",
            "user_id",
            "name",
            "type",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
        ),
        Index(
            "uq_categories_system_name_type",
            "name",
            "type",
            unique=True,
            postgresql_where=text("user_id IS NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    type: Mapped[TransactionType] = mapped_column(transaction_type_enum, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#64748b", nullable=False)
    icon: Mapped[str | None] = mapped_column(String(40))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User | None"] = relationship(back_populates="categories")
    # passive_deletes="all": the ORM never nulls out transaction.category_id; the database's
    # ON DELETE RESTRICT blocks deleting a category that still has transactions.
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="category", passive_deletes="all"
    )
    # Deleting a category deletes its budgets. Without the delete cascade, the ORM would null
    # category_id on loaded budgets, silently turning them into overall monthly budgets.
    budgets: Mapped[list["Budget"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def is_system(self) -> bool:
        return self.user_id is None
