from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..models import FinancialAccount, User
from ..net_worth import (
  build_net_worth,
  ensure_configured_account,
  mark_stale_if_old,
  sync_account,
  sync_if_due,
)
from ..schemas import (
  FinancialAccountRead,
  NetWorthLineRead,
  NetWorthSummaryRead,
)
from ..sepay import SePayError, get_sepay_config

router = APIRouter(prefix="/api/net-worth", tags=["net-worth"])


def _provider_http_error(error: SePayError) -> HTTPException:
  headers = {"Retry-After": str(error.retry_after)} if error.retry_after else None
  return HTTPException(status_code=error.status_code, detail=error.public_message, headers=headers)


def _owned_accounts(db: Session, user: User) -> list[FinancialAccount]:
  return (
    db.query(FinancialAccount)
    .filter(FinancialAccount.user_id == user.id)
    .order_by(FinancialAccount.created_at.asc())
    .all()
  )


def _get_owned_account(db: Session, account_id: UUID, user: User) -> FinancialAccount:
  account = (
    db.query(FinancialAccount)
    .filter(FinancialAccount.id == str(account_id), FinancialAccount.user_id == user.id)
    .first()
  )
  if account is None:
    raise HTTPException(status_code=404, detail="Financial account not found")
  return account


def _sync_configured_accounts(
  db: Session,
  user: User,
  accounts: list[FinancialAccount],
) -> list[str]:
  warnings: list[str] = []
  try:
    config = get_sepay_config()
    configured = ensure_configured_account(db, user)
  except SePayError as error:
    for account in accounts:
      mark_stale_if_old(db, account)
    warnings.append(error.public_message)
    return warnings

  if config is None or configured is None:
    for account in accounts:
      mark_stale_if_old(db, account)
    return warnings

  # The query is repeated after provisioning so the returned list remains
  # the complete user-owned set if additional providers are added later.
  accounts[:] = _owned_accounts(db, user)
  for account in accounts:
    mark_stale_if_old(db, account)
    if account.provider != "sepay" or account.external_account_id != config.bank_account_id:
      continue
    error = sync_if_due(db, account)
    if error is not None:
      warnings.append(error.public_message)
  return warnings


def _account_read(account: FinancialAccount) -> FinancialAccountRead:
  return FinancialAccountRead.model_validate(account)


@router.get("/accounts", response_model=list[FinancialAccountRead])
def list_accounts(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  accounts = _owned_accounts(db, current_user)
  warnings = _sync_configured_accounts(db, current_user, accounts)
  # A list response has no warning envelope. Configuration errors are
  # surfaced through the summary endpoint and the account's safe sync status.
  del warnings
  return [_account_read(account) for account in accounts]


@router.get("/summary", response_model=NetWorthSummaryRead)
def get_summary(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  accounts = _owned_accounts(db, current_user)
  sync_warnings = _sync_configured_accounts(db, current_user, accounts)
  result = build_net_worth(db, current_user, accounts)
  for warning in sync_warnings:
    if warning not in result.warnings:
      result.warnings.append(warning)
  return NetWorthSummaryRead(
    reporting_currency=result.reporting_currency,
    total_assets=result.total_assets,
    total_liabilities=result.total_liabilities,
    net_worth=result.net_worth,
    conversion_complete=result.conversion_complete,
    valuation_complete=result.valuation_complete,
    asset_breakdown=[NetWorthLineRead.model_validate(line) for line in result.asset_breakdown],
    liability_breakdown=[
      NetWorthLineRead.model_validate(line) for line in result.liability_breakdown
    ],
    warnings=result.warnings,
    last_updated_at=result.last_updated_at,
  )


@router.post("/accounts/{account_id}/refresh", response_model=FinancialAccountRead)
def refresh_account(
  account_id: UUID,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  account = _get_owned_account(db, account_id, current_user)
  try:
    sync_account(db, account, force=True)
  except SePayError as error:
    raise _provider_http_error(error) from error
  return _account_read(account)
