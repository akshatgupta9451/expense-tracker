import uuid

from fastapi import APIRouter, status

from app.authentication.dependencies import CurrentUser, DbSession
from app.routes._params import Month
from app.schemas.budget import (
    BudgetCreate,
    BudgetRead,
    BudgetSummary,
    BudgetUpdate,
    CopyBudgetsRequest,
)
from app.services import budget_service

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetRead])
async def list_budgets(month: Month, user: CurrentUser, db: DbSession):
    return await budget_service.list_budgets(db, user, month)


@router.get("/summary", response_model=BudgetSummary)
async def budget_summary(month: Month, user: CurrentUser, db: DbSession):
    """Monthly budget overview: limit, spent, remaining, pacing, and per-category budgets.
    `month` defaults to the current month (user's timezone)."""
    return await budget_service.budget_summary(db, user, month)


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(data: BudgetCreate, user: CurrentUser, db: DbSession):
    return await budget_service.create_budget(db, user, data)


@router.post("/copy")
async def copy_budgets(data: CopyBudgetsRequest, user: CurrentUser, db: DbSession):
    copied = await budget_service.copy_budgets(db, user, data.from_month, data.to_month)
    return {"copied": copied}


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(budget_id: uuid.UUID, data: BudgetUpdate, user: CurrentUser, db: DbSession):
    return await budget_service.update_budget(db, user, budget_id, data)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: uuid.UUID, user: CurrentUser, db: DbSession):
    await budget_service.delete_budget(db, user, budget_id)
