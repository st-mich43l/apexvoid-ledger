from calendar import monthrange
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
from app.models import RecurringIncomeRevision, SavingPot, SavingPotEntry, Transaction
from app.monthly_recurrence import due_at_for_month
from app.routers import saving_pot as saving_pot_router


@pytest.fixture(autouse=True)
def deterministic_exchange_rates(monkeypatch: pytest.MonkeyPatch):
  rates = {
    ("EUR", "USD"): Decimal("1.25"),
    ("USD", "VND"): Decimal("25000"),
  }

  def get_rates(
    _provider: FrankfurterExchangeRateProvider,
    source_currency: str,
    target_currency: str,
    start_date: date,
    _end_date: date,
  ) -> list[ExchangeRateQuote]:
    key = (source_currency, target_currency)
    if key not in rates and source_currency != target_currency:
      rate = Decimal("2")
    else:
      rate = rates.get(key, Decimal("1"))
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

  monkeypatch.setattr(saving_pot_router, "datetime", _FrozenDateTime)


def categories(client: TestClient) -> list[dict]:
  response = client.get("/api/categories")
  assert response.status_code == 200, response.text
  return response.json()


def category(client: TestClient, name: str, category_type: str = "expense") -> dict:
  return next(
    item for item in categories(client) if item["name"] == name and item["type"] == category_type
  )


def create_income(client: TestClient, **overrides) -> dict:
  salary = category(client, "Salary", "income")
  payload = {
    "name": "Monthly salary",
    "categoryId": salary["id"],
    "amount": 45000000,
    "currency": "VND",
    "expectedDay": 25,
    "startMonth": "2026-01",
    "endMonth": None,
    **overrides,
  }
  response = client.post("/api/recurring-incomes", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def create_fixed(client: TestClient, **overrides) -> dict:
  housing = category(client, "Housing")
  payload = {
    "name": "Apartment rent",
    "categoryId": housing["id"],
    "amount": 12000000,
    "currency": "VND",
    "dueDay": 5,
    "startMonth": "2026-01",
    "endMonth": None,
    **overrides,
  }
  response = client.post("/api/recurring-expenses", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def create_tx(client: TestClient, **overrides) -> dict:
  food = category(client, "Food")
  salary = category(client, "Salary", "income")
  payload = {
    "type": "expense",
    "categoryId": food["id"],
    "amount": 10,
    "currency": "USD",
    "occurredAt": "2026-08-15T12:00:00Z",
    "description": None,
    **overrides,
  }
  if payload["type"] == "income" and "categoryId" not in overrides:
    payload["categoryId"] = salary["id"]
  response = client.post("/api/transactions", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def summary(client: TestClient, year: int, month: int, currency: str = "VND") -> dict:
  response = client.get(f"/api/cashflow/summary?year={year}&month={month}&currency={currency}")
  assert response.status_code == 200, response.text
  return response.json()


def routine(client: TestClient, year: int, month: int, currency: str = "VND") -> dict:
  response = client.get(
    f"/api/monthly-routine?year={year}&month={month}&currency={currency}"
  )
  assert response.status_code == 200, response.text
  return response.json()


class TestDueDayShared:
  def test_clamps(self):
    assert due_at_for_month(2026, 2, 31).day == 28
    assert due_at_for_month(2024, 2, 31).day == 29
    assert due_at_for_month(2026, 4, 31).day == 30
    for year, month in ((2026, 2), (2024, 2), (2026, 4), (2026, 1)):
      assert due_at_for_month(year, month, 31).day == monthrange(year, month)[1]


class TestRecurringIncomeAuth:
  def test_unauthenticated(self, client: TestClient):
    assert client.get("/api/recurring-incomes").status_code == 401
    assert client.post("/api/recurring-incomes", json={}).status_code == 401
    assert client.get("/api/monthly-routine?year=2026&month=8&currency=VND").status_code == 401

  def test_cross_user_404(self, auth_client: TestClient, other_auth_client: TestClient):
    created = create_income(auth_client)
    assert other_auth_client.get("/api/recurring-incomes").json() == []
    assert (
      other_auth_client.put(
        f"/api/recurring-incomes/{created['id']}",
        json={
          "name": "Hack",
          "categoryId": created["categoryId"],
          "amount": 1,
          "currency": "VND",
          "expectedDay": 1,
          "effectiveFromMonth": "2026-09",
        },
      ).status_code
      == 404
    )
    assert (
      other_auth_client.post(
        f"/api/recurring-incomes/{created['id']}/deactivate",
        json={"effectiveFromMonth": "2026-10"},
      ).status_code
      == 404
    )


class TestRecurringIncomeValidation:
  def test_rejects_bad_inputs(self, auth_client: TestClient):
    salary = category(auth_client, "Salary", "income")
    housing = category(auth_client, "Housing")
    assert (
      auth_client.post(
        "/api/recurring-incomes",
        json={
          "name": " ",
          "categoryId": salary["id"],
          "amount": 100,
          "currency": "VND",
          "expectedDay": 25,
          "startMonth": "2026-08",
        },
      ).status_code
      == 422
    )
    assert (
      auth_client.post(
        "/api/recurring-incomes",
        json={
          "name": "Salary",
          "categoryId": housing["id"],
          "amount": 100,
          "currency": "VND",
          "expectedDay": 25,
          "startMonth": "2026-08",
        },
      ).status_code
      == 422
    )
    assert (
      auth_client.post(
        "/api/recurring-incomes",
        json={
          "name": "Salary",
          "categoryId": salary["id"],
          "amount": 0,
          "currency": "VND",
          "expectedDay": 25,
          "startMonth": "2026-08",
        },
      ).status_code
      == 422
    )
    assert (
      auth_client.post(
        "/api/recurring-incomes",
        json={
          "name": "Salary",
          "categoryId": salary["id"],
          "amount": 100,
          "currency": "VND",
          "expectedDay": 32,
          "startMonth": "2026-08",
        },
      ).status_code
      == 422
    )


class TestRecurringIncomeLifecycle:
  def test_effective_edit_and_boundaries(self, auth_client: TestClient):
    created = create_income(auth_client, amount=45000000, startMonth="2026-01")
    updated = auth_client.put(
      f"/api/recurring-incomes/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 50000000,
        "currency": "VND",
        "expectedDay": 25,
        "effectiveFromMonth": "2026-09",
      },
    )
    assert updated.status_code == 200, updated.text
    assert routine(auth_client, 2026, 8)["expectedIncomeTotal"] == 45000000
    assert routine(auth_client, 2026, 9)["expectedIncomeTotal"] == 50000000

  def test_same_month_updates_in_place(self, auth_client: TestClient, db_session: Session):
    created = create_income(auth_client, amount=100, startMonth="2026-05")
    auth_client.put(
      f"/api/recurring-incomes/{created['id']}",
      json={
        "name": "Renamed",
        "categoryId": created["categoryId"],
        "amount": 200,
        "currency": "VND",
        "expectedDay": 25,
        "effectiveFromMonth": "2026-05",
      },
    )
    assert db_session.query(RecurringIncomeRevision).count() == 1
    assert routine(auth_client, 2026, 5)["expectedIncomeTotal"] == 200

  def test_historical_edit_rejected(self, auth_client: TestClient):
    created = create_income(auth_client, amount=10, startMonth="2026-01")
    auth_client.put(
      f"/api/recurring-incomes/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 11,
        "currency": "VND",
        "expectedDay": 25,
        "effectiveFromMonth": "2026-05",
      },
    )
    conflict = auth_client.put(
      f"/api/recurring-incomes/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 12,
        "currency": "VND",
        "expectedDay": 25,
        "effectiveFromMonth": "2026-03",
      },
    )
    assert conflict.status_code == 409

  def test_stop_and_resume(self, auth_client: TestClient):
    created = create_income(auth_client, amount=5000000, startMonth="2026-01")
    stopped = auth_client.post(
      f"/api/recurring-incomes/{created['id']}/deactivate",
      json={"effectiveFromMonth": "2026-06"},
    )
    assert stopped.status_code == 200
    assert stopped.json()["isActive"] is False
    assert routine(auth_client, 2026, 5)["expectedIncomeTotal"] == 5000000
    assert routine(auth_client, 2026, 6)["expectedIncomeTotal"] == 0

    resumed = auth_client.post(
      f"/api/recurring-incomes/{created['id']}/reactivate",
      json={"resumeFromMonth": "2026-09"},
    )
    assert resumed.status_code == 200
    assert routine(auth_client, 2026, 8)["expectedIncomeTotal"] == 0
    assert routine(auth_client, 2026, 9)["expectedIncomeTotal"] == 5000000

  def test_end_month_boundaries(self, auth_client: TestClient):
    create_income(
      auth_client,
      amount=1000000,
      startMonth="2026-03",
      endMonth="2026-06",
      expectedDay=10,
    )
    assert routine(auth_client, 2026, 2)["expectedIncomeTotal"] == 0
    assert routine(auth_client, 2026, 3)["expectedIncomeTotal"] == 1000000
    assert routine(auth_client, 2026, 6)["expectedIncomeTotal"] == 1000000
    assert routine(auth_client, 2026, 7)["expectedIncomeTotal"] == 0

  def test_no_write_on_read(self, auth_client: TestClient, db_session: Session):
    create_income(auth_client, startMonth="2026-08")
    before_tx = db_session.query(Transaction).count()
    before_rev = db_session.query(RecurringIncomeRevision).count()
    for _ in range(5):
      routine(auth_client, 2026, 8)
      auth_client.get("/api/recurring-incomes")
    assert db_session.query(Transaction).count() == before_tx
    assert db_session.query(RecurringIncomeRevision).count() == before_rev


class TestMonthlyRoutineCalculations:
  def test_basic_equations(self, auth_client: TestClient):
    create_income(auth_client, amount=50000000, startMonth="2026-08", expectedDay=25)
    create_fixed(auth_client, amount=12000000, startMonth="2026-08")
    create_tx(
      auth_client,
      amount=5000000,
      currency="VND",
      occurredAt="2026-08-12T00:00:00Z",
    )
    data = routine(auth_client, 2026, 8)
    assert data["expectedIncomeTotal"] == 50000000
    assert data["fixedExpenseTotal"] == 12000000
    assert data["loanPaymentTotal"] == 0
    assert data["committedExpenseTotal"] == 12000000
    assert data["baselineAvailable"] == 38000000
    assert data["actualVariableExpenseTotal"] == 5000000
    assert data["projectedRemainder"] == 33000000

  def test_actual_income_independence(self, auth_client: TestClient):
    create_income(auth_client, amount=50000000, startMonth="2026-08")
    create_tx(
      auth_client,
      type="income",
      amount=45000000,
      currency="VND",
      occurredAt="2026-08-25T00:00:00Z",
    )
    data = routine(auth_client, 2026, 8)
    assert data["expectedIncomeTotal"] == 50000000
    assert data["actualIncomeTotal"] == 45000000
    cash = summary(auth_client, 2026, 8)
    assert cash["income"] == 45000000

  def test_negative_baseline(self, auth_client: TestClient):
    create_income(auth_client, amount=20000000, startMonth="2026-08")
    create_fixed(auth_client, amount=25000000, startMonth="2026-08")
    data = routine(auth_client, 2026, 8)
    assert data["baselineAvailable"] == -5000000
    assert data["projectedRemainder"] == -5000000


class TestCashFlowIsolation:
  def test_expected_income_does_not_change_cashflow(self, auth_client: TestClient):
    before = summary(auth_client, 2026, 8)
    create_income(auth_client, amount=50000000, startMonth="2026-08")
    after = summary(auth_client, 2026, 8)
    assert after["income"] == before["income"]
    assert after["netCashFlow"] == before["netCashFlow"]
    assert after["transactionCount"] == before["transactionCount"]
    assert after["expenses"] == before["expenses"]


class TestSavingPotIsolation:
  def test_expected_income_does_not_reconcile_saving_pot(
    self, auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, tzinfo=timezone.utc))
    create_tx(
      auth_client,
      type="income",
      amount=1000,
      currency="USD",
      occurredAt="2026-07-10T00:00:00Z",
    )
    put = auth_client.put("/api/saving-pot", json={"balance": 1000, "currency": "USD"})
    assert put.status_code == 200
    row = db_session.query(SavingPot).filter(SavingPot.id == put.json()["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    synced = auth_client.get("/api/saving-pot").json()
    assert synced["balance"] == 2000
    before_entries = db_session.query(SavingPotEntry).count()

    create_income(
      auth_client,
      amount=500,
      currency="USD",
      startMonth="2026-07",
      expectedDay=20,
    )
    assert routine(auth_client, 2026, 7, "USD")["expectedIncomeTotal"] == 500

    after = auth_client.get("/api/saving-pot").json()
    assert after["balance"] == 2000
    assert after["applications"][0]["amountApplied"] == 1000
    assert db_session.query(SavingPotEntry).count() == before_entries
    history = auth_client.get("/api/saving-pot/history").json()["items"]
    assert not any(item["entryType"] == "month_reconciliation" for item in history)

    # Actual income still reconciles normally.
    create_tx(
      auth_client,
      type="income",
      amount=100,
      currency="USD",
      occurredAt="2026-07-22T00:00:00Z",
    )
    reconciled = auth_client.get("/api/saving-pot").json()
    assert reconciled["balance"] == 2100
    assert reconciled["applications"][0]["amountApplied"] == 1100

  def test_fixed_expense_still_reconciles(
    self, auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, tzinfo=timezone.utc))
    create_tx(
      auth_client,
      type="income",
      amount=1000,
      currency="USD",
      occurredAt="2026-07-10T00:00:00Z",
    )
    put = auth_client.put("/api/saving-pot", json={"balance": 1000, "currency": "USD"})
    row = db_session.query(SavingPot).filter(SavingPot.id == put.json()["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()
    assert auth_client.get("/api/saving-pot").json()["balance"] == 2000

    create_fixed(auth_client, amount=100, currency="USD", startMonth="2026-07", dueDay=20)
    reconciled = auth_client.get("/api/saving-pot").json()
    assert reconciled["balance"] == 1900


class TestExpectedIncomeFx:
  def test_converts_historical(self, auth_client: TestClient):
    salary = category(auth_client, "Salary", "income")
    create_income(
      auth_client,
      name="Retainer",
      categoryId=salary["id"],
      amount=2000,
      currency="USD",
      expectedDay=5,
      startMonth="2026-08",
    )
    data = routine(auth_client, 2026, 8, "VND")
    assert data["expectedIncomeTotal"] == 50000000
    item = data["expectedIncome"][0]
    assert item["amount"] == 2000
    assert item["currency"] == "USD"
    assert item["reportingAmount"] == 50000000
    assert summary(auth_client, 2026, 8, "VND")["income"] == 0

  def test_fx_failure(self, auth_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    salary = category(auth_client, "Salary", "income")
    create_income(
      auth_client,
      name="Retainer",
      categoryId=salary["id"],
      amount=2000,
      currency="USD",
      expectedDay=5,
      startMonth="2026-08",
    )

    def unavailable(*_args, **_kwargs):
      raise ExchangeRateProviderError("down")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
    data = routine(auth_client, 2026, 8, "VND")
    assert data["expectedIncomeTotal"] == 0
    assert data["expectedIncome"][0]["reportingAmount"] is None
    assert "USD" in data["unconvertedCurrencies"]
