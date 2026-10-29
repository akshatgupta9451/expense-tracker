from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.authentication.security import decode_access_token
from app.database import get_db
from app.exceptions import AuthError
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)

# scope="function": commit when the endpoint returns, before the response is sent. FastAPI's
# default ("request") runs this teardown after the response, so clients could get a 2xx for a
# write that is not committed yet, or that then fails to commit.
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise AuthError("Not authenticated")

    user_id = decode_access_token(credentials.credentials)
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
