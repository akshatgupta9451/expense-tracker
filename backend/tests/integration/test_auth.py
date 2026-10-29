from tests.conftest import register_and_login


async def test_register_login_and_me(client):
    await register_and_login(client, email="Bob@Example.com")
    r = await client.get("/users/me")
    assert r.status_code == 200
    assert r.json()["email"] == "bob@example.com"


async def test_register_duplicate_email_conflicts(client):
    await register_and_login(client)
    r = await client.post(
        "/auth/register", json={"email": "ALICE@example.com", "password": "secret123"}
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


async def test_weak_password_rejected(client):
    r = await client.post("/auth/register", json={"email": "x@example.com", "password": "abcdefgh"})
    assert r.status_code == 422


async def test_wrong_password_and_unknown_email_look_identical(client):
    await register_and_login(client)
    wrong = await client.post(
        "/auth/login", json={"email": "alice@example.com", "password": "nope12345"}
    )
    unknown = await client.post(
        "/auth/login", json={"email": "ghost@example.com", "password": "nope12345"}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


async def test_protected_route_requires_token(client):
    assert (await client.get("/users/me")).status_code == 401
    client.headers["Authorization"] = "Bearer not-a-jwt"
    assert (await client.get("/users/me")).status_code == 401


async def test_refresh_rotates_token(client):
    login = await register_and_login(client)
    old_cookie = login.cookies["refresh_token"]

    r = await client.post("/auth/refresh")
    assert r.status_code == 200
    assert r.cookies["refresh_token"] != old_cookie
    assert r.json()["access_token"]


async def test_refresh_token_reuse_revokes_family(client):
    login = await register_and_login(client)
    stolen = login.cookies["refresh_token"]

    assert (await client.post("/auth/refresh")).status_code == 200  # legit rotation
    client.cookies.clear()

    client.cookies.set("refresh_token", stolen)
    reuse = await client.post("/auth/refresh")
    assert reuse.status_code == 401

    # The legitimately rotated token is now revoked too.
    client.cookies.clear()
    latest = await client.post("/auth/refresh")
    assert latest.status_code == 401


async def test_logout_revokes_refresh_token(client):
    login = await register_and_login(client)
    token = login.cookies["refresh_token"]
    assert (await client.post("/auth/logout")).status_code == 204
    client.cookies.clear()
    client.cookies.set("refresh_token", token)
    r = await client.post("/auth/refresh")
    assert r.status_code == 401


async def test_change_password_wrong_current(client):
    await register_and_login(client)
    r = await client.post(
        "/users/me/change-password",
        json={"current_password": "wrong1234", "new_password": "newpass456"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["details"] == [
        {"field": "current_password", "message": "Current password is incorrect"}
    ]


async def test_change_password(client):
    await register_and_login(client)
    r = await client.post(
        "/users/me/change-password",
        json={"current_password": "secret123", "new_password": "newpass456"},
    )
    assert r.status_code == 200
    ok = await client.post(
        "/auth/login", json={"email": "alice@example.com", "password": "newpass456"}
    )
    assert ok.status_code == 200


async def test_expired_and_forged_tokens_rejected(client):
    from datetime import UTC, datetime, timedelta

    import jwt

    from app.config import settings

    await register_and_login(client)
    me = (await client.get("/users/me")).json()
    now = datetime.now(UTC)
    claims = {"sub": me["id"], "type": "access", "iat": now}

    expired = jwt.encode({**claims, "exp": now - timedelta(seconds=1)}, settings.jwt_secret_key)
    forged = jwt.encode(
        {**claims, "exp": now + timedelta(minutes=5)}, "attacker-secret-0123456789abcdef"
    )
    wrong_type = jwt.encode(
        {**claims, "type": "refresh", "exp": now + timedelta(minutes=5)}, settings.jwt_secret_key
    )
    unsigned = jwt.encode({**claims, "exp": now + timedelta(minutes=5)}, None, algorithm="none")

    for token, message in [
        (expired, "Access token expired"),
        (forged, "Invalid access token"),
        (wrong_type, "Invalid token type"),
        (unsigned, "Invalid access token"),
    ]:
        r = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401, message
        assert r.json()["error"]["message"] == message
