"""Shared cash-flow aggregation used by summary and saving pot."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from .calculations import generate_loan_schedule
from .cashflow import as_utc, ensure_default_categories, month_range, normalize_category_name
from .exchange_rates import (
  ExchangeRateProviderError,
  ExchangeRateQuote,
  FrankfurterExchangeRateProvider,
  quote_for_date,
)
from .models import Category, Loan, Transaction

MONEY_QUANTUM = Decimal("0.01")


@dataclass
class ReportEntry:
  entry_type: str
  category_id: str
  category_name: str
  category_icon: str | None
  amount: Decimal
  currency: str
  occurred_at: datetime
  loan: Loan | None = None
  loan_term: int | None = None


@dataclass
class ConvertedPeriodTotals:
  income: Decimal
  expenses: Decimal
  net_cash_flow: Decimal
  entries: list[ReportEntry]
  converted: list[tuple[ReportEntry, Decimal]]
  manual_transaction_count: int
  converted_currencies: set[str]
  unconverted_currencies: set[str]
  used_rates: dict[tuple[str, str, Decimal, date], ExchangeRateQuote]

  @property
  def conversion_complete(self) -> bool:
    return not self.unconverted_currencies


# Backward-compatible alias used by cashflow summary and older call sites.
ConvertedMonthTotals = ConvertedPeriodTotals


def period_entries(
  db: Session,
  user_id: str,
  start: datetime,
  end: datetime,
) -> tuple[list[ReportEntry], int]:
  transactions = (
    db.query(Transaction)
    .filter(
      Transaction.user_id == user_id,
      Transaction.occurred_at >= start,
      Transaction.occurred_at < end,
    )
    .all()
  )
  entries = [
    ReportEntry(
      entry_type=transaction.transaction_type,
      category_id=transaction.category_id,
      category_name=transaction.category.name,
      category_icon=transaction.category.icon,
      amount=transaction.amount,
      currency=transaction.currency,
      occurred_at=as_utc(transaction.occurred_at),
    )
    for transaction in transactions
  ]

  ensure_default_categories(db, user_id)
  loan_category = (
    db.query(Category)
    .filter(
      Category.user_id == user_id,
      Category.category_type == "expense",
      Category.normalized_name == normalize_category_name("Loan"),
    )
    .first()
  )
  loans = db.query(Loan).filter(Loan.user_id == user_id).all()
  for loan in loans:
    schedule = generate_loan_schedule(
      loan.disbursement_amount,
      loan.interest_rate_per_year,
      loan.open_date,
      loan.duration_months,
      loan.loan_type,
      as_of=end,
      currency=loan.currency,
    )
    for item in schedule.items:
      due_at = as_utc(item.due_date)
      if start <= due_at < end:
        entries.append(
          ReportEntry(
            entry_type="expense",
            category_id=loan_category.id if loan_category else "linked-loans",
            category_name=loan_category.name if loan_category else "Loan",
            category_icon=loan_category.icon if loan_category else "🏦",
            amount=item.payment,
            currency=loan.currency,
            occurred_at=due_at,
            loan=loan,
            loan_term=item.term,
          )
        )

  return entries, len(transactions)


# Backward-compatible name.
monthly_entries = period_entries


def compute_converted_period_totals(
  db: Session,
  user_id: str,
  start: datetime,
  end: datetime,
  currency: str,
  rate_provider: FrankfurterExchangeRateProvider,
) -> ConvertedPeriodTotals:
  start = as_utc(start)
  end = as_utc(end)
  if end <= start:
    return ConvertedPeriodTotals(
      income=Decimal("0.00"),
      expenses=Decimal("0.00"),
      net_cash_flow=Decimal("0.00"),
      entries=[],
      converted=[],
      manual_transaction_count=0,
      converted_currencies=set(),
      unconverted_currencies=set(),
      used_rates={},
    )

  entries, manual_transaction_count = period_entries(db, user_id, start, end)

  foreign_currencies = sorted(
    {entry.currency for entry in entries if entry.currency != currency}
  )
  rate_tables: dict[str, list[ExchangeRateQuote]] = {}
  unconverted_currencies: set[str] = set()
  lookback_days = min(7, max(start.date().toordinal() - 1, 0))
  rates_start = start.date() - timedelta(days=lookback_days)
  rates_end = (end - timedelta(microseconds=1)).date()
  for source_currency in foreign_currencies:
    try:
      rate_tables[source_currency] = rate_provider.get_rates(
        source_currency, currency, rates_start, rates_end
      )
    except ExchangeRateProviderError:
      unconverted_currencies.add(source_currency)

  converted: list[tuple[ReportEntry, Decimal]] = []
  converted_currencies: set[str] = set()
  used_rates: dict[tuple[str, str, Decimal, date], ExchangeRateQuote] = {}
  for entry in entries:
    if entry.currency == currency:
      converted.append((entry, entry.amount))
      continue

    quote = quote_for_date(
      rate_tables.get(entry.currency, []), as_utc(entry.occurred_at).date()
    )
    if quote is None:
      unconverted_currencies.add(entry.currency)
      continue

    converted_amount = (entry.amount * quote.rate).quantize(
      MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )
    converted.append((entry, converted_amount))
    converted_currencies.add(entry.currency)
    used_rates[
      (quote.source_currency, quote.target_currency, quote.rate, quote.rate_date)
    ] = quote

  income = sum(
    (amount for entry, amount in converted if entry.entry_type == "income"),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)
  expenses = sum(
    (amount for entry, amount in converted if entry.entry_type == "expense"),
    Decimal(0),
  ).quantize(MONEY_QUANTUM)

  return ConvertedPeriodTotals(
    income=income,
    expenses=expenses,
    net_cash_flow=income - expenses,
    entries=entries,
    converted=converted,
    manual_transaction_count=manual_transaction_count,
    converted_currencies=converted_currencies,
    unconverted_currencies=unconverted_currencies,
    used_rates=used_rates,
  )


def compute_converted_month_totals(
  db: Session,
  user_id: str,
  year: int,
  month: int,
  currency: str,
  rate_provider: FrankfurterExchangeRateProvider,
) -> ConvertedPeriodTotals:
  start, end = month_range(year, month)
  return compute_converted_period_totals(
    db, user_id, start, end, currency, rate_provider
  )
