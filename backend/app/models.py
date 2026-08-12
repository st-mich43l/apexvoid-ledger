import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column("email", String, nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column("hashedPassword", String, nullable=False)
    is_admin: Mapped[bool] = mapped_column("isAdmin", Boolean, nullable=False, default=False)
    must_change_password: Mapped[bool] = mapped_column(
        "mustChangePassword", Boolean, nullable=False, default=False
    )
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


class Loan(Base):
    __tablename__ = "Loan"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Nullable until the backfill migration (post admin-seed) flips this to NOT NULL.
    user_id: Mapped[str | None] = mapped_column("userId", String, nullable=True)
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
