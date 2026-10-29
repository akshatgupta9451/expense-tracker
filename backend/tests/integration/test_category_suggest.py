async def test_suggest_returns_matching_system_category(auth_client):
    r = await auth_client.post(
        "/categories/suggest", json={"text": "Bought burger from McDonald's"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Food & Dining"
    assert body["category"]["name"] == "Food & Dining"
    cats = (await auth_client.get("/categories", params={"type": "expense"})).json()
    assert body["category"]["id"] in {c["id"] for c in cats}
    assert len(body["alternatives"]) == 2


async def test_suggest_validates_and_requires_auth(auth_client, client):
    assert (await auth_client.post("/categories/suggest", json={"text": ""})).status_code == 422
    client.headers.pop("Authorization")
    r = await client.post("/categories/suggest", json={"text": "coffee"})
    assert r.status_code == 401
