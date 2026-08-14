import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from .routers.auth import router as auth_router
from .routers.cashflow import router as cashflow_router
from .routers.categories import router as categories_router
from .routers.loans import router as loans_router
from .routers.monthly_budget import router as monthly_budget_router
from .routers.monthly_close import router as monthly_close_router
from .routers.monthly_routine import router as monthly_routine_router
from .routers.recurring_expenses import router as recurring_expenses_router
from .routers.recurring_incomes import router as recurring_incomes_router
from .routers.saving_pot import router as saving_pot_router
from .routers.transactions import router as transactions_router

app = FastAPI(title="apexvoid-ledger backend")

# No CORS middleware: the frontend only ever calls /api/* as same-origin relative
# paths (nginx proxies /api/ to this service both in dev and prod), so cross-origin
# requests are neither expected nor wanted now that auth is cookie-based.
app.add_middleware(
  SessionMiddleware,
  secret_key=os.environ["SECRET_KEY"],
  session_cookie="apexvoid_ledger_session",
  same_site="lax",
  https_only=os.environ.get("SESSION_COOKIE_SECURE", "true").lower() == "true",
  max_age=60 * 60 * 24 * 30,
)

app.include_router(auth_router)
app.include_router(loans_router)
app.include_router(categories_router)
app.include_router(transactions_router)
app.include_router(cashflow_router)
app.include_router(recurring_expenses_router)
app.include_router(recurring_incomes_router)
app.include_router(monthly_routine_router)
app.include_router(monthly_budget_router)
app.include_router(monthly_close_router)
app.include_router(saving_pot_router)


@app.get("/api/health")
def health():
  return {"ok": True}
