"""Monthly recurring expense domain helpers (schedule definitions, not transactions)."""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from .cashflow import as_utc, ensure_default_categories
from .models import Category, RecurringExpense, RecurringExpenseRevision

MONTH_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")
NAME_MAX_LENGTH = 120


def parse_month(value: str) -> datetime:
  match = MONTH_PATTERN.fullmatch(value.strip())
  if match is None:
    raise HTTPException(status_code=422, detail="Month must use YYYY-MM format")
  year = int(match.group(1))
  month = int(match.group(2))
  if month < 1 or month > 12:
    raise HTTPException(status_code=422, detail="Month must use YYYY-MM format")
  return datetime(year, month, 1, tzinfo=timezone.utc)


def format_month(value: datetime) -> str:
  value = as_utc(value)
  return f"{value.year:04d}-{value.month:02d}"


def next_month(value: datetime) -> datetime:
  value = as_utc(value)
  if value.month == 12:
    return datetime(value.year + 1, 1, 1, tzinfo=timezone.utc)
  return datetime(value.year, value.month + 1, 1, tzinfo=timezone.utc)


def previous_month(value: datetime) -> datetime:
  value = as_utc(value)
  if value.month == 1:
    return datetime(value.year - 1, 12, 1, tzinfo=timezone.utc)
  return datetime(value.year, value.month - 1, 1, tzinfo=timezone.utc)


def inclusive_end_to_exclusive(end_month: datetime | None) -> datetime | None:
  if end_month is None:
    return None
  return next_month(end_month)


def exclusive_until_to_inclusive_end(until: datetime | None) -> datetime | None:
  if until is None:
    return None
  return previous_month(until)


def due_at_for_month(year: int, month: int, due_day: int) -> datetime:
  last_day = calendar.monthrange(year, month)[1]
  day = min(due_day, last_day)
  return datetime(year, month, day, tzinfo=timezone.utc)


def months_touching(start: datetime, end: datetime) -> list[datetime]:
  start = as_utc(start)
  end = as_utc(end)
  if end <= start:
    return []
  cursor = datetime(start.year, start.month, 1, tzinfo=timezone.utc)
  last = end - timedelta(microseconds=1)
  last_month = datetime(last.year, last.month, 1, tzinfo=timezone.utc)
  months: list[datetime] = []
  while cursor <= last_month:
    months.append(cursor)
    cursor = next_month(cursor)
  return months


def revision_covers_month(revision: RecurringExpenseRevision, month_start: datetime) -> bool:
  month_start = as_utc(month_start)
  from_month = as_utc(revision.effective_from_month)
  until = (
    as_utc(revision.effective_until_month)
    if revision.effective_until_month is not None
    else None
  )
  if from_month > month_start:
    return False
  if until is not None and month_start >= until:
    return False
  return True


def normalize_name(name: str) -> str:
  cleaned = re.sub(r"\s+", " ", name.strip())
  if not cleaned:
    raise HTTPException(status_code=422, detail="Name is required")
  if len(cleaned) > NAME_MAX_LENGTH:
    raise HTTPException(
      status_code=422, detail=f"Name must be at most {NAME_MAX_LENGTH} characters"
    )
  return cleaned


def _get_expense_category(
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
  if category.category_type != "expense":
    raise HTTPException(status_code=422, detail="Recurring expenses require an expense category")
  if require_active and not category.is_active:
    raise HTTPException(status_code=422, detail="Category is inactive")
  return category


def latest_revision(expense: RecurringExpense) -> RecurringExpenseRevision:
  if not expense.revisions:
    raise HTTPException(status_code=500, detail="Recurring expense has no revisions")
  return max(expense.revisions, key=lambda item: as_utc(item.effective_from_month))


def series_start_month(expense: RecurringExpense) -> datetime:
  return min(as_utc(item.effective_from_month) for item in expense.revisions)


def is_series_active(expense: RecurringExpense, as_of: datetime | None = None) -> bool:
  latest = latest_revision(expense)
  if latest.effective_until_month is None:
    return True
  as_of = as_utc(as_of or datetime.now(timezone.utc))
  current_month = datetime(as_of.year, as_of.month, 1, tzinfo=timezone.utc)
  return as_utc(latest.effective_until_month) > current_month


def get_owned_expense(
  db: Session,
  user_id: str,
  expense_id: str,
) -> RecurringExpense:
  expense = (
    db.query(RecurringExpense)
    .options(
      selectinload(RecurringExpense.revisions).joinedload(RecurringExpenseRevision.category)
    )
    .filter(RecurringExpense.id == expense_id, RecurringExpense.user_id == user_id)
    .first()
  )
  if expense is None:
    raise HTTPException(status_code=404, detail="Recurring expense not found")
  return expense


def list_owned_expenses(db: Session, user_id: str) -> list[RecurringExpense]:
  return (
    db.query(RecurringExpense)
    .options(
      selectinload(RecurringExpense.revisions).joinedload(RecurringExpenseRevision.category)
    )
    .filter(RecurringExpense.user_id == user_id)
    .order_by(RecurringExpense.created_at.asc())
    .all()
  )


def create_recurring_expense(
  db: Session,
  user_id: str,
  *,
  name: str,
  category_id: str,
  amount: Decimal,
  currency: str,
  due_day: int,
  start_month: datetime,
  end_month: datetime | None,
) -> RecurringExpense:
  category = _get_expense_category(db, user_id, category_id, require_active=True)
  clean_name = normalize_name(name)
  start_month = as_utc(start_month)
  exclusive_until = inclusive_end_to_exclusive(
    as_utc(end_month) if end_month is not None else None
  )
  if exclusive_until is not None and exclusive_until <= start_month:
    raise HTTPException(status_code=422, detail="End month must be on or after start month")

  now = datetime.now(timezone.utc)
  expense = RecurringExpense(user_id=user_id, created_at=now, updated_at=now)
  revision = RecurringExpenseRevision(
    recurring_expense=expense,
    name=clean_name,
    category_id=category.id,
    amount=amount,
    currency=currency,
    due_day=due_day,
    effective_from_month=start_month,
    effective_until_month=exclusive_until,
    created_at=now,
  )
  db.add(expense)
  db.add(revision)
  db.commit()
  return get_owned_expense(db, user_id, expense.id)


def update_recurring_expense(
  db: Session,
  user_id: str,
  expense_id: str,
  *,
  name: str,
  category_id: str,
  amount: Decimal,
  currency: str,
  due_day: int,
  effective_from_month: datetime,
  end_month: datetime | None,
) -> RecurringExpense:
  expense = get_owned_expense(db, user_id, expense_id)
  category = _get_expense_category(db, user_id, category_id, require_active=True)
  clean_name = normalize_name(name)
  effective_from = as_utc(effective_from_month)
  exclusive_until = inclusive_end_to_exclusive(
    as_utc(end_month) if end_month is not None else None
  )
  if exclusive_until is not None and exclusive_until <= effective_from:
    raise HTTPException(status_code=422, detail="End month must be on or after effective month")

  latest = latest_revision(expense)
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
      detail="Effective month is outside the latest revision; resume the expense instead",
    )

  now = datetime.now(timezone.utc)
  if effective_from == latest_from:
    latest.name = clean_name
    latest.category_id = category.id
    latest.amount = amount
    latest.currency = currency
    latest.due_day = due_day
    latest.effective_until_month = exclusive_until
  else:
    previous_until = latest_until
    latest.effective_until_month = effective_from
    db.add(
      RecurringExpenseRevision(
        recurring_expense_id=expense.id,
        name=clean_name,
        category_id=category.id,
        amount=amount,
        currency=currency,
        due_day=due_day,
        effective_from_month=effective_from,
        effective_until_month=exclusive_until if exclusive_until is not None else previous_until,
        created_at=now,
      )
    )

  expense.updated_at = now
  db.commit()
  return get_owned_expense(db, user_id, expense.id)


def deactivate_recurring_expense(
  db: Session,
  user_id: str,
  expense_id: str,
  *,
  effective_from_month: datetime,
) -> RecurringExpense:
  expense = get_owned_expense(db, user_id, expense_id)
  stop_from = as_utc(effective_from_month)
  latest = latest_revision(expense)
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
    raise HTTPException(status_code=409, detail="Recurring expense is already stopped by that month")

  if stop_from == latest_from:
    # Zero-length latest revision: remove it and close the previous open end if needed.
    # Prefer closing the interval so history before stop_from remains.
    latest.effective_until_month = stop_from
  else:
    latest.effective_until_month = stop_from

  expense.updated_at = datetime.now(timezone.utc)
  db.commit()
  return get_owned_expense(db, user_id, expense.id)


def reactivate_recurring_expense(
  db: Session,
  user_id: str,
  expense_id: str,
  *,
  resume_from_month: datetime,
  name: str | None = None,
  category_id: str | None = None,
  amount: Decimal | None = None,
  currency: str | None = None,
  due_day: int | None = None,
  end_month: datetime | None = None,
) -> RecurringExpense:
  expense = get_owned_expense(db, user_id, expense_id)
  resume_from = as_utc(resume_from_month)
  latest = latest_revision(expense)
  latest_until = (
    as_utc(latest.effective_until_month) if latest.effective_until_month is not None else None
  )
  if latest_until is None:
    raise HTTPException(status_code=409, detail="Recurring expense is already active")
  if resume_from < latest_until:
    raise HTTPException(
      status_code=409,
      detail="Resume month must be on or after the previous end month",
    )

  category = _get_expense_category(
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
    RecurringExpenseRevision(
      recurring_expense_id=expense.id,
      name=normalize_name(name) if name is not None else latest.name,
      category_id=category.id,
      amount=amount if amount is not None else latest.amount,
      currency=currency if currency is not None else latest.currency,
      due_day=due_day if due_day is not None else latest.due_day,
      effective_from_month=resume_from,
      effective_until_month=exclusive_until,
      created_at=now,
    )
  )
  expense.updated_at = now
  db.commit()
  return get_owned_expense(db, user_id, expense.id)


def load_applicable_revisions(
  db: Session,
  user_id: str,
  start: datetime,
  end: datetime,
) -> list[RecurringExpenseRevision]:
  """Load revisions that could generate dues inside [start, end)."""
  start = as_utc(start)
  end = as_utc(end)
  if end <= start:
    return []

  months = months_touching(start, end)
  if not months:
    return []
  first_month = months[0]
  last_month = months[-1]

  revisions = (
    db.query(RecurringExpenseRevision)
    .join(RecurringExpense)
    .filter(RecurringExpense.user_id == user_id)
    .filter(RecurringExpenseRevision.effective_from_month <= last_month)
    .filter(
      (RecurringExpenseRevision.effective_until_month.is_(None))
      | (RecurringExpenseRevision.effective_until_month > first_month)
    )
    .options(
      selectinload(RecurringExpenseRevision.category),
      selectinload(RecurringExpenseRevision.recurring_expense),
    )
    .all()
  )
  return revisions
