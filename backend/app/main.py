import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from .routers.auth import router as auth_router
from .routers.loans import router as loans_router

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


@app.get("/api/health")
def health():
    return {"ok": True}
