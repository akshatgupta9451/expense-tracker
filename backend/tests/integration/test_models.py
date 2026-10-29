"""ORM relationship and cascade behaviour, tested directly against Postgres."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models import Budget, Category, Transaction, TransactionType, User


@pytest.fixture
async def user_with_data(db):
    user = User(name="Ana", email="ana@example.com", password_hash="x")
    food = Category(user=user, name="Food", type=TransactionType.EXPENSE)
    user.transactions.append(
        Transaction(
            category=food,
            title="Groceries",
            amount=Decimal("42.10"),
            type=TransactionType.EXPENSE,
            transaction_date=date(2026, 10, 1),
            currency="USD",
        )
    )
    user.budgets.append(
        Budget(category=food, monthly_limit=Decimal("300"), period_month=date(2026, 10, 1))
    )
    db.add(user)
    await db.commit()
    return user, food


async def _count(db, model):
    return await db.scalar(select(func.count()).select_from(model))


async def test_relationships_are_bidirectional(db, user_with_data):
    user, food = user_with_data
    user_id, food_id = user.id, food.id
    db.expire_all()
    loaded = await db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.transactions),
            selectinload(User.budgets),
            selectinload(User.categories),
        )
    )
    txn = loaded.transactions[0]
    assert txn.user is loaded
    assert txn.category.name == "Food"
    assert loaded.budgets[0].monthly_limit == Decimal("300.00")
    assert loaded.budgets[0].category.id == food_id
    assert [c.name for c in loaded.categories] == ["Food"]


async def test_deleting_user_cascades_everything(db, user_with_data):
    user, _ = user_with_data
    await db.delete(user)
    await db.commit()
    for model in (User, Category, Transaction, Budget):
        assert await _count(db, model) == 0, model


async def test_category_with_transactions_cannot_be_deleted(db, user_with_data):
    _, food = user_with_data
    await db.delete(food)
    with pytest.raises(IntegrityError):
        await db.commit()
    await db.rollback()


async def test_deleting_category_removes_its_budgets_not_converts_them(db):
    user = User(email="b@example.com", password_hash="x")
    rent = Category(user=user, name="Rent", type=TransactionType.EXPENSE)
    db.add_all([user, rent])
    db.add(Budget(user=user, category=rent, monthly_limit=100, period_month=date(2026, 10, 1)))
    await db.commit()

    await db.delete(rent)
    await db.commit()
    # The budget must be deleted, not silently turned into an overall (category_id NULL) budget.
    assert await _count(db, Budget) == 0


async def test_constraints(db, user_with_data):
    user, food = user_with_data
    bad = [
        Transaction(
            user_id=user.id,
            category_id=food.id,
            title="Neg",
            amount=Decimal("-1"),
            type=TransactionType.EXPENSE,
            transaction_date=date(2026, 10, 1),
            currency="USD",
        ),
        Budget(user_id=user.id, monthly_limit=Decimal("0"), period_month=date(2026, 10, 1)),
        Budget(user_id=user.id, monthly_limit=Decimal("5"), period_month=date(2026, 10, 15)),
        Budget(
            user_id=user.id, category_id=food.id, monthly_limit=1, period_month=date(2026, 10, 1)
        ),
    ]
    for obj in bad:
        db.add(obj)
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()
