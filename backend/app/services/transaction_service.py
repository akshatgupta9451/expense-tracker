import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.models import Category, Transaction, TransactionType, User
from app.schemas.common import Page
from app.schemas.transaction import (
    TransactionCreate,
    TransactionFilters,
    TransactionRead,
    TransactionReplace,
    TransactionUpdate,
)
from app.services.category_service import get_visible_category

SORT_COLUMNS = {
    "transaction_date": Transaction.transaction_date,
    "amount": Transaction.amount,
}


def active_transactions(user_id: uuid.UUID):
    return select(Transaction).where(
        Transaction.user_id == user_id, Transaction.deleted_at.is_(None)
    )


def _apply_filters(stmt, f: TransactionFilters):
    if f.start_date:
        stmt = stmt.where(Transaction.transaction_date >= f.start_date)
    if f.end_date:
        stmt = stmt.where(Transaction.transaction_date <= f.end_date)
    if f.type:
        stmt = stmt.where(Transaction.type == f.type)
    if f.category_id:
        stmt = stmt.where(Transaction.category_id.in_(f.category_id))
    if f.min_amount is not None:
        stmt = stmt.where(Transaction.amount >= f.min_amount)
    if f.max_amount is not None:
        stmt = stmt.where(Transaction.amount <= f.max_amount)
    if f.q:
        escaped = f.q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        stmt = stmt.where(
            or_(
                Transaction.title.ilike(pattern, escape="\\"),
                Transaction.description.ilike(pattern, escape="\\"),
            )
        )
    return stmt


def filtered_transactions(user_id: uuid.UUID, filters: TransactionFilters):
    """The user's transactions matching `filters`, in the requested sort order (no paging).

    Shared by the list endpoint and exports, so an export contains exactly what the list shows.
    """
    descending = filters.sort.value.startswith("-")
    column = SORT_COLUMNS[filters.sort.value.lstrip("-")]
    order = column.desc() if descending else column.asc()
    return _apply_filters(active_transactions(user_id), filters).order_by(
        order, Transaction.created_at.desc()
    )


async def count_transactions(db: AsyncSession, stmt) -> int:
    return await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0


async def list_transactions(
    db: AsyncSession, user: User, filters: TransactionFilters
) -> Page[TransactionRead]:
    stmt = filtered_transactions(user.id, filters)
    total = await count_transactions(db, stmt)
    stmt = stmt.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)
    rows = (await db.scalars(stmt)).unique().all()
    return Page(
        items=[TransactionRead.model_validate(t) for t in rows],
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


async def get_transaction(db: AsyncSession, user: User, transaction_id: uuid.UUID) -> Transaction:
    txn = await db.scalar(active_transactions(user.id).where(Transaction.id == transaction_id))
    if txn is None:
        raise NotFoundError("Transaction not found")
    return txn


async def _resolve_category(
    db: AsyncSession,
    user: User,
    category_id: uuid.UUID,
    declared_type: TransactionType | None,
    current: Transaction | None = None,
) -> Category:
    """The category a transaction will use, which also decides its income/expense type.

    Keeping a transaction's existing category is allowed even if that category was archived
    since; switching *to* an archived category is not.
    """
    if current is not None and current.category_id == category_id:
        category = current.category
    else:
        category = await get_visible_category(db, user, category_id)
        if category.is_archived:
            raise ValidationError("category_id", "Cannot use an archived category")

    if declared_type is not None and declared_type != category.type:
        raise ValidationError(
            "type", f"Category '{category.name}' is for {category.type}, not {declared_type}"
        )
    return category


async def _reload(db: AsyncSession, txn: Transaction) -> Transaction:
    """Flush, then re-read the row so the response shows stored values (e.g. 800 -> 800.00)."""
    await db.flush()
    await db.refresh(txn)
    return txn


async def create_transaction(db: AsyncSession, user: User, data: TransactionCreate) -> Transaction:
    category = await _resolve_category(db, user, data.category_id, data.type)
    txn = Transaction(
        user_id=user.id,
        type=category.type,
        currency=user.currency,
        **data.model_dump(exclude={"type"}),
    )
    db.add(txn)
    return await _reload(db, txn)


async def replace_transaction(
    db: AsyncSession, user: User, transaction_id: uuid.UUID, data: TransactionReplace
) -> Transaction:
    """PUT: overwrite every editable field; optional fields left out become null."""
    txn = await get_transaction(db, user, transaction_id)
    category = await _resolve_category(db, user, data.category_id, data.type, current=txn)
    for field, value in data.model_dump(exclude={"type"}).items():
        setattr(txn, field, value)
    txn.type = category.type
    return await _reload(db, txn)


async def update_transaction(
    db: AsyncSession, user: User, transaction_id: uuid.UUID, data: TransactionUpdate
) -> Transaction:
    """PATCH: change only the fields that were sent."""
    txn = await get_transaction(db, user, transaction_id)
    changes = data.model_dump(exclude_unset=True)
    for required in ("category_id", "title", "amount", "transaction_date"):
        if required in changes and changes[required] is None:
            raise ValidationError(required, "Field cannot be null")

    declared_type = changes.pop("type", None)
    category_id = changes.get("category_id", txn.category_id)
    category = await _resolve_category(db, user, category_id, declared_type, current=txn)

    for field, value in changes.items():
        setattr(txn, field, value)
    txn.type = category.type
    return await _reload(db, txn)


async def delete_transaction(db: AsyncSession, user: User, transaction_id: uuid.UUID) -> None:
    txn = await get_transaction(db, user, transaction_id)
    txn.deleted_at = datetime.now(UTC)


async def bulk_delete(db: AsyncSession, user: User, ids: list[uuid.UUID]) -> int:
    result = await db.execute(
        update(Transaction)
        .where(
            Transaction.user_id == user.id,
            Transaction.id.in_(ids),
            Transaction.deleted_at.is_(None),
        )
        .values(deleted_at=datetime.now(UTC))
    )
    return result.rowcount
