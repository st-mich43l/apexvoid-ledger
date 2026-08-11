from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")


@dataclass
class LoanCalculations:
    days_elapsed: int
    accrued_interest: Decimal
    current_balance: Decimal
    monthly_interest: Decimal


def calculate_loan(
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    open_date: datetime,
) -> LoanCalculations:
    now = datetime.now(timezone.utc)
    open_date_utc = open_date if open_date.tzinfo else open_date.replace(tzinfo=timezone.utc)
    days_elapsed = max(0, (now - open_date_utc).days)

    daily_rate = interest_rate_per_year / Decimal(100) / Decimal(365)
    accrued_interest = disbursement_amount * daily_rate * days_elapsed
    current_balance = disbursement_amount + accrued_interest
    monthly_interest = (disbursement_amount * (interest_rate_per_year / Decimal(100))) / Decimal(12)

    return LoanCalculations(
        days_elapsed=days_elapsed,
        accrued_interest=accrued_interest.quantize(CENTS, rounding=ROUND_HALF_UP),
        current_balance=current_balance.quantize(CENTS, rounding=ROUND_HALF_UP),
        monthly_interest=monthly_interest.quantize(CENTS, rounding=ROUND_HALF_UP),
    )
