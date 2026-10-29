import json
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from langchain_core.language_models import BaseChatModel

from app.assistant import chain
from app.assistant.analysis import load_snapshot
from app.authentication.dependencies import CurrentUser, DbSession
from app.config import settings
from app.rate_limit import limiter, user_or_ip
from app.schemas.assistant import (
    BudgetInsight,
    CategoryInsight,
    ChatRequest,
    Insights,
    MonthInsight,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])

ChatModel = Annotated[BaseChatModel, Depends(chain.get_chat_model)]


@router.get("/insights", response_model=Insights)
async def insights(user: CurrentUser, db: DbSession):
    """Spending patterns, saving suggestions and predictions, computed without the LLM."""
    s = await load_snapshot(db, user)
    return Insights(
        has_data=s.has_data,
        currency=s.currency,
        months=[
            MonthInsight(
                month=m.month,
                income=m.income,
                expense=m.expense,
                net=m.net,
                savings_rate=m.savings_rate,
            )
            for m in s.months
        ],
        categories=[
            CategoryInsight(
                name=c.name,
                average=c.average,
                last_month=c.last_month,
                change_pct=c.change_pct,
                predicted_next=c.predicted_next,
            )
            for c in s.categories
        ],
        month_to_date=s.month_to_date,
        projected_this_month=s.projected_this_month,
        predicted_next_month=s.predicted_next_month,
        budgets=[
            BudgetInsight(
                category=b.category,
                limit=b.limit,
                spent=b.spent,
                projected=b.projected,
                at_risk=b.at_risk,
            )
            for b in s.budgets
        ],
        patterns=s.patterns,
        suggestions=s.suggestions,
    )


@router.post(
    "/chat",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"application/x-ndjson": {}}},
        429: {"description": "Too many messages"},
    },
)
@limiter.limit(settings.assistant_rate_limit, key_func=user_or_ip)
async def chat(
    data: ChatRequest, request: Request, user: CurrentUser, db: DbSession, llm: ChatModel
):
    """Stream the assistant's answer as NDJSON events: delta (text), then done or error."""
    # Load everything from the database before streaming starts.
    snapshot = await load_snapshot(db, user)
    history = [t.model_dump() for t in data.history]

    async def events():
        try:
            async for text in chain.stream_answer(llm, snapshot, data.message, history):
                yield json.dumps({"type": "delta", "text": text}) + "\n"
        except chain.AssistantError as exc:
            yield json.dumps({"type": "error", "message": str(exc)}) + "\n"
            return
        yield json.dumps({"type": "done"}) + "\n"

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
