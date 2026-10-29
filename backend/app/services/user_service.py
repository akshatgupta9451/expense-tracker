from sqlalchemy.ext.asyncio import AsyncSession

from app.authentication.security import hash_password, verify_password
from app.exceptions import ValidationError
from app.models import User
from app.schemas.auth import ChangePasswordRequest
from app.schemas.user import UserUpdate
from app.services.auth_service import revoke_all_sessions


async def update_profile(db: AsyncSession, user: User, data: UserUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    return user


async def change_password(db: AsyncSession, user: User, data: ChangePasswordRequest) -> None:
    if not verify_password(data.current_password, user.password_hash):
        # 422 on the field, not 401: the user *is* authenticated; this is a form input error.
        # (A 401 here would also make clients try a token refresh.)
        raise ValidationError("current_password", "Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    await revoke_all_sessions(db, user.id)


async def delete_account(db: AsyncSession, user: User) -> None:
    await db.delete(user)
