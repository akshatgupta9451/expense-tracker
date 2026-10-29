import uuid

from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.ml import categorizer
from app.models import Category, Transaction, TransactionType, User
from app.schemas.category import (
    CategoryBrief,
    CategoryCreate,
    CategoryScore,
    CategorySuggestion,
    CategoryUpdate,
)


def visible_to(user_id: uuid.UUID):
    """Categories a user can use: their own plus the system defaults."""
    return or_(Category.user_id == user_id, Category.user_id.is_(None))


async def list_categories(
    db: AsyncSession, user: User, type_: TransactionType | None, include_archived: bool
) -> list[Category]:
    stmt = select(Category).where(visible_to(user.id))
    if type_:
        stmt = stmt.where(Category.type == type_)
    if not include_archived:
        stmt = stmt.where(Category.is_archived.is_(False))
    stmt = stmt.order_by(Category.type, Category.user_id.is_not(None), Category.name)
    return list(await db.scalars(stmt))


async def get_visible_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> Category:
    category = await db.scalar(
        select(Category).where(Category.id == category_id, visible_to(user.id))
    )
    if category is None:
        raise NotFoundError("Category not found")
    return category


async def _get_owned_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> Category:
    category = await get_visible_category(db, user, category_id)
    if category.is_system:
        raise ForbiddenError("System categories cannot be modified")
    return category


async def _name_taken(
    db: AsyncSession, user: User, name: str, type_: TransactionType, exclude_id=None
) -> bool:
    stmt = select(Category.id).where(
        visible_to(user.id), Category.type == type_, Category.name.ilike(name)
    )
    if exclude_id:
        stmt = stmt.where(Category.id != exclude_id)
    return await db.scalar(stmt) is not None


async def create_category(db: AsyncSession, user: User, data: CategoryCreate) -> Category:
    name = data.name.strip()
    if await _name_taken(db, user, name, data.type):
        raise ConflictError(f"A {data.type} category named '{name}' already exists")

    category = Category(user_id=user.id, **data.model_dump(exclude={"name"}), name=name)
    db.add(category)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise ConflictError("Category already exists") from exc
    return category


async def update_category(
    db: AsyncSession, user: User, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = await _get_owned_category(db, user, category_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        if await _name_taken(db, user, changes["name"], category.type, exclude_id=category.id):
            raise ConflictError(f"A {category.type} category with that name already exists")
    for field, value in changes.items():
        setattr(category, field, value)
    await db.flush()
    return category


async def delete_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> bool:
    """Delete an unused category, or archive it if it has transactions. True if deleted."""
    category = await _get_owned_category(db, user, category_id)
    in_use = await db.scalar(select(exists().where(Transaction.category_id == category.id)))
    if in_use:
        category.is_archived = True
        return False
    await db.delete(category)
    return True


async def suggest_category(db: AsyncSession, text: str) -> CategorySuggestion:
    prediction = categorizer.predict(text)
    category = await db.scalar(
        select(Category).where(
            Category.user_id.is_(None),
            Category.type == TransactionType.EXPENSE,
            Category.name == prediction.category,
        )
    )
    return CategorySuggestion(
        name=prediction.category,
        confidence=prediction.confidence,
        category=CategoryBrief.model_validate(category) if category else None,
        alternatives=[CategoryScore(name=n, confidence=c) for n, c in prediction.alternatives],
    )
