import calendar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

# The original schedule was calibrated for VND and therefore rounded to whole
# units. Loans now retain their native currency, so decimal currencies keep
# cents while VND and JPY continue using whole-unit bank schedules.
WHOLE_UNIT_CURRENCIES = {"VND", "JPY"}


def _currency_quantum(currency: str) -> Decimal:
    return Decimal("1") if currency in WHOLE_UNIT_CURRENCIES else Decimal("0.01")


ScheduleStatus = Literal["completed", "current", "upcoming"]


@dataclass
class LoanScheduleItem:
    term: int
    due_date: datetime
    opening_principal: Decimal
    payment: Decimal
    principal: Decimal
    interest: Decimal
    closing_principal: Decimal
    status: ScheduleStatus


@dataclass
class LoanSchedule:
    open_date: datetime
    maturity_date: datetime
    as_of: datetime
    quantum: Decimal
    monthly_payment: Decimal
    items: list[LoanScheduleItem]


@dataclass
class LoanCalculations:
    days_elapsed: int
    days_remaining: int
    terms_elapsed: int
    terms_remaining: int
    is_matured: bool
    maturity_date: datetime
    accrued_interest: Decimal
    current_balance: Decimal
    monthly_payment: Decimal


@dataclass
class LoanDetail:
    open_date: datetime
    maturity_date: datetime
    duration_months: int
    terms_elapsed: int
    terms_remaining: int
    days_remaining: int
    is_matured: bool
    current_principal: Decimal
    estimated_outstanding_balance: Decimal
    monthly_payment: Decimal
    total_interest: Decimal
    total_repayment: Decimal
    principal_repaid: Decimal
    principal_repaid_percent: Decimal
    schedule: list[LoanScheduleItem]


@dataclass
class _CurrentState:
    terms_elapsed: int
    is_matured: bool
    current_principal: Decimal
    accrued_interest: Decimal
    balance: Decimal


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


def _calculate_emi(
    principal: Decimal,
    monthly_rate: Decimal,
    duration_months: int,
    quantum: Decimal,
) -> Decimal:
    """Standard equal-monthly-installment (annuity) amortization payment."""
    if monthly_rate == 0:
        return (principal / Decimal(duration_months)).quantize(quantum, rounding=ROUND_HALF_UP)
    growth = (1 + monthly_rate) ** duration_months
    emi = principal * monthly_rate * growth / (growth - 1)
    return emi.quantize(quantum, rounding=ROUND_HALF_UP)


def generate_loan_schedule(
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    open_date: datetime,
    duration_months: int,
    loan_type: str,
    as_of: datetime | None = None,
    currency: str = "VND",
) -> LoanSchedule:
    """The single source of truth for loan amortization.

    Builds the *complete* term-by-term schedule (all duration_months terms,
    past and future) once. Everything else - calculate_loan()'s current-state
    summary, the loan detail API, charts, progress metrics, the schedule
    table - derives from this instead of recomputing the amortization math
    independently.

    unsecured: declining-balance EMI/annuity. The installment (EMI) is fixed
    for the life of the loan; interest each period is charged on the actual
    calendar days since the previous installment, and installment dates that
    land on a weekend are pushed to the next business day (Monday) - so the
    interest/principal split shifts slightly period to period even though
    the EMI itself doesn't, and the principal portion grows over time.

    secured: fixed balance. Principal stays at the full disbursement amount
    for every term (it is never paid down by the schedule); each period's
    interest is charged on that same full, unreduced principal.

    A term is "completed" once its due date has passed `as_of` (defaults to
    now); the next one is "current"; the rest are "upcoming". This schedule
    represents an *estimated contractual* balance, not a record of actual
    payments - the app has no payment-tracking of its own.
    """
    resolved_as_of = as_of if as_of is not None else datetime.now(timezone.utc)
    open_date_utc = open_date if open_date.tzinfo else open_date.replace(tzinfo=timezone.utc)
    maturity_date = _add_months(open_date_utc, duration_months)
    daily_rate = interest_rate_per_year / Decimal(100) / Decimal(365)
    monthly_rate = interest_rate_per_year / Decimal(1200)
    quantum = _currency_quantum(currency)

    is_unsecured = loan_type == "unsecured"
    monthly_payment = (
        _calculate_emi(disbursement_amount, monthly_rate, duration_months, quantum)
        if is_unsecured
        else (disbursement_amount * (interest_rate_per_year / Decimal(100)) / Decimal(12)).quantize(
            quantum, rounding=ROUND_HALF_UP
        )
    )

    items: list[LoanScheduleItem] = []
    outstanding = disbursement_amount
    previous_date = open_date_utc
    found_current = False

    for term in range(1, duration_months + 1):
        due_date = _next_business_day(_add_months(open_date_utc, term))
        days_in_period = (due_date - previous_date).days
        interest = (outstanding * daily_rate * days_in_period).quantize(
            quantum, rounding=ROUND_HALF_UP
        )

        if is_unsecured:
            if term == duration_months:
                # True up the final installment to the exact remaining
                # balance - actual/365 day-count interest doesn't divide
                # evenly the way the closed-form EMI formula assumes, so the
                # theoretical payment schedule can drift a few units off
                # zero by the end. Real bank schedules true up the last
                # payment the same way rather than leaving a residual.
                principal = outstanding
                payment = interest + principal
            else:
                principal = monthly_payment - interest
                payment = monthly_payment
        else:
            # Fixed balance: nothing is ever paid down by the schedule itself.
            principal = Decimal(0)
            payment = interest

        closing = (outstanding - principal).quantize(quantum, rounding=ROUND_HALF_UP)

        if due_date <= resolved_as_of:
            status: ScheduleStatus = "completed"
        elif not found_current:
            status = "current"
            found_current = True
        else:
            status = "upcoming"

        items.append(
            LoanScheduleItem(
                term=term,
                due_date=due_date,
                opening_principal=outstanding.quantize(quantum, rounding=ROUND_HALF_UP),
                payment=payment.quantize(quantum, rounding=ROUND_HALF_UP),
                principal=principal.quantize(quantum, rounding=ROUND_HALF_UP),
                interest=interest,
                closing_principal=closing,
                status=status,
            )
        )

        outstanding = closing
        previous_date = due_date

    return LoanSchedule(
        open_date=open_date_utc,
        maturity_date=maturity_date,
        as_of=resolved_as_of,
        quantum=quantum,
        monthly_payment=monthly_payment,
        items=items,
    )


def _resolve_current_state(
    schedule: LoanSchedule,
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    duration_months: int,
    loan_type: str,
) -> _CurrentState:
    """Shared by calculate_loan() and build_loan_detail() so "what's currently
    owed" is derived from the schedule exactly once, not recomputed per caller.

    unsecured: current_principal is the declining outstanding balance (0 once
    matured); accrued_interest is only the *not-yet-invoiced* interest for the
    still-open current period - completed periods' interest was already
    folded into the principal paydown via the EMI mechanism.

    secured: current_principal never moves (see generate_loan_schedule);
    accrued_interest is the running total of every period's interest since
    open_date (nothing ever settles it), which is why it - not just a partial
    period - adds on top of the principal to form the balance.
    """
    daily_rate = interest_rate_per_year / Decimal(100) / Decimal(365)
    completed = [item for item in schedule.items if item.status == "completed"]
    terms_elapsed = len(completed)
    is_matured = terms_elapsed >= duration_months
    last_due_date = completed[-1].due_date if completed else schedule.open_date
    days_since_installment = max(0, (schedule.as_of - last_due_date).days)
    quantum = schedule.quantum

    if loan_type == "unsecured":
        current_principal = completed[-1].closing_principal if completed else disbursement_amount
        if is_matured:
            current_principal = Decimal(0)
        accrued_interest = (current_principal * daily_rate * days_since_installment).quantize(
            quantum, rounding=ROUND_HALF_UP
        )
        balance = current_principal
    else:
        current_principal = disbursement_amount
        completed_interest = sum((item.interest for item in completed), Decimal(0))
        partial_interest = Decimal(0)
        if not is_matured:
            partial_interest = (disbursement_amount * daily_rate * days_since_installment).quantize(
                quantum, rounding=ROUND_HALF_UP
            )
        accrued_interest = (completed_interest + partial_interest).quantize(
            quantum, rounding=ROUND_HALF_UP
        )
        balance = (disbursement_amount + accrued_interest).quantize(
            quantum, rounding=ROUND_HALF_UP
        )

    return _CurrentState(
        terms_elapsed=terms_elapsed,
        is_matured=is_matured,
        current_principal=current_principal.quantize(quantum, rounding=ROUND_HALF_UP),
        accrued_interest=accrued_interest,
        balance=balance,
    )


def calculate_loan(
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    open_date: datetime,
    duration_months: int,
    loan_type: str,
    as_of: datetime | None = None,
    currency: str = "VND",
) -> LoanCalculations:
    schedule = generate_loan_schedule(
        disbursement_amount,
        interest_rate_per_year,
        open_date,
        duration_months,
        loan_type,
        as_of,
        currency,
    )
    state = _resolve_current_state(schedule, disbursement_amount, interest_rate_per_year, duration_months, loan_type)

    term_days = max(0, (schedule.maturity_date - schedule.open_date).days)
    days_since_open = max(0, (schedule.as_of - schedule.open_date).days)
    days_elapsed = min(days_since_open, term_days)
    days_remaining = max(0, term_days - days_since_open)

    return LoanCalculations(
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        terms_elapsed=state.terms_elapsed,
        terms_remaining=max(0, duration_months - state.terms_elapsed),
        is_matured=state.is_matured,
        maturity_date=schedule.maturity_date,
        accrued_interest=state.accrued_interest,
        current_balance=state.balance,
        monthly_payment=schedule.monthly_payment,
    )


def build_loan_detail(
    disbursement_amount: Decimal,
    interest_rate_per_year: Decimal,
    open_date: datetime,
    duration_months: int,
    loan_type: str,
    as_of: datetime | None = None,
    currency: str = "VND",
) -> LoanDetail:
    schedule = generate_loan_schedule(
        disbursement_amount,
        interest_rate_per_year,
        open_date,
        duration_months,
        loan_type,
        as_of,
        currency,
    )
    state = _resolve_current_state(schedule, disbursement_amount, interest_rate_per_year, duration_months, loan_type)

    total_interest = sum((item.interest for item in schedule.items), Decimal(0)).quantize(
        schedule.quantum, rounding=ROUND_HALF_UP
    )
    total_repayment = (disbursement_amount + total_interest).quantize(
        schedule.quantum, rounding=ROUND_HALF_UP
    )
    principal_repaid = (disbursement_amount - state.current_principal).quantize(
        schedule.quantum, rounding=ROUND_HALF_UP
    )
    principal_repaid_percent = (
        (principal_repaid / disbursement_amount * Decimal(100)) if disbursement_amount > 0 else Decimal(0)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    term_days = max(0, (schedule.maturity_date - schedule.open_date).days)
    days_since_open = max(0, (schedule.as_of - schedule.open_date).days)
    days_remaining = max(0, term_days - days_since_open)

    return LoanDetail(
        open_date=schedule.open_date,
        maturity_date=schedule.maturity_date,
        duration_months=duration_months,
        terms_elapsed=state.terms_elapsed,
        terms_remaining=max(0, duration_months - state.terms_elapsed),
        days_remaining=days_remaining,
        is_matured=state.is_matured,
        current_principal=state.current_principal,
        estimated_outstanding_balance=state.balance,
        monthly_payment=schedule.monthly_payment,
        total_interest=total_interest,
        total_repayment=total_repayment,
        principal_repaid=principal_repaid,
        principal_repaid_percent=principal_repaid_percent,
        schedule=schedule.items,
    )
