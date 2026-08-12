from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..calculations import build_loan_detail, calculate_loan, generate_loan_schedule
from ..database import get_db
from ..models import Loan, User
from ..schemas import LoanCreate, LoanDetailRead, LoanRead, LoanScheduleItemRead, LoanUpdate

router = APIRouter(prefix="/api/loans", tags=["loans"])


def _serialize(loan: Loan) -> LoanRead:
    calc = calculate_loan(
        loan.disbursement_amount,
        loan.interest_rate_per_year,
        loan.open_date,
        loan.duration_months,
        loan.loan_type,
    )
    return LoanRead(
        id=loan.id,
        bank_name=loan.bank_name,
        open_date=loan.open_date,
        disbursement_amount=loan.disbursement_amount,
        interest_rate_per_year=loan.interest_rate_per_year,
        duration_months=loan.duration_months,
        loan_type=loan.loan_type,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        days_elapsed=calc.days_elapsed,
        days_remaining=calc.days_remaining,
        is_matured=calc.is_matured,
        maturity_date=calc.maturity_date,
        accrued_interest=calc.accrued_interest,
        current_balance=calc.current_balance,
        monthly_interest=calc.monthly_interest,
    )


def _get_or_404(db: Session, loan_id: str, user_id: str) -> Loan:
    # Scoped by user_id in the same query (not checked after the fact) so a
    # loan belonging to someone else 404s exactly like a nonexistent loan —
    # it never reveals that the id is valid for a different account.
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.get("", response_model=list[LoanRead])
def list_loans(db: Session = Depends(get_db), current_user: User = Depends(require_password_changed)):
    loans = (
        db.query(Loan)
        .filter(Loan.user_id == current_user.id)
        .order_by(Loan.open_date.desc())
        .all()
    )
    return [_serialize(loan) for loan in loans]


@router.get("/{loan_id}", response_model=LoanDetailRead)
def get_loan_detail(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    loan = _get_or_404(db, loan_id, current_user.id)
    detail = build_loan_detail(
        loan.disbursement_amount,
        loan.interest_rate_per_year,
        loan.open_date,
        loan.duration_months,
        loan.loan_type,
    )
    return LoanDetailRead(
        id=loan.id,
        bank_name=loan.bank_name,
        loan_type=loan.loan_type,
        disbursement_amount=loan.disbursement_amount,
        interest_rate_per_year=loan.interest_rate_per_year,
        open_date=detail.open_date,
        maturity_date=detail.maturity_date,
        duration_months=detail.duration_months,
        terms_elapsed=detail.terms_elapsed,
        terms_remaining=detail.terms_remaining,
        days_remaining=detail.days_remaining,
        is_matured=detail.is_matured,
        current_principal=detail.current_principal,
        estimated_outstanding_balance=detail.estimated_outstanding_balance,
        monthly_payment=detail.monthly_payment,
        total_interest=detail.total_interest,
        total_repayment=detail.total_repayment,
        principal_repaid=detail.principal_repaid,
        principal_repaid_percent=detail.principal_repaid_percent,
    )


@router.get("/{loan_id}/schedule", response_model=list[LoanScheduleItemRead])
def get_loan_schedule(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    loan = _get_or_404(db, loan_id, current_user.id)
    schedule = generate_loan_schedule(
        loan.disbursement_amount,
        loan.interest_rate_per_year,
        loan.open_date,
        loan.duration_months,
        loan.loan_type,
    )
    return [
        LoanScheduleItemRead(
            term=item.term,
            due_date=item.due_date,
            opening_principal=item.opening_principal,
            payment=item.payment,
            principal=item.principal,
            interest=item.interest,
            closing_principal=item.closing_principal,
            status=item.status,
        )
        for item in schedule.items
    ]


@router.post("", response_model=LoanRead, status_code=201)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    loan = Loan(
        user_id=current_user.id,
        bank_name=payload.bank_name,
        open_date=payload.open_date,
        disbursement_amount=payload.disbursement_amount,
        interest_rate_per_year=payload.interest_rate_per_year,
        duration_months=payload.duration_months,
        loan_type=payload.loan_type,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _serialize(loan)


@router.put("/{loan_id}", response_model=LoanRead)
def update_loan(
    loan_id: str,
    payload: LoanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    loan = _get_or_404(db, loan_id, current_user.id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)

    db.commit()
    db.refresh(loan)
    return _serialize(loan)


@router.delete("/{loan_id}", status_code=204)
def delete_loan(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    loan = _get_or_404(db, loan_id, current_user.id)
    db.delete(loan)
    db.commit()
