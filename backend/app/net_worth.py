from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .calculations import calculate_loan
from .exchange_rates import (
  ExchangeRateProviderError,
  get_exchange_rate_provider,
  quote_for_date,
)
from .models import FinancialAccount, Loan, User
from .sepay import (
  SePayClient,
  SePayConfig,
  SePayError,
  account_number_fingerprint,
  decrypt_api_token,
  encrypt_api_token,
)

SYNC_INTERVAL_SECONDS = 5 * 60
_sync_lock = threading.Lock()


def utcnow() -> datetime:
  return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
  if value is None:
    return None
  if value.tzinfo is None:
    return value.replace(tzinfo=timezone.utc)
  return value.astimezone(timezone.utc)


def connect_sepay_account(
  db: Session,
  user: User,
  *,
  api_token: str,
  account_number: str,
  webhook_auth_enabled: bool = False,
  webhook_auth_key: str | None = None,
) -> FinancialAccount:
  """Validate and attach one SePay account to the currently authenticated user."""
  token = api_token.strip()
  if not token:
    raise SePayError("SePay API token is required", kind="validation", status_code=422)
  webhook_key = webhook_auth_key.strip() if webhook_auth_key else ""
  if webhook_auth_enabled and not webhook_key:
    raise SePayError(
      "A webhook API key is required when webhook authentication is enabled",
      kind="validation",
      status_code=422,
    )

  client = SePayClient(SePayConfig(token))
  try:
    reference = client.find_account(account_number)
  finally:
    client.close()

  client = SePayClient(SePayConfig(token, reference.external_account_id))
  try:
    details = client.get_account_details()
  finally:
    client.close()

  ciphertext = encrypt_api_token(token)
  webhook_ciphertext = encrypt_api_token(webhook_key) if webhook_auth_enabled else None
  now = utcnow()
  with _sync_lock:
    account = (
      db.query(FinancialAccount)
      .filter(
        FinancialAccount.user_id == user.id,
        FinancialAccount.provider == "sepay",
        FinancialAccount.external_account_id == reference.external_account_id,
      )
      .first()
    )
    if account is None:
      account = FinancialAccount(
        user_id=user.id,
        provider="sepay",
        external_account_id=details.external_account_id,
        bank_name=details.bank_name,
        account_number_masked=details.account_number_masked,
        account_name=details.account_name,
        currency="VND",
        balance=None,
        balance_status="unavailable",
        credential_ciphertext=ciphertext,
        webhook_auth_ciphertext=webhook_ciphertext,
      )
      db.add(account)
    else:
      account.credential_ciphertext = ciphertext
      account.webhook_auth_ciphertext = webhook_ciphertext

    account.bank_name = details.bank_name
    account.account_number_masked = details.account_number_masked
    account.account_name = details.account_name
    account.currency = "VND"
    account.balance = details.balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    account.balance_status = "verified"
    account.last_synced_at = now
    account.last_transaction_at = details.last_transaction_at
    account.last_sync_attempt_at = now
    account.last_sync_error = None
    account.account_number_fingerprint = account_number_fingerprint(account_number)
    try:
      db.commit()
    except IntegrityError as error:
      db.rollback()
      raise SePayError(
        "This SePay account could not be connected", kind="conflict", status_code=409
      ) from error
    db.refresh(account)
    return account


def _refresh_account(db: Session, account: FinancialAccount) -> FinancialAccount:
  db.refresh(account)
  return account


def sync_account(
  db: Session,
  account: FinancialAccount,
  *,
  force: bool = False,
) -> FinancialAccount:
  if account.provider != "sepay" or not account.credential_ciphertext:
    raise SePayError(
      "Reconnect this SePay account to continue syncing",
      kind="configuration",
      status_code=503,
    )

  with _sync_lock:
    locked_account = (
      db.query(FinancialAccount)
      .filter(FinancialAccount.id == account.id)
      .with_for_update()
      .first()
    )
    if locked_account is None:
      raise SePayError(
        "Financial account is no longer available",
        kind="configuration",
        status_code=404,
      )
    account = locked_account
    now = utcnow()
    last_attempt = _as_utc(account.last_sync_attempt_at)
    if last_attempt is not None:
      elapsed = max(0, int((now - last_attempt).total_seconds()))
      if elapsed < SYNC_INTERVAL_SECONDS:
        if force:
          raise SePayError(
            "Refresh is temporarily rate-limited",
            kind="rate_limit",
            status_code=429,
            retry_after=SYNC_INTERVAL_SECONDS - elapsed,
          )
        return account

    account.last_sync_attempt_at = now
    # Keep the row lock until the upstream request finishes. PostgreSQL
    # workers therefore cannot start a duplicate sync for the same account.
    db.flush()

    client: SePayClient | None = None
    try:
      token = decrypt_api_token(account.credential_ciphertext)
      client = SePayClient(SePayConfig(token, account.external_account_id))
      details = client.get_account_details()
    except SePayError as error:
      db.rollback()
      db.refresh(account)
      account.balance_status = (
        "inactive"
        if error.kind == "inactive"
        else "stale"
        if account.balance is not None
        else "unavailable"
      )
      account.last_sync_error = error.public_message[:160]
      account.last_sync_attempt_at = now
      db.commit()
      raise
    finally:
      if client is not None:
        client.close()

    account.bank_name = details.bank_name
    account.account_number_masked = details.account_number_masked
    account.account_name = details.account_name
    account.currency = "VND"
    account.balance = details.balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    account.balance_status = "verified"
    account.last_synced_at = now
    account.last_transaction_at = details.last_transaction_at
    account.last_sync_error = None
    account.last_sync_attempt_at = now
    db.commit()
    return _refresh_account(db, account)


def sync_if_due(
  db: Session,
  account: FinancialAccount,
) -> SePayError | None:
  try:
    sync_account(db, account)
  except SePayError as error:
    return error
  return None


def mark_stale_if_old(db: Session, account: FinancialAccount) -> FinancialAccount:
  last_synced = _as_utc(account.last_synced_at)
  if (
    account.balance_status == "verified"
    and last_synced is not None
    and (utcnow() - last_synced).total_seconds() >= SYNC_INTERVAL_SECONDS
  ):
    account.balance_status = "stale"
    db.commit()
    db.refresh(account)
  return account


def _convert(
  amount: Decimal,
  source_currency: str,
  target_currency: str,
  *,
  as_of: datetime,
) -> tuple[Decimal | None, str | None]:
  if source_currency == target_currency:
    return amount, None

  provider = get_exchange_rate_provider()
  try:
    rates = provider.get_rates(
      source_currency,
      target_currency,
      as_of.date(),
      as_of.date(),
    )
    quote = quote_for_date(rates, as_of.date())
  except ExchangeRateProviderError:
    return None, f"Missing {source_currency}/{target_currency} exchange rate"
  if quote is None:
    return None, f"Missing {source_currency}/{target_currency} exchange rate"
  return (amount * quote.rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), None


@dataclass(frozen=True)
class NetWorthResult:
  reporting_currency: str
  total_assets: Decimal | None
  total_liabilities: Decimal | None
  net_worth: Decimal | None
  conversion_complete: bool
  valuation_complete: bool
  asset_breakdown: list[dict]
  liability_breakdown: list[dict]
  warnings: list[str]
  last_updated_at: datetime | None


def build_net_worth(
  db: Session,
  user: User,
  accounts: list[FinancialAccount],
) -> NetWorthResult:
  reporting_currency = user.preferred_currency or "USD"
  conversion_complete = True
  valuation_complete = bool(accounts)
  warnings: list[str] = []
  asset_breakdown: list[dict] = []
  liability_breakdown: list[dict] = []
  total_assets = Decimal(0)
  total_liabilities = Decimal(0)
  last_updated_at: datetime | None = None
  as_of = utcnow()

  for account in accounts:
    last_updated_at = max(
      [value for value in (last_updated_at, _as_utc(account.last_synced_at)) if value is not None],
      default=None,
    )
    included = account.balance is not None and account.balance_status == "verified"
    reporting_amount: Decimal | None = None
    warning: str | None = None
    if account.balance is not None:
      reporting_amount, warning = _convert(
        account.balance,
        account.currency,
        reporting_currency,
        as_of=_as_utc(account.last_synced_at) or as_of,
      )
      if warning:
        conversion_complete = False
        warnings.append(warning)
    if account.balance_status != "verified":
      valuation_complete = False
      warnings.append(
        f"{account.bank_name} balance is {account.balance_status}; it is not included in confirmed net worth"
      )
    if included and reporting_amount is not None:
      total_assets += reporting_amount
    elif included:
      conversion_complete = False

    asset_breakdown.append(
      {
        "id": account.id,
        "type": "bank_account",
        "name": account.bank_name,
        "provider": account.provider,
        "amount": account.balance,
        "currency": account.currency,
        "reporting_amount": reporting_amount,
        "reporting_currency": reporting_currency,
        "included": included and reporting_amount is not None,
        "status": account.balance_status,
        "stale": account.balance_status == "stale",
        "last_updated_at": _as_utc(account.last_synced_at),
        "warning": warning,
      }
    )

  loans = db.query(Loan).filter(Loan.user_id == user.id).order_by(Loan.bank_name.asc()).all()
  if not accounts:
    valuation_complete = False
    warnings.append("No connected bank account is available")

  for loan in loans:
    calculation = calculate_loan(
      loan.disbursement_amount,
      loan.interest_rate_per_year,
      loan.open_date,
      loan.duration_months,
      loan.loan_type,
      currency=loan.currency,
    )
    reporting_amount, warning = _convert(
      calculation.current_balance,
      loan.currency,
      reporting_currency,
      as_of=as_of,
    )
    if warning:
      conversion_complete = False
      warnings.append(warning)
    if reporting_amount is not None:
      total_liabilities += reporting_amount
    liability_breakdown.append(
      {
        "id": loan.id,
        "type": "loan",
        "name": loan.bank_name,
        "amount": calculation.current_balance,
        "currency": loan.currency,
        "reporting_amount": reporting_amount,
        "reporting_currency": reporting_currency,
        "included": reporting_amount is not None,
        "status": "outstanding" if calculation.current_balance > 0 else "settled",
        "stale": False,
        "last_updated_at": _as_utc(loan.updated_at),
        "warning": warning,
      }
    )
    last_updated_at = max(
      [value for value in (last_updated_at, _as_utc(loan.updated_at)) if value is not None],
      default=None,
    )

  valuation_complete = valuation_complete and conversion_complete
  if not conversion_complete:
    warnings.append("Net worth is incomplete because one or more exchange rates are unavailable")
  warnings = list(dict.fromkeys(warnings))
  confirmed_assets = total_assets if valuation_complete else None
  confirmed_liabilities = total_liabilities if valuation_complete else None
  confirmed_net_worth = (
    confirmed_assets - confirmed_liabilities
    if confirmed_assets is not None and confirmed_liabilities is not None
    else None
  )
  return NetWorthResult(
    reporting_currency=reporting_currency,
    total_assets=confirmed_assets,
    total_liabilities=confirmed_liabilities,
    net_worth=confirmed_net_worth,
    conversion_complete=conversion_complete,
    valuation_complete=valuation_complete,
    asset_breakdown=asset_breakdown,
    liability_breakdown=liability_breakdown,
    warnings=warnings,
    last_updated_at=last_updated_at,
  )
