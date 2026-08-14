from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..cashflow import as_utc
from ..cashflow_report import MONEY_QUANTUM
from ..database import get_db
from ..exchange_rates import get_exchange_rate_provider
from ..models import SavingPot, SavingPotEntry, User
from ..saving_pot_domain import (
  add_entry,
  get_pot,
  synchronize_closed_months,
)
from ..schemas import (
  SavingPotAdjust,
  SavingPotEntryRead,
  SavingPotHistoryPage,
  SavingPotMonthApplicationRead,
  SavingPotRead,
  SavingPotUpsert,
)

router = APIRouter(prefix="/api/saving-pot", tags=["saving-pot"])


def _serialize_entry(entry: SavingPotEntry) -> SavingPotEntryRead:
  return SavingPotEntryRead(
    id=entry.id,
    entry_type=entry.entry_type,
    amount=entry.amount,
    currency=entry.currency,
    year=entry.year,
    month=entry.month,
    note=entry.note,
    created_at=entry.created_at,
  )


def _serialize(pot: SavingPot, sync_warnings: list[str] | None = None) -> SavingPotRead:
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
    sync_warnings=sync_warnings or [],
  )


def _get_pot(db: Session, user_id: str, *, for_update: bool = False) -> SavingPot | None:
  return get_pot(db, user_id, for_update=for_update)


@router.get("", response_model=SavingPotRead)
def get_saving_pot(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  pot = _get_pot(db, current_user.id, for_update=True)
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  changed, warnings = synchronize_closed_months(
    db, pot, rate_provider, now=datetime.now(timezone.utc)
  )
  if changed:
    db.commit()
    pot = _get_pot(db, current_user.id)
    assert pot is not None
  else:
    db.commit()  # release row lock

  return _serialize(pot, warnings)


@router.get("/history", response_model=SavingPotHistoryPage)
def get_saving_pot_history(
  limit: int = Query(default=50, ge=1, le=200),
  offset: int = Query(default=0, ge=0),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  pot = db.query(SavingPot).filter(SavingPot.user_id == current_user.id).first()
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  query = db.query(SavingPotEntry).filter(SavingPotEntry.saving_pot_id == pot.id)
  total = query.count()
  items = (
    query.order_by(SavingPotEntry.created_at.desc(), SavingPotEntry.id.desc())
    .offset(offset)
    .limit(limit)
    .all()
  )
  return SavingPotHistoryPage(
    items=[_serialize_entry(item) for item in items],
    total=total,
    limit=limit,
    offset=offset,
  )


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
  balance = Decimal(payload.balance).quantize(MONEY_QUANTUM)
  note = payload.note or None

  pot = _get_pot(db, current_user.id, for_update=True)
  warnings: list[str] = []

  if pot is None:
    pot = SavingPot(
      user_id=current_user.id,
      balance=balance,
      currency=currency,
      created_at=now,
      updated_at=now,
    )
    db.add(pot)
    db.flush()
    add_entry(
      db,
      pot,
      entry_type="opening",
      amount=balance,
      now=now,
      note=note,
    )
    db.commit()
    pot = _get_pot(db, current_user.id)
    assert pot is not None
    return _serialize(pot)

  if payload.currency is not None and payload.currency != pot.currency:
    db.rollback()
    raise HTTPException(
      status_code=400,
      detail="Saving pot currency cannot be changed after creation",
    )

  current = Decimal(pot.balance).quantize(MONEY_QUANTUM)
  delta = (balance - current).quantize(MONEY_QUANTUM)
  if delta != 0:
    pot.balance = balance
    pot.updated_at = now
    add_entry(
      db,
      pot,
      entry_type="balance_correction",
      amount=delta,
      now=now,
      note=note,
    )

  changed, warnings = synchronize_closed_months(db, pot, rate_provider, now=now)
  if delta != 0 or changed:
    db.commit()
  else:
    db.commit()

  pot = _get_pot(db, current_user.id)
  assert pot is not None
  return _serialize(pot, warnings)


@router.post("/adjust", response_model=SavingPotRead)
def adjust_saving_pot(
  payload: SavingPotAdjust,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  pot = _get_pot(db, current_user.id, for_update=True)
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  now = datetime.now(timezone.utc)
  changed, warnings = synchronize_closed_months(db, pot, rate_provider, now=now)
  if changed:
    db.flush()

  amount = Decimal(payload.amount).quantize(MONEY_QUANTUM)
  current = Decimal(pot.balance)
  if payload.direction == "add":
    next_balance = (current + amount).quantize(MONEY_QUANTUM)
    entry_type = "manual_add"
    signed = amount
  else:
    next_balance = (current - amount).quantize(MONEY_QUANTUM)
    if next_balance < 0:
      db.rollback()
      raise HTTPException(
        status_code=400,
        detail="Subtract amount cannot exceed the current balance",
      )
    entry_type = "manual_subtract"
    signed = (-amount).quantize(MONEY_QUANTUM)

  pot.balance = next_balance
  pot.updated_at = now
  add_entry(
    db,
    pot,
    entry_type=entry_type,
    amount=signed,
    now=now,
    note=payload.note or None,
  )
  db.commit()
  pot = _get_pot(db, current_user.id)
  assert pot is not None
  return _serialize(pot, warnings)
