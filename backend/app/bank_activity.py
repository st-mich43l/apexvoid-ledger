"""SePay webhook parsing, account matching, and deterministic reconciliation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from .cashflow_report import period_entries
from .models import Category, FinancialAccount, SePayBankActivity, Transaction
from .net_worth import sync_if_due
from .sepay import (
  SePayClient,
  SePayConfig,
  SePayError,
  account_number_fingerprint,
  decrypt_api_token,
  normalize_account_number,
)

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
MONEY_QUANTUM = Decimal("0.01")
MAX_AMOUNT = Decimal("10000000000000000")
RECONCILIATION_WINDOW = timedelta(days=3)


class WebhookValidationError(ValueError):
  pass


@dataclass(frozen=True)
class ParsedBankActivity:
  provider_transaction_id: str
  account_number: str
  account_number_fingerprint: str
  account_number_masked: str
  occurred_at: datetime
  direction: str
  amount: Decimal
  description: str | None
  bank_reference: str | None
  running_balance: Decimal | None
  original_payload: dict[str, Any]


def _text(value: Any, field: str, limit: int) -> str | None:
  if value is None:
    return None
  if not isinstance(value, str):
    value = str(value)
  value = " ".join(value.split()).strip()
  if not value:
    return None
  return value[:limit]


def _parse_amount(value: Any, field: str, *, allow_zero: bool = False) -> Decimal | None:
  if value is None or value == "":
    return None
  try:
    amount = Decimal(str(value))
  except (InvalidOperation, TypeError, ValueError) as error:
    raise WebhookValidationError(f"Invalid {field}") from error
  if not amount.is_finite() or amount < 0 or (not allow_zero and amount <= 0) or amount >= MAX_AMOUNT:
    raise WebhookValidationError(f"Invalid {field}")
  return amount.quantize(MONEY_QUANTUM)


def _parse_transaction_date(value: Any) -> datetime:
  if not isinstance(value, str) or not value.strip():
    raise WebhookValidationError("Missing transactionDate")
  text = value.strip()
  parsed: datetime | None = None
  for candidate in (text, text.replace(" ", "T", 1)):
    try:
      parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
      break
    except ValueError:
      continue
  if parsed is None:
    raise WebhookValidationError("Invalid transactionDate")
  if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=VIETNAM_TZ)
  return parsed.astimezone(timezone.utc)


def _redact_payload(payload: dict[str, Any], account_number: str) -> dict[str, Any]:
  redacted = dict(payload)
  redacted["accountNumber"] = f"••••{account_number[-4:]}"
  return redacted


def parse_webhook_payload(payload: Any) -> ParsedBankActivity:
  if not isinstance(payload, dict):
    raise WebhookValidationError("Webhook payload must be a JSON object")

  provider_id = _text(payload.get("id"), "id", 128)
  if provider_id is None:
    raise WebhookValidationError("Missing transaction id")
  account_number = _text(payload.get("accountNumber"), "accountNumber", 64)
  if account_number is None:
    raise WebhookValidationError("Missing accountNumber")
  try:
    account_number = normalize_account_number(account_number)
    fingerprint = account_number_fingerprint(account_number)
  except SePayError as error:
    raise WebhookValidationError(str(error)) from error

  direction = _text(payload.get("transferType"), "transferType", 8)
  if direction not in {"in", "out"}:
    raise WebhookValidationError("Unsupported transferType")
  amount = _parse_amount(payload.get("transferAmount"), "transferAmount")
  if amount is None:
    raise WebhookValidationError("Missing transferAmount")

  running_balance = _parse_amount(payload.get("accumulated"), "accumulated", allow_zero=True)
  if running_balance == Decimal("0.00"):
    running_balance = None

  reference = _text(payload.get("referenceCode"), "referenceCode", 255)
  if reference is None:
    reference = _text(payload.get("code"), "code", 255)
  description = _text(payload.get("content"), "content", 500) or _text(
    payload.get("description"), "description", 500
  )

  return ParsedBankActivity(
    provider_transaction_id=provider_id,
    account_number=account_number,
    account_number_fingerprint=fingerprint,
    account_number_masked=f"••••{account_number[-4:]}",
    occurred_at=_parse_transaction_date(payload.get("transactionDate")),
    direction=direction,
    amount=amount,
    description=description,
    bank_reference=reference,
    running_balance=running_balance,
    original_payload=_redact_payload(payload, account_number),
  )


def _account_candidates(db: Session, fingerprint: str) -> list[FinancialAccount]:
  return (
    db.query(FinancialAccount)
    .filter(
      FinancialAccount.provider == "sepay",
      FinancialAccount.account_number_fingerprint == fingerprint,
    )
    .all()
  )


def match_financial_account(
  db: Session,
  account_number: str,
  fingerprint: str,
) -> FinancialAccount | None:
  """Match by a full keyed identity, with a one-time encrypted-token fallback.

  Accounts connected before fingerprint storage was introduced have no raw
  account number to backfill. For those rows, the already-encrypted SePay
  token is used to verify the full account number and then the fingerprint is
  persisted for future webhook deliveries.
  """
  candidates = _account_candidates(db, fingerprint)
  if len(candidates) == 1:
    return candidates[0]
  if len(candidates) > 1:
    return None

  legacy = (
    db.query(FinancialAccount)
    .filter(
      FinancialAccount.provider == "sepay",
      FinancialAccount.credential_ciphertext.is_not(None),
      FinancialAccount.account_number_fingerprint.is_(None),
    )
    .all()
  )
  matches: list[FinancialAccount] = []
  for account in legacy:
    client: SePayClient | None = None
    try:
      token = decrypt_api_token(account.credential_ciphertext or "")
      client = SePayClient(SePayConfig(token))
      references = client.list_accounts()
      if any(
        reference.external_account_id == account.external_account_id
        and reference.account_number == account_number
        for reference in references
      ):
        matches.append(account)
    except SePayError:
      continue
    finally:
      if client is not None:
        client.close()
  if len(matches) == 1:
    matches[0].account_number_fingerprint = fingerprint
    return matches[0]
  return None


def _manual_match(
  db: Session,
  activity: SePayBankActivity,
) -> Transaction | None:
  transaction_type = "income" if activity.direction == "in" else "expense"
  start = activity.occurred_at - RECONCILIATION_WINDOW
  end = activity.occurred_at + RECONCILIATION_WINDOW
  candidates = (
    db.query(Transaction)
    .filter(
      Transaction.user_id == activity.user_id,
      Transaction.source == "manual",
      Transaction.transaction_type == transaction_type,
      Transaction.amount == activity.amount,
      Transaction.currency == activity.currency,
      Transaction.occurred_at >= start,
      Transaction.occurred_at <= end,
    )
    .all()
  )
  if len(candidates) != 1:
    return None
  candidate = candidates[0]
  if not activity.description or not candidate.description:
    return None
  if activity.description.casefold() not in candidate.description.casefold() and candidate.description.casefold() not in activity.description.casefold():
    return None
  return candidate


def _scheduled_match(db: Session, activity: SePayBankActivity) -> tuple[str, str, str] | None:
  if activity.user_id is None:
    return None
  entries, _ = period_entries(
    db,
    activity.user_id,
    activity.occurred_at - RECONCILIATION_WINDOW,
    activity.occurred_at + RECONCILIATION_WINDOW + timedelta(microseconds=1),
  )
  matches = [
    entry
    for entry in entries
    if entry.source_kind in {"recurring", "recurring_income", "loan"}
    and entry.currency == activity.currency
    and entry.amount == activity.amount
    and entry.entry_type == ("income" if activity.direction == "in" else "expense")
    and abs((entry.occurred_at - activity.occurred_at).total_seconds()) <= RECONCILIATION_WINDOW.total_seconds()
  ]
  if len(matches) != 1:
    return None
  entry = matches[0]
  if entry.source_kind == "recurring_income":
    return "recurring_income", entry.recurring_income_id or "", "income"
  if entry.source_kind == "recurring":
    return "recurring_expense", entry.recurring_expense_id or "", "expense"
  return "loan", entry.loan.id if entry.loan is not None else "", "loan_repayment"


def _auto_category_for_activity(
  db: Session, activity: SePayBankActivity
) -> Category | None:
  """Return the configured category only for a high-confidence outgoing match.

  The rule is deliberately limited to literal description/reference matching.
  An amount, date, or running balance by itself can never classify an activity.
  """
  if activity.direction != "out" or activity.financial_account_id is None:
    return None
  account = db.get(FinancialAccount, activity.financial_account_id)
  if account is None or not account.auto_rule_enabled or not account.auto_category_id:
    return None

  description_matcher = (account.auto_description_contains or "").strip().casefold()
  reference_matcher = (account.auto_reference_contains or "").strip().casefold()
  if not description_matcher and not reference_matcher:
    return None
  if description_matcher and (
    not activity.description or description_matcher not in activity.description.casefold()
  ):
    return None
  if reference_matcher and (
    not activity.bank_reference or reference_matcher not in activity.bank_reference.casefold()
  ):
    return None

  category = (
    db.query(Category)
    .filter(
      Category.id == account.auto_category_id,
      Category.user_id == activity.user_id,
      Category.category_type == "expense",
      Category.is_active.is_(True),
    )
    .first()
  )
  return category


def _get_or_create_sepay_transaction(
  db: Session, activity: SePayBankActivity, category: Category
) -> Transaction:
  external_id = f"sepay:{activity.provider}:{activity.provider_transaction_id}"
  existing = (
    db.query(Transaction)
    .filter(
      Transaction.user_id == activity.user_id,
      Transaction.source == "sepay",
      Transaction.external_id == external_id,
    )
    .first()
  )
  if existing is not None:
    return existing

  transaction = Transaction(
    user_id=activity.user_id,
    transaction_type="expense",
    category_id=category.id,
    amount=activity.amount,
    currency=activity.currency,
    occurred_at=activity.occurred_at,
    description=activity.description or f"SePay {activity.provider_transaction_id}",
    source="sepay",
    external_id=external_id,
  )
  db.add(transaction)
  db.flush()
  return transaction


def process_activity(db: Session, activity: SePayBankActivity) -> None:
  if activity.linked_transaction_id is not None:
    activity.processing_status = "processed"
    activity.processed_at = activity.processed_at or datetime.now(timezone.utc)
    return

  manual = _manual_match(db, activity)
  if manual is not None:
    activity.linked_transaction_id = manual.id
    activity.matched_kind = "manual"
    activity.matched_id = manual.id
    activity.classification = activity.direction == "in" and "income" or "expense"
    activity.processing_status = "processed"
    activity.processed_at = datetime.now(timezone.utc)
    return

  category = _auto_category_for_activity(db, activity)
  if category is not None:
    scheduled = _scheduled_match(db, activity)
    transaction = _get_or_create_sepay_transaction(db, activity, category)
    activity.linked_transaction_id = transaction.id
    if scheduled is not None and scheduled[0] == "recurring_expense":
      activity.matched_kind = scheduled[0]
      activity.matched_id = scheduled[1]
    else:
      activity.matched_kind = "auto_rule"
      activity.matched_id = category.id
    activity.classification = "expense"
    activity.processing_status = "processed"
    activity.processed_at = datetime.now(timezone.utc)
    activity.processing_error = None
    return

  scheduled = _scheduled_match(db, activity)
  if scheduled is not None:
    activity.matched_kind, activity.matched_id, activity.classification = scheduled
    activity.processing_status = "processed"
    activity.processed_at = datetime.now(timezone.utc)
    return

  activity.processing_status = "pending_review"
  activity.classification = "unreviewed"
  activity.processed_at = None


def ingest_webhook(db: Session, payload: Any) -> SePayBankActivity:
  parsed = parse_webhook_payload(payload)
  account = match_financial_account(db, parsed.account_number, parsed.account_number_fingerprint)
  now = datetime.now(timezone.utc)
  activity = SePayBankActivity(
    provider="sepay",
    provider_transaction_id=parsed.provider_transaction_id,
    user_id=account.user_id if account else None,
    financial_account_id=account.id if account else None,
    account_number_fingerprint=parsed.account_number_fingerprint,
    account_number_masked=parsed.account_number_masked,
    occurred_at=parsed.occurred_at,
    direction=parsed.direction,
    amount=parsed.amount,
    currency="VND",
    description=parsed.description,
    bank_reference=parsed.bank_reference,
    running_balance=parsed.running_balance,
    processing_status="pending_review" if account else "unmatched",
    classification="unreviewed",
    received_at=now,
    original_payload=parsed.original_payload,
  )
  from sqlalchemy.exc import IntegrityError

  try:
    with db.begin_nested():
      db.add(activity)
      db.flush()
  except IntegrityError:
    existing = (
      db.query(SePayBankActivity)
      .filter(
        SePayBankActivity.provider == "sepay",
        SePayBankActivity.provider_transaction_id == parsed.provider_transaction_id,
      )
      .first()
    )
    if existing is None:
      raise
    return existing

  if account is not None:
    process_activity(db, activity)
  db.commit()

  if account is not None:
    try:
      sync_if_due(db, account)
    except SePayError:
      # The durable event is already accepted. Balance refresh can recover on
      # the normal sync cycle or the user's manual Net Worth refresh.
      pass
  return activity
