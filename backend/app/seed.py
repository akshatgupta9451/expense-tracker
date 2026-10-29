"""Seed system default categories. Idempotent: run with `python -m app.seed`."""

import asyncio

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Category, TransactionType

EXPENSE = TransactionType.EXPENSE
INCOME = TransactionType.INCOME

DEFAULT_CATEGORIES = [
    ("Food & Dining", EXPENSE, "#f97316", "utensils"),
    ("Groceries", EXPENSE, "#84cc16", "shopping-cart"),
    ("Transport", EXPENSE, "#3b82f6", "car"),
    ("Housing & Rent", EXPENSE, "#8b5cf6", "home"),
    ("Utilities", EXPENSE, "#06b6d4", "bolt"),
    ("Shopping", EXPENSE, "#ec4899", "bag"),
    ("Entertainment", EXPENSE, "#eab308", "film"),
    ("Health", EXPENSE, "#ef4444", "heart"),
    ("Education", EXPENSE, "#14b8a6", "book"),
    ("Travel", EXPENSE, "#0ea5e9", "plane"),
    ("Subscriptions", EXPENSE, "#a855f7", "repeat"),
    ("Other Expense", EXPENSE, "#64748b", "dots"),
    ("Salary", INCOME, "#16a34a", "briefcase"),
    ("Freelance", INCOME, "#22c55e", "laptop"),
    ("Investments", INCOME, "#10b981", "trending-up"),
    ("Gifts", INCOME, "#f43f5e", "gift"),
    ("Other Income", INCOME, "#64748b", "dots"),
]


async def seed_categories() -> int:
    async with SessionLocal() as session:
        existing = {
            (name, type_)
            for name, type_ in await session.execute(
                select(Category.name, Category.type).where(Category.user_id.is_(None))
            )
        }
        added = 0
        for name, type_, color, icon in DEFAULT_CATEGORIES:
            if (name, type_) not in existing:
                session.add(Category(user_id=None, name=name, type=type_, color=color, icon=icon))
                added += 1
        await session.commit()
        return added


if __name__ == "__main__":
    print(f"Seeded {asyncio.run(seed_categories())} default categories")
