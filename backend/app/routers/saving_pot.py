from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..auth import require_password_changed
from ..cashflow import as_utc, month_range
from ..cashflow_report import MONEY_QUANTUM, compute_converted_period_totals
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import SavingPot, SavingPotEntry, SavingPotMonthApplication, User
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
  # Use selectinload (not joinedload): Postgres rejects FOR UPDATE on the
  # nullable side of an outer join when locking a pot with its applications.
  query = (
    db.query(SavingPot)
    .options(selectinload(SavingPot.applications))
    .filter(SavingPot.user_id == user_id)
  )
  if for_update:
    query = query.with_for_update(of=SavingPot)
  return query.first()


def _iter_months(start_year: int, start_month: int, end_year: int, end_month: int):
  year, month = start_year, start_month
  while (year, month) <= (end_year, end_month):
    yield year, month
    if month == 12:
      year += 1
      month = 1
    else:
      month += 1


def _add_entry(
  db: Session,
  pot: SavingPot,
  *,
  entry_type: str,
  amount: Decimal,
  now: datetime,
  year: int | None = None,
  month: int | None = None,
  note: str | None = None,
) -> SavingPotEntry:
  # Nudge by microseconds so same-transaction entries sort stably newest-last.
  stamp = now
  latest = (
    db.query(SavingPotEntry.created_at)
    .filter(SavingPotEntry.saving_pot_id == pot.id)
    .order_by(SavingPotEntry.created_at.desc())
    .first()
  )
  if latest and latest[0] is not None and as_utc(latest[0]) >= as_utc(now):
    from datetime import timedelta

    stamp = as_utc(latest[0]) + timedelta(microseconds=1)

  entry = SavingPotEntry(
    saving_pot_id=pot.id,
    entry_type=entry_type,
    amount=amount,
    currency=pot.currency,
    year=year,
    month=month,
    note=note,
    created_at=stamp,
  )
  db.add(entry)
  return entry


def synchronize_closed_months(
  db: Session,
  pot: SavingPot,
  rate_provider: FrankfurterExchangeRateProvider,
  *,
  now: datetime | None = None,
) -> tuple[bool, list[str]]:
  """Synchronize/reconcile closed months. Returns (changed, sync_warnings)."""
  now = as_utc(now or datetime.now(timezone.utc))
  created = as_utc(pot.created_at)
  applications_by_month = {(item.year, item.month): item for item in pot.applications}
  changed = False
  warnings: list[str] = []

  last_year, last_month = now.year, now.month
  if last_month == 1:
    last_year -= 1
    last_month = 12
  else:
    last_month -= 1

  if (created.year, created.month) > (last_year, last_month):
    return False, warnings

  for year, month in _iter_months(created.year, created.month, last_year, last_month):
    month_start, month_end = month_range(year, month)
    if month_end > now:
      continue

    period_start = month_start
    if year == created.year and month == created.month:
      period_start = max(month_start, created)

    totals = compute_converted_period_totals(
      db, pot.user_id, period_start, month_end, pot.currency, rate_provider
    )
    if not totals.conversion_complete:
      missing = ", ".join(sorted(totals.unconverted_currencies))
      warnings.append(
        f"{year}-{month:02d} could not be synchronized because FX rates were "
        f"unavailable for: {missing}"
      )
      continue

    calculated_net = totals.net_cash_flow.quantize(MONEY_QUANTUM)
    application = applications_by_month.get((year, month))

    if application is None:
      delta = calculated_net
      application = SavingPotMonthApplication(
        saving_pot_id=pot.id,
        year=year,
        month=month,
        amount_applied=calculated_net,
        currency=pot.currency,
        applied_at=now,
      )
      try:
        with db.begin_nested():
          db.add(application)
          db.flush()
      except IntegrityError:
        # Concurrent request created the row; reload and reconcile against it.
        application = (
          db.query(SavingPotMonthApplication)
          .filter(
            SavingPotMonthApplication.saving_pot_id == pot.id,
            SavingPotMonthApplication.year == year,
            SavingPotMonthApplication.month == month,
          )
          .one()
        )
        applications_by_month[(year, month)] = application
        previous = Decimal(application.amount_applied).quantize(MONEY_QUANTUM)
        delta = (calculated_net - previous).quantize(MONEY_QUANTUM)
        if delta == 0:
          continue
        application.amount_applied = calculated_net
        application.applied_at = now
        pot.balance = (Decimal(pot.balance) + delta).quantize(MONEY_QUANTUM)
        pot.updated_at = now
        _add_entry(
          db,
          pot,
          entry_type="month_reconciliation",
          amount=delta,
          now=now,
          year=year,
          month=month,
        )
        changed = True
        continue

      pot.applications.append(application)
      applications_by_month[(year, month)] = application
      if delta != 0:
        pot.balance = (Decimal(pot.balance) + delta).quantize(MONEY_QUANTUM)
        pot.updated_at = now
        _add_entry(
          db,
          pot,
          entry_type="month_apply",
          amount=delta,
          now=now,
          year=year,
          month=month,
        )
        changed = True
      else:
        # Zero-net months still need a checkpoint for future reconciliations.
        changed = True
      continue

    previous = Decimal(application.amount_applied).quantize(MONEY_QUANTUM)
    delta = (calculated_net - previous).quantize(MONEY_QUANTUM)
    if delta == 0:
      continue

    application.amount_applied = calculated_net
    application.applied_at = now
    pot.balance = (Decimal(pot.balance) + delta).quantize(MONEY_QUANTUM)
    pot.updated_at = now
    _add_entry(
      db,
      pot,
      entry_type="month_reconciliation",
      amount=delta,
      now=now,
      year=year,
      month=month,
    )
    changed = True

  return changed, warnings


@router.get("", response_model=SavingPotRead)
def get_saving_pot(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  pot = _get_pot(db, current_user.id, for_update=True)
  if pot is None:
    raise HTTPException(status_code=404, detail="Saving pot not found")

  changed, warnings = synchronize_closed_months(db, pot, rate_provider)
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
    _add_entry(
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
    _add_entry(
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
  _add_entry(
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
