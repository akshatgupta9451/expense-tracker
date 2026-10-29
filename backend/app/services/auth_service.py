import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.authentication.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    needs_rehash,
    verify_password,
)
from app.config import settings
from app.exceptions import AuthError, ConflictError
from app.models import RefreshToken, User
from app.schemas.auth import RegisterRequest


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


@dataclass
class ClientInfo:
    user_agent: str | None = None
    ip_address: str | None = None


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    email = data.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise ConflictError("An account with this email already exists")

    user = User(email=email, password_hash=hash_password(data.password), name=data.name)
    db.add(user)
    await db.flush()
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        verify_password(password, DUMMY_PASSWORD_HASH)
        raise AuthError("Invalid email or password")
    if not verify_password(password, user.password_hash) or not user.is_active:
        raise AuthError("Invalid email or password")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = datetime.now(UTC)
    return user


async def issue_tokens(
    db: AsyncSession, user: User, client: ClientInfo, family_id: uuid.UUID | None = None
) -> TokenPair:
    raw_refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            family_id=family_id or uuid.uuid4(),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
            user_agent=(client.user_agent or "")[:255] or None,
            ip_address=client.ip_address,
        )
    )
    await db.flush()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=raw_refresh)


async def _revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def rotate_refresh_token(
    db: AsyncSession, raw_token: str | None, client: ClientInfo
) -> tuple[User, TokenPair]:
    """Exchange a refresh token for a new pair. Reusing a revoked token revokes its family."""
    if not raw_token:
        raise AuthError("Missing refresh token")

    stored = await db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .with_for_update()
    )
    if stored is None:
        raise AuthError("Invalid refresh token")

    if stored.revoked_at is not None:
        # Token reuse: someone may have stolen it. Kill every session in this family.
        await _revoke_family(db, stored.family_id)
        await db.commit()
        raise AuthError("Refresh token reuse detected")

    if stored.expires_at <= datetime.now(UTC):
        raise AuthError("Refresh token expired")

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    stored.revoked_at = datetime.now(UTC)
    tokens = await issue_tokens(db, user, client, family_id=stored.family_id)
    return user, tokens


async def logout(db: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    if stored is not None:
        await _revoke_family(db, stored.family_id)


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
