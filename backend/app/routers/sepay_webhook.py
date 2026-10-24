import hmac
import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..bank_activity import (
  WebhookValidationError,
  ingest_webhook,
  match_financial_account,
  parse_webhook_payload,
)
from ..database import get_db
from ..models import FinancialAccount
from ..sepay import SePayError, decrypt_api_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/sepay", tags=["integrations"])


def _received_api_key(request: Request) -> str | None:
  authorization = request.headers.get("Authorization", "")
  scheme, separator, received = authorization.partition(" ")
  if not separator or scheme.casefold() != "apikey" or not received.strip():
    return None
  return received.strip()


def _verify_api_key(request: Request, account: FinancialAccount | None) -> None:
  received = _received_api_key(request)
  # A user-configured account key takes precedence. Do not silently allow the
  # server-wide compatibility key to bypass an account-specific credential.
  if account is not None and account.webhook_auth_ciphertext:
    try:
      expected = decrypt_api_token(account.webhook_auth_ciphertext)
    except SePayError:
      logger.exception("Unable to load the SePay webhook credential for account %s", account.id)
      expected = ""
  else:
    expected = os.getenv("SEPAY_WEBHOOK_API_KEY", "").strip()
  if not received or not expected or not hmac.compare_digest(received, expected):
    raise HTTPException(status_code=401, detail="Invalid webhook authentication")


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
  try:
    payload = await request.json()
  except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
    raise HTTPException(status_code=422, detail="Malformed webhook JSON") from error

  try:
    parsed = parse_webhook_payload(payload)
    account = match_financial_account(
      db, parsed.account_number, parsed.account_number_fingerprint
    )
    _verify_api_key(request, account)
    ingest_webhook(db, payload)
  except WebhookValidationError as error:
    db.rollback()
    raise HTTPException(status_code=422, detail=str(error)) from error
  except SQLAlchemyError as error:
    db.rollback()
    logger.exception("SePay webhook persistence failed")
    raise HTTPException(status_code=500, detail="Unable to accept webhook") from error

  return {"success": True}
