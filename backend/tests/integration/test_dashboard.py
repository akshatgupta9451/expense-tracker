from datetime import date, timedelta

import pytest

from tests.conftest import login, register_and_login


@pytest.fixture
async def cats(auth_client):
    return {c["name"]: c["id"] for c in (await auth_client.get("/categories")).json()}


@pytest.fixture
async def add(auth_client, cats):
    async def _add(category, amount, day):
        r = await auth_client.post(
            "/transactions",
            json={
                "category_id": cats[category],
                "title": category,
                "amount": amount,
                "transaction_date": str(day),
            },
        )
        assert r.status_code == 201, r.text
        return r.json()

    return _add


@pytest.fixture
async def history(add):
    # Aug: nothing.  Sep: 4000 in / 200 out.  Oct: 5000 in / 300 out over 2 categories.
    await add("Salary", "4000", "2026-09-01")
    await add("Food & Dining", "200", "2026-09-10")
    await add("Salary", "5000", "2026-10-01")
    await add("Food & Dining", "150", "2026-10-03")
    await add("Food & Dining", "100", "2026-10-15")
    await add("Transport", "50", "2026-10-20")


# ---------- /dashboard/summary ----------


async def test_summary_totals_balance_and_month(auth_client, history):
    r = await auth_client.get("/dashboard/summary", params={"month": "2026-10"})
    assert r.status_code == 200
    d = r.json()
    assert (d["total_income"], d["total_expense"], d["current_balance"]) == (9000, 500, 8500)
    assert d["transaction_count"] == 6
    assert d["currency"] == "USD"
    assert d["this_month"] == {
        "month": "2026-10",
        "income": 5000,
        "expense": 300,
        "net": 4700,
        "savings_rate": 94.0,
        "income_change_pct": 25.0,
        "expense_change_pct": 50.0,
        "transaction_count": 4,
    }
    assert d["chart"]["labels"] == ["Income", "Expense"]
    assert d["chart"]["datasets"][0]["data"] == [9000, 500]


async def test_summary_amounts_are_json_numbers(auth_client, add):
    await add("Salary", "1000.10", "2026-10-01")
    await add("Food & Dining", "0.20", "2026-10-02")
    d = (await auth_client.get("/dashboard/summary")).json()
    assert isinstance(d["current_balance"], float)
    assert d["current_balance"] == 999.9  # exact decimal math, then rounded


async def test_balance_ignores_future_dated_transactions(auth_client, add):
    await add("Salary", "1000", date.today() - timedelta(days=1))
    await add("Housing & Rent", "800", date.today() + timedelta(days=400))
    d = (await auth_client.get("/dashboard/summary")).json()
    assert d["current_balance"] == 1000
    assert d["total_expense"] == 0


async def test_summary_empty_account(auth_client):
    d = (await auth_client.get("/dashboard/summary", params={"month": "2026-10"})).json()
    assert d["current_balance"] == 0
    m = d["this_month"]
    assert (m["savings_rate"], m["income_change_pct"], m["expense_change_pct"]) == (
        None,
        None,
        None,
    )


async def test_summary_excludes_deleted(auth_client, add):
    txn = await add("Food & Dining", "40", "2026-10-01")
    await auth_client.delete(f"/transactions/{txn['id']}")
    d = (await auth_client.get("/dashboard/summary")).json()
    assert d["total_expense"] == 0


# ---------- /dashboard/monthly ----------


async def test_monthly_zero_fills_and_is_chart_ready(auth_client, history):
    r = await auth_client.get("/dashboard/monthly", params={"months": 3, "end_month": "2026-10"})
    assert r.status_code == 200
    d = r.json()
    assert (d["start_month"], d["end_month"]) == ("2026-08", "2026-10")
    assert [m["month"] for m in d["months"]] == ["2026-08", "2026-09", "2026-10"]
    assert d["months"][0] == {
        "month": "2026-08",
        "label": "Aug 2026",
        "income": 0,
        "expense": 0,
        "net": 0,
        "transaction_count": 0,
    }

    chart = d["chart"]
    assert chart["labels"] == ["Aug 2026", "Sep 2026", "Oct 2026"]
    series = {ds["key"]: ds["data"] for ds in chart["datasets"]}
    assert series == {
        "expense": [0, 200, 300],
        "income": [0, 4000, 5000],
        "net": [0, 3800, 4700],
    }

    s = d["summary"]
    assert (s["total_income"], s["total_expense"], s["total_net"]) == (9000, 500, 8500)
    assert s["average_monthly_expense"] == 166.67
    assert s["highest_expense_month"] == {"month": "2026-10", "label": "Oct 2026", "expense": 300}
    # Months with no spending don't count as the "lowest".
    assert s["lowest_expense_month"]["month"] == "2026-09"


async def test_monthly_spans_year_boundary(auth_client, add):
    await add("Groceries", "10", "2025-12-31")
    await add("Groceries", "20", "2026-01-01")
    d = (
        await auth_client.get("/dashboard/monthly", params={"months": 2, "end_month": "2026-01"})
    ).json()
    assert [(m["month"], m["expense"]) for m in d["months"]] == [("2025-12", 10), ("2026-01", 20)]


async def test_monthly_defaults_and_limits(auth_client):
    d = (await auth_client.get("/dashboard/monthly")).json()
    assert len(d["months"]) == 12
    assert d["summary"]["highest_expense_month"] is None
    for bad in ({"months": 0}, {"months": 37}, {"end_month": "2026-13"}):
        assert (await auth_client.get("/dashboard/monthly", params=bad)).status_code == 422


# ---------- /dashboard/category ----------


async def test_category_breakdown_for_month(auth_client, history, cats):
    r = await auth_client.get("/dashboard/category", params={"month": "2026-10"})
    assert r.status_code == 200
    d = r.json()
    assert (d["type"], d["start_date"], d["end_date"], d["total"]) == (
        "expense",
        "2026-10-01",
        "2026-10-31",
        300,
    )
    assert d["categories"] == [
        {
            "category_id": cats["Food & Dining"],
            "name": "Food & Dining",
            "color": "#f97316",
            "icon": "utensils",
            "total": 250,
            "percentage": 83.33,
            "transaction_count": 2,
        },
        {
            "category_id": cats["Transport"],
            "name": "Transport",
            "color": "#3b82f6",
            "icon": "car",
            "total": 50,
            "percentage": 16.67,
            "transaction_count": 1,
        },
    ]
    ds = d["chart"]["datasets"][0]
    assert d["chart"]["labels"] == ["Food & Dining", "Transport"]
    assert ds["data"] == [250, 50]
    assert ds["backgroundColor"] == ["#f97316", "#3b82f6"]


async def test_category_date_range_and_income(auth_client, history):
    d = (
        await auth_client.get(
            "/dashboard/category",
            params={"start_date": "2026-09-01", "end_date": "2026-10-31", "type": "income"},
        )
    ).json()
    assert [(c["name"], c["total"]) for c in d["categories"]] == [("Salary", 9000)]


async def test_category_limit_groups_rest_as_other(auth_client, add):
    for name, amount in [("Groceries", 50), ("Transport", 30), ("Health", 15), ("Travel", 5)]:
        await add(name, str(amount), "2026-10-05")
    d = (
        await auth_client.get("/dashboard/category", params={"month": "2026-10", "limit": 2})
    ).json()
    assert [(c["name"], c["total"], c["percentage"]) for c in d["categories"]] == [
        ("Groceries", 50, 50.0),
        ("Transport", 30, 30.0),
        ("Other", 20, 20.0),
    ]
    assert d["categories"][-1]["category_id"] is None
    assert d["categories"][-1]["transaction_count"] == 2
    assert d["total"] == 100


async def test_category_empty_period(auth_client):
    d = (await auth_client.get("/dashboard/category", params={"month": "2020-01"})).json()
    assert d["total"] == 0 and d["categories"] == []
    assert d["chart"] == {
        "labels": [],
        "datasets": [
            {
                "key": "expense",
                "label": "Expense by category",
                "data": [],
                "backgroundColor": [],
                "borderColor": None,
            }
        ],
    }


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"month": "2026-10", "start_date": "2026-10-01", "end_date": "2026-10-31"}, "month"),
        ({"start_date": "2026-10-01"}, "end_date"),
        ({"end_date": "2026-10-01"}, "start_date"),
        ({"start_date": "2026-10-31", "end_date": "2026-10-01"}, "start_date"),
        ({"start_date": "2020-01-01", "end_date": "2026-10-01"}, "end_date"),
        ({"type": "transfer"}, "type"),
        ({"limit": 0}, "limit"),
    ],
)
async def test_category_param_validation(auth_client, params, field):
    r = await auth_client.get("/dashboard/category", params=params)
    assert r.status_code == 422
    assert field in {d["field"] for d in r.json()["error"]["details"]}


# ---------- security ----------


@pytest.mark.parametrize(
    "path", ["/dashboard/summary", "/dashboard/monthly", "/dashboard/category"]
)
async def test_requires_jwt(client, path):
    assert (await client.get(path)).status_code == 401


async def test_only_own_data_is_counted(client, seeded):
    await register_and_login(client, email="rich@example.com")
    salary = next(
        c["id"] for c in (await client.get("/categories")).json() if c["name"] == "Salary"
    )
    await client.post(
        "/transactions",
        json={
            "category_id": salary,
            "title": "Bonus",
            "amount": "99999",
            "transaction_date": "2026-10-01",
        },
    )
    await register_and_login(client, email="new@example.com")
    for path in ("/dashboard/summary", "/dashboard/monthly", "/dashboard/category"):
        body = (
            await client.get(path, params={"type": "income"} if "category" in path else {})
        ).json()
        assert "99999" not in str(body), path
    await login(client, email="rich@example.com")
    assert (await client.get("/dashboard/summary")).json()["total_income"] == 99999
