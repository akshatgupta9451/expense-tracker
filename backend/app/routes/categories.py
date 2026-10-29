import uuid

from fastapi import APIRouter, Response, status
from fastapi.responses import JSONResponse

from app.authentication.dependencies import CurrentUser, DbSession
from app.models import TransactionType
from app.schemas.category import (
    CategoryCreate,
    CategoryRead,
    CategorySuggestion,
    CategorySuggestRequest,
    CategoryUpdate,
)
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    user: CurrentUser,
    db: DbSession,
    type: TransactionType | None = None,
    include_archived: bool = False,
):
    return await category_service.list_categories(db, user, type, include_archived)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryCreate, user: CurrentUser, db: DbSession):
    return await category_service.create_category(db, user, data)


@router.post("/suggest", response_model=CategorySuggestion)
async def suggest_category(data: CategorySuggestRequest, _: CurrentUser, db: DbSession):
    """Predict the expense category for a free-text description (TF-IDF + ML classifier)."""
    return await category_service.suggest_category(db, data.text)


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID, data: CategoryUpdate, user: CurrentUser, db: DbSession
):
    return await category_service.update_category(db, user, category_id, data)


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={200: {"description": "Category is in use and was archived instead"}},
)
async def delete_category(category_id: uuid.UUID, user: CurrentUser, db: DbSession):
    deleted = await category_service.delete_category(db, user, category_id)
    if deleted:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return JSONResponse({"message": "Category has transactions and was archived"})
