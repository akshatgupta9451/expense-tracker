"""Request rate limiting (slowapi / limits).

- Per client IP on login and registration (route decorators).
- Per account on failed logins, so guessing a password from many IPs is still throttled.
- Per user on the AI assistant chat, since every message is a paid LLM call.
"""

import math
import time

import jwt
from fastapi import Request
from limits import parse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.authentication.security import decode_access_token
from app.config import settings
from app.exceptions import TooManyRequestsError, app_error_response

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
    # If Redis is unreachable, keep limiting in memory instead of failing every request.
    in_memory_fallback_enabled=True,
    # Read no RATELIMIT_* keys from .env; settings.py is the single source of configuration.
    config_filename="/dev/null",
)


def user_or_ip(request: Request) -> str:
    """Key for authenticated endpoints. Auth has already run when the limit is checked."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            return f"user:{decode_access_token(auth[7:])}"
        except (jwt.PyJWTError, ValueError):
            pass
    return f"ip:{get_remote_address(request)}"


_failed_login = parse(settings.login_failures_per_email)


def _email_key(email: str) -> tuple[str, str]:
    return "login-failures", email.strip().lower()


def check_login_allowed(email: str) -> None:
    """Refuse further attempts on an account that has had too many recent failures."""
    if not settings.rate_limit_enabled:
        return
    if not limiter.limiter.test(_failed_login, *_email_key(email)):
        reset_at, _ = limiter.limiter.get_window_stats(_failed_login, *_email_key(email))
        raise TooManyRequestsError(
            "Too many failed sign-in attempts for this account. Try again later.",
            retry_after=max(1, math.ceil(reset_at - time.time())),
        )


def record_failed_login(email: str) -> None:
    if settings.rate_limit_enabled:
        limiter.limiter.hit(_failed_login, *_email_key(email))


def rate_limit_exceeded(request: Request, exc: RateLimitExceeded):
    """Exception handler: slowapi's 429 in the app's standard error envelope."""
    limit, key = request.state.view_rate_limit
    reset_at, _ = limiter.limiter.get_window_stats(limit, *key)
    return app_error_response(
        TooManyRequestsError(
            "Too many requests. Please slow down and try again shortly.",
            retry_after=max(1, math.ceil(reset_at - time.time())),
        )
    )
