import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Loan(Base):
    __tablename__ = "Loan"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_name: Mapped[str] = mapped_column("bankName", String, nullable=False)
    open_date: Mapped[datetime] = mapped_column("openDate", DateTime, nullable=False)
    disbursement_amount: Mapped[float] = mapped_column("disbursementAmount", Numeric(14, 2), nullable=False)
    interest_rate_per_year: Mapped[float] = mapped_column("interestRatePerYear", Numeric(6, 3), nullable=False)
    duration_months: Mapped[int] = mapped_column("durationMonths", Integer, nullable=False, default=12)
    loan_type: Mapped[str] = mapped_column("loanType", String, nullable=False, default="unsecured")
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
