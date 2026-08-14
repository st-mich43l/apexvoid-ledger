"""Monthly Close: auditable checkpoints over existing financial engines."""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from pydantic.alias_generators import to_camel

from .cashflow import month_range
from .cashflow_report import MONEY_QUANTUM, compute_converted_month_totals, compute_converted_period_totals
from .exchange_rates import FrankfurterExchangeRateProvider
from .models import MonthlyClose, MonthlyCloseSnapshot, User
from .monthly_budget import monthly_budget_summary
from .saving_pot_domain import (
  get_pot,
  month_application,
  month_application_period,
  pot_applies_to_month,
  synchronize_closed_months,
)
from .schemas import (
  MonthlyCloseCurrentRead,
  MonthlyCloseDifferenceRead,
  MonthlyCloseSnapshotRead,
  MonthlyCloseSummary,
)

DRIFT_FIELDS: tuple[tuple[str, str, str], ...] = (
  ("scheduled_income_total", "Scheduled income", "reporting"),
  ("manual_income_total", "Manual / additional income", "reporting"),
  ("income_total", "Total income", "reporting"),
  ("fixed_expense_total", "Fixed commitments", "reporting"),
  ("variable_expense_total", "Variable spending", "reporting"),
  ("loan_payment_total", "Loan obligations", "reporting"),
  ("expense_total", "Total expenses", "reporting"),
  ("net_cash_flow", "Net cash flow", "reporting"),
  ("manual_transaction_count", "Manual transactions", "count"),
  ("scheduled_income_count", "Scheduled income items", "count"),
  ("fixed_expense_count", "Fixed expense items", "count"),
  ("loan_payment_count", "Loan obligation items", "count"),
  ("has_budget", "Budget configured", "bool"),
  ("budget_currency", "Budget currency", "text"),
  ("planned_savings_amount", "Planned savings", "budget"),
  ("planned_variable_budget_total", "Variable budget", "budget"),
  ("budget_actual_variable_expense_total", "Budget actual variable spending", "budget"),
  ("unallocated_buffer", "Unallocated buffer", "budget"),
  ("safe_to_spend", "Safe to spend", "budget"),
  ("unbudgeted_spend_total", "Unbudgeted spending", "budget"),
  ("budget_comparison_complete", "Budget comparison complete", "bool"),
  ("saving_pot_exists", "Saving Pot configured", "bool"),
  ("saving_pot_applicable", "Saving Pot applicable", "bool"),
  ("saving_pot_currency", "Saving Pot currency", "text"),
  ("saving_pot_month_applied_amount", "Saving Pot month application", "pot"),
  ("saving_pot_synced", "Saving Pot synced", "bool"),
  ("conversion_complete", "Conversion complete", "bool"),
)


def _money(value: Decimal | int | float | None) -> Decimal | None:
  if value is None:
    return None
  return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _money0(value: Decimal | int | float | None) -> Decimal:
  result = _money(value)
  return result if result is not None else Decimal("0.00")


def _float(value: Decimal | None) -> float | None:
  if value is None:
    return None
  return float(value)


def month_is_past(year: int, month: int, *, now: datetime | None = None) -> bool:
  now = now or datetime.now(timezone.utc)
  _start, month_end = month_range(year, month)
  return month_end <= now


def month_last_day(year: int, month: int) -> date:
  return date(year, month, monthrange(year, month)[1])


def _month_label(year: int, month: int) -> str:
  return date(year, month, 1).strftime("%B %Y")


@dataclass
class CloseCandidate:
  reporting_currency: str
  scheduled_income_total: Decimal
  manual_income_total: Decimal
  income_total: Decimal
  fixed_expense_total: Decimal
  variable_expense_total: Decimal
  loan_payment_total: Decimal
  expense_total: Decimal
  net_cash_flow: Decimal
  manual_transaction_count: int
  scheduled_income_count: int
  fixed_expense_count: int
  loan_payment_count: int
  has_budget: bool
  budget_currency: str | None
  planned_savings_amount: Decimal | None
  planned_variable_budget_total: Decimal | None
  budget_actual_variable_expense_total: Decimal | None
  unallocated_buffer: Decimal | None
  safe_to_spend: Decimal | None
  unbudgeted_spend_total: Decimal | None
  budget_comparison_complete: bool | None
  savings_target_variance: Decimal | None
  saving_pot_exists: bool
  saving_pot_applicable: bool
  saving_pot_currency: str | None
  saving_pot_month_applied_amount: Decimal | None
  saving_pot_synced: bool | None
  saving_pot_status: str
  conversion_complete: bool
  unconverted_currencies: list[str]
  blockers: list[str]


def _sum_converted(converted, *, entry_type: str | None = None, source_kind: str | None = None) -> Decimal:
  total = Decimal("0")
  for entry, amount in converted:
    if entry_type is not None and entry.entry_type != entry_type:
      continue
    if source_kind is not None and entry.source_kind != source_kind:
      continue
    total += amount
  return total.quantize(MONEY_QUANTUM)


def _count_converted(converted, *, entry_type: str | None = None, source_kind: str | None = None) -> int:
  count = 0
  for entry, _amount in converted:
    if entry_type is not None and entry.entry_type != entry_type:
      continue
    if source_kind is not None and entry.source_kind != source_kind:
      continue
    count += 1
  return count


def build_close_candidate(
  db: Session,
  user: User,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
  *,
  reporting_currency: str | None = None,
) -> CloseCandidate:
  currency = reporting_currency or user.preferred_currency
  if currency is None:
    raise HTTPException(status_code=422, detail="Choose an account currency first")

  totals = compute_converted_month_totals(db, user.id, year, month, currency, rate_provider)
  scheduled_income = _sum_converted(
    totals.converted, entry_type="income", source_kind="recurring_income"
  )
  manual_income = _sum_converted(totals.converted, entry_type="income", source_kind="manual")
  income_total = (scheduled_income + manual_income).quantize(MONEY_QUANTUM)
  fixed_expense = _sum_converted(totals.converted, entry_type="expense", source_kind="recurring")
  variable_expense = _sum_converted(totals.converted, entry_type="expense", source_kind="manual")
  loan_payment = _sum_converted(totals.converted, entry_type="expense", source_kind="loan")
  expense_total = (fixed_expense + variable_expense + loan_payment).quantize(MONEY_QUANTUM)
  net = (income_total - expense_total).quantize(MONEY_QUANTUM)

  budget = monthly_budget_summary(
    db, user.id, user.preferred_currency, year, month, rate_provider
  )

  blockers: list[str] = []
  if not totals.conversion_complete:
    missing = ", ".join(sorted(totals.unconverted_currencies))
    blockers.append(
      f"{_month_label(year, month)} cannot be closed yet. "
      f"Some {missing} amounts could not be converted into {currency}. "
      "The financial result would be incomplete."
    )
  if budget.has_budget and not budget.budget_comparison_complete:
    missing = ", ".join(budget.unconverted_currencies) or "foreign currencies"
    blockers.append(
      f"{_month_label(year, month)} cannot be closed yet. "
      f"Budget comparison is incomplete because {missing} could not be converted."
    )

  pot = get_pot(db, user.id)
  saving_pot_exists = pot is not None
  saving_pot_applicable = bool(pot is not None and pot_applies_to_month(pot, year, month))
  saving_pot_currency = pot.currency if pot is not None else None
  applied_amount: Decimal | None = None
  saving_pot_synced: bool | None = None
  saving_pot_status = "not_configured"

  if pot is None:
    saving_pot_status = "not_configured"
  elif not saving_pot_applicable:
    saving_pot_status = "not_applicable"
  else:
    application = month_application(pot, year, month)
    period_start, period_end = month_application_period(pot, year, month)
    pot_totals = compute_converted_period_totals(
      db, user.id, period_start, period_end, pot.currency, rate_provider
    )
    if not pot_totals.conversion_complete:
      saving_pot_status = "blocked"
      missing = ", ".join(sorted(pot_totals.unconverted_currencies))
      blockers.append(
        f"{_month_label(year, month)} cannot be closed yet. "
        f"Saving Pot could not synchronize because FX rates were unavailable for: {missing}."
      )
    elif application is None:
      saving_pot_status = "missing"
      saving_pot_synced = False
    else:
      applied_amount = _money0(application.amount_applied)
      expected = pot_totals.net_cash_flow.quantize(MONEY_QUANTUM)
      if applied_amount == expected:
        saving_pot_status = "synced"
        saving_pot_synced = True
      else:
        saving_pot_status = "stale"
        saving_pot_synced = False

  planned_savings = _money(budget.planned_savings_amount) if budget.has_budget else None
  savings_variance = None
  if (
    budget.has_budget
    and planned_savings is not None
    and budget.currency == currency
  ):
    savings_variance = (net - planned_savings).quantize(MONEY_QUANTUM)

  return CloseCandidate(
    reporting_currency=currency,
    scheduled_income_total=scheduled_income,
    manual_income_total=manual_income,
    income_total=income_total,
    fixed_expense_total=fixed_expense,
    variable_expense_total=variable_expense,
    loan_payment_total=loan_payment,
    expense_total=expense_total,
    net_cash_flow=net,
    manual_transaction_count=totals.manual_transaction_count,
    scheduled_income_count=_count_converted(
      totals.converted, entry_type="income", source_kind="recurring_income"
    ),
    fixed_expense_count=_count_converted(
      totals.converted, entry_type="expense", source_kind="recurring"
    ),
    loan_payment_count=_count_converted(
      totals.converted, entry_type="expense", source_kind="loan"
    ),
    has_budget=budget.has_budget,
    budget_currency=budget.currency if budget.has_budget else None,
    planned_savings_amount=planned_savings,
    planned_variable_budget_total=_money(budget.planned_variable_budget_total)
    if budget.has_budget
    else None,
    budget_actual_variable_expense_total=_money(budget.actual_variable_expense_total)
    if budget.has_budget
    else None,
    unallocated_buffer=_money(budget.unallocated_buffer) if budget.has_budget else None,
    safe_to_spend=_money(budget.safe_to_spend) if budget.has_budget else None,
    unbudgeted_spend_total=_money(budget.unbudgeted_spend_total) if budget.has_budget else None,
    budget_comparison_complete=budget.budget_comparison_complete if budget.has_budget else None,
    savings_target_variance=savings_variance,
    saving_pot_exists=saving_pot_exists,
    saving_pot_applicable=saving_pot_applicable,
    saving_pot_currency=saving_pot_currency,
    saving_pot_month_applied_amount=applied_amount,
    saving_pot_synced=saving_pot_synced,
    saving_pot_status=saving_pot_status,
    conversion_complete=totals.conversion_complete,
    unconverted_currencies=sorted(totals.unconverted_currencies),
    blockers=blockers,
  )


def _values(obj: CloseCandidate | MonthlyCloseSnapshot) -> dict:
  return {
    "scheduled_income_total": _money0(obj.scheduled_income_total),
    "manual_income_total": _money0(obj.manual_income_total),
    "income_total": _money0(obj.income_total),
    "fixed_expense_total": _money0(obj.fixed_expense_total),
    "variable_expense_total": _money0(obj.variable_expense_total),
    "loan_payment_total": _money0(obj.loan_payment_total),
    "expense_total": _money0(obj.expense_total),
    "net_cash_flow": _money0(obj.net_cash_flow),
    "manual_transaction_count": int(obj.manual_transaction_count),
    "scheduled_income_count": int(obj.scheduled_income_count),
    "fixed_expense_count": int(obj.fixed_expense_count),
    "loan_payment_count": int(obj.loan_payment_count),
    "has_budget": bool(obj.has_budget),
    "budget_currency": obj.budget_currency,
    "planned_savings_amount": _money(obj.planned_savings_amount),
    "planned_variable_budget_total": _money(obj.planned_variable_budget_total),
    "budget_actual_variable_expense_total": _money(obj.budget_actual_variable_expense_total),
    "unallocated_buffer": _money(obj.unallocated_buffer),
    "safe_to_spend": _money(obj.safe_to_spend),
    "unbudgeted_spend_total": _money(obj.unbudgeted_spend_total),
    "budget_comparison_complete": obj.budget_comparison_complete,
    "saving_pot_exists": bool(obj.saving_pot_exists),
    "saving_pot_applicable": bool(obj.saving_pot_applicable),
    "saving_pot_currency": obj.saving_pot_currency,
    "saving_pot_month_applied_amount": _money(obj.saving_pot_month_applied_amount),
    "saving_pot_synced": obj.saving_pot_synced,
    "conversion_complete": bool(obj.conversion_complete),
  }


def compare_candidate_to_snapshot(
  candidate: CloseCandidate, snapshot: MonthlyCloseSnapshot
) -> tuple[list[str], list[MonthlyCloseDifferenceRead]]:
  current = _values(candidate)
  previous = _values(snapshot)
  fields: list[str] = []
  differences: list[MonthlyCloseDifferenceRead] = []
  for name, label, kind in DRIFT_FIELDS:
    left = previous[name]
    right = current[name]
    if left != right:
      fields.append(to_camel(name))
      currency = None
      if kind == "reporting":
        currency = candidate.reporting_currency
      elif kind == "budget":
        currency = candidate.budget_currency or snapshot.budget_currency
      elif kind == "pot":
        currency = candidate.saving_pot_currency or snapshot.saving_pot_currency
      prev_amount = float(left) if isinstance(left, Decimal) else None
      curr_amount = float(right) if isinstance(right, Decimal) else None
      if kind in {"count", "bool", "text"}:
        prev_amount = None
        curr_amount = None
      differences.append(
        MonthlyCloseDifferenceRead(
          field=to_camel(name),
          label=label,
          previous_amount=prev_amount,
          current_amount=curr_amount,
          currency=currency,
        )
      )
  return fields, differences


def _current_read(candidate: CloseCandidate) -> MonthlyCloseCurrentRead:
  return MonthlyCloseCurrentRead(
    reporting_currency=candidate.reporting_currency,
    scheduled_income_total=float(candidate.scheduled_income_total),
    manual_income_total=float(candidate.manual_income_total),
    income_total=float(candidate.income_total),
    fixed_expense_total=float(candidate.fixed_expense_total),
    variable_expense_total=float(candidate.variable_expense_total),
    loan_payment_total=float(candidate.loan_payment_total),
    expense_total=float(candidate.expense_total),
    net_cash_flow=float(candidate.net_cash_flow),
    manual_transaction_count=candidate.manual_transaction_count,
    scheduled_income_count=candidate.scheduled_income_count,
    fixed_expense_count=candidate.fixed_expense_count,
    loan_payment_count=candidate.loan_payment_count,
    has_budget=candidate.has_budget,
    budget_currency=candidate.budget_currency,
    planned_savings_amount=_float(candidate.planned_savings_amount),
    planned_variable_budget_total=_float(candidate.planned_variable_budget_total),
    budget_actual_variable_expense_total=_float(
      candidate.budget_actual_variable_expense_total
    ),
    unallocated_buffer=_float(candidate.unallocated_buffer),
    safe_to_spend=_float(candidate.safe_to_spend),
    unbudgeted_spend_total=_float(candidate.unbudgeted_spend_total),
    budget_comparison_complete=candidate.budget_comparison_complete,
    savings_target_variance=_float(candidate.savings_target_variance),
    saving_pot_exists=candidate.saving_pot_exists,
    saving_pot_applicable=candidate.saving_pot_applicable,
    saving_pot_currency=candidate.saving_pot_currency,
    saving_pot_month_applied_amount=_float(candidate.saving_pot_month_applied_amount),
    saving_pot_synced=candidate.saving_pot_synced,
    saving_pot_status=candidate.saving_pot_status,
    conversion_complete=candidate.conversion_complete,
    unconverted_currencies=candidate.unconverted_currencies,
  )


def _snapshot_read(row: MonthlyCloseSnapshot) -> MonthlyCloseSnapshotRead:
  return MonthlyCloseSnapshotRead.model_validate(row)


def _get_close(
  db: Session, user_id: str, year: int, month: int, *, for_update: bool = False
) -> MonthlyClose | None:
  query = (
    db.query(MonthlyClose)
    .options(selectinload(MonthlyClose.snapshots))
    .filter(
      MonthlyClose.user_id == user_id,
      MonthlyClose.year == year,
      MonthlyClose.month == month,
    )
  )
  if for_update:
    query = query.with_for_update(of=MonthlyClose)
  return query.first()


def _latest_snapshot(close: MonthlyClose | None) -> MonthlyCloseSnapshot | None:
  if close is None or not close.snapshots:
    return None
  return max(close.snapshots, key=lambda item: item.revision_number)


def _history(close: MonthlyClose | None) -> list[MonthlyCloseSnapshotRead]:
  if close is None:
    return []
  rows = sorted(close.snapshots, key=lambda item: item.revision_number, reverse=True)
  return [_snapshot_read(row) for row in rows]


def monthly_close_summary(
  db: Session,
  user: User,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
) -> MonthlyCloseSummary:
  close = _get_close(db, user.id, year, month)
  latest = _latest_snapshot(close)
  reporting = latest.reporting_currency if latest is not None else user.preferred_currency
  candidate = build_close_candidate(
    db, user, year, month, rate_provider, reporting_currency=reporting
  )
  past = month_is_past(year, month)
  drift_fields: list[str] = []
  differences: list[MonthlyCloseDifferenceRead] = []
  has_drift = False
  if latest is not None:
    drift_fields, differences = compare_candidate_to_snapshot(candidate, latest)
    has_drift = bool(drift_fields)

  if not past:
    status = "in_progress"
  elif latest is None:
    status = "blocked" if candidate.blockers else "ready_to_close"
  elif has_drift:
    status = "needs_review"
  else:
    status = "closed"

  return MonthlyCloseSummary(
    year=year,
    month=month,
    status=status,
    close_eligible=status == "ready_to_close",
    reclose_eligible=status == "needs_review" and not candidate.blockers,
    current=_current_read(candidate),
    latest_snapshot=_snapshot_read(latest) if latest is not None else None,
    has_drift=has_drift,
    drift_fields=drift_fields,
    differences=differences,
    history=_history(close),
    blockers=candidate.blockers,
    last_day=month_last_day(year, month),
  )


def _snapshot_from_candidate(
  close_id: str,
  revision_number: int,
  candidate: CloseCandidate,
  note: str | None,
  now: datetime,
) -> MonthlyCloseSnapshot:
  return MonthlyCloseSnapshot(
    monthly_close_id=close_id,
    revision_number=revision_number,
    reporting_currency=candidate.reporting_currency,
    scheduled_income_total=candidate.scheduled_income_total,
    manual_income_total=candidate.manual_income_total,
    income_total=candidate.income_total,
    fixed_expense_total=candidate.fixed_expense_total,
    variable_expense_total=candidate.variable_expense_total,
    loan_payment_total=candidate.loan_payment_total,
    expense_total=candidate.expense_total,
    net_cash_flow=candidate.net_cash_flow,
    manual_transaction_count=candidate.manual_transaction_count,
    scheduled_income_count=candidate.scheduled_income_count,
    fixed_expense_count=candidate.fixed_expense_count,
    loan_payment_count=candidate.loan_payment_count,
    has_budget=candidate.has_budget,
    budget_currency=candidate.budget_currency,
    planned_savings_amount=candidate.planned_savings_amount,
    planned_variable_budget_total=candidate.planned_variable_budget_total,
    budget_actual_variable_expense_total=candidate.budget_actual_variable_expense_total,
    unallocated_buffer=candidate.unallocated_buffer,
    safe_to_spend=candidate.safe_to_spend,
    unbudgeted_spend_total=candidate.unbudgeted_spend_total,
    budget_comparison_complete=candidate.budget_comparison_complete,
    saving_pot_exists=candidate.saving_pot_exists,
    saving_pot_applicable=candidate.saving_pot_applicable,
    saving_pot_currency=candidate.saving_pot_currency,
    saving_pot_month_applied_amount=candidate.saving_pot_month_applied_amount,
    saving_pot_synced=candidate.saving_pot_synced,
    conversion_complete=candidate.conversion_complete,
    note=note,
    closed_at=now,
    created_at=now,
  )


def _sync_saving_pot_for_close(
  db: Session,
  user: User,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
  now: datetime,
) -> None:
  pot = get_pot(db, user.id, for_update=True)
  if pot is None or not pot_applies_to_month(pot, year, month):
    return
  synchronize_closed_months(db, pot, rate_provider, now=now)
  db.flush()
  pot = get_pot(db, user.id)
  if pot is None:
    return
  application = month_application(pot, year, month)
  if application is None:
    raise HTTPException(
      status_code=409,
      detail=(
        f"{_month_label(year, month)} cannot be closed yet. "
        "Saving Pot could not synchronize this month."
      ),
    )


def close_month(
  db: Session,
  user: User,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
  *,
  note: str | None = None,
) -> MonthlyCloseSummary:
  now = datetime.now(timezone.utc)
  if not month_is_past(year, month, now=now):
    last = month_last_day(year, month)
    raise HTTPException(
      status_code=409,
      detail=(
        f"{_month_label(year, month)} is still in progress. "
        f"Final close becomes available after {last.isoformat()}."
      ),
    )

  existing = _get_close(db, user.id, year, month, for_update=True)
  if existing is not None and existing.snapshots:
    raise HTTPException(
      status_code=409,
      detail=f"{_month_label(year, month)} is already closed. Re-close if financial data changed.",
    )

  candidate = build_close_candidate(db, user, year, month, rate_provider)
  if candidate.blockers:
    raise HTTPException(status_code=409, detail=candidate.blockers[0])

  _sync_saving_pot_for_close(db, user, year, month, rate_provider, now)
  candidate = build_close_candidate(db, user, year, month, rate_provider)
  if candidate.blockers:
    raise HTTPException(status_code=409, detail=candidate.blockers[0])

  close = existing
  if close is None:
    close = MonthlyClose(user_id=user.id, year=year, month=month, created_at=now, updated_at=now)
    db.add(close)
    try:
      db.flush()
    except IntegrityError as error:
      db.rollback()
      raise HTTPException(
        status_code=409,
        detail=f"{_month_label(year, month)} is already closed. Re-close if financial data changed.",
      ) from error
  else:
    close.updated_at = now

  snapshot = _snapshot_from_candidate(close.id, 1, candidate, note, now)
  db.add(snapshot)
  try:
    db.commit()
  except IntegrityError as error:
    db.rollback()
    raise HTTPException(
      status_code=409,
      detail=f"{_month_label(year, month)} is already closed. Re-close if financial data changed.",
    ) from error
  return monthly_close_summary(db, user, year, month, rate_provider)


def reclose_month(
  db: Session,
  user: User,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
  *,
  reason: str,
) -> MonthlyCloseSummary:
  now = datetime.now(timezone.utc)
  if not month_is_past(year, month, now=now):
    last = month_last_day(year, month)
    raise HTTPException(
      status_code=409,
      detail=(
        f"{_month_label(year, month)} is still in progress. "
        f"Final close becomes available after {last.isoformat()}."
      ),
    )

  close = _get_close(db, user.id, year, month, for_update=True)
  latest = _latest_snapshot(close)
  if close is None or latest is None:
    raise HTTPException(
      status_code=409,
      detail=f"{_month_label(year, month)} has not been closed yet.",
    )

  reporting = latest.reporting_currency
  candidate = build_close_candidate(
    db, user, year, month, rate_provider, reporting_currency=reporting
  )
  drift_fields, _differences = compare_candidate_to_snapshot(candidate, latest)
  if not drift_fields:
    raise HTTPException(
      status_code=409,
      detail="No financial changes were detected since the latest close.",
    )
  if candidate.blockers:
    raise HTTPException(status_code=409, detail=candidate.blockers[0])

  _sync_saving_pot_for_close(db, user, year, month, rate_provider, now)
  candidate = build_close_candidate(
    db, user, year, month, rate_provider, reporting_currency=reporting
  )
  if candidate.blockers:
    raise HTTPException(status_code=409, detail=candidate.blockers[0])
  drift_fields, _differences = compare_candidate_to_snapshot(candidate, latest)
  if not drift_fields:
    raise HTTPException(
      status_code=409,
      detail="No financial changes were detected since the latest close.",
    )

  next_revision = latest.revision_number + 1
  close.updated_at = now
  snapshot = _snapshot_from_candidate(close.id, next_revision, candidate, reason, now)
  db.add(snapshot)
  try:
    db.commit()
  except IntegrityError as error:
    db.rollback()
    raise HTTPException(
      status_code=409,
      detail="A concurrent close revision already exists. Reload and try again.",
    ) from error
  return monthly_close_summary(db, user, year, month, rate_provider)
