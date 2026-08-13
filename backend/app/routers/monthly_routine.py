from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import User
from ..monthly_routine import compute_monthly_routine
from ..schemas import (
  CurrencyCode,
  CurrencyConversionRate,
  LoanPaymentActivityRead,
  MonthlyRoutineSummary,
  RecurringExpenseActivityRead,
  RecurringIncomeActivityRead,
  RoutineVariableCategoryRead,
)

router = APIRouter(prefix="/api/monthly-routine", tags=["monthly-routine"])


@router.get("", response_model=MonthlyRoutineSummary)
def get_monthly_routine(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  currency: CurrencyCode = Query(),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  result = compute_monthly_routine(
    db, current_user.id, year, month, currency, rate_provider
  )

  converted_by_key = {
    (
      entry.source_kind,
      entry.loan.id if entry.loan is not None else None,
      entry.loan_term,
      entry.recurring_expense_id,
      entry.occurred_at.isoformat(),
    ): amount
    for entry, amount in result.cashflow_entries_converted
  }

  fixed_expenses = [
    RecurringExpenseActivityRead(
      id=f"recurring:{entry.recurring_expense_id}:{entry.occurred_at.date().isoformat()}",
      recurring_expense_id=entry.recurring_expense_id,
      name=entry.recurring_name or entry.category_name,
      category_id=entry.category_id,
      category_name=entry.category_name,
      category_icon=entry.category_icon,
      due_at=entry.occurred_at,
      amount=entry.amount,
      currency=entry.currency,
      reporting_amount=converted_by_key.get(
        (
          "recurring",
          None,
          None,
          entry.recurring_expense_id,
          entry.occurred_at.isoformat(),
        )
      ),
      reporting_currency=currency,
    )
    for entry in sorted(
      (e for e in result.cashflow_entries if e.source_kind == "recurring"),
      key=lambda item: item.occurred_at,
      reverse=True,
    )
  ]

  loan_payments = [
    LoanPaymentActivityRead(
      id=f"loan:{entry.loan.id}:{entry.loan_term}",
      loan_id=entry.loan.id,
      bank_name=entry.loan.bank_name,
      term=entry.loan_term,
      due_at=entry.occurred_at,
      amount=entry.amount,
      currency=entry.currency,
      reporting_amount=converted_by_key.get(
        (
          "loan",
          entry.loan.id,
          entry.loan_term,
          None,
          entry.occurred_at.isoformat(),
        )
      ),
      reporting_currency=currency,
    )
    for entry in sorted(
      (e for e in result.cashflow_entries if e.source_kind == "loan"),
      key=lambda item: item.occurred_at,
      reverse=True,
    )
  ]

  expected_income = [
    RecurringIncomeActivityRead(
      id=f"expected-income:{item.activity.recurring_income_id}:{item.activity.expected_at.date().isoformat()}",
      recurring_income_id=item.activity.recurring_income_id,
      name=item.activity.name,
      category_id=item.activity.category_id,
      category_name=item.activity.category_name,
      category_icon=item.activity.category_icon,
      expected_at=item.activity.expected_at,
      amount=item.activity.amount,
      currency=item.activity.currency,
      reporting_amount=item.reporting_amount,
      reporting_currency=currency,
    )
    for item in result.expected_incomes
  ]

  conversion_rates = [
    CurrencyConversionRate(
      source_currency=quote.source_currency,
      target_currency=quote.target_currency,
      rate=quote.rate,
      rate_date=quote.rate_date,
    )
    for quote in sorted(
      result.used_rates.values(),
      key=lambda item: (item.source_currency, item.rate_date),
    )
  ]
  has_conversions = bool(result.converted_currencies)

  return MonthlyRoutineSummary(
    year=year,
    month=month,
    currency=currency,
    expected_income_total=result.expected_income_total,
    expected_income_count=len(expected_income),
    expected_income=expected_income,
    fixed_expense_total=result.fixed_expense_total,
    fixed_expense_count=result.fixed_expense_count,
    fixed_expenses=fixed_expenses,
    loan_payment_total=result.loan_payment_total,
    loan_payment_count=result.loan_payment_count,
    loan_payments=loan_payments,
    committed_expense_total=result.committed_expense_total,
    baseline_available=result.baseline_available,
    actual_income_total=result.actual_income_total,
    actual_variable_expense_total=result.actual_variable_expense_total,
    projected_remainder=result.projected_remainder,
    variable_categories=[
      RoutineVariableCategoryRead(
        category_id=item.category_id,
        name=item.name,
        icon=item.icon,
        amount=item.amount,
      )
      for item in result.variable_categories
    ],
    converted_currencies=sorted(result.converted_currencies),
    unconverted_currencies=sorted(result.unconverted_currencies),
    conversion_rates=conversion_rates,
    exchange_rate_provider=rate_provider.provider_name if has_conversions else None,
    exchange_rate_provider_url=rate_provider.provider_url if has_conversions else None,
  )
