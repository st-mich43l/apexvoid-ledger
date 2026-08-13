"""Monthly Routine composition — scheduled income, committed costs, and spending."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from .cashflow import as_utc, month_range
from .cashflow_report import MONEY_QUANTUM, compute_converted_month_totals
from .exchange_rates import (
  ExchangeRateProviderError,
  ExchangeRateQuote,
  FrankfurterExchangeRateProvider,
  quote_for_date,
)
from .recurring_income import ExpectedIncomeActivity, expected_income_activities


@dataclass
class ConvertedExpectedIncome:
  activity: ExpectedIncomeActivity
  reporting_amount: Decimal | None


@dataclass
class VariableCategorySpend:
  category_id: str
  name: str
  icon: str | None
  amount: Decimal


@dataclass
class MonthlyRoutineResult:
  year: int
  month: int
  currency: str
  expected_income_total: Decimal
  expected_incomes: list[ConvertedExpectedIncome]
  fixed_expense_total: Decimal
  fixed_expense_count: int
  loan_payment_total: Decimal
  loan_payment_count: int
  committed_expense_total: Decimal
  baseline_available: Decimal
  actual_income_total: Decimal
  actual_variable_expense_total: Decimal
  projected_remainder: Decimal
  variable_categories: list[VariableCategorySpend]
  converted_currencies: set[str]
  unconverted_currencies: set[str]
  used_rates: dict[tuple[str, str, Decimal, date], ExchangeRateQuote]
  # Pass-through Cash Flow derived activity for UI sections.
  cashflow_entries_converted: list
  cashflow_entries: list


def _convert_expected_incomes(
  activities: list[ExpectedIncomeActivity],
  currency: str,
  start: datetime,
  end: datetime,
  rate_provider: FrankfurterExchangeRateProvider,
) -> tuple[
  list[ConvertedExpectedIncome],
  Decimal,
  set[str],
  set[str],
  dict[tuple[str, str, Decimal, date], ExchangeRateQuote],
]:
  foreign = sorted({item.currency for item in activities if item.currency != currency})
  rate_tables: dict[str, list[ExchangeRateQuote]] = {}
  unconverted: set[str] = set()
  lookback_days = min(7, max(start.date().toordinal() - 1, 0))
  rates_start = start.date() - timedelta(days=lookback_days)
  rates_end = (end - timedelta(microseconds=1)).date()
  for source in foreign:
    try:
      rate_tables[source] = rate_provider.get_rates(source, currency, rates_start, rates_end)
    except ExchangeRateProviderError:
      unconverted.add(source)

  converted_list: list[ConvertedExpectedIncome] = []
  converted_currencies: set[str] = set()
  used_rates: dict[tuple[str, str, Decimal, date], ExchangeRateQuote] = {}
  total = Decimal("0.00")

  for activity in activities:
    if activity.currency == currency:
      converted_list.append(ConvertedExpectedIncome(activity, activity.amount))
      total += activity.amount
      continue

    quote = quote_for_date(
      rate_tables.get(activity.currency, []), as_utc(activity.expected_at).date()
    )
    if quote is None:
      unconverted.add(activity.currency)
      converted_list.append(ConvertedExpectedIncome(activity, None))
      continue

    amount = (activity.amount * quote.rate).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    converted_list.append(ConvertedExpectedIncome(activity, amount))
    total += amount
    converted_currencies.add(activity.currency)
    used_rates[
      (quote.source_currency, quote.target_currency, quote.rate, quote.rate_date)
    ] = quote

  return (
    converted_list,
    total.quantize(MONEY_QUANTUM),
    converted_currencies,
    unconverted,
    used_rates,
  )


def compute_monthly_routine(
  db: Session,
  user_id: str,
  year: int,
  month: int,
  currency: str,
  rate_provider: FrankfurterExchangeRateProvider,
) -> MonthlyRoutineResult:
  # Authoritative Cash Flow totals include auto-linked scheduled income and obligations.
  totals = compute_converted_month_totals(db, user_id, year, month, currency, rate_provider)
  start, end = month_range(year, month)

  fixed_expense_total = sum(
    (amount for entry, amount in totals.converted if entry.source_kind == "recurring"),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)
  loan_payment_total = sum(
    (amount for entry, amount in totals.converted if entry.source_kind == "loan"),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)
  actual_income_total = sum(
    (
      amount
      for entry, amount in totals.converted
      if entry.source_kind == "manual" and entry.entry_type == "income"
    ),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)
  actual_variable_expense_total = sum(
    (
      amount
      for entry, amount in totals.converted
      if entry.source_kind == "manual" and entry.entry_type == "expense"
    ),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)

  fixed_expense_count = sum(1 for entry in totals.entries if entry.source_kind == "recurring")
  loan_payment_count = sum(1 for entry in totals.entries if entry.source_kind == "loan")
  committed_expense_total = (fixed_expense_total + loan_payment_total).quantize(MONEY_QUANTUM)

  # Scheduled income remains separately visible as the planning baseline.
  expected_raw = expected_income_activities(db, user_id, start, end)
  (
    expected_converted,
    expected_income_total,
    expected_converted_currencies,
    expected_unconverted,
    expected_rates,
  ) = _convert_expected_incomes(expected_raw, currency, start, end, rate_provider)

  baseline_available = (expected_income_total - committed_expense_total).quantize(MONEY_QUANTUM)
  projected_remainder = (baseline_available - actual_variable_expense_total).quantize(
    MONEY_QUANTUM
  )

  by_category: dict[str, tuple[str, str | None, Decimal]] = {}
  for entry, amount in totals.converted:
    if entry.source_kind != "manual" or entry.entry_type != "expense":
      continue
    current = by_category.get(
      entry.category_id, (entry.category_name, entry.category_icon, Decimal(0))
    )
    by_category[entry.category_id] = (current[0], current[1], current[2] + amount)

  variable_categories = [
    VariableCategorySpend(
      category_id=category_id,
      name=name,
      icon=icon,
      amount=amount.quantize(MONEY_QUANTUM),
    )
    for category_id, (name, icon, amount) in sorted(
      by_category.items(), key=lambda item: item[1][2], reverse=True
    )
  ]

  converted_currencies = set(totals.converted_currencies) | expected_converted_currencies
  unconverted_currencies = set(totals.unconverted_currencies) | expected_unconverted
  used_rates = dict(totals.used_rates)
  used_rates.update(expected_rates)

  return MonthlyRoutineResult(
    year=year,
    month=month,
    currency=currency,
    expected_income_total=expected_income_total,
    expected_incomes=sorted(
      expected_converted, key=lambda item: item.activity.expected_at, reverse=True
    ),
    fixed_expense_total=fixed_expense_total,
    fixed_expense_count=fixed_expense_count,
    loan_payment_total=loan_payment_total,
    loan_payment_count=loan_payment_count,
    committed_expense_total=committed_expense_total,
    baseline_available=baseline_available,
    actual_income_total=actual_income_total,
    actual_variable_expense_total=actual_variable_expense_total,
    projected_remainder=projected_remainder,
    variable_categories=variable_categories,
    converted_currencies=converted_currencies,
    unconverted_currencies=unconverted_currencies,
    used_rates=used_rates,
    cashflow_entries_converted=totals.converted,
    cashflow_entries=totals.entries,
  )
