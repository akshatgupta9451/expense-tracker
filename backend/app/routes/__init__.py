from fastapi import APIRouter

from app.routes import (
    analytics,
    assistant,
    auth,
    budgets,
    categories,
    dashboard,
    exports,
    transactions,
    users,
)

api_router = APIRouter()
for module in (
    auth,
    users,
    categories,
    transactions,
    budgets,
    dashboard,
    analytics,
    exports,
    assistant,
):
    api_router.include_router(module.router)
