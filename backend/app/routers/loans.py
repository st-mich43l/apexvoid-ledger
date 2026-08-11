from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..calculations import calculate_loan
from ..database import get_db
from ..models import Loan
from ..schemas import LoanCreate, LoanRead, LoanUpdate

router = APIRouter(prefix="/api/loans", tags=["loans"])


def _serialize(loan: Loan) -> LoanRead:
    calc = calculate_loan(loan.disbursement_amount, loan.interest_rate_per_year, loan.open_date)
    return LoanRead(
        id=loan.id,
        bank_name=loan.bank_name,
        open_date=loan.open_date,
        disbursement_amount=loan.disbursement_amount,
        interest_rate_per_year=loan.interest_rate_per_year,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        days_elapsed=calc.days_elapsed,
        accrued_interest=calc.accrued_interest,
        current_balance=calc.current_balance,
        monthly_interest=calc.monthly_interest,
    )


def _get_or_404(db: Session, loan_id: str) -> Loan:
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.get("", response_model=list[LoanRead])
def list_loans(db: Session = Depends(get_db)):
    loans = db.query(Loan).order_by(Loan.open_date.desc()).all()
    return [_serialize(loan) for loan in loans]


@router.post("", response_model=LoanRead, status_code=201)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)):
    loan = Loan(
        bank_name=payload.bank_name,
        open_date=payload.open_date,
        disbursement_amount=payload.disbursement_amount,
        interest_rate_per_year=payload.interest_rate_per_year,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _serialize(loan)


@router.put("/{loan_id}", response_model=LoanRead)
def update_loan(loan_id: str, payload: LoanUpdate, db: Session = Depends(get_db)):
    loan = _get_or_404(db, loan_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)

    db.commit()
    db.refresh(loan)
    return _serialize(loan)


@router.delete("/{loan_id}", status_code=204)
def delete_loan(loan_id: str, db: Session = Depends(get_db)):
    loan = _get_or_404(db, loan_id)
    db.delete(loan)
    db.commit()
