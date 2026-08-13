from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..models import RecurringExpense, User
from ..recurring_expenses import (
  create_recurring_expense,
  deactivate_recurring_expense,
  exclusive_until_to_inclusive_end,
  format_month,
  get_owned_expense,
  is_series_active,
  latest_revision,
  list_owned_expenses,
  parse_month,
  reactivate_recurring_expense,
  series_start_month,
  update_recurring_expense,
)
from ..schemas import (
  RecurringExpenseCreate,
  RecurringExpenseDeactivate,
  RecurringExpenseReactivate,
  RecurringExpenseRead,
  RecurringExpenseUpdate,
)

router = APIRouter(prefix="/api/recurring-expenses", tags=["recurring-expenses"])


def _serialize(expense: RecurringExpense) -> RecurringExpenseRead:
  latest = latest_revision(expense)
  end_inclusive = exclusive_until_to_inclusive_end(latest.effective_until_month)
  return RecurringExpenseRead(
    id=expense.id,
    name=latest.name,
    category_id=latest.category_id,
    category_name=latest.category.name,
    category_icon=latest.category.icon,
    amount=latest.amount,
    currency=latest.currency,
    due_day=latest.due_day,
    start_month=format_month(series_start_month(expense)),
    end_month=format_month(end_inclusive) if end_inclusive is not None else None,
    is_active=is_series_active(expense),
    created_at=expense.created_at,
    updated_at=expense.updated_at,
  )


@router.get("", response_model=list[RecurringExpenseRead])
def list_recurring_expenses(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  return [_serialize(expense) for expense in list_owned_expenses(db, current_user.id)]


@router.post("", response_model=RecurringExpenseRead, status_code=201)
def create_expense(
  payload: RecurringExpenseCreate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  expense = create_recurring_expense(
    db,
    current_user.id,
    name=payload.name,
    category_id=payload.category_id,
    amount=Decimal(payload.amount).quantize(Decimal("0.01")),
    currency=payload.currency,
    due_day=payload.due_day,
    start_month=parse_month(payload.start_month),
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(expense)


@router.put("/{expense_id}", response_model=RecurringExpenseRead)
def update_expense(
  expense_id: str,
  payload: RecurringExpenseUpdate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  expense = update_recurring_expense(
    db,
    current_user.id,
    expense_id,
    name=payload.name,
    category_id=payload.category_id,
    amount=Decimal(payload.amount).quantize(Decimal("0.01")),
    currency=payload.currency,
    due_day=payload.due_day,
    effective_from_month=parse_month(payload.effective_from_month),
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(expense)


@router.post("/{expense_id}/deactivate", response_model=RecurringExpenseRead)
def deactivate_expense(
  expense_id: str,
  payload: RecurringExpenseDeactivate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  # Touch ownership first for consistent 404.
  get_owned_expense(db, current_user.id, expense_id)
  expense = deactivate_recurring_expense(
    db,
    current_user.id,
    expense_id,
    effective_from_month=parse_month(payload.effective_from_month),
  )
  return _serialize(expense)


@router.post("/{expense_id}/reactivate", response_model=RecurringExpenseRead)
def reactivate_expense(
  expense_id: str,
  payload: RecurringExpenseReactivate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  get_owned_expense(db, current_user.id, expense_id)
  expense = reactivate_recurring_expense(
    db,
    current_user.id,
    expense_id,
    resume_from_month=parse_month(payload.resume_from_month),
    name=payload.name,
    category_id=payload.category_id,
    amount=(
      Decimal(payload.amount).quantize(Decimal("0.01")) if payload.amount is not None else None
    ),
    currency=payload.currency,
    due_day=payload.due_day,
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(expense)
