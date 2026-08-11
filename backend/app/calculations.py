import calendar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

# Loan amounts round to whole currency units (no VND has minor decimal units in
# practice, and the reference bank schedule this was calibrated against rounds
# each period to whole VND - a fixed-point cents granularity introduced a
# rounding drift that whole-unit rounding does not).
UNIT = Decimal("1")


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


def _next_business_day(dt: datetime) -> datetime:
    """Push weekend due dates to the following Monday, as banks do."""
    while dt.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
        dt += timedelta(days=1)
    return dt


def _calculate_emi(principal: Decimal, monthly_rate: Decimal, duration_months: int) -> Decimal:
    """Standard equal-monthly-installment (annuity) amortization payment."""
    if monthly_rate == 0:
        return (principal / Decimal(duration_months)).quantize(UNIT, rounding=ROUND_HALF_UP)
    growth = (1 + monthly_rate) ** duration_months
    emi = principal * monthly_rate * growth / (growth - 1)
    return emi.quantize(UNIT, rounding=ROUND_HALF_UP)


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
        # Declining balance: EMI/annuity amortization. The total installment
        # (EMI) is fixed for the life of the loan, but each period's interest
        # is charged on the actual calendar days since the previous
        # installment - and installment dates that land on a weekend are
        # pushed to the next business day (Monday), same as a real bank
        # schedule - so the interest/principal split shifts slightly period
        # to period even though EMI itself doesn't.
        monthly_rate = interest_rate_per_year / Decimal(1200)
        emi = _calculate_emi(disbursement_amount, monthly_rate, duration_months)

        outstanding_principal = disbursement_amount
        previous_date = open_date_utc
        last_installment_date = open_date_utc
        periods_elapsed = 0
        for period in range(1, duration_months + 1):
            scheduled_date = _next_business_day(_add_months(open_date_utc, period))
            if scheduled_date > now:
                break
            days_in_period = (scheduled_date - previous_date).days
            interest_for_period = (outstanding_principal * daily_rate * days_in_period).quantize(
                UNIT, rounding=ROUND_HALF_UP
            )
            principal_for_period = emi - interest_for_period
            outstanding_principal -= principal_for_period
            previous_date = scheduled_date
            last_installment_date = scheduled_date
            periods_elapsed += 1

        if periods_elapsed >= duration_months or is_matured:
            outstanding_principal = Decimal(0)
        outstanding_principal = outstanding_principal.quantize(UNIT, rounding=ROUND_HALF_UP)

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
        accrued_interest=accrued_interest.quantize(UNIT, rounding=ROUND_HALF_UP),
        current_balance=current_balance.quantize(UNIT, rounding=ROUND_HALF_UP),
        monthly_interest=monthly_interest.quantize(UNIT, rounding=ROUND_HALF_UP),
    )
