from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer, field_validator
from pydantic.alias_generators import to_camel

LoanType = Literal["secured", "unsecured"]
ScheduleStatus = Literal["completed", "current", "upcoming"]
CashFlowType = Literal["income", "expense"]
TransactionSource = Literal["manual"]

USERNAME_PATTERN = r"^[a-zA-Z0-9_.-]+$"

# Mirrors frontend/src/lib/currency.ts's SUPPORTED_CURRENCIES — keep in sync.
CurrencyCode = Literal["USD", "EUR", "GBP", "AUD", "JPY", "CNY", "VND"]

# Trims whitespace before the length check runs, so "   " is caught by
# min_length just like "" is — not just rejected-if-literally-empty.
BankName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
DisbursementAmount = Annotated[Decimal, Field(gt=0)]
InterestRatePerYear = Annotated[Decimal, Field(ge=0, le=100)]
DurationMonths = Annotated[int, Field(ge=1, le=600)]
CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
TransactionAmount = Annotated[Decimal, Field(gt=0)]


def _to_js_iso(dt: datetime) -> str:
  if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
  return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class CamelModel(BaseModel):
  model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class LoanCreate(CamelModel):
  bank_name: BankName
  open_date: datetime
  disbursement_amount: DisbursementAmount
  currency: CurrencyCode | None = None
  interest_rate_per_year: InterestRatePerYear
  duration_months: DurationMonths
  loan_type: LoanType = "unsecured"


class LoanUpdate(CamelModel):
  # Same constraints as LoanCreate, just optional - a field that IS supplied
  # must satisfy the same rules as at creation time; only its absence is
  # allowed (a partial update, via exclude_unset in the router).
  bank_name: BankName | None = None
  open_date: datetime | None = None
  disbursement_amount: DisbursementAmount | None = None
  currency: CurrencyCode | None = None
  interest_rate_per_year: InterestRatePerYear | None = None
  duration_months: DurationMonths | None = None
  loan_type: LoanType | None = None


class LoanRead(CamelModel):
  id: str
  bank_name: str
  open_date: datetime
  disbursement_amount: float
  currency: CurrencyCode
  interest_rate_per_year: float
  duration_months: int
  loan_type: LoanType
  created_at: datetime
  updated_at: datetime
  days_elapsed: int
  days_remaining: int
  terms_elapsed: int
  terms_remaining: int
  is_matured: bool
  maturity_date: datetime
  accrued_interest: float
  current_balance: float
  monthly_payment: float
  # Backward-compatible alias for clients using the original, misleading
  # field name. Both values are the schedule's contractual monthly payment.
  monthly_interest: float

  @field_serializer("open_date", "created_at", "updated_at", "maturity_date")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class LoanScheduleItemRead(CamelModel):
  term: int
  due_date: datetime
  opening_principal: float
  payment: float
  principal: float
  interest: float
  closing_principal: float
  status: ScheduleStatus

  @field_serializer("due_date")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class LoanDetailRead(CamelModel):
  """Loan detail summary — everything the analytics page's header, summary
  cards, charts, and progress section need, minus the term-by-term
  schedule (see GET /api/loans/{id}/schedule). Self-sufficient (includes
  the loan's static fields, not just the schedule-derived ones) so the
  frontend can load this page directly - e.g. a refresh or a bookmarked
  link - without depending on already having fetched the loan list.
  """

  id: str
  bank_name: str
  loan_type: LoanType
  disbursement_amount: float
  currency: CurrencyCode
  interest_rate_per_year: float
  open_date: datetime
  maturity_date: datetime
  duration_months: int
  terms_elapsed: int
  terms_remaining: int
  days_remaining: int
  is_matured: bool
  current_principal: float
  estimated_outstanding_balance: float
  monthly_payment: float
  total_interest: float
  total_repayment: float
  principal_repaid: float
  principal_repaid_percent: float

  @field_serializer("open_date", "maturity_date")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class CategoryCreate(CamelModel):
  name: CategoryName
  type: CashFlowType
  icon: str | None = Field(default=None, max_length=32)

  @field_validator("icon")
  @classmethod
  def clean_icon(cls, value: str | None) -> str | None:
    if value is None:
      return None
    return value.strip() or None


class CategoryUpdate(CamelModel):
  name: CategoryName | None = None
  type: CashFlowType | None = None
  icon: str | None = Field(default=None, max_length=32)
  is_active: bool | None = None

  @field_validator("icon")
  @classmethod
  def clean_icon(cls, value: str | None) -> str | None:
    if value is None:
      return None
    return value.strip() or None


class CategoryRead(CamelModel):
  id: str
  name: str
  type: CashFlowType
  icon: str | None
  is_active: bool
  created_at: datetime
  updated_at: datetime

  @field_serializer("created_at", "updated_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class TransactionCreate(CamelModel):
  type: CashFlowType
  category_id: str
  amount: TransactionAmount
  currency: CurrencyCode | None = None
  occurred_at: datetime
  description: str | None = Field(default=None, max_length=240)

  @field_validator("description")
  @classmethod
  def clean_description(cls, value: str | None) -> str | None:
    if value is None:
      return None
    return value.strip() or None


class TransactionUpdate(CamelModel):
  type: CashFlowType | None = None
  category_id: str | None = None
  amount: TransactionAmount | None = None
  currency: CurrencyCode | None = None
  occurred_at: datetime | None = None
  description: str | None = Field(default=None, max_length=240)

  @field_validator("description")
  @classmethod
  def clean_description(cls, value: str | None) -> str | None:
    if value is None:
      return None
    return value.strip() or None


class WeeklyExpenseEntryCreate(CamelModel):
  category_id: str
  amount: TransactionAmount
  description: str | None = Field(default=None, max_length=240)

  @field_validator("description")
  @classmethod
  def clean_description(cls, value: str | None) -> str | None:
    if value is None:
      return None
    return value.strip() or None


class WeeklyExpenseBatchCreate(CamelModel):
  week_ending: datetime
  currency: CurrencyCode | None = None
  entries: list[WeeklyExpenseEntryCreate] = Field(min_length=1, max_length=20)

  @field_validator("entries")
  @classmethod
  def category_once_per_week(
    cls, entries: list[WeeklyExpenseEntryCreate]
  ) -> list[WeeklyExpenseEntryCreate]:
    category_ids = [entry.category_id for entry in entries]
    if len(category_ids) != len(set(category_ids)):
      raise ValueError("Each category can appear only once in a weekly expense batch")
    return entries


class TransactionRead(CamelModel):
  id: str
  type: CashFlowType
  category_id: str
  category_name: str
  category_icon: str | None
  amount: float
  currency: CurrencyCode
  occurred_at: datetime
  description: str | None
  source: TransactionSource
  created_at: datetime
  updated_at: datetime

  @field_serializer("occurred_at", "created_at", "updated_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class CategorySpendingSummary(CamelModel):
  category_id: str
  name: str
  icon: str | None
  amount: float
  percent: float


class CurrencyConversionRate(CamelModel):
  source_currency: CurrencyCode
  target_currency: CurrencyCode
  rate: float
  rate_date: date


class LoanPaymentActivityRead(CamelModel):
  id: str
  loan_id: str
  bank_name: str
  term: int
  due_at: datetime
  amount: float
  currency: CurrencyCode
  reporting_amount: float | None
  reporting_currency: CurrencyCode

  @field_serializer("due_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


MonthKey = Annotated[
  str, StringConstraints(strip_whitespace=True, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
]
RecurringExpenseName = Annotated[
  str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]
DueDay = Annotated[int, Field(ge=1, le=31)]


class RecurringExpenseActivityRead(CamelModel):
  id: str
  recurring_expense_id: str
  name: str
  category_id: str
  category_name: str
  category_icon: str | None
  due_at: datetime
  amount: float
  currency: CurrencyCode
  reporting_amount: float | None
  reporting_currency: CurrencyCode

  @field_serializer("due_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class RecurringExpenseCreate(CamelModel):
  name: RecurringExpenseName
  category_id: str
  amount: TransactionAmount
  currency: CurrencyCode
  due_day: DueDay
  start_month: MonthKey
  end_month: MonthKey | None = None


class RecurringExpenseUpdate(CamelModel):
  name: RecurringExpenseName
  category_id: str
  amount: TransactionAmount
  currency: CurrencyCode
  due_day: DueDay
  effective_from_month: MonthKey
  end_month: MonthKey | None = None


class RecurringExpenseDeactivate(CamelModel):
  effective_from_month: MonthKey


class RecurringExpenseReactivate(CamelModel):
  resume_from_month: MonthKey
  name: RecurringExpenseName | None = None
  category_id: str | None = None
  amount: TransactionAmount | None = None
  currency: CurrencyCode | None = None
  due_day: DueDay | None = None
  end_month: MonthKey | None = None


class RecurringExpenseRead(CamelModel):
  id: str
  name: str
  category_id: str
  category_name: str
  category_icon: str | None
  amount: float
  currency: CurrencyCode
  due_day: int
  start_month: MonthKey
  end_month: MonthKey | None
  is_active: bool
  created_at: datetime
  updated_at: datetime

  @field_serializer("created_at", "updated_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


RecurringIncomeName = RecurringExpenseName
ExpectedDay = DueDay


class RecurringIncomeActivityRead(CamelModel):
  id: str
  recurring_income_id: str
  name: str
  category_id: str
  category_name: str
  category_icon: str | None
  expected_at: datetime
  amount: float
  currency: CurrencyCode
  reporting_amount: float | None
  reporting_currency: CurrencyCode

  @field_serializer("expected_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class RecurringIncomeCreate(CamelModel):
  name: RecurringIncomeName
  category_id: str
  amount: TransactionAmount
  currency: CurrencyCode
  expected_day: ExpectedDay
  start_month: MonthKey
  end_month: MonthKey | None = None


class RecurringIncomeUpdate(CamelModel):
  name: RecurringIncomeName
  category_id: str
  amount: TransactionAmount
  currency: CurrencyCode
  expected_day: ExpectedDay
  effective_from_month: MonthKey
  end_month: MonthKey | None = None


class RecurringIncomeDeactivate(CamelModel):
  effective_from_month: MonthKey


class RecurringIncomeReactivate(CamelModel):
  resume_from_month: MonthKey
  name: RecurringIncomeName | None = None
  category_id: str | None = None
  amount: TransactionAmount | None = None
  currency: CurrencyCode | None = None
  expected_day: ExpectedDay | None = None
  end_month: MonthKey | None = None


class RecurringIncomeRead(CamelModel):
  id: str
  name: str
  category_id: str
  category_name: str
  category_icon: str | None
  amount: float
  currency: CurrencyCode
  expected_day: int
  start_month: MonthKey
  end_month: MonthKey | None
  is_active: bool
  created_at: datetime
  updated_at: datetime

  @field_serializer("created_at", "updated_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class RoutineVariableCategoryRead(CamelModel):
  category_id: str
  name: str
  icon: str | None
  amount: float


class MonthlyRoutineSummary(CamelModel):
  year: int
  month: int
  currency: CurrencyCode
  expected_income_total: float
  expected_income_count: int
  expected_income: list[RecurringIncomeActivityRead]
  fixed_expense_total: float
  fixed_expense_count: int
  fixed_expenses: list[RecurringExpenseActivityRead]
  loan_payment_total: float
  loan_payment_count: int
  loan_payments: list[LoanPaymentActivityRead]
  committed_expense_total: float
  baseline_available: float
  actual_income_total: float
  actual_variable_expense_total: float
  projected_remainder: float
  variable_categories: list[RoutineVariableCategoryRead]
  converted_currencies: list[CurrencyCode]
  unconverted_currencies: list[CurrencyCode]
  conversion_rates: list[CurrencyConversionRate]
  exchange_rate_provider: str | None
  exchange_rate_provider_url: str | None


class CashFlowMonthlySummary(CamelModel):
  year: int
  month: int
  currency: CurrencyCode
  income: float
  expenses: float
  net_cash_flow: float
  savings_rate_percent: float | None
  transaction_count: int
  loan_payment_count: int
  loan_payments: list[LoanPaymentActivityRead]
  fixed_expense_total: float
  fixed_expense_count: int
  variable_expense_total: float
  loan_payment_total: float
  committed_expense_total: float
  recurring_expenses: list[RecurringExpenseActivityRead]
  category_breakdown: list[CategorySpendingSummary]
  converted_currencies: list[CurrencyCode]
  unconverted_currencies: list[CurrencyCode]
  conversion_rates: list[CurrencyConversionRate]
  exchange_rate_provider: str | None
  exchange_rate_provider_url: str | None
  # Backward-compatible alias retained for older clients. Once conversion is
  # enabled, only currencies that could not be converted remain excluded.
  excluded_currencies: list[CurrencyCode]


SavingPotBalance = Annotated[Decimal, Field(ge=0)]
SavingPotAdjustAmount = Annotated[Decimal, Field(gt=0)]
SavingPotAdjustDirection = Literal["add", "subtract"]
SavingPotEntryType = Literal[
  "opening",
  "manual_add",
  "manual_subtract",
  "balance_correction",
  "month_apply",
  "month_reconciliation",
  "legacy_baseline",
]
SavingPotNote = Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]


class SavingPotUpsert(CamelModel):
  balance: SavingPotBalance
  currency: CurrencyCode | None = None
  note: SavingPotNote | None = None


class SavingPotAdjust(CamelModel):
  amount: SavingPotAdjustAmount
  direction: SavingPotAdjustDirection
  note: SavingPotNote | None = None


class SavingPotMonthApplicationRead(CamelModel):
  id: str
  year: int
  month: int
  amount_applied: float
  currency: CurrencyCode
  applied_at: datetime

  @field_serializer("applied_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class SavingPotEntryRead(CamelModel):
  id: str
  entry_type: SavingPotEntryType
  amount: float
  currency: CurrencyCode
  year: int | None
  month: int | None
  note: str | None
  created_at: datetime

  @field_serializer("created_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)


class SavingPotHistoryPage(CamelModel):
  items: list[SavingPotEntryRead]
  total: int
  limit: int
  offset: int


class SavingPotRead(CamelModel):
  id: str
  balance: float
  currency: CurrencyCode
  created_at: datetime
  updated_at: datetime
  applications: list[SavingPotMonthApplicationRead]
  sync_warnings: list[str] = []

  @field_serializer("created_at", "updated_at")
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


class SetCurrencyRequest(CamelModel):
  currency: CurrencyCode


class UserRead(CamelModel):
  id: str
  username: str
  is_admin: bool
  must_change_password: bool
  preferred_currency: str | None
  created_at: datetime

  @field_serializer("created_at")
  def _serialize_dt(self, dt: datetime, _info) -> str:
    return _to_js_iso(dt)
