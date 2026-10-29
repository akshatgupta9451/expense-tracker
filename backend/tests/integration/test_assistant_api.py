import json

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from app.assistant import chain
from app.config import settings
from app.main import app


class RecordingFakeModel(GenericFakeChatModel):
    """Streams a canned answer and remembers the prompt it was given."""

    seen: list = []

    async def _astream(self, messages, *args, **kwargs):
        self.seen.append(messages)
        async for chunk in super()._astream(messages, *args, **kwargs):
            yield chunk


@pytest.fixture
def fake_llm():
    model = RecordingFakeModel(messages=iter([AIMessage("You spend most on **Food & Dining**.")]))
    model.seen = []
    app.dependency_overrides[chain.get_chat_model] = lambda: model
    yield model
    app.dependency_overrides.pop(chain.get_chat_model)


async def _category_id(client, name):
    cats = (await client.get("/categories")).json()
    return next(c["id"] for c in cats if c["name"] == name)


async def _add(client, category, title, amount, day):
    r = await client.post(
        "/transactions",
        json={
            "category_id": await _category_id(client, category),
            "title": title,
            "amount": amount,
            "transaction_date": day,
        },
    )
    assert r.status_code == 201, r.text


def _events(body: str) -> list[dict]:
    return [json.loads(line) for line in body.splitlines() if line]


async def test_insights_empty_account(auth_client):
    r = await auth_client.get("/assistant/insights")
    assert r.status_code == 200
    body = r.json()
    assert body["has_data"] is False
    assert len(body["months"]) == 6
    assert body["patterns"] == []


async def test_insights_with_spending(auth_client):
    from app.utils.dates import today

    day = today("UTC").isoformat()
    await _add(auth_client, "Food & Dining", "Swiggy order", "25.50", day)
    await _add(auth_client, "Salary", "Salary", "3000", day)
    body = (await auth_client.get("/assistant/insights")).json()
    assert body["has_data"] is True
    assert body["months"][-1]["expense"] == "25.50"
    assert body["month_to_date"] == "25.50"
    assert body["categories"][0]["name"] == "Food & Dining"


async def test_chat_streams_answer_grounded_in_user_data(auth_client, fake_llm):
    from app.utils.dates import today

    await _add(auth_client, "Food & Dining", "Swiggy order", "25.50", today("UTC").isoformat())
    r = await auth_client.post(
        "/assistant/chat",
        json={
            "message": "Where does my money go on Swiggy?",
            "history": [
                {"role": "user", "content": "Hi"},
                {"role": "assistant", "content": "Hello! Ask me about your spending."},
            ],
        },
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")
    events = _events(r.text)
    assert events[-1] == {"type": "done"}
    text = "".join(e["text"] for e in events if e["type"] == "delta")
    assert text == "You spend most on **Food & Dining**."

    [messages] = fake_llm.seen
    system = messages[0].content
    assert "<financial_overview>" in system and "Swiggy order" in system
    assert [m.type for m in messages] == ["system", "human", "ai", "human"]
    assert messages[-1].content == "Where does my money go on Swiggy?"


async def test_chat_reports_llm_errors_in_stream(auth_client, monkeypatch):
    async def failing(*args, **kwargs):
        raise chain.AssistantError("The assistant is busy right now. Please try again shortly.")
        yield  # pragma: no cover

    app.dependency_overrides[chain.get_chat_model] = lambda: None
    monkeypatch.setattr(chain, "stream_answer", failing)
    try:
        r = await auth_client.post("/assistant/chat", json={"message": "hi"})
    finally:
        app.dependency_overrides.pop(chain.get_chat_model)
    assert _events(r.text) == [
        {"type": "error", "message": "The assistant is busy right now. Please try again shortly."}
    ]


async def test_chat_without_api_key_is_503(auth_client, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    r = await auth_client.post("/assistant/chat", json={"message": "hi"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["error"]["message"]


async def test_chat_validation_and_auth(auth_client, client, fake_llm):
    assert (await auth_client.post("/assistant/chat", json={"message": "  "})).status_code == 422
    bad_role = {"message": "hi", "history": [{"role": "system", "content": "x"}]}
    assert (await auth_client.post("/assistant/chat", json=bad_role)).status_code == 422
    client.headers.pop("Authorization")
    assert (await client.post("/assistant/chat", json={"message": "hi"})).status_code == 401
