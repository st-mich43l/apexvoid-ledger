from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.exchange_rates import (
  ExchangeRateProviderError,
  ExchangeRateQuote,
  FrankfurterExchangeRateProvider,
)
from app.models import (
  MonthlyBudget,
  MonthlyClose,
  MonthlyCloseSnapshot,
  SavingPot,
  SavingPotEntry,
  SavingPotMonthApplication,
  Transaction,
  User,
)
from app import monthly_close as close_domain
from app.routers import saving_pot as saving_pot_router


@pytest.fixture(autouse=True)
def deterministic_exchange_rates(monkeypatch: pytest.MonkeyPatch):
  def get_rates(
    _provider: FrankfurterExchangeRateProvider,
    source_currency: str,
    target_currency: str,
    start_date: date,
    _end_date: date,
  ) -> list[ExchangeRateQuote]:
    rate = Decimal("25000") if (source_currency, target_currency) == ("USD", "VND") else Decimal("2")
    return [
      ExchangeRateQuote(
        source_currency=source_currency,
        target_currency=target_currency,
        rate=rate,
        rate_date=start_date,
      )
    ]

  monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", get_rates)


def freeze_now(monkeypatch: pytest.MonkeyPatch, frozen: datetime) -> None:
  class _FrozenDateTime:
    @staticmethod
    def now(tz=None):
      return frozen if tz is not None else frozen.replace(tzinfo=None)

  monkeypatch.setattr(close_domain, "datetime", _FrozenDateTime)
  monkeypatch.setattr(saving_pot_router, "datetime", _FrozenDateTime)


def set_currency(db: Session, user: User, currency: str = "VND") -> None:
  user.preferred_currency = currency
  db.commit()


def categories(client: TestClient) -> list[dict]:
  response = client.get("/api/categories?includeInactive=true")
  assert response.status_code == 200, response.text
  return response.json()


def category(client: TestClient, name: str, category_type: str = "expense") -> dict:
  return next(
    item for item in categories(client)
    if item["name"] == name and item["type"] == category_type
  )


def create_tx(client: TestClient, **overrides) -> dict:
  food = category(client, "Food")
  salary = category(client, "Salary", "income")
  payload = {
    "type": "expense",
    "categoryId": food["id"],
    "amount": 10_000_000,
    "currency": "VND",
    "occurredAt": "2026-07-15T12:00:00Z",
    "description": None,
    **overrides,
  }
  if payload["type"] == "income" and "categoryId" not in overrides:
    payload["categoryId"] = salary["id"]
  response = client.post("/api/transactions", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def create_income(client: TestClient, amount: int = 45_000_000, **overrides) -> dict:
  payload = {
    "name": "Monthly salary",
    "categoryId": category(client, "Salary", "income")["id"],
    "amount": amount,
    "currency": "VND",
    "expectedDay": 25,
    "startMonth": "2026-01",
    "endMonth": None,
    **overrides,
  }
  response = client.post("/api/recurring-incomes", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def create_fixed(client: TestClient, amount: int = 15_000_000, **overrides) -> dict:
  payload = {
    "name": "Apartment rent",
    "categoryId": category(client, "Housing")["id"],
    "amount": amount,
    "currency": "VND",
    "dueDay": 5,
    "startMonth": "2026-01",
    "endMonth": None,
    **overrides,
  }
  response = client.post("/api/recurring-expenses", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def create_loan(client: TestClient, **overrides) -> dict:
  payload = {
    "bankName": "Example Bank",
    "openDate": "2026-06-07T00:00:00Z",
    "disbursementAmount": 96_000_000,
    "currency": "VND",
    "interestRatePerYear": 0,
    "durationMonths": 12,
    "loanType": "unsecured",
    **overrides,
  }
  response = client.post("/api/loans", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def save_budget(client: TestClient, year: int = 2026, month: int = 7, savings: int = 5_000_000) -> dict:
  payload = {
    "currency": "VND",
    "plannedSavings": savings,
    "allocations": [
      {"categoryId": category(client, "Food")["id"], "amount": 16_000_000},
    ],
  }
  response = client.put(f"/api/monthly-budget?year={year}&month={month}", json=payload)
  assert response.status_code == 200, response.text
  return response.json()


def get_close(client: TestClient, year: int = 2026, month: int = 7) -> dict:
  response = client.get(f"/api/monthly-close?year={year}&month={month}")
  assert response.status_code == 200, response.text
  return response.json()


def close_month(client: TestClient, year: int = 2026, month: int = 7, note: str | None = None) -> dict:
  body = {} if note is None else {"note": note}
  response = client.post(f"/api/monthly-close/{year}/{month}/close", json=body)
  assert response.status_code == 201, response.text
  return response.json()


def cashflow(client: TestClient, year: int = 2026, month: int = 7) -> dict:
  response = client.get(f"/api/cashflow/summary?year={year}&month={month}&currency=VND")
  assert response.status_code == 200, response.text
  return response.json()


class TestMonthlyCloseAuth:
  def test_requires_authentication(self, client: TestClient):
    assert client.get("/api/monthly-close?year=2026&month=7").status_code == 401
    assert client.post("/api/monthly-close/2026/7/close", json={}).status_code == 401
    assert (
      client.post("/api/monthly-close/2026/7/reclose", json={"reason": "x"}).status_code
      == 401
    )


class TestMonthlyCloseIsolation:
  def test_user_a_close_is_invisible_to_user_b(
    self,
    auth_client: TestClient,
    other_auth_client: TestClient,
    user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    close_month(auth_client)
    alice = get_close(auth_client)
    bob = get_close(other_auth_client)
    assert alice["status"] == "closed"
    assert alice["latestSnapshot"] is not None
    assert bob["latestSnapshot"] is None
    assert bob["status"] == "ready_to_close"


class TestCloseEligibility:
  def test_past_current_future_and_boundaries(
    self,
    auth_client: TestClient,
    user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    july = get_close(auth_client, 2026, 7)
    august = get_close(auth_client, 2026, 8)
    september = get_close(auth_client, 2026, 9)
    assert july["status"] == "ready_to_close"
    assert july["closeEligible"] is True
    assert august["status"] == "in_progress"
    assert august["closeEligible"] is False
    assert september["status"] == "in_progress"
    assert auth_client.post("/api/monthly-close/2026/8/close", json={}).status_code == 409
    assert auth_client.post("/api/monthly-close/2026/9/close", json={}).status_code == 409

    freeze_now(monkeypatch, datetime(2027, 1, 1, tzinfo=timezone.utc))
    december = get_close(auth_client, 2026, 12)
    assert december["status"] == "ready_to_close"

    freeze_now(monkeypatch, datetime(2024, 2, 29, tzinfo=timezone.utc))
    assert get_close(auth_client, 2024, 2)["status"] == "in_progress"
    freeze_now(monkeypatch, datetime(2024, 3, 1, tzinfo=timezone.utc))
    assert get_close(auth_client, 2024, 2)["status"] == "ready_to_close"


class TestInitialClose:
  def test_snapshot_matches_cash_flow_breakdown(
    self,
    auth_client: TestClient,
    user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_income(auth_client, 45_000_000)
    create_tx(auth_client, type="income", amount=5_000_000)
    create_fixed(auth_client, 15_000_000)
    create_tx(auth_client, amount=10_000_000)
    create_loan(auth_client)
    cf = cashflow(auth_client)
    result = close_month(auth_client, note="Reviewed July")
    snap = result["latestSnapshot"]
    assert snap["scheduledIncomeTotal"] == 45_000_000
    assert snap["manualIncomeTotal"] == 5_000_000
    assert snap["incomeTotal"] == 50_000_000
    assert snap["fixedExpenseTotal"] == 15_000_000
    assert snap["variableExpenseTotal"] == 10_000_000
    assert snap["loanPaymentTotal"] == 8_000_000
    assert snap["expenseTotal"] == 33_000_000
    assert snap["netCashFlow"] == 17_000_000
    assert snap["incomeTotal"] == cf["income"]
    assert snap["expenseTotal"] == cf["expenses"]
    assert snap["netCashFlow"] == cf["netCashFlow"]
    assert snap["revisionNumber"] == 1
    assert result["status"] == "closed"


class TestExpenseBreakdown:
  def test_fixed_variable_loan_sum(self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_fixed(auth_client, 12_000_000)
    create_tx(auth_client, amount=7_000_000)
    create_loan(auth_client)
    snap = close_month(auth_client)["latestSnapshot"]
    assert snap["fixedExpenseTotal"] == 12_000_000
    assert snap["variableExpenseTotal"] == 7_000_000
    assert snap["loanPaymentTotal"] == 8_000_000
    assert snap["expenseTotal"] == 27_000_000


class TestBudgetSnapshot:
  def test_budget_values_are_frozen(
    self,
    auth_client: TestClient,
    user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_tx(auth_client, amount=14_000_000)
    save_budget(auth_client, savings=5_000_000)
    snap = close_month(auth_client)["latestSnapshot"]
    assert snap["hasBudget"] is True
    assert snap["plannedSavingsAmount"] == 5_000_000
    assert snap["plannedVariableBudgetTotal"] == 16_000_000
    assert snap["budgetActualVariableExpenseTotal"] == 14_000_000
    assert snap["safeToSpend"] == 2_000_000
    auth_client.put(
      "/api/monthly-budget?year=2026&month=7",
      json={
        "currency": "VND",
        "plannedSavings": 8_000_000,
        "allocations": [{"categoryId": category(auth_client, "Food")["id"], "amount": 20_000_000}],
      },
    )
    row = db_session.query(MonthlyCloseSnapshot).one()
    assert Decimal(row.planned_savings_amount) == Decimal("5000000.00")
    assert Decimal(row.planned_variable_budget_total) == Decimal("16000000.00")
    drifted = get_close(auth_client)
    assert drifted["status"] == "needs_review"
    assert drifted["hasDrift"] is True
    assert "plannedSavingsAmount" in drifted["driftFields"]


class TestNoBudget:
  def test_close_without_budget(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    snap = close_month(auth_client)["latestSnapshot"]
    assert snap["hasBudget"] is False
    assert snap["plannedSavingsAmount"] is None


class TestTransactionDrift:
  def test_add_and_delete_expense(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    first = close_month(auth_client)
    assert first["status"] == "closed"
    created = create_tx(auth_client, amount=500_000)
    after_add = get_close(auth_client)
    assert after_add["status"] == "needs_review"
    assert "variableExpenseTotal" in after_add["driftFields"]
    assert "expenseTotal" in after_add["driftFields"]
    assert "netCashFlow" in after_add["driftFields"]
    original = db_session.query(MonthlyCloseSnapshot).filter_by(revision_number=1).one()
    assert Decimal(original.variable_expense_total) == Decimal("0.00")
    assert auth_client.delete(f"/api/transactions/{created['id']}").status_code == 204
    restored = get_close(auth_client)
    assert restored["status"] == "closed"
    assert restored["hasDrift"] is False


class TestRecurringDrift:
  def test_recurring_income_and_expense(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    income = create_income(auth_client, 45_000_000)
    fixed = create_fixed(auth_client, 12_000_000)
    close_month(auth_client)
    auth_client.put(
      f"/api/recurring-incomes/{income['id']}",
      json={
        "name": income["name"],
        "categoryId": income["categoryId"],
        "amount": 46_000_000,
        "currency": "VND",
        "expectedDay": 25,
        "effectiveFromMonth": "2026-07",
      },
    )
    income_drift = get_close(auth_client)
    assert income_drift["status"] == "needs_review"
    assert "scheduledIncomeTotal" in income_drift["driftFields"]
    assert "incomeTotal" in income_drift["driftFields"]
    assert "netCashFlow" in income_drift["driftFields"]
    auth_client.put(
      f"/api/recurring-expenses/{fixed['id']}",
      json={
        "name": fixed["name"],
        "categoryId": fixed["categoryId"],
        "amount": 12_500_000,
        "currency": "VND",
        "dueDay": 5,
        "effectiveFromMonth": "2026-07",
      },
    )
    expense_drift = get_close(auth_client)
    assert "fixedExpenseTotal" in expense_drift["driftFields"]


class TestLoanDrift:
  def test_schedule_change_without_payment_status(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    loan = create_loan(auth_client)
    close_month(auth_client)
    auth_client.put(f"/api/loans/{loan['id']}", json={"disbursementAmount": 120_000_000})
    drifted = get_close(auth_client)
    assert drifted["status"] == "needs_review"
    assert "loanPaymentTotal" in drifted["driftFields"]
    assert "paid" not in drifted["latestSnapshot"]


class TestSavingPotClose:
  def test_close_syncs_application_and_reconciliation(
    self,
    auth_client: TestClient,
    user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "USD")
    create_tx(auth_client, type="income", amount=15, currency="USD")
    create_tx(auth_client, amount=5, currency="USD")
    pot = auth_client.put("/api/saving-pot", json={"balance": 0, "currency": "USD"}).json()
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    result = close_month(auth_client)
    snap = result["latestSnapshot"]
    assert snap["netCashFlow"] == 10
    assert snap["savingPotApplicable"] is True
    assert snap["savingPotMonthAppliedAmount"] == 10
    assert snap["savingPotSynced"] is True
    apps = db_session.query(SavingPotMonthApplication).all()
    assert len(apps) == 1
    assert Decimal(apps[0].amount_applied) == Decimal("10.00")

    create_tx(auth_client, amount=1, currency="USD")
    auth_client.get("/api/saving-pot")
    db_session.expire_all()
    apps = db_session.query(SavingPotMonthApplication).all()
    assert Decimal(apps[0].amount_applied) == Decimal("9.00")
    drifted = get_close(auth_client)
    assert drifted["status"] == "needs_review"
    assert "savingPotMonthAppliedAmount" in drifted["driftFields"]

    reclosed = auth_client.post(
      "/api/monthly-close/2026/7/reclose",
      json={"reason": "Corrected missing expense"},
    )
    assert reclosed.status_code == 200, reclosed.text
    assert reclosed.json()["latestSnapshot"]["revisionNumber"] == 2
    assert reclosed.json()["latestSnapshot"]["savingPotMonthAppliedAmount"] == 9
    first = db_session.query(MonthlyCloseSnapshot).filter_by(revision_number=1).one()
    assert Decimal(first.saving_pot_month_applied_amount) == Decimal("10.00")

  def test_manual_adjustment_does_not_drift(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "USD")
    pot = auth_client.put("/api/saving-pot", json={"balance": 0, "currency": "USD"}).json()
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()
    close_month(auth_client)
    auth_client.post("/api/saving-pot/adjust", json={"amount": 5, "direction": "add"})
    after = get_close(auth_client)
    assert after["status"] == "closed"
    assert after["hasDrift"] is False

  def test_absent_and_not_applicable(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    none = close_month(auth_client)
    assert none["latestSnapshot"]["savingPotExists"] is False
    db_session.query(MonthlyCloseSnapshot).delete()
    db_session.query(MonthlyClose).delete()
    db_session.commit()
    pot = auth_client.put("/api/saving-pot", json={"balance": 1, "currency": "VND"}).json()
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 8, 1, tzinfo=timezone.utc)
    db_session.commit()
    later = close_month(auth_client)
    assert later["latestSnapshot"]["savingPotExists"] is True
    assert later["latestSnapshot"]["savingPotApplicable"] is False


class TestFxBlockers:
  def test_incomplete_cash_flow_blocks_close(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_tx(auth_client, amount=20, currency="USD")

    def unavailable(*_args, **_kwargs):
      raise ExchangeRateProviderError("offline")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
    body = get_close(auth_client)
    assert body["status"] == "blocked"
    assert body["closeEligible"] is False
    rejected = auth_client.post("/api/monthly-close/2026/7/close", json={})
    assert rejected.status_code == 409
    assert db_session.query(MonthlyClose).count() == 0
    assert db_session.query(MonthlyCloseSnapshot).count() == 0

  def test_incomplete_budget_comparison_blocks_close(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_tx(auth_client, amount=20, currency="USD")
    save_budget(auth_client)

    def unavailable(*_args, **_kwargs):
      raise ExchangeRateProviderError("offline")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
    assert get_close(auth_client)["status"] == "blocked"
    assert auth_client.post("/api/monthly-close/2026/7/close", json={}).status_code == 409


class TestReclose:
  def test_revision_and_noop_and_reason(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    close_month(auth_client)
    noop = auth_client.post(
      "/api/monthly-close/2026/7/reclose", json={"reason": "nothing"}
    )
    assert noop.status_code == 409
    create_tx(auth_client, amount=500_000)
    empty = auth_client.post("/api/monthly-close/2026/7/reclose", json={"reason": "   "})
    assert empty.status_code == 422
    too_long = auth_client.post("/api/monthly-close/2026/7/reclose", json={"reason": "x" * 241})
    assert too_long.status_code == 422
    ok = auth_client.post(
      "/api/monthly-close/2026/7/reclose",
      json={"reason": "  Added missing Food expense  "},
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["latestSnapshot"]["revisionNumber"] == 2
    assert body["latestSnapshot"]["note"] == "Added missing Food expense"
    assert body["status"] == "closed"
    assert body["hasDrift"] is False
    assert db_session.query(MonthlyCloseSnapshot).count() == 2
    first = db_session.query(MonthlyCloseSnapshot).filter_by(revision_number=1).one()
    assert Decimal(first.net_cash_flow) == Decimal("0.00")


class TestSnapshotImmutabilityAndIdempotency:
  def test_original_row_unchanged_and_get_is_read_only(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    create_tx(auth_client, amount=1_000_000)
    close_month(auth_client)
    original = db_session.query(MonthlyCloseSnapshot).one()
    frozen = {
      "net": Decimal(original.net_cash_flow),
      "variable": Decimal(original.variable_expense_total),
      "note": original.note,
      "revision": original.revision_number,
      "closed_at": original.closed_at,
    }
    counts = {
      "close": db_session.query(MonthlyClose).count(),
      "snap": db_session.query(MonthlyCloseSnapshot).count(),
      "tx": db_session.query(Transaction).count(),
      "entry": db_session.query(SavingPotEntry).count(),
      "app": db_session.query(SavingPotMonthApplication).count(),
      "budget": db_session.query(MonthlyBudget).count(),
    }
    get_close(auth_client)
    get_close(auth_client)
    create_tx(auth_client, amount=2_000_000)
    db_session.refresh(original)
    assert Decimal(original.net_cash_flow) == frozen["net"]
    assert Decimal(original.variable_expense_total) == frozen["variable"]
    assert original.note == frozen["note"]
    assert original.revision_number == frozen["revision"]
    assert original.closed_at == frozen["closed_at"]
    get_close(auth_client)
    assert db_session.query(MonthlyClose).count() == counts["close"]
    assert db_session.query(MonthlyCloseSnapshot).count() == counts["snap"]
    assert db_session.query(Transaction).count() == counts["tx"] + 1
    assert db_session.query(SavingPotEntry).count() == counts["entry"]
    assert db_session.query(SavingPotMonthApplication).count() == counts["app"]
    assert db_session.query(MonthlyBudget).count() == counts["budget"]
    second = auth_client.post("/api/monthly-close/2026/7/close", json={})
    assert second.status_code == 409
    assert db_session.query(MonthlyCloseSnapshot).count() == 1


class TestEmptyAndNegative:
  def test_zero_and_deficit(
    self, auth_client: TestClient, user: User, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 14, tzinfo=timezone.utc))
    set_currency(db_session, user, "VND")
    empty = close_month(auth_client)
    assert empty["latestSnapshot"]["incomeTotal"] == 0
    assert empty["latestSnapshot"]["expenseTotal"] == 0
    assert empty["latestSnapshot"]["netCashFlow"] == 0
    db_session.query(MonthlyCloseSnapshot).delete()
    db_session.query(MonthlyClose).delete()
    db_session.commit()
    create_tx(auth_client, type="income", amount=10_000_000)
    create_tx(auth_client, amount=20_000_000)
    deficit = close_month(auth_client)
    assert deficit["latestSnapshot"]["netCashFlow"] == -10_000_000
