"""Expected recurring income domain helpers (planning only — not Cash Flow)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from .cashflow import as_utc, ensure_default_categories
from .models import Category, RecurringIncome, RecurringIncomeRevision
from .monthly_recurrence import (
  due_at_for_month,
  exclusive_until_to_inclusive_end,
  format_month,
  inclusive_end_to_exclusive,
  months_touching,
  normalize_name,
  revision_covers_month,
)


@dataclass
class ExpectedIncomeActivity:
  recurring_income_id: str
  name: str
  category_id: str
  category_name: str
  category_icon: str | None
  amount: Decimal
  currency: str
  expected_at: datetime


def _get_income_category(
  db: Session,
  user_id: str,
  category_id: str,
  *,
  require_active: bool,
) -> Category:
  ensure_default_categories(db, user_id)
  category = (
    db.query(Category)
    .filter(Category.id == category_id, Category.user_id == user_id)
    .first()
  )
  if category is None:
    raise HTTPException(status_code=404, detail="Category not found")
  if category.category_type != "income":
    raise HTTPException(status_code=422, detail="Expected income requires an income category")
  if require_active and not category.is_active:
    raise HTTPException(status_code=422, detail="Category is inactive")
  return category


def latest_revision(income: RecurringIncome) -> RecurringIncomeRevision:
  if not income.revisions:
    raise HTTPException(status_code=500, detail="Recurring income has no revisions")
  return max(income.revisions, key=lambda item: as_utc(item.effective_from_month))


def series_start_month(income: RecurringIncome) -> datetime:
  return min(as_utc(item.effective_from_month) for item in income.revisions)


def is_series_active(income: RecurringIncome, as_of: datetime | None = None) -> bool:
  latest = latest_revision(income)
  if latest.effective_until_month is None:
    return True
  as_of = as_utc(as_of or datetime.now(timezone.utc))
  current_month = datetime(as_of.year, as_of.month, 1, tzinfo=timezone.utc)
  return as_utc(latest.effective_until_month) > current_month


def get_owned_income(db: Session, user_id: str, income_id: str) -> RecurringIncome:
  income = (
    db.query(RecurringIncome)
    .options(
      selectinload(RecurringIncome.revisions).joinedload(RecurringIncomeRevision.category)
    )
    .filter(RecurringIncome.id == income_id, RecurringIncome.user_id == user_id)
    .first()
  )
  if income is None:
    raise HTTPException(status_code=404, detail="Recurring income not found")
  return income


def list_owned_incomes(db: Session, user_id: str) -> list[RecurringIncome]:
  return (
    db.query(RecurringIncome)
    .options(
      selectinload(RecurringIncome.revisions).joinedload(RecurringIncomeRevision.category)
    )
    .filter(RecurringIncome.user_id == user_id)
    .order_by(RecurringIncome.created_at.asc())
    .all()
  )


def create_recurring_income(
  db: Session,
  user_id: str,
  *,
  name: str,
  category_id: str,
  amount: Decimal,
  currency: str,
  expected_day: int,
  start_month: datetime,
  end_month: datetime | None,
) -> RecurringIncome:
  category = _get_income_category(db, user_id, category_id, require_active=True)
  clean_name = normalize_name(name)
  start_month = as_utc(start_month)
  exclusive_until = inclusive_end_to_exclusive(
    as_utc(end_month) if end_month is not None else None
  )
  if exclusive_until is not None and exclusive_until <= start_month:
    raise HTTPException(status_code=422, detail="End month must be on or after start month")

  now = datetime.now(timezone.utc)
  income = RecurringIncome(user_id=user_id, created_at=now, updated_at=now)
  revision = RecurringIncomeRevision(
    recurring_income=income,
    name=clean_name,
    category_id=category.id,
    amount=amount,
    currency=currency,
    expected_day=expected_day,
    effective_from_month=start_month,
    effective_until_month=exclusive_until,
    created_at=now,
  )
  db.add(income)
  db.add(revision)
  db.commit()
  return get_owned_income(db, user_id, income.id)


def update_recurring_income(
  db: Session,
  user_id: str,
  income_id: str,
  *,
  name: str,
  category_id: str,
  amount: Decimal,
  currency: str,
  expected_day: int,
  effective_from_month: datetime,
  end_month: datetime | None,
) -> RecurringIncome:
  income = get_owned_income(db, user_id, income_id)
  category = _get_income_category(db, user_id, category_id, require_active=True)
  clean_name = normalize_name(name)
  effective_from = as_utc(effective_from_month)
  exclusive_until = inclusive_end_to_exclusive(
    as_utc(end_month) if end_month is not None else None
  )
  if exclusive_until is not None and exclusive_until <= effective_from:
    raise HTTPException(status_code=422, detail="End month must be on or after effective month")

  latest = latest_revision(income)
  latest_from = as_utc(latest.effective_from_month)
  latest_until = (
    as_utc(latest.effective_until_month) if latest.effective_until_month is not None else None
  )

  if effective_from < latest_from:
    raise HTTPException(
      status_code=409,
      detail="Effective month cannot precede the latest revision; historical multi-revision edits are not supported",
    )
  if latest_until is not None and effective_from >= latest_until:
    raise HTTPException(
      status_code=409,
      detail="Effective month is outside the latest revision; resume the income instead",
    )

  now = datetime.now(timezone.utc)
  if effective_from == latest_from:
    latest.name = clean_name
    latest.category_id = category.id
    latest.amount = amount
    latest.currency = currency
    latest.expected_day = expected_day
    latest.effective_until_month = exclusive_until
  else:
    previous_until = latest_until
    latest.effective_until_month = effective_from
    db.add(
      RecurringIncomeRevision(
        recurring_income_id=income.id,
        name=clean_name,
        category_id=category.id,
        amount=amount,
        currency=currency,
        expected_day=expected_day,
        effective_from_month=effective_from,
        effective_until_month=exclusive_until if exclusive_until is not None else previous_until,
        created_at=now,
      )
    )

  income.updated_at = now
  db.commit()
  return get_owned_income(db, user_id, income.id)


def deactivate_recurring_income(
  db: Session,
  user_id: str,
  income_id: str,
  *,
  effective_from_month: datetime,
) -> RecurringIncome:
  income = get_owned_income(db, user_id, income_id)
  stop_from = as_utc(effective_from_month)
  latest = latest_revision(income)
  latest_from = as_utc(latest.effective_from_month)
  latest_until = (
    as_utc(latest.effective_until_month) if latest.effective_until_month is not None else None
  )

  if stop_from < latest_from:
    raise HTTPException(
      status_code=409,
      detail="Stop month cannot precede the latest revision start",
    )
  if latest_until is not None and stop_from >= latest_until:
    raise HTTPException(status_code=409, detail="Recurring income is already stopped by that month")

  latest.effective_until_month = stop_from
  income.updated_at = datetime.now(timezone.utc)
  db.commit()
  return get_owned_income(db, user_id, income.id)


def reactivate_recurring_income(
  db: Session,
  user_id: str,
  income_id: str,
  *,
  resume_from_month: datetime,
  name: str | None = None,
  category_id: str | None = None,
  amount: Decimal | None = None,
  currency: str | None = None,
  expected_day: int | None = None,
  end_month: datetime | None = None,
) -> RecurringIncome:
  income = get_owned_income(db, user_id, income_id)
  resume_from = as_utc(resume_from_month)
  latest = latest_revision(income)
  latest_until = (
    as_utc(latest.effective_until_month) if latest.effective_until_month is not None else None
  )
  if latest_until is None:
    raise HTTPException(status_code=409, detail="Recurring income is already active")
  if resume_from < latest_until:
    raise HTTPException(
      status_code=409,
      detail="Resume month must be on or after the previous end month",
    )

  category = _get_income_category(
    db,
    user_id,
    category_id or latest.category_id,
    require_active=True,
  )
  exclusive_until = inclusive_end_to_exclusive(
    as_utc(end_month) if end_month is not None else None
  )
  if exclusive_until is not None and exclusive_until <= resume_from:
    raise HTTPException(status_code=422, detail="End month must be on or after resume month")

  now = datetime.now(timezone.utc)
  db.add(
    RecurringIncomeRevision(
      recurring_income_id=income.id,
      name=normalize_name(name) if name is not None else latest.name,
      category_id=category.id,
      amount=amount if amount is not None else latest.amount,
      currency=currency if currency is not None else latest.currency,
      expected_day=expected_day if expected_day is not None else latest.expected_day,
      effective_from_month=resume_from,
      effective_until_month=exclusive_until,
      created_at=now,
    )
  )
  income.updated_at = now
  db.commit()
  return get_owned_income(db, user_id, income.id)


def load_applicable_income_revisions(
  db: Session,
  user_id: str,
  start: datetime,
  end: datetime,
) -> list[RecurringIncomeRevision]:
  start = as_utc(start)
  end = as_utc(end)
  if end <= start:
    return []
  months = months_touching(start, end)
  if not months:
    return []
  first_month = months[0]
  last_month = months[-1]
  return (
    db.query(RecurringIncomeRevision)
    .join(RecurringIncome)
    .filter(RecurringIncome.user_id == user_id)
    .filter(RecurringIncomeRevision.effective_from_month <= last_month)
    .filter(
      (RecurringIncomeRevision.effective_until_month.is_(None))
      | (RecurringIncomeRevision.effective_until_month > first_month)
    )
    .options(
      selectinload(RecurringIncomeRevision.category),
      selectinload(RecurringIncomeRevision.recurring_income),
    )
    .all()
  )


def expected_income_activities(
  db: Session,
  user_id: str,
  start: datetime,
  end: datetime,
) -> list[ExpectedIncomeActivity]:
  """Derive expected-income planning activity for [start, end). Never persists."""
  start = as_utc(start)
  end = as_utc(end)
  revisions = load_applicable_income_revisions(db, user_id, start, end)
  seen: set[tuple[str, date]] = set()
  activities: list[ExpectedIncomeActivity] = []
  for month_start in months_touching(start, end):
    for revision in revisions:
      if not revision_covers_month(revision, month_start):
        continue
      key = (revision.recurring_income_id, month_start.date())
      if key in seen:
        continue
      seen.add(key)
      expected_at = due_at_for_month(
        month_start.year, month_start.month, revision.expected_day
      )
      if not (start <= expected_at < end):
        continue
      category = revision.category
      activities.append(
        ExpectedIncomeActivity(
          recurring_income_id=revision.recurring_income_id,
          name=revision.name,
          category_id=category.id,
          category_name=category.name,
          category_icon=category.icon,
          amount=revision.amount,
          currency=revision.currency,
          expected_at=expected_at,
        )
      )
  return activities


# Re-export helpers used by serializers/routers.
__all__ = [
  "ExpectedIncomeActivity",
  "create_recurring_income",
  "deactivate_recurring_income",
  "exclusive_until_to_inclusive_end",
  "expected_income_activities",
  "format_month",
  "get_owned_income",
  "is_series_active",
  "latest_revision",
  "list_owned_incomes",
  "reactivate_recurring_income",
  "series_start_month",
  "update_recurring_income",
]
