from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..cashflow import as_utc, month_range
from ..cashflow_report import compute_converted_month_totals, compute_converted_period_totals
from ..database import get_db
from ..exchange_rates import FrankfurterExchangeRateProvider, get_exchange_rate_provider
from ..models import User
from ..schemas import (
  CashFlowMonthlySummary,
  CashFlowTrendPoint,
  CashFlowTrendSummary,
  CategorySpendingSummary,
  CurrencyCode,
  CurrencyConversionRate,
  LoanPaymentActivityRead,
  RecurringExpenseActivityRead,
  RecurringIncomeActivityRead,
)

router = APIRouter(prefix="/api/cashflow", tags=["cashflow"])


@dataclass
class _TrendBucket:
  income: Decimal = Decimal(0)
  expenses: Decimal = Decimal(0)
  categories: dict[str, tuple[str, str | None, Decimal]] = field(default_factory=dict)


def _savings_rate(income: Decimal, net_cash_flow: Decimal) -> Decimal | None:
  if income <= 0:
    return None
  return (net_cash_flow / income * Decimal(100)).quantize(
    Decimal("0.01"), rounding=ROUND_HALF_UP
  )


def _category_breakdown(
  by_category: dict[str, tuple[str, str | None, Decimal]], expenses: Decimal
) -> list[CategorySpendingSummary]:
  return [
    CategorySpendingSummary(
      category_id=category_id,
      name=name,
      icon=icon,
      amount=amount,
      percent=(
        (amount / expenses * Decimal(100)).quantize(
          Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if expenses > 0
        else Decimal(0)
      ),
    )
    for category_id, (name, icon, amount) in sorted(
      by_category.items(), key=lambda item: item[1][2], reverse=True
    )
  ]


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

  savings_rate = _savings_rate(totals.income, totals.net_cash_flow)

  by_category: dict[str, tuple[str, str | None, Decimal]] = {}
  for entry, amount in totals.converted:
    if entry.entry_type != "expense":
      continue
    current = by_category.get(
      entry.category_id,
      (entry.category_name, entry.category_icon, Decimal(0)),
    )
    by_category[entry.category_id] = (current[0], current[1], current[2] + amount)

  category_breakdown = _category_breakdown(by_category, totals.expenses)

  converted_by_key = {
    (
      entry.source_kind,
      entry.loan.id if entry.loan is not None else None,
      entry.loan_term,
      entry.recurring_expense_id,
      entry.recurring_income_id,
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
          None,
          entry.occurred_at.isoformat(),
        )
      ),
      reporting_currency=currency,
    )
    for entry in sorted(recurring_entries, key=lambda item: item.occurred_at, reverse=True)
  ]

  recurring_income_entries = [
    entry for entry in totals.entries if entry.source_kind == "recurring_income"
  ]
  recurring_incomes = [
    RecurringIncomeActivityRead(
      id=f"recurring-income:{entry.recurring_income_id}:{entry.occurred_at.date().isoformat()}",
      recurring_income_id=entry.recurring_income_id,
      name=entry.recurring_name or entry.category_name,
      category_id=entry.category_id,
      category_name=entry.category_name,
      category_icon=entry.category_icon,
      expected_at=entry.occurred_at,
      amount=entry.amount,
      currency=entry.currency,
      reporting_amount=converted_by_key.get(
        (
          "recurring_income",
          None,
          None,
          None,
          entry.recurring_income_id,
          entry.occurred_at.isoformat(),
        )
      ),
      reporting_currency=currency,
    )
    for entry in sorted(
      recurring_income_entries, key=lambda item: item.occurred_at, reverse=True
    )
  ]

  recurring_income_total = sum(
    (
      amount
      for entry, amount in totals.converted
      if entry.source_kind == "recurring_income"
    ),
    Decimal(0),
  ).quantize(Decimal("0.01"))

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
    recurring_income_total=recurring_income_total,
    recurring_income_count=len(recurring_incomes),
    recurring_incomes=recurring_incomes,
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


@router.get("/trend", response_model=CashFlowTrendSummary)
def get_cash_flow_trend(
  end_year: int = Query(alias="endYear", ge=1, le=9998),
  end_month: int = Query(alias="endMonth", ge=1, le=12),
  months: int = Query(default=6),
  currency: CurrencyCode = Query(),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
  rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
  if months not in (6, 12):
    raise HTTPException(status_code=422, detail="Months must be either 6 or 12")

  end_index = end_year * 12 + end_month - 1
  start_index = end_index - months + 1
  start_year, start_month_index = divmod(start_index, 12)
  if start_year < 1:
    raise HTTPException(status_code=422, detail="Requested range starts before year 1")
  start_month = start_month_index + 1

  start, _ = month_range(start_year, start_month)
  _, end = month_range(end_year, end_month)
  totals = compute_converted_period_totals(
    db, current_user.id, start, end, currency, rate_provider
  )

  buckets: dict[tuple[int, int], _TrendBucket] = {}
  month_keys: list[tuple[int, int]] = []
  for offset in range(months):
    month_index = start_index + offset
    year, zero_based_month = divmod(month_index, 12)
    key = (year, zero_based_month + 1)
    month_keys.append(key)
    buckets[key] = _TrendBucket()

  for entry, amount in totals.converted:
    occurred_at = as_utc(entry.occurred_at)
    key = (occurred_at.year, occurred_at.month)
    bucket = buckets.get(key)
    if bucket is None:
      continue
    if entry.entry_type == "income":
      bucket.income += amount
      continue
    if entry.entry_type != "expense":
      continue

    bucket.expenses += amount
    current = bucket.categories.get(
      entry.category_id,
      (entry.category_name, entry.category_icon, Decimal(0)),
    )
    bucket.categories[entry.category_id] = (current[0], current[1], current[2] + amount)

  points: list[CashFlowTrendPoint] = []
  for year, month in month_keys:
    bucket = buckets[(year, month)]
    income = bucket.income.quantize(Decimal("0.01"))
    expenses = bucket.expenses.quantize(Decimal("0.01"))
    net_cash_flow = (income - expenses).quantize(Decimal("0.01"))
    points.append(
      CashFlowTrendPoint(
        year=year,
        month=month,
        income=income,
        expenses=expenses,
        net_cash_flow=net_cash_flow,
        savings_rate_percent=_savings_rate(income, net_cash_flow),
        category_breakdown=_category_breakdown(bucket.categories, expenses),
      )
    )

  has_conversions = bool(totals.converted_currencies)
  return CashFlowTrendSummary(
    start_year=start_year,
    start_month=start_month,
    end_year=end_year,
    end_month=end_month,
    month_count=months,
    currency=currency,
    points=points,
    converted_currencies=sorted(totals.converted_currencies),
    unconverted_currencies=sorted(totals.unconverted_currencies),
    exchange_rate_provider=rate_provider.provider_name if has_conversions else None,
    exchange_rate_provider_url=rate_provider.provider_url if has_conversions else None,
  )
