from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import User
from ..monthly_close import close_month, monthly_close_summary, reclose_month
from ..schemas import MonthlyCloseCreate, MonthlyCloseReclose, MonthlyCloseSummary

router = APIRouter(prefix="/api/monthly-close", tags=["monthly-close"])


@router.get("", response_model=MonthlyCloseSummary)
def get_monthly_close(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  return monthly_close_summary(db, current_user, year, month, rate_provider)


@router.post("/{year}/{month}/close", response_model=MonthlyCloseSummary, status_code=201)
def post_close_month(
  year: Annotated[int, Path(ge=1, le=9999)],
  month: Annotated[int, Path(ge=1, le=12)],
  payload: MonthlyCloseCreate | None = None,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  note = payload.note if payload is not None else None
  return close_month(db, current_user, year, month, rate_provider, note=note)


@router.post("/{year}/{month}/reclose", response_model=MonthlyCloseSummary)
def post_reclose_month(
  year: Annotated[int, Path(ge=1, le=9999)],
  month: Annotated[int, Path(ge=1, le=12)],
  payload: MonthlyCloseReclose,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  return reclose_month(
    db, current_user, year, month, rate_provider, reason=payload.reason
  )
