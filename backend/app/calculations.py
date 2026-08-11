import calendar
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")


@dataclass
class LoanCalculations:
    days_elapsed: int
    days_remaining: int
    is_matured: bool
    maturity_date: datetime
    accrued_interest: Decimal
    current_balance: Decimal
    monthly_interest: Decimal


def _add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _installment_periods_elapsed(
    open_date: datetime, now: datetime, duration_months: int
) -> tuple[int, datetime]:
    """Full monthly installment periods elapsed, and the most recent installment date."""
    periods = 0
    last_installment_date = open_date
    while periods < duration_months:
        next_installment_date = _add_months(open_date, periods + 1)
        if next_installment_date > now:
            break
        last_installment_date = next_installment_date
        periods += 1
    return periods, last_installment_date


def _calculate_emi(principal: Decimal, monthly_rate: Decimal, duration_months: int) -> Decimal:
    """Standard equal-monthly-installment (annuity) amortization payment."""
    if monthly_rate == 0:
        return (principal / Decimal(duration_months)).quantize(CENTS, rounding=ROUND_HALF_UP)
    growth = (1 + monthly_rate) ** duration_months
    emi = principal * monthly_rate * growth / (growth - 1)
    return emi.quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_loan(
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    open_date: datetime,
    duration_months: int,
    loan_type: str,
) -> LoanCalculations:
    now = datetime.now(timezone.utc)
    open_date_utc = open_date if open_date.tzinfo else open_date.replace(tzinfo=timezone.utc)
    maturity_date = _add_months(open_date_utc, duration_months)

    term_days = max(0, (maturity_date - open_date_utc).days)
    days_since_open = max(0, (now - open_date_utc).days)
    days_elapsed = min(days_since_open, term_days)
    is_matured = days_since_open >= term_days
    days_remaining = max(0, term_days - days_since_open)

    daily_rate = interest_rate_per_year / Decimal(100) / Decimal(365)

    if loan_type == "unsecured":
        # Declining balance: standard EMI/annuity amortization. Each elapsed
        # month, a fixed total installment splits into interest (on the
        # principal still outstanding) and principal; the principal portion
        # grows each period as the outstanding balance shrinks.
        periods_elapsed, last_installment_date = _installment_periods_elapsed(
            open_date_utc, now, duration_months
        )
        monthly_rate = interest_rate_per_year / Decimal(1200)
        emi = _calculate_emi(disbursement_amount, monthly_rate, duration_months)

        outstanding_principal = disbursement_amount
        for _ in range(periods_elapsed):
            interest_for_period = (outstanding_principal * monthly_rate).quantize(
                CENTS, rounding=ROUND_HALF_UP
            )
            principal_for_period = emi - interest_for_period
            outstanding_principal -= principal_for_period
        if is_matured:
            outstanding_principal = Decimal(0)
        outstanding_principal = outstanding_principal.quantize(CENTS, rounding=ROUND_HALF_UP)

        days_since_installment = max(0, (now - last_installment_date).days)
        accrued_interest = outstanding_principal * daily_rate * days_since_installment
        current_balance = outstanding_principal
        monthly_interest = emi
    else:
        # Fixed balance: principal stays at the full disbursement amount until
        # maturity; interest simply accrues on top of it.
        accrued_interest = disbursement_amount * daily_rate * days_elapsed
        current_balance = disbursement_amount + accrued_interest
        monthly_interest = disbursement_amount * (interest_rate_per_year / Decimal(100)) / Decimal(12)

    return LoanCalculations(
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        is_matured=is_matured,
        maturity_date=maturity_date,
        accrued_interest=accrued_interest.quantize(CENTS, rounding=ROUND_HALF_UP),
        current_balance=current_balance.quantize(CENTS, rounding=ROUND_HALF_UP),
        monthly_interest=monthly_interest.quantize(CENTS, rounding=ROUND_HALF_UP),
    )
