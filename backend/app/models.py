import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column("username", String, nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column("hashedPassword", String, nullable=False)
    is_admin: Mapped[bool] = mapped_column("isAdmin", Boolean, nullable=False, default=False)
    must_change_password: Mapped[bool] = mapped_column(
        "mustChangePassword", Boolean, nullable=False, default=False
    )
    # NULL until they pick one on first login (see routers/auth.py's PATCH /currency).
    preferred_currency: Mapped[str | None] = mapped_column("preferredCurrency", String, nullable=True)
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
    __table_args__ = (
        CheckConstraint(
            "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
            name="ck_loan_currency",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column("userId", String, nullable=False)
    bank_name: Mapped[str] = mapped_column("bankName", String, nullable=False)
    open_date: Mapped[datetime] = mapped_column("openDate", DateTime, nullable=False)
    disbursement_amount: Mapped[float] = mapped_column("disbursementAmount", Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="VND")
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


class Category(Base):
    __tablename__ = "Category"
    __table_args__ = (
        UniqueConstraint("userId", "categoryType", "normalizedName", name="uq_category_user_type_name"),
        CheckConstraint('"categoryType" IN (\'income\', \'expense\')', name="ck_category_type"),
        Index("ix_category_user_id", "userId"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        "userId", ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    normalized_name: Mapped[str] = mapped_column("normalizedName", String(80), nullable=False)
    category_type: Mapped[str] = mapped_column("categoryType", String(16), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "Transaction"
    __table_args__ = (
        CheckConstraint(
            '"transactionType" IN (\'income\', \'expense\')', name="ck_transaction_type"
        ),
        CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
        CheckConstraint(
            "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
            name="ck_transaction_currency",
        ),
        Index("ix_transaction_user_occurred_at", "userId", "occurredAt"),
        Index("ix_transaction_category_id", "categoryId"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        "userId", ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    transaction_type: Mapped[str] = mapped_column("transactionType", String(16), nullable=False)
    category_id: Mapped[str] = mapped_column(
        "categoryId", ForeignKey("Category.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column("occurredAt", DateTime(timezone=True), nullable=False)
    description: Mapped[str | None] = mapped_column(String(240), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    external_id: Mapped[str | None] = mapped_column("externalId", String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    category: Mapped[Category] = relationship(back_populates="transactions", lazy="joined")
