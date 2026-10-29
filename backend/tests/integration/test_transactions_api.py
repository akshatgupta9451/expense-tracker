"""Transaction CRUD contract: POST / GET / PUT / PATCH / DELETE, validation and errors."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import login, register_and_login


@pytest.fixture
async def cats(auth_client):
    return {c["name"]: c for c in (await auth_client.get("/categories")).json()}


def _body(cat, **overrides):
    return {
        "category_id": cat["id"],
        "title": "Lunch",
        "amount": "12.50",
        "transaction_date": "2026-10-20",
        "description": "With team",
        "payment_method": "card",
        **overrides,
    }


async def _create(client, cat, **overrides):
    r = await client.post("/transactions", json=_body(cat, **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def _fields(r):
    return {d["field"] for d in r.json()["error"]["details"]}


# ---------- create ----------


async def test_create_income_and_expense(auth_client, cats):
    income = await _create(auth_client, cats["Salary"], title="Salary", type="income")
    expense = await _create(auth_client, cats["Food & Dining"], type="expense")
    implicit = await _create(auth_client, cats["Transport"])  # type omitted → from category
    assert (income["type"], expense["type"], implicit["type"]) == ("income", "expense", "expense")


async def test_create_rejects_type_category_mismatch(auth_client, cats):
    r = await auth_client.post("/transactions", json=_body(cats["Salary"], type="expense"))
    assert r.status_code == 422
    assert r.json()["error"]["details"] == [
        {"field": "type", "message": "Category 'Salary' is for income, not expense"}
    ]


async def test_create_validation_reports_every_bad_field(auth_client, cats):
    r = await auth_client.post(
        "/transactions",
        json={
            "category_id": "not-a-uuid",
            "title": "   ",
            "amount": "abc",
            "transaction_date": "2026-13-45",
            "type": "transfer",
            "payment_method": "bitcoin",
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert _fields(r) == {
        "category_id",
        "title",
        "amount",
        "transaction_date",
        "type",
        "payment_method",
    }


async def test_title_and_description_are_trimmed(auth_client, cats):
    t = await _create(auth_client, cats["Food & Dining"], title="  Pizza  ", description=" hot ")
    assert (t["title"], t["description"]) == ("Pizza", "hot")


async def test_amount_is_returned_as_stored(auth_client, cats):
    t = await _create(auth_client, cats["Food & Dining"], amount="7")
    assert t["amount"] == "7.00"


async def test_create_with_unknown_category(auth_client):
    r = await auth_client.post(
        "/transactions",
        json={
            "category_id": str(uuid.uuid4()),
            "title": "X",
            "amount": "1",
            "transaction_date": "2026-10-01",
        },
    )
    assert r.status_code == 404
    assert r.json()["error"]["message"] == "Category not found"


# ---------- PUT (full replace) ----------


async def test_put_replaces_everything(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    r = await auth_client.put(
        f"/transactions/{txn['id']}",
        json={
            "category_id": cats["Freelance"]["id"],
            "title": "Logo design",
            "amount": "800",
            "transaction_date": "2026-10-22",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == txn["id"]
    assert (body["title"], body["amount"], body["type"]) == ("Logo design", "800.00", "income")
    assert body["category"]["name"] == "Freelance"
    # Optional fields not sent in a PUT are cleared.
    assert body["description"] is None and body["payment_method"] is None
    # Persisted, not just echoed.
    assert (await auth_client.get(f"/transactions/{txn['id']}")).json() == body


async def test_put_requires_full_body(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    r = await auth_client.put(f"/transactions/{txn['id']}", json={"amount": "5"})
    assert r.status_code == 422
    assert _fields(r) == {"category_id", "title", "transaction_date"}


async def test_put_type_mismatch(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    r = await auth_client.put(
        f"/transactions/{txn['id']}", json=_body(cats["Food & Dining"], type="income")
    )
    assert r.status_code == 422 and _fields(r) == {"type"}


async def test_put_keeps_archived_category_but_cannot_switch_to_one(auth_client, cats):
    pets = (await auth_client.post("/categories", json={"name": "Pets", "type": "expense"})).json()
    txn = await _create(auth_client, pets)
    await auth_client.patch(f"/categories/{pets['id']}", json={"is_archived": True})

    keep = await auth_client.put(f"/transactions/{txn['id']}", json=_body(pets, amount="99"))
    assert keep.status_code == 200 and keep.json()["amount"] == "99.00"

    other = await _create(auth_client, cats["Food & Dining"])
    switch = await auth_client.put(f"/transactions/{other['id']}", json=_body(pets))
    assert switch.status_code == 422 and _fields(switch) == {"category_id"}


# ---------- PATCH (partial) ----------


async def test_patch_changes_only_sent_fields(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    r = await auth_client.patch(f"/transactions/{txn['id']}", json={"amount": "15"})
    body = r.json()
    assert body["amount"] == "15.00"
    assert (body["title"], body["description"], body["payment_method"]) == (
        "Lunch",
        "With team",
        "card",
    )


async def test_patch_type_checked_against_current_category(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    r = await auth_client.patch(f"/transactions/{txn['id']}", json={"type": "income"})
    assert r.status_code == 422 and _fields(r) == {"type"}


# ---------- DELETE ----------


async def test_delete_then_gone_everywhere(auth_client, cats):
    txn = await _create(auth_client, cats["Food & Dining"])
    assert (await auth_client.delete(f"/transactions/{txn['id']}")).status_code == 204
    for method in ("get", "put", "patch", "delete"):
        kwargs = {"json": _body(cats["Food & Dining"])} if method in ("put", "patch") else {}
        r = await getattr(auth_client, method)(f"/transactions/{txn['id']}", **kwargs)
        assert r.status_code == 404, method
    assert (await auth_client.get("/transactions")).json()["total"] == 0


# ---------- auth, ownership, error envelope ----------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/transactions"),
        ("post", "/transactions"),
        ("get", f"/transactions/{uuid.uuid4()}"),
        ("put", f"/transactions/{uuid.uuid4()}"),
        ("patch", f"/transactions/{uuid.uuid4()}"),
        ("delete", f"/transactions/{uuid.uuid4()}"),
    ],
)
async def test_every_endpoint_requires_jwt(client, method, path):
    r = await client.request(method.upper(), path, json={})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


async def test_other_users_transaction_is_invisible_to_put(client, seeded):
    await register_and_login(client, email="owner@example.com")
    food = next(c for c in (await client.get("/categories")).json() if c["name"] == "Groceries")
    txn = await _create(client, food)

    await register_and_login(client, email="intruder@example.com")
    r = await client.put(f"/transactions/{txn['id']}", json=_body(food, amount="0.01"))
    assert r.status_code == 404  # 404, not 403: don't reveal that the id exists

    await login(client, email="owner@example.com")
    assert (await client.get(f"/transactions/{txn['id']}")).json()["amount"] == "12.50"


async def test_malformed_id_and_unknown_route_use_error_envelope(auth_client):
    bad_id = await auth_client.get("/transactions/123")
    assert bad_id.status_code == 422 and _fields(bad_id) == {"transaction_id"}

    missing = await auth_client.get("/nope")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"

    wrong_method = await auth_client.post(f"/transactions/{uuid.uuid4()}")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["error"]["code"] == "method_not_allowed"


async def test_unexpected_errors_return_safe_500(auth_client, monkeypatch):
    from app.services import transaction_service

    async def boom(*_, **__):
        raise RuntimeError("db password is hunter2")

    monkeypatch.setattr(transaction_service, "list_transactions", boom)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport, base_url="http://test/api/v1", headers=auth_client.headers
    ) as c:
        r = await c.get("/transactions")
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"
    assert "hunter2" not in r.text
