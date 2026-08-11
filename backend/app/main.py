from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.loans import router as loans_router

app = FastAPI(title="apexvoid-ledger backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(loans_router)


@app.get("/api/health")
def health():
    return {"ok": True}
