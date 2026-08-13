from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..cashflow_report import compute_converted_month_totals
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import User
from ..schemas import (
  CashFlowMonthlySummary,
  CategorySpendingSummary,
  CurrencyCode,
  CurrencyConversionRate,
  LoanPaymentActivityRead,
  RecurringExpenseActivityRead,
)

router = APIRouter(prefix="/api/cashflow", tags=["cashflow"])


@router.get("/summary", response_model=CashFlowMonthlySummary)
def get_monthly_summary(
  year: int = Query(ge=1, le=9999),
  month: int = Query(ge=1, le=12),
  currency: CurrencyCode = Query(),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  totals = compute_converted_month_totals(
    db, current_user.id, year, month, currency, rate_provider
  )

  savings_rate = (
    (totals.net_cash_flow / totals.income * Decimal(100)).quantize(
      Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if totals.income > 0
    else None
  )

  by_category: dict[str, tuple[str, str | None, Decimal]] = {}
  for entry, amount in totals.converted:
    if entry.entry_type != "expense":
      continue
    current = by_category.get(
      entry.category_id,
      (entry.category_name, entry.category_icon, Decimal(0)),
    )
    by_category[entry.category_id] = (current[0], current[1], current[2] + amount)

  category_breakdown = [
    CategorySpendingSummary(
      category_id=category_id,
      name=name,
      icon=icon,
      amount=amount,
      percent=(
        (amount / totals.expenses * Decimal(100)).quantize(
          Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if totals.expenses > 0
        else Decimal(0)
      ),
    )
    for category_id, (name, icon, amount) in sorted(
      by_category.items(), key=lambda item: item[1][2], reverse=True
    )
  ]

  converted_by_key = {
    (
      entry.source_kind,
      entry.loan.id if entry.loan is not None else None,
      entry.loan_term,
      entry.recurring_expense_id,
      entry.occurred_at.isoformat(),
    ): amount
    for entry, amount in totals.converted
  }

  loan_entries = [entry for entry in totals.entries if entry.source_kind == "loan"]
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
    for entry in sorted(loan_entries, key=lambda item: item.occurred_at, reverse=True)
  ]

  recurring_entries = [entry for entry in totals.entries if entry.source_kind == "recurring"]
  recurring_expenses = [
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
    for entry in sorted(recurring_entries, key=lambda item: item.occurred_at, reverse=True)
  ]

  fixed_expense_total = sum(
    (amount for entry, amount in totals.converted if entry.source_kind == "recurring"),
    Decimal(0),
  ).quantize(Decimal("0.01"))
  variable_expense_total = sum(
    (
      amount
      for entry, amount in totals.converted
      if entry.source_kind == "manual" and entry.entry_type == "expense"
    ),
    Decimal(0),
  ).quantize(Decimal("0.01"))
  loan_payment_total = sum(
    (amount for entry, amount in totals.converted if entry.source_kind == "loan"),
    Decimal(0),
  ).quantize(Decimal("0.01"))
  committed_expense_total = (fixed_expense_total + loan_payment_total).quantize(
    Decimal("0.01")
  )

  conversion_rates = [
    CurrencyConversionRate(
      source_currency=quote.source_currency,
      target_currency=quote.target_currency,
      rate=quote.rate,
      rate_date=quote.rate_date,
    )
    for quote in sorted(
      totals.used_rates.values(),
      key=lambda item: (item.source_currency, item.rate_date),
    )
  ]
  unconverted = sorted(totals.unconverted_currencies)
  has_conversions = bool(totals.converted_currencies)

  return CashFlowMonthlySummary(
    year=year,
    month=month,
    currency=currency,
    income=totals.income,
    expenses=totals.expenses,
    net_cash_flow=totals.net_cash_flow,
    savings_rate_percent=savings_rate,
    transaction_count=totals.manual_transaction_count,
    loan_payment_count=len(loan_payments),
    loan_payments=loan_payments,
    fixed_expense_total=fixed_expense_total,
    fixed_expense_count=len(recurring_expenses),
    variable_expense_total=variable_expense_total,
    loan_payment_total=loan_payment_total,
    committed_expense_total=committed_expense_total,
    recurring_expenses=recurring_expenses,
    category_breakdown=category_breakdown,
    converted_currencies=sorted(totals.converted_currencies),
    unconverted_currencies=unconverted,
    conversion_rates=conversion_rates,
    exchange_rate_provider=rate_provider.provider_name if has_conversions else None,
    exchange_rate_provider_url=rate_provider.provider_url if has_conversions else None,
    excluded_currencies=unconverted,
  )
