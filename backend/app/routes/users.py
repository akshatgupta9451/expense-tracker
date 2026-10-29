from fastapi import APIRouter, Response, status

from app.authentication.cookies import clear_refresh_cookie
from app.authentication.dependencies import CurrentUser, DbSession
from app.schemas.auth import ChangePasswordRequest
from app.schemas.common import Message
from app.schemas.user import UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession):
    return await user_service.update_profile(db, user, data)


@router.post("/me/change-password", response_model=Message)
async def change_password(
    data: ChangePasswordRequest, user: CurrentUser, db: DbSession, response: Response
):
    await user_service.change_password(db, user, data)
    clear_refresh_cookie(response)
    return Message(message="Password changed. Please log in again on all devices.")


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: CurrentUser, db: DbSession, response: Response):
    await user_service.delete_account(db, user)
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
