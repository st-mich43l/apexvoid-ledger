from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer
from pydantic.alias_generators import to_camel

LoanType = Literal["secured", "unsecured"]

USERNAME_PATTERN = r"^[a-zA-Z0-9_.-]+$"


def _to_js_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class LoanCreate(CamelModel):
    bank_name: str
    open_date: datetime
    disbursement_amount: Decimal
    interest_rate_per_year: Decimal
    duration_months: int
    loan_type: LoanType = "unsecured"


class LoanUpdate(CamelModel):
    bank_name: str | None = None
    open_date: datetime | None = None
    disbursement_amount: Decimal | None = None
    interest_rate_per_year: Decimal | None = None
    duration_months: int | None = None
    loan_type: LoanType | None = None


class LoanRead(CamelModel):
    id: str
    bank_name: str
    open_date: datetime
    disbursement_amount: float
    interest_rate_per_year: float
    duration_months: int
    loan_type: LoanType
    created_at: datetime
    updated_at: datetime
    days_elapsed: int
    days_remaining: int
    is_matured: bool
    maturity_date: datetime
    accrued_interest: float
    current_balance: float
    monthly_interest: float

    @field_serializer("open_date", "created_at", "updated_at", "maturity_date")
    def _serialize_dt(self, dt: datetime, _info) -> str:
        return _to_js_iso(dt)


class UserCreate(CamelModel):
    username: str = Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    # bcrypt silently ignores bytes past 72 — reject early instead of truncating.
    password: str = Field(min_length=8, max_length=72)
    is_admin: bool = False


class LoginRequest(CamelModel):
    username: str
    password: str


class ChangePasswordRequest(CamelModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class UserRead(CamelModel):
    id: str
    username: str
    is_admin: bool
    must_change_password: bool
    created_at: datetime

    @field_serializer("created_at")
    def _serialize_dt(self, dt: datetime, _info) -> str:
        return _to_js_iso(dt)
