import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.authentication.dependencies import CurrentUser, DbSession
from app.schemas.common import Page
from app.schemas.transaction import (
    BulkDeleteRequest,
    TransactionCreate,
    TransactionFilters,
    TransactionRead,
    TransactionReplace,
    TransactionUpdate,
)
from app.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Documented on every route; all of them require a valid access token.
ERRORS = {401: {"description": "Missing, invalid or expired access token"}}
NOT_FOUND = {404: {"description": "Transaction does not exist or belongs to another user"}}
INVALID = {422: {"description": "Invalid body, or type/category mismatch, or archived category"}}


@router.get("", response_model=Page[TransactionRead], responses=ERRORS)
async def list_transactions(
    user: CurrentUser, db: DbSession, filters: Annotated[TransactionFilters, Query()]
):
    """List the current user's transactions, newest first, with filters and pagination."""
    return await transaction_service.list_transactions(db, user, filters)


@router.post(
    "",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
    responses={**ERRORS, 404: {"description": "Category not found"}, **INVALID},
)
async def create_transaction(data: TransactionCreate, user: CurrentUser, db: DbSession):
    """Create an income or expense. The category decides the type; `type` is optional."""
    return await transaction_service.create_transaction(db, user, data)


@router.post("/bulk-delete", responses=ERRORS)
async def bulk_delete(data: BulkDeleteRequest, user: CurrentUser, db: DbSession):
    return {"deleted": await transaction_service.bulk_delete(db, user, data.ids)}


@router.get("/{transaction_id}", response_model=TransactionRead, responses={**ERRORS, **NOT_FOUND})
async def get_transaction(transaction_id: uuid.UUID, user: CurrentUser, db: DbSession):
    return await transaction_service.get_transaction(db, user, transaction_id)


@router.put(
    "/{transaction_id}",
    response_model=TransactionRead,
    responses={**ERRORS, **NOT_FOUND, **INVALID},
)
async def replace_transaction(
    transaction_id: uuid.UUID, data: TransactionReplace, user: CurrentUser, db: DbSession
):
    """Replace the whole transaction. Optional fields left out are cleared."""
    return await transaction_service.replace_transaction(db, user, transaction_id, data)


@router.patch(
    "/{transaction_id}",
    response_model=TransactionRead,
    responses={**ERRORS, **NOT_FOUND, **INVALID},
)
async def update_transaction(
    transaction_id: uuid.UUID, data: TransactionUpdate, user: CurrentUser, db: DbSession
):
    """Change only the fields sent."""
    return await transaction_service.update_transaction(db, user, transaction_id, data)


@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ERRORS, **NOT_FOUND},
)
async def delete_transaction(transaction_id: uuid.UUID, user: CurrentUser, db: DbSession):
    await transaction_service.delete_transaction(db, user, transaction_id)
