from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import User
from ..monthly_budget import (
  copy_previous_monthly_budget,
  delete_monthly_budget,
  monthly_budget_summary,
  save_monthly_budget,
)
from ..schemas import MonthlyBudgetSummary, MonthlyBudgetUpsert

router = APIRouter(prefix="/api/monthly-budget", tags=["monthly-budget"])


@router.get("", response_model=MonthlyBudgetSummary)
def get_monthly_budget(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  return monthly_budget_summary(
    db,
    current_user.id,
    current_user.preferred_currency,
    year,
    month,
    rate_provider,
  )


@router.put("", response_model=MonthlyBudgetSummary)
def upsert_monthly_budget(
  payload: MonthlyBudgetUpsert,
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  save_monthly_budget(
    db,
    current_user.id,
    current_user.preferred_currency,
    year,
    month,
    payload,
  )
  return monthly_budget_summary(
    db,
    current_user.id,
    current_user.preferred_currency,
    year,
    month,
    rate_provider,
  )


@router.delete("", status_code=204)
def reset_monthly_budget(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  delete_monthly_budget(db, current_user.id, year, month)


@router.post("/copy-previous", response_model=MonthlyBudgetSummary, status_code=201)
def copy_previous_budget(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  copy_previous_monthly_budget(db, current_user.id, year, month)
  return monthly_budget_summary(
    db,
    current_user.id,
    current_user.preferred_currency,
    year,
    month,
    rate_provider,
  )
