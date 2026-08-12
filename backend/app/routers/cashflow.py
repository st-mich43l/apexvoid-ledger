from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..calculations import generate_loan_schedule
from ..cashflow import as_utc, ensure_default_categories, month_range, normalize_category_name
from ..database import get_db
from ..exchange_rates import (
    ExchangeRateProviderError,
    ExchangeRateQuote,
    FrankfurterExchangeRateProvider,
    get_exchange_rate_provider,
    quote_for_date,
)
from ..models import Category, Loan, Transaction, User
from ..schemas import (
    CashFlowMonthlySummary,
    CategorySpendingSummary,
    CurrencyCode,
    CurrencyConversionRate,
    LoanPaymentActivityRead,
)

router = APIRouter(prefix="/api/cashflow", tags=["cashflow"])
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


def _monthly_entries(
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


@router.get("/summary", response_model=CashFlowMonthlySummary)
def get_monthly_summary(
    year: int = Query(ge=1, le=9999),
    month: int = Query(ge=1, le=12),
    currency: CurrencyCode = Query(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
    rate_provider: FrankfurterExchangeRateProvider = Depends(get_exchange_rate_provider),
):
    start, end = month_range(year, month)
    entries, manual_transaction_count = _monthly_entries(
        db, current_user.id, start, end
    )

    foreign_currencies = sorted(
        {entry.currency for entry in entries if entry.currency != currency}
    )
    rate_tables: dict[str, list[ExchangeRateQuote]] = {}
    unconverted_currencies: set[str] = set()
    lookback_days = min(7, start.date().toordinal() - 1)
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
    net_cash_flow = income - expenses
    savings_rate = (
        (net_cash_flow / income * Decimal(100)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if income > 0
        else None
    )

    by_category: dict[str, tuple[str, str | None, Decimal]] = {}
    for entry, amount in converted:
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

    converted_by_loan_term = {
        (entry.loan.id, entry.loan_term): amount
        for entry, amount in converted
        if entry.loan is not None
    }
    loan_entries = [entry for entry in entries if entry.loan is not None]
    loan_payments = [
        LoanPaymentActivityRead(
            id=f"loan:{entry.loan.id}:{entry.loan_term}",
            loan_id=entry.loan.id,
            bank_name=entry.loan.bank_name,
            term=entry.loan_term,
            due_at=entry.occurred_at,
            amount=entry.amount,
            currency=entry.currency,
            reporting_amount=converted_by_loan_term.get((entry.loan.id, entry.loan_term)),
            reporting_currency=currency,
        )
        for entry in sorted(loan_entries, key=lambda item: item.occurred_at, reverse=True)
    ]
    conversion_rates = [
        CurrencyConversionRate(
            source_currency=quote.source_currency,
            target_currency=quote.target_currency,
            rate=quote.rate,
            rate_date=quote.rate_date,
        )
        for quote in sorted(
            used_rates.values(), key=lambda item: (item.source_currency, item.rate_date)
        )
    ]
    unconverted = sorted(unconverted_currencies)
    has_conversions = bool(converted_currencies)

    return CashFlowMonthlySummary(
        year=year,
        month=month,
        currency=currency,
        income=income,
        expenses=expenses,
        net_cash_flow=net_cash_flow,
        savings_rate_percent=savings_rate,
        transaction_count=manual_transaction_count,
        loan_payment_count=len(loan_payments),
        loan_payments=loan_payments,
        category_breakdown=category_breakdown,
        converted_currencies=sorted(converted_currencies),
        unconverted_currencies=unconverted,
        conversion_rates=conversion_rates,
        exchange_rate_provider=rate_provider.provider_name if has_conversions else None,
        exchange_rate_provider_url=rate_provider.provider_url if has_conversions else None,
        excluded_currencies=unconverted,
    )
