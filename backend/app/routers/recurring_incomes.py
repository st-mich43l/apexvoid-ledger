from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..models import RecurringIncome, User
from ..monthly_recurrence import parse_month
from ..recurring_income import (
  create_recurring_income,
  deactivate_recurring_income,
  exclusive_until_to_inclusive_end,
  format_month,
  get_owned_income,
  is_series_active,
  latest_revision,
  list_owned_incomes,
  reactivate_recurring_income,
  series_start_month,
  update_recurring_income,
)
from ..schemas import (
  RecurringIncomeCreate,
  RecurringIncomeDeactivate,
  RecurringIncomeReactivate,
  RecurringIncomeRead,
  RecurringIncomeUpdate,
)

router = APIRouter(prefix="/api/recurring-incomes", tags=["recurring-incomes"])


def _serialize(income: RecurringIncome) -> RecurringIncomeRead:
  latest = latest_revision(income)
  end_inclusive = exclusive_until_to_inclusive_end(latest.effective_until_month)
  return RecurringIncomeRead(
    id=income.id,
    name=latest.name,
    category_id=latest.category_id,
    category_name=latest.category.name,
    category_icon=latest.category.icon,
    amount=latest.amount,
    currency=latest.currency,
    expected_day=latest.expected_day,
    start_month=format_month(series_start_month(income)),
    end_month=format_month(end_inclusive) if end_inclusive is not None else None,
    is_active=is_series_active(income),
    created_at=income.created_at,
    updated_at=income.updated_at,
  )


@router.get("", response_model=list[RecurringIncomeRead])
def list_recurring_incomes(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  return [_serialize(item) for item in list_owned_incomes(db, current_user.id)]


@router.post("", response_model=RecurringIncomeRead, status_code=201)
def create_income(
  payload: RecurringIncomeCreate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  income = create_recurring_income(
    db,
    current_user.id,
    name=payload.name,
    category_id=payload.category_id,
    amount=Decimal(payload.amount).quantize(Decimal("0.01")),
    currency=payload.currency,
    expected_day=payload.expected_day,
    start_month=parse_month(payload.start_month),
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(income)


@router.put("/{income_id}", response_model=RecurringIncomeRead)
def update_income(
  income_id: str,
  payload: RecurringIncomeUpdate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  income = update_recurring_income(
    db,
    current_user.id,
    income_id,
    name=payload.name,
    category_id=payload.category_id,
    amount=Decimal(payload.amount).quantize(Decimal("0.01")),
    currency=payload.currency,
    expected_day=payload.expected_day,
    effective_from_month=parse_month(payload.effective_from_month),
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(income)


@router.post("/{income_id}/deactivate", response_model=RecurringIncomeRead)
def deactivate_income(
  income_id: str,
  payload: RecurringIncomeDeactivate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  get_owned_income(db, current_user.id, income_id)
  income = deactivate_recurring_income(
    db,
    current_user.id,
    income_id,
    effective_from_month=parse_month(payload.effective_from_month),
  )
  return _serialize(income)


@router.post("/{income_id}/reactivate", response_model=RecurringIncomeRead)
def reactivate_income(
  income_id: str,
  payload: RecurringIncomeReactivate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  get_owned_income(db, current_user.id, income_id)
  income = reactivate_recurring_income(
    db,
    current_user.id,
    income_id,
    resume_from_month=parse_month(payload.resume_from_month),
    name=payload.name,
    category_id=payload.category_id,
    amount=(
      Decimal(payload.amount).quantize(Decimal("0.01")) if payload.amount is not None else None
    ),
    currency=payload.currency,
    expected_day=payload.expected_day,
    end_month=parse_month(payload.end_month) if payload.end_month else None,
  )
  return _serialize(income)
