import pytest


@pytest.fixture
async def data(auth_client):
    cats = {c["name"]: c["id"] for c in (await auth_client.get("/categories")).json()}

    async def add(name, amount, day):
        r = await auth_client.post(
            "/transactions",
            json={
                "category_id": cats[name],
                "title": name,
                "amount": amount,
                "transaction_date": day,
            },
        )
        assert r.status_code == 201

    # September
    await add("Salary", "4000.00", "2026-09-01")
    await add("Food & Dining", "200.00", "2026-09-10")
    # October
    await add("Salary", "5000.00", "2026-10-01")
    await add("Food & Dining", "150.00", "2026-10-03")
    await add("Food & Dining", "100.00", "2026-10-15")
    await add("Transport", "50.00", "2026-10-20")
    return cats


async def test_budget_progress_and_status(auth_client, data):
    r = await auth_client.post(
        "/budgets",
        json={"category_id": data["Food & Dining"], "monthly_limit": "300", "month": "2026-10"},
    )
    assert r.status_code == 201
    b = r.json()
    assert (b["spent"], b["remaining"], b["percent_used"], b["status"]) == (
        "250.00",
        "50.00",
        83.33,
        "warning",
    )

    overall = (
        await auth_client.post("/budgets", json={"monthly_limit": "250", "month": "2026-10"})
    ).json()
    assert overall["category"] is None
    assert overall["spent"] == "300.00"
    assert overall["status"] == "exceeded"

    dup = await auth_client.post("/budgets", json={"monthly_limit": "999", "month": "2026-10"})
    assert dup.status_code == 409

    income_budget = await auth_client.post(
        "/budgets", json={"category_id": data["Salary"], "monthly_limit": "1", "month": "2026-10"}
    )
    assert income_budget.status_code == 400


async def test_copy_budgets(auth_client, data):
    await auth_client.post(
        "/budgets",
        json={"category_id": data["Transport"], "monthly_limit": "100", "month": "2026-10"},
    )
    await auth_client.post("/budgets", json={"monthly_limit": "1000", "month": "2026-10"})
    r = await auth_client.post(
        "/budgets/copy", json={"from_month": "2026-10", "to_month": "2026-11"}
    )
    assert r.json() == {"copied": 2}
    again = await auth_client.post(
        "/budgets/copy", json={"from_month": "2026-10", "to_month": "2026-11"}
    )
    assert again.json() == {"copied": 0}
    nov = (await auth_client.get("/budgets", params={"month": "2026-11"})).json()
    assert len(nov) == 2 and all(b["spent"] == "0.00" for b in nov)


async def test_trend_and_comparison(auth_client, data):
    trend = (
        await auth_client.get(
            "/analytics/trend",
            params={"start_date": "2026-09-01", "end_date": "2026-10-31", "granularity": "month"},
        )
    ).json()
    assert [(p["period"], p["income"], p["expense"]) for p in trend] == [
        ("2026-09-01", "4000.00", "200.00"),
        ("2026-10-01", "5000.00", "300.00"),
    ]

    cmp_ = (await auth_client.get("/analytics/comparison", params={"month": "2026-10"})).json()
    food = next(c for c in cmp_ if c["name"] == "Food & Dining")
    assert (food["current"], food["previous"], food["change_pct"]) == ("250.00", "200.00", 25.0)
    transport = next(c for c in cmp_ if c["name"] == "Transport")
    assert transport["change_pct"] is None

    breakdown = (
        await auth_client.get(
            "/analytics/category-breakdown",
            params={"start_date": "2026-10-01", "end_date": "2026-10-31", "type": "income"},
        )
    ).json()
    assert breakdown == [
        {
            "category_id": data["Salary"],
            "name": "Salary",
            "color": "#16a34a",
            "total": "5000.00",
            "percentage": 100.0,
        }
    ]

    bad = await auth_client.get(
        "/analytics/trend", params={"start_date": "2020-01-01", "end_date": "2026-10-31"}
    )
    assert bad.status_code == 400
