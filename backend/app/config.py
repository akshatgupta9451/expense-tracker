from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Values shipped in the .env.example files; a real deployment must never run with them.
EXAMPLE_SECRETS = {
    "change-me-to-a-long-random-string",
    'replace-with-output-of: python -c "import secrets; print(secrets.token_urlsafe(64))"',
}
# Words that mark a secret as a placeholder. Rejected in production only, so local dev
# secrets like "local-dev-secret-change-me-..." keep working.
PLACEHOLDER_MARKERS = ("change-me", "changeme", "replace-with", "example", "secret-key")
MIN_SECRET_LENGTH = 32
GENERATE_HINT = 'generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_name: str = "Expense Tracker API"
    # A typo such as "prod" fails at startup instead of silently running with dev settings
    # (API docs exposed, refresh cookie without the Secure flag).
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://expense:expense@localhost:5432/expense_tracker"
    db_echo: bool = False

    jwt_secret_key: str
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    refresh_cookie_name: str = "refresh_token"

    # Rate limits (limits-library syntax). Counters live in Redis when REDIS_URL is set, so
    # they hold across workers; otherwise in process memory.
    redis_url: str | None = None
    rate_limit_enabled: bool = True
    login_rate_limit: str = "10/minute"  # per client IP
    login_failures_per_email: str = "10/15minutes"  # failed attempts per account, any IP
    register_rate_limit: str = "10/hour"  # per client IP
    assistant_rate_limit: str = "10/minute;100/day"  # per user; each message is a paid API call

    # AI financial assistant. Without an API key the /assistant/chat endpoint returns 503.
    anthropic_api_key: str | None = None
    assistant_model: str = "claude-opus-5-5"

    # Comma-separated in env, e.g. CORS_ORIGINS=http://localhost:5173,https://app.example.com
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def check_jwt_secret(self) -> Self:
        secret = self.jwt_secret_key.strip()
        if secret in EXAMPLE_SECRETS:
            raise ValueError(f"JWT_SECRET_KEY is still the example value; {GENERATE_HINT}")
        if len(secret) < MIN_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET_KEY must be at least {MIN_SECRET_LENGTH} characters; {GENERATE_HINT}"
            )
        if self.is_production and any(m in secret.lower() for m in PLACEHOLDER_MARKERS):
            raise ValueError(f"JWT_SECRET_KEY looks like a placeholder; {GENERATE_HINT}")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def rate_limit_storage_uri(self) -> str:
        return self.redis_url or "memory://"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
