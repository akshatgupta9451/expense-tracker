from fastapi import APIRouter, Cookie, Request, Response, status

from app.authentication.cookies import clear_refresh_cookie, set_refresh_cookie
from app.authentication.dependencies import DbSession
from app.config import settings
from app.exceptions import AuthError
from app.rate_limit import check_login_allowed, limiter, record_failed_login
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserRead
from app.services import auth_service
from app.services.auth_service import ClientInfo

router = APIRouter(prefix="/auth", tags=["auth"])


def _client(request: Request) -> ClientInfo:
    return ClientInfo(
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )


def _token_response(response: Response, tokens: auth_service.TokenPair) -> TokenResponse:
    set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(
        access_token=tokens.access_token, expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.register_rate_limit)
async def register(data: RegisterRequest, request: Request, db: DbSession):
    return await auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.login_rate_limit)
async def login(data: LoginRequest, request: Request, response: Response, db: DbSession):
    check_login_allowed(data.email)
    try:
        user = await auth_service.authenticate(db, data.email, data.password)
    except AuthError:
        record_failed_login(data.email)
        raise
    tokens = await auth_service.issue_tokens(db, user, _client(request))
    return _token_response(response, tokens)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
):
    _, tokens = await auth_service.rotate_refresh_token(db, refresh_token, _client(request))
    return _token_response(response, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: DbSession,
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_cookie_name),
):
    await auth_service.logout(db, refresh_token)
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
