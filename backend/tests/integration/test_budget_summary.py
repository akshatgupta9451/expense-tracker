from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.utils.dates import format_month, month_bounds, next_month, previous_month
from tests.conftest import register_and_login

TODAY = datetime.now(UTC).date()
THIS_MONTH = TODAY.replace(day=1)
M = format_month(THIS_MONTH)


@pytest.fixture
async def cats(auth_client):
    return {c["name"]: c["id"] for c in (await auth_client.get("/categories")).json()}


@pytest.fixture
async def spend(auth_client, cats):
    async def _spend(category, amount, day=TODAY):
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

    return _spend


async def _summary(client, month=M):
    r = await client.get("/budgets/summary", params={"month": month})
    assert r.status_code == 200, r.text
    return r.json()


async def test_empty_month(auth_client):
    s = await _summary(auth_client)
    assert s["overall"] is None and s["categories"] == []
    assert Decimal(s["total_spent"]) == 0
    assert s["previous_month_has_budgets"] is False
    assert s["currency"] == "USD"


async def test_overall_budget_limit_spent_remaining(auth_client, cats, spend):
    await auth_client.post("/budgets", json={"monthly_limit": "1000", "month": M})
    await spend("Groceries", "250")
    await spend("Transport", "50")

    s = await _summary(auth_client)
    o = s["overall"]
    assert (o["monthly_limit"], o["spent"], o["remaining"]) == ("1000.00", "300.00", "700.00")
    assert o["percent_used"] == 30.0 and o["status"] == "on_track"
    assert s["total_spent"] == "300.00"


async def test_income_is_not_spending(auth_client, cats, spend):
    await auth_client.post("/budgets", json={"monthly_limit": "100", "month": M})
    await spend("Salary", "5000")
    assert (await _summary(auth_client))["overall"]["spent"] == "0.00"


async def test_pacing_for_current_month(auth_client, spend):
    await auth_client.post("/budgets", json={"monthly_limit": "3100", "month": M})
    await spend("Groceries", "100")
    s = await _summary(auth_client)

    _, last = month_bounds(THIS_MONTH)
    assert s["days_in_month"] == last.day
    assert s["days_elapsed"] == TODAY.day
    assert s["days_left"] == last.day - TODAY.day + 1  # today still counts
    expected_daily = (Decimal("3000") / s["days_left"]).quantize(Decimal("0.01"))
    assert Decimal(s["daily_allowance"]) == expected_daily
    expected_projection = (Decimal("100") / TODAY.day * last.day).quantize(Decimal("0.01"))
    assert Decimal(s["projected_spend"]) == expected_projection


async def test_over_budget_daily_allowance_is_zero(auth_client, spend):
    await auth_client.post("/budgets", json={"monthly_limit": "50", "month": M})
    await spend("Groceries", "80")
    s = await _summary(auth_client)
    assert s["overall"]["status"] == "exceeded"
    assert s["overall"]["remaining"] == "-30.00"
    assert Decimal(s["daily_allowance"]) == 0


async def test_past_and_future_months_have_no_pacing(auth_client):
    past = await _summary(auth_client, format_month(previous_month(THIS_MONTH)))
    assert past["days_left"] == 0 and past["days_elapsed"] == past["days_in_month"]
    assert past["daily_allowance"] is None and past["projected_spend"] is None

    future = await _summary(auth_client, format_month(next_month(THIS_MONTH)))
    assert future["days_elapsed"] == 0 and future["days_left"] == future["days_in_month"]
    assert future["projected_spend"] is None


async def test_category_budgets_sorted_and_unbudgeted_spend(auth_client, cats, spend):
    for name, limit in [("Groceries", "400"), ("Transport", "100")]:
        r = await auth_client.post(
            "/budgets", json={"category_id": cats[name], "monthly_limit": limit, "month": M}
        )
        assert r.status_code == 201
    await spend("Groceries", "100")  # 25%
    await spend("Transport", "90")  # 90% -> warning at default 80% threshold
    await spend("Entertainment", "60")  # no budget

    s = await _summary(auth_client)
    assert [b["category"]["name"] for b in s["categories"]] == ["Transport", "Groceries"]
    assert s["categories"][0]["status"] == "warning"
    assert s["unbudgeted_spent"] == "60.00"
    assert s["category_limits_total"] == "500.00"
    assert s["total_spent"] == "250.00"


async def test_offers_copy_when_last_month_had_budgets(auth_client):
    prev = format_month(previous_month(THIS_MONTH))
    await auth_client.post("/budgets", json={"monthly_limit": "800", "month": prev})
    assert (await _summary(auth_client))["previous_month_has_budgets"] is True

    copied = await auth_client.post("/budgets/copy", json={"from_month": prev, "to_month": M})
    assert copied.json() == {"copied": 1}
    assert (await _summary(auth_client))["overall"]["monthly_limit"] == "800.00"


async def test_summary_is_per_user(client, seeded):
    await register_and_login(client, email="a@example.com")
    await client.post("/budgets", json={"monthly_limit": "123", "month": M})
    await register_and_login(client, email="b@example.com")
    assert (await _summary(client))["overall"] is None


async def test_summary_requires_auth_and_valid_month(client, auth_client):
    assert (
        await auth_client.get("/budgets/summary", params={"month": "2026-13"})
    ).status_code == 422
    client.headers.pop("Authorization")
    assert (await client.get("/budgets/summary")).status_code == 401
