from tests.conftest import register_and_login


async def _category_id(client, name):
    cats = (await client.get("/categories")).json()
    return next(c["id"] for c in cats if c["name"] == name)


async def test_lists_system_categories(auth_client):
    cats = (await auth_client.get("/categories", params={"type": "income"})).json()
    assert {c["name"] for c in cats} >= {"Salary", "Freelance"}
    assert all(c["is_system"] for c in cats)


async def test_custom_category_crud_and_name_conflicts(auth_client):
    r = await auth_client.post("/categories", json={"name": "Pets", "type": "expense"})
    assert r.status_code == 201
    pet_id = r.json()["id"]

    dup = await auth_client.post("/categories", json={"name": "pets", "type": "expense"})
    assert dup.status_code == 409
    clash = await auth_client.post("/categories", json={"name": "Groceries", "type": "expense"})
    assert clash.status_code == 409

    r = await auth_client.patch(f"/categories/{pet_id}", json={"color": "#123456"})
    assert r.json()["color"] == "#123456"
    assert (await auth_client.delete(f"/categories/{pet_id}")).status_code == 204


async def test_system_category_is_read_only(auth_client):
    salary = await _category_id(auth_client, "Salary")
    assert (await auth_client.patch(f"/categories/{salary}", json={"name": "X"})).status_code == 403
    assert (await auth_client.delete(f"/categories/{salary}")).status_code == 403


async def test_category_in_use_is_archived_not_deleted(auth_client):
    cat = (await auth_client.post("/categories", json={"name": "Pets", "type": "expense"})).json()
    await auth_client.post(
        "/transactions",
        json={
            "category_id": cat["id"],
            "title": "Test",
            "amount": "10",
            "transaction_date": "2026-10-01",
        },
    )
    r = await auth_client.delete(f"/categories/{cat['id']}")
    assert r.status_code == 200
    archived = (await auth_client.get("/categories", params={"include_archived": True})).json()
    assert next(c for c in archived if c["id"] == cat["id"])["is_archived"] is True

    blocked = await auth_client.post(
        "/transactions",
        json={
            "category_id": cat["id"],
            "title": "Test",
            "amount": "5",
            "transaction_date": "2026-10-02",
        },
    )
    assert blocked.status_code == 422


async def test_transaction_type_follows_category(auth_client):
    salary = await _category_id(auth_client, "Salary")
    r = await auth_client.post(
        "/transactions",
        json={
            "category_id": salary,
            "title": "Test",
            "amount": "5000.50",
            "transaction_date": "2026-10-01",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "income"
    assert body["title"] == "Test"
    assert body["amount"] == "5000.50"
    assert body["currency"] == "USD"
    assert body["category"]["name"] == "Salary"


async def test_title_is_required(auth_client):
    food = await _category_id(auth_client, "Food & Dining")
    for payload in ({}, {"title": ""}):
        r = await auth_client.post(
            "/transactions",
            json={"category_id": food, "amount": "5", "transaction_date": "2026-10-01", **payload},
        )
        assert r.status_code == 422, payload


async def test_invalid_amounts_rejected(auth_client):
    food = await _category_id(auth_client, "Food & Dining")
    for amount in ("0", "-5", "1.234"):
        r = await auth_client.post(
            "/transactions",
            json={
                "category_id": food,
                "title": "Test",
                "amount": amount,
                "transaction_date": "2026-10-01",
            },
        )
        assert r.status_code == 422, amount


async def test_list_filters_sort_and_pagination(auth_client):
    food = await _category_id(auth_client, "Food & Dining")
    salary = await _category_id(auth_client, "Salary")
    for day, amount, cat, desc in [
        ("2026-10-01", "12.00", food, "Coffee beans"),
        ("2026-10-05", "40.00", food, "Dinner 50% off"),
        ("2026-10-10", "3000.00", salary, "October salary"),
        ("2026-09-20", "25.00", food, "Old lunch"),
    ]:
        await auth_client.post(
            "/transactions",
            json={
                "category_id": cat,
                "title": desc,
                "amount": amount,
                "transaction_date": day,
                "description": f"Note for {desc.lower()}",
            },
        )

    r = await auth_client.get(
        "/transactions", params={"start_date": "2026-10-01", "end_date": "2026-10-31"}
    )
    page = r.json()
    assert page["total"] == 3
    assert [t["transaction_date"] for t in page["items"]] == [
        "2026-10-10",
        "2026-10-05",
        "2026-10-01",
    ]

    expenses = (
        await auth_client.get("/transactions", params={"type": "expense", "sort": "amount"})
    ).json()
    assert [t["amount"] for t in expenses["items"]] == ["12.00", "25.00", "40.00"]

    assert (await auth_client.get("/transactions", params={"q": "coffee"})).json()["total"] == 1
    assert (await auth_client.get("/transactions", params={"q": "note for old"})).json()[
        "total"
    ] == 1
    # '%' in the search term is literal, not a wildcard
    assert (await auth_client.get("/transactions", params={"q": "50%"})).json()["total"] == 1

    paged = (await auth_client.get("/transactions", params={"page": 2, "page_size": 3})).json()
    assert paged["total"] == 4 and len(paged["items"]) == 1

    bad = await auth_client.get(
        "/transactions", params={"start_date": "2026-10-31", "end_date": "2026-10-01"}
    )
    assert bad.status_code == 422


async def test_update_and_soft_delete(auth_client):
    food = await _category_id(auth_client, "Food & Dining")
    salary = await _category_id(auth_client, "Salary")
    txn = (
        await auth_client.post(
            "/transactions",
            json={
                "category_id": food,
                "title": "Test",
                "amount": "20",
                "transaction_date": "2026-10-01",
            },
        )
    ).json()

    r = await auth_client.patch(f"/transactions/{txn['id']}", json={"category_id": salary})
    assert r.json()["type"] == "income"
    assert (
        await auth_client.patch(f"/transactions/{txn['id']}", json={"amount": None})
    ).status_code == 422

    assert (await auth_client.delete(f"/transactions/{txn['id']}")).status_code == 204
    assert (await auth_client.get(f"/transactions/{txn['id']}")).status_code == 404
    assert (await auth_client.get("/transactions")).json()["total"] == 0


async def test_users_cannot_see_each_others_data(client, seeded):
    await register_and_login(client, email="alice@example.com")
    cat = (await client.post("/categories", json={"name": "Private", "type": "expense"})).json()
    txn = (
        await client.post(
            "/transactions",
            json={
                "category_id": cat["id"],
                "title": "Test",
                "amount": "9.99",
                "transaction_date": "2026-10-01",
            },
        )
    ).json()

    await register_and_login(client, email="mallory@example.com")
    assert (await client.get(f"/transactions/{txn['id']}")).status_code == 404
    assert (await client.delete(f"/transactions/{txn['id']}")).status_code == 404
    assert (await client.get("/transactions")).json()["total"] == 0
    assert cat["id"] not in {c["id"] for c in (await client.get("/categories")).json()}
    stolen = await client.post(
        "/transactions",
        json={
            "category_id": cat["id"],
            "title": "Test",
            "amount": "1",
            "transaction_date": "2026-10-01",
        },
    )
    assert stolen.status_code == 404
    bulk = await client.post("/transactions/bulk-delete", json={"ids": [txn["id"]]})
    assert bulk.json() == {"deleted": 0}
