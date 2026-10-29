import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")

from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEFAULT_CATEGORIES  # noqa: E402

# Tests run against "<db>_test" so they never touch development data.
_dev_url = make_url(settings.database_url)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _dev_url.set(
    database=f"{_dev_url.database}_test"
).render_as_string(hide_password=False)

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def _ensure_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin = create_async_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    await admin.dispose()


@pytest.fixture(scope="session", autouse=True)
async def _schema():
    await _ensure_database()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app.rate_limit import limiter

    limiter.reset()


@pytest.fixture(autouse=True)
async def _clean_tables(_schema):
    yield
    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    async with TestSession() as session:
        yield session


async def _override_get_db() -> AsyncIterator[AsyncSession]:
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
async def seeded(db):
    from app.models import Category

    for name, type_, color, icon in DEFAULT_CATEGORIES:
        db.add(Category(user_id=None, name=name, type=type_, color=color, icon=icon))
    await db.commit()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        yield c


async def register_and_login(client: AsyncClient, email="alice@example.com", password="secret123"):
    r = await client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return await login(client, email, password)


async def login(client: AsyncClient, email="alice@example.com", password="secret123"):
    r = await client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return r


@pytest.fixture
async def auth_client(client, seeded) -> AsyncClient:
    await register_and_login(client)
    return client
