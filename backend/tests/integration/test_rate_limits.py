import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from app.assistant import chain
from app.main import app
from tests.conftest import register_and_login


def _client_from(ip: str) -> AsyncClient:
    transport = ASGITransport(app=app, client=(ip, 50000))
    return AsyncClient(transport=transport, base_url="http://test/api/v1")


def _assert_rate_limited(r):
    assert r.status_code == 429, r.text
    assert r.json()["error"]["code"] == "rate_limited"
    assert int(r.headers["Retry-After"]) > 0


async def test_login_is_limited_per_ip(client, seeded):
    await client.post("/auth/register", json={"email": "a@example.com", "password": "secret123"})
    for _ in range(10):
        r = await client.post(
            "/auth/login", json={"email": "x@example.com", "password": "nope1234"}
        )
        assert r.status_code == 401
    r = await client.post("/auth/login", json={"email": "a@example.com", "password": "secret123"})
    _assert_rate_limited(r)

    # Another address is unaffected.
    async with _client_from("203.0.113.9") as other:
        r = await other.post(
            "/auth/login", json={"email": "a@example.com", "password": "secret123"}
        )
        assert r.status_code == 200


async def test_failed_logins_lock_the_account_across_ips(client, seeded):
    await client.post("/auth/register", json={"email": "a@example.com", "password": "secret123"})
    for i in range(10):
        async with _client_from(f"198.51.100.{i}") as c:
            r = await c.post("/auth/login", json={"email": "A@example.com", "password": "wrong123"})
            assert r.status_code == 401
    # Even the right password from a fresh address is refused while the account is throttled.
    async with _client_from("198.51.100.200") as c:
        r = await c.post("/auth/login", json={"email": "a@example.com", "password": "secret123"})
    _assert_rate_limited(r)
    assert "this account" in r.json()["error"]["message"]

    # Other accounts can still sign in.
    await client.post("/auth/register", json={"email": "b@example.com", "password": "secret123"})
    async with _client_from("198.51.100.201") as c:
        r = await c.post("/auth/login", json={"email": "b@example.com", "password": "secret123"})
    assert r.status_code == 200


async def test_successful_logins_do_not_count_against_the_account(seeded):
    async with _client_from("192.0.2.1") as c:
        await c.post("/auth/register", json={"email": "a@example.com", "password": "secret123"})
    for i in range(15):
        async with _client_from(f"192.0.2.{i + 10}") as c:
            r = await c.post(
                "/auth/login", json={"email": "a@example.com", "password": "secret123"}
            )
            assert r.status_code == 200


async def test_registration_is_limited_per_ip(client, seeded):
    for i in range(10):
        r = await client.post(
            "/auth/register", json={"email": f"u{i}@example.com", "password": "secret123"}
        )
        assert r.status_code == 201
    r = await client.post(
        "/auth/register", json={"email": "u99@example.com", "password": "secret123"}
    )
    _assert_rate_limited(r)


@pytest.fixture
def fake_llm():
    app.dependency_overrides[chain.get_chat_model] = lambda: GenericFakeChatModel(
        messages=iter([AIMessage("ok")] * 50)
    )
    yield
    app.dependency_overrides.pop(chain.get_chat_model)


async def test_assistant_chat_is_limited_per_user(client, seeded, fake_llm):
    await register_and_login(client)
    for _ in range(10):
        assert (await client.post("/assistant/chat", json={"message": "hi"})).status_code == 200
    _assert_rate_limited(await client.post("/assistant/chat", json={"message": "hi"}))

    # A different user on the same IP has their own allowance.
    async with _client_from("127.0.0.1") as other:
        await register_and_login(other, email="bob@example.com")
        assert (await other.post("/assistant/chat", json={"message": "hi"})).status_code == 200
