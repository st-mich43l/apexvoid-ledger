from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import require_password_changed
from ..cashflow import as_utc, month_range
from ..cashflow_report import MONEY_QUANTUM, compute_converted_month_totals
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import SavingPot, SavingPotMonthApplication, User
from ..schemas import (
  SavingPotAdjust,
  SavingPotMonthApplicationRead,
  SavingPotRead,
  SavingPotUpsert,
)

router = APIRouter(prefix="/api/saving-pot", tags=["saving-pot"])


def _serialize(pot: SavingPot) -> SavingPotRead:
  applications = sorted(
    pot.applications,
    key=lambda item: (item.year, item.month),
    reverse=True,
  )
  return SavingPotRead(
    id=pot.id,
    balance=pot.balance,
    currency=pot.currency,
    created_at=pot.created_at,
    updated_at=pot.updated_at,
    applications=[
      SavingPotMonthApplicationRead(
        id=item.id,
        year=item.year,
        month=item.month,
        amount_applied=item.amount_applied,
        currency=item.currency,
        applied_at=item.applied_at,
      )
      for item in applications
    ],
  )


def _get_pot(db: Session, user_id: str) -> SavingPot | None:
  return (
    db.query(SavingPot)
    .options(joinedload(SavingPot.applications))
    .filter(SavingPot.user_id == user_id)
    .first()
  )


def _iter_months(start_year: int, start_month: int, end_year: int, end_month: int):
  year, month = start_year, start_month
  while (year, month) <= (end_year, end_month):
    yield year, month
    if month == 12:
      year += 1
      month = 1
    else:
      month += 1


def apply_closed_months(
  db: Session,
  pot: SavingPot,
  rate_provider: FrankfurterExchangeRateProvider,
  *,
  now: datetime | None = None,
) -> bool:
  """Apply each closed, unapplied month's net cash flow once. Returns True if changed."""
  now = as_utc(now or datetime.now(timezone.utc))
  created = as_utc(pot.created_at)
  applied = {(item.year, item.month) for item in pot.applications}
  changed = False

  # Walk from pot creation month through the previous calendar month relative
  # to `now`, applying only months whose end is already past.
  cursor_year, cursor_month = created.year, created.month
  # Cap the walk at the month before `now`'s month (current month never closes
  # until its end). Also check month_range end <= now for safety around TZ.
  last_year, last_month = now.year, now.month
  if last_month == 1:
    last_year -= 1
    last_month = 12
  else:
    last_month -= 1

  if (cursor_year, cursor_month) > (last_year, last_month):
    return False

  for year, month in _iter_months(cursor_year, cursor_month, last_year, last_month):
    if (year, month) in applied:
      continue
    _start, end = month_range(year, month)
    if end > now:
      continue

    totals = compute_converted_month_totals(
      db, pot.user_id, year, month, pot.currency, rate_provider
    )
    net = totals.net_cash_flow.quantize(MONEY_QUANTUM)
    pot.balance = (Decimal(pot.balance) + net).quantize(MONEY_QUANTUM)
    pot.updated_at = now
    application = SavingPotMonthApplication(
      saving_pot_id=pot.id,
      year=year,
      month=month,
      amount_applied=net,
      currency=pot.currency,
      applied_at=now,
    )
    db.add(application)
    pot.applications.append(application)
    applied.add((year, month))
    changed = True

  return changed


@router.get("", response_model=SavingPotRead)
def get_saving_pot(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  pot = _get_pot(db, current_user.id)
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  if apply_closed_months(db, pot, rate_provider):
    db.commit()
    db.refresh(pot)
    pot = _get_pot(db, current_user.id)
    assert pot is not None

  return _serialize(pot)


@router.put("", response_model=SavingPotRead)
def upsert_saving_pot(
  payload: SavingPotUpsert,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  currency = payload.currency or current_user.preferred_currency
  if currency is None:
    raise HTTPException(
      status_code=400,
      detail="Set a preferred currency before creating a saving pot",
    )

  now = datetime.now(timezone.utc)
  pot = _get_pot(db, current_user.id)
  balance = Decimal(payload.balance).quantize(MONEY_QUANTUM)

  if pot is None:
    pot = SavingPot(
      user_id=current_user.id,
      balance=balance,
      currency=currency,
      created_at=now,
      updated_at=now,
    )
    db.add(pot)
    db.commit()
    db.refresh(pot)
    pot = _get_pot(db, current_user.id)
    assert pot is not None
  else:
    pot.balance = balance
    if payload.currency is not None:
      pot.currency = payload.currency
    pot.updated_at = now
    db.commit()
    # Manual overwrite keeps application history; still apply any newly
    # closed months that have not been counted yet.
    pot = _get_pot(db, current_user.id)
    assert pot is not None
    if apply_closed_months(db, pot, rate_provider):
      db.commit()
      pot = _get_pot(db, current_user.id)
      assert pot is not None

  return _serialize(pot)


@router.post("/adjust", response_model=SavingPotRead)
def adjust_saving_pot(
  payload: SavingPotAdjust,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  pot = _get_pot(db, current_user.id)
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  # Apply any newly closed months first so the adjustment is against an up-to-date balance.
  if apply_closed_months(db, pot, rate_provider):
    db.commit()
    pot = _get_pot(db, current_user.id)
    assert pot is not None

  amount = Decimal(payload.amount).quantize(MONEY_QUANTUM)
  current = Decimal(pot.balance)
  if payload.direction == "add":
    next_balance = (current + amount).quantize(MONEY_QUANTUM)
  else:
    next_balance = (current - amount).quantize(MONEY_QUANTUM)
    if next_balance < 0:
      raise HTTPException(
        status_code=400,
        detail="Subtract amount cannot exceed the current balance",
      )

  now = datetime.now(timezone.utc)
  pot.balance = next_balance
  pot.updated_at = now
  db.commit()
  pot = _get_pot(db, current_user.id)
  assert pot is not None
  return _serialize(pot)
