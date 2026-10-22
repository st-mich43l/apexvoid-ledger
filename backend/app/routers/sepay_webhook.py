import hmac
import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..bank_activity import WebhookValidationError, ingest_webhook
from ..database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/sepay", tags=["integrations"])


def _verify_api_key(request: Request) -> None:
  expected = os.getenv("SEPAY_WEBHOOK_API_KEY", "").strip()
  authorization = request.headers.get("Authorization", "")
  scheme, separator, received = authorization.partition(" ")
  valid = bool(expected) and bool(separator) and scheme.casefold() == "apikey" and bool(received.strip())
  if not valid or not hmac.compare_digest(received.strip() if separator else "", expected):
    raise HTTPException(status_code=401, detail="Invalid webhook authentication")


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
  _verify_api_key(request)
  try:
    payload = await request.json()
  except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
    raise HTTPException(status_code=422, detail="Malformed webhook JSON") from error

  try:
    ingest_webhook(db, payload)
  except WebhookValidationError as error:
    db.rollback()
    raise HTTPException(status_code=422, detail=str(error)) from error
  except SQLAlchemyError as error:
    db.rollback()
    logger.exception("SePay webhook persistence failed")
    raise HTTPException(status_code=500, detail="Unable to accept webhook") from error

  return {"success": True}
