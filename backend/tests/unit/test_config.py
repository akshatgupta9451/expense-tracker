import pytest
from pydantic import ValidationError

from app.authentication.dependencies import DbSession
from app.config import Settings

STRONG = "Zr3q8yJx0pVt-6mWnL2cQe9bHk4sUa7dGf1iOy5rTw"


def make(**overrides) -> Settings:
    return Settings(_env_file=None, **{"jwt_secret_key": STRONG, **overrides})


def test_valid_settings():
    s = make(environment="production")
    assert s.is_production
    assert s.rate_limit_storage_uri == "memory://"
    assert make(redis_url="redis://redis:6379/0").rate_limit_storage_uri == "redis://redis:6379/0"


@pytest.mark.parametrize("env", ["prod", "Production", "staging", ""])
def test_unknown_environment_fails_at_startup(env):
    with pytest.raises(ValidationError, match="environment"):
        make(environment=env)


@pytest.mark.parametrize(
    "secret",
    [
        "change-me-to-a-long-random-string",
        'replace-with-output-of: python -c "import secrets; print(secrets.token_urlsafe(64))"',
        "too-short-secret",
    ],
)
def test_weak_or_example_jwt_secret_rejected(secret):
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        make(jwt_secret_key=secret)


def test_placeholder_looking_secret_allowed_in_dev_but_not_production():
    dev_secret = "local-dev-secret-change-me-0123456789abcdef"
    assert make(jwt_secret_key=dev_secret).jwt_secret_key == dev_secret
    with pytest.raises(ValidationError, match="placeholder"):
        make(jwt_secret_key=dev_secret, environment="production")


def test_jwt_algorithm_allowlist():
    with pytest.raises(ValidationError):
        make(jwt_algorithm="none")


def test_db_session_commits_before_the_response_is_sent():
    # FastAPI's default scope ("request") runs get_db's commit after the response is sent.
    assert DbSession.__metadata__[0].scope == "function"
