"""Saving Pot persistence helpers shared by the pot router and Monthly Close."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .cashflow import as_utc, month_range
from .cashflow_report import MONEY_QUANTUM, compute_converted_period_totals
from .exchange_rates import FrankfurterExchangeRateProvider
from .models import SavingPot, SavingPotEntry, SavingPotMonthApplication


def get_pot(db: Session, user_id: str, *, for_update: bool = False) -> SavingPot | None:
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


def iter_months(start_year: int, start_month: int, end_year: int, end_month: int):
  year, month = start_year, start_month
  while (year, month) <= (end_year, end_month):
    yield year, month
    if month == 12:
      year += 1
      month = 1
    else:
      month += 1


def add_entry(
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
  stamp = now
  latest = (
    db.query(SavingPotEntry.created_at)
    .filter(SavingPotEntry.saving_pot_id == pot.id)
    .order_by(SavingPotEntry.created_at.desc())
    .first()
  )
  if latest and latest[0] is not None and as_utc(latest[0]) >= as_utc(now):
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


def month_application_period(
  pot: SavingPot, year: int, month: int
) -> tuple[datetime, datetime]:
  month_start, month_end = month_range(year, month)
  created = as_utc(pot.created_at)
  period_start = month_start
  if year == created.year and month == created.month:
    period_start = max(month_start, created)
  return period_start, month_end


def pot_applies_to_month(pot: SavingPot, year: int, month: int) -> bool:
  created = as_utc(pot.created_at)
  return (created.year, created.month) <= (year, month)


def month_application(
  pot: SavingPot, year: int, month: int
) -> SavingPotMonthApplication | None:
  return next(
    (item for item in pot.applications if item.year == year and item.month == month),
    None,
  )


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

  for year, month in iter_months(created.year, created.month, last_year, last_month):
    month_start, month_end = month_range(year, month)
    if month_end > now:
      continue

    period_start, _ = month_application_period(pot, year, month)
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
        add_entry(
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
        add_entry(
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
    add_entry(
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
