import base64
import hashlib
import hmac
import json
import logging
import os
import time
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..bank_activity import WebhookValidationError, ingest_webhook, match_financial_account, parse_webhook_payload
from ..database import get_db
from ..models import FinancialAccount
from ..sepay import SePayError, decrypt_api_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/sepay", tags=["integrations"])
OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
OAUTH_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
HMAC_MAX_AGE_SECONDS = 5 * 60


def _reject_authentication() -> None:
  raise HTTPException(status_code=401, detail="Invalid webhook authentication")


def _authorization_value(request: Request, scheme: str) -> str | None:
  received_scheme, separator, value = request.headers.get("Authorization", "").partition(" ")
  if not separator or received_scheme.casefold() != scheme.casefold() or not value.strip():
    return None
  return value.strip()


def _account_auth_type(account: FinancialAccount | None) -> str | None:
  if account is None:
    return None
  if account.webhook_auth_type:
    return account.webhook_auth_type
  return "api_key" if account.webhook_auth_ciphertext else None


def _stored_secret(account: FinancialAccount) -> str | None:
  if not account.webhook_auth_ciphertext:
    return None
  try:
    return decrypt_api_token(account.webhook_auth_ciphertext)
  except SePayError:
    logger.exception("Unable to load SePay webhook credential for account %s", account.id)
    return None


def _oauth_serializer() -> URLSafeTimedSerializer:
  return URLSafeTimedSerializer(os.environ["SECRET_KEY"], salt="apexvoid-ledger.sepay-oauth")


def _issue_oauth_token(account_id: str, token_kind: str) -> str:
  return _oauth_serializer().dumps({"account_id": account_id, "kind": token_kind})


def _valid_oauth_token(token: str, account_id: str) -> bool:
  try:
    payload = _oauth_serializer().loads(token, max_age=OAUTH_ACCESS_TOKEN_TTL_SECONDS)
  except (BadSignature, SignatureExpired):
    return False
  return payload == {"account_id": account_id, "kind": "access"}


def _verify_webhook_authentication(
  request: Request, account: FinancialAccount | None, raw_body: bytes
) -> None:
  auth_type = _account_auth_type(account)
  if auth_type == "none":
    return
  if auth_type == "api_key" and account is not None:
    received, expected = _authorization_value(request, "Apikey"), _stored_secret(account)
    if received and expected and hmac.compare_digest(received, expected):
      return
    _reject_authentication()
  if auth_type == "hmac_sha256" and account is not None:
    signature = request.headers.get("X-SePay-Signature", "")
    try:
      timestamp = int(request.headers.get("X-SePay-Timestamp", ""))
    except ValueError:
      _reject_authentication()
    if abs(time.time() - timestamp) > HMAC_MAX_AGE_SECONDS:
      _reject_authentication()
    secret = _stored_secret(account)
    expected = "sha256=" + hmac.new(
      secret.encode("utf-8") if secret else b"",
      str(timestamp).encode("ascii") + b"." + raw_body,
      hashlib.sha256,
    ).hexdigest()
    if secret and hmac.compare_digest(signature, expected):
      return
    _reject_authentication()
  if auth_type == "oauth2" and account is not None:
    token = _authorization_value(request, "Bearer")
    if token and _valid_oauth_token(token, account.id):
      return
    _reject_authentication()

  # Compatibility only for previously deployed global API-key installations.
  expected, received = os.getenv("SEPAY_WEBHOOK_API_KEY", "").strip(), _authorization_value(request, "Apikey")
  if received and expected and hmac.compare_digest(received, expected):
    return
  _reject_authentication()


def _oauth_request_values(request: Request, raw_body: bytes) -> tuple[dict[str, str], bool]:
  if "application/json" in request.headers.get("Content-Type", "").casefold():
    try:
      value = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
      raise HTTPException(status_code=400, detail="Invalid OAuth request") from error
    if not isinstance(value, dict):
      raise HTTPException(status_code=400, detail="Invalid OAuth request")
    return ({str(key): str(item) for key, item in value.items() if item is not None}, True)
  values = parse_qs(raw_body.decode("utf-8"), keep_blank_values=True)
  return ({key: value[-1] for key, value in values.items() if value}, False)


def _oauth_basic_credentials(request: Request) -> tuple[str, str] | None:
  encoded = _authorization_value(request, "Basic")
  if not encoded:
    return None
  try:
    decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
  except (ValueError, UnicodeDecodeError):
    return None
  client_id, separator, client_secret = decoded.partition(":")
  return (client_id, client_secret) if separator else None


def _oauth_account(db: Session, client_id: str, client_secret: str) -> FinancialAccount | None:
  candidates = (
    db.query(FinancialAccount)
    .filter(FinancialAccount.provider == "sepay", FinancialAccount.webhook_auth_type == "oauth2")
    .all()
  )
  for account in candidates:
    if not account.webhook_auth_client_id_ciphertext:
      continue
    try:
      expected_client_id = decrypt_api_token(account.webhook_auth_client_id_ciphertext)
    except SePayError:
      continue
    expected_client_secret = _stored_secret(account)
    if (
      expected_client_secret
      and hmac.compare_digest(client_id, expected_client_id)
      and hmac.compare_digest(client_secret, expected_client_secret)
    ):
      return account
  return None


@router.post("/oauth/token")
async def issue_oauth_token(request: Request, db: Session = Depends(get_db)):
  raw_body = await request.body()
  values, is_custom_request = _oauth_request_values(request, raw_body)
  credentials = _oauth_basic_credentials(request)
  client_id = credentials[0] if credentials else values.get("client_id") or values.get("clientId")
  client_secret = credentials[1] if credentials else values.get("client_secret") or values.get("clientSecret")
  if not client_id or not client_secret:
    raise HTTPException(status_code=401, detail="invalid_client")
  account = _oauth_account(db, client_id, client_secret)
  if account is None:
    raise HTTPException(status_code=401, detail="invalid_client")

  grant_type = values.get("grant_type", "client_credentials")
  refresh_token = values.get("refresh_token") or values.get("refreshToken")
  if grant_type == "refresh_token":
    try:
      refresh_payload = _oauth_serializer().loads(
        refresh_token or "", max_age=OAUTH_REFRESH_TOKEN_TTL_SECONDS
      )
    except (BadSignature, SignatureExpired):
      raise HTTPException(status_code=401, detail="invalid_grant") from None
    if refresh_payload != {"account_id": account.id, "kind": "refresh"}:
      raise HTTPException(status_code=401, detail="invalid_grant")
  elif grant_type != "client_credentials":
    raise HTTPException(status_code=400, detail="unsupported_grant_type")

  access_token, refresh = _issue_oauth_token(account.id, "access"), _issue_oauth_token(account.id, "refresh")
  if is_custom_request:
    return {"data": {"accessToken": access_token, "refreshToken": refresh, "expiredIn": OAUTH_ACCESS_TOKEN_TTL_SECONDS}}
  return {"access_token": access_token, "token_type": "Bearer", "expires_in": OAUTH_ACCESS_TOKEN_TTL_SECONDS, "refresh_token": refresh}


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
  raw_body = await request.body()
  try:
    payload = json.loads(raw_body)
  except (json.JSONDecodeError, UnicodeDecodeError) as error:
    raise HTTPException(status_code=422, detail="Malformed webhook JSON") from error

  try:
    parsed = parse_webhook_payload(payload)
    account = match_financial_account(db, parsed.account_number, parsed.account_number_fingerprint)
    _verify_webhook_authentication(request, account, raw_body)
    ingest_webhook(db, payload)
  except WebhookValidationError as error:
    db.rollback()
    raise HTTPException(status_code=422, detail=str(error)) from error
  except SQLAlchemyError as error:
    db.rollback()
    logger.exception("SePay webhook persistence failed")
    raise HTTPException(status_code=500, detail="Unable to accept webhook") from error

  return {"success": True}
