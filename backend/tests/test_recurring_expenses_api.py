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
from app.models import RecurringExpenseRevision, Transaction
from app.recurring_expenses import due_at_for_month
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


def create_recurring(client: TestClient, **overrides) -> dict:
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


def summary(client: TestClient, year: int, month: int, currency: str = "VND") -> dict:
  response = client.get(
    f"/api/cashflow/summary?year={year}&month={month}&currency={currency}"
  )
  assert response.status_code == 200, response.text
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


class TestDueDayClamping:
  def test_clamps_to_month_length(self):
    assert due_at_for_month(2026, 1, 31).day == 31
    assert due_at_for_month(2026, 2, 31).day == 28
    assert due_at_for_month(2024, 2, 31).day == 29
    assert due_at_for_month(2026, 4, 31).day == 30
    assert due_at_for_month(2026, 5, 31).day == 31
    for year, month in ((2026, 2), (2024, 2), (2026, 4), (2026, 1)):
      due = due_at_for_month(year, month, 31)
      assert due.day == monthrange(year, month)[1]
      assert due.tzinfo == timezone.utc


class TestRecurringExpenseAuthAndOwnership:
  def test_unauthenticated_rejected(self, client: TestClient):
    assert client.get("/api/recurring-expenses").status_code == 401
    assert client.post("/api/recurring-expenses", json={}).status_code == 401

  def test_cross_user_404(
    self, auth_client: TestClient, other_auth_client: TestClient
  ):
    created = create_recurring(auth_client)
    assert other_auth_client.get("/api/recurring-expenses").json() == []
    assert (
      other_auth_client.put(
        f"/api/recurring-expenses/{created['id']}",
        json={
          "name": "Hack",
          "categoryId": created["categoryId"],
          "amount": 1,
          "currency": "VND",
          "dueDay": 1,
          "effectiveFromMonth": "2026-09",
        },
      ).status_code
      == 404
    )
    assert (
      other_auth_client.post(
        f"/api/recurring-expenses/{created['id']}/deactivate",
        json={"effectiveFromMonth": "2026-10"},
      ).status_code
      == 404
    )


class TestRecurringExpenseValidation:
  def test_rejects_invalid_inputs(self, auth_client: TestClient):
    housing = category(auth_client, "Housing")
    salary = category(auth_client, "Salary", "income")

    blank = auth_client.post(
      "/api/recurring-expenses",
      json={
        "name": "   ",
        "categoryId": housing["id"],
        "amount": 100,
        "currency": "VND",
        "dueDay": 5,
        "startMonth": "2026-08",
      },
    )
    assert blank.status_code == 422

    zero = auth_client.post(
      "/api/recurring-expenses",
      json={
        "name": "Rent",
        "categoryId": housing["id"],
        "amount": 0,
        "currency": "VND",
        "dueDay": 5,
        "startMonth": "2026-08",
      },
    )
    assert zero.status_code == 422

    bad_day = auth_client.post(
      "/api/recurring-expenses",
      json={
        "name": "Rent",
        "categoryId": housing["id"],
        "amount": 100,
        "currency": "VND",
        "dueDay": 32,
        "startMonth": "2026-08",
      },
    )
    assert bad_day.status_code == 422

    income_cat = auth_client.post(
      "/api/recurring-expenses",
      json={
        "name": "Rent",
        "categoryId": salary["id"],
        "amount": 100,
        "currency": "VND",
        "dueDay": 5,
        "startMonth": "2026-08",
      },
    )
    assert income_cat.status_code == 422

    end_before = auth_client.post(
      "/api/recurring-expenses",
      json={
        "name": "Rent",
        "categoryId": housing["id"],
        "amount": 100,
        "currency": "VND",
        "dueDay": 5,
        "startMonth": "2026-08",
        "endMonth": "2026-07",
      },
    )
    assert end_before.status_code == 422


class TestRecurringExpenseLifecycle:
  def test_start_end_boundaries(self, auth_client: TestClient):
    utilities = category(auth_client, "Utilities")
    create_recurring(
      auth_client,
      name="Netflix",
      categoryId=utilities["id"],
      amount=500000,
      currency="VND",
      dueDay=10,
      startMonth="2026-03",
      endMonth="2026-06",
    )
    assert summary(auth_client, 2026, 2)["fixedExpenseTotal"] == 0
    assert summary(auth_client, 2026, 3)["fixedExpenseTotal"] == 500000
    assert summary(auth_client, 2026, 6)["fixedExpenseTotal"] == 500000
    assert summary(auth_client, 2026, 7)["fixedExpenseTotal"] == 0

  def test_effective_edit_preserves_history(self, auth_client: TestClient):
    created = create_recurring(auth_client, amount=12000000, startMonth="2026-01")
    updated = auth_client.put(
      f"/api/recurring-expenses/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 14000000,
        "currency": "VND",
        "dueDay": 5,
        "effectiveFromMonth": "2026-09",
      },
    )
    assert updated.status_code == 200, updated.text
    assert summary(auth_client, 2026, 8)["fixedExpenseTotal"] == 12000000
    assert summary(auth_client, 2026, 9)["fixedExpenseTotal"] == 14000000
    assert summary(auth_client, 2026, 10)["fixedExpenseTotal"] == 14000000
    first = summary(auth_client, 2026, 8)
    second = summary(auth_client, 2026, 8)
    assert first == second

  def test_same_effective_from_updates_in_place(
    self, auth_client: TestClient, db_session: Session
  ):
    created = create_recurring(auth_client, amount=100, startMonth="2026-05")
    auth_client.put(
      f"/api/recurring-expenses/{created['id']}",
      json={
        "name": "Renamed",
        "categoryId": created["categoryId"],
        "amount": 200,
        "currency": "VND",
        "dueDay": 5,
        "effectiveFromMonth": "2026-05",
      },
    )
    revisions = db_session.query(RecurringExpenseRevision).all()
    assert len(revisions) == 1
    assert float(revisions[0].amount) == 200
    assert summary(auth_client, 2026, 5)["fixedExpenseTotal"] == 200

  def test_historical_edit_before_latest_rejected(self, auth_client: TestClient):
    created = create_recurring(auth_client, amount=10, startMonth="2026-01")
    auth_client.put(
      f"/api/recurring-expenses/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 11,
        "currency": "VND",
        "dueDay": 5,
        "effectiveFromMonth": "2026-05",
      },
    )
    conflict = auth_client.put(
      f"/api/recurring-expenses/{created['id']}",
      json={
        "name": created["name"],
        "categoryId": created["categoryId"],
        "amount": 12,
        "currency": "VND",
        "dueDay": 5,
        "effectiveFromMonth": "2026-03",
      },
    )
    assert conflict.status_code == 409

  def test_deactivate_and_reactivate(self, auth_client: TestClient):
    created = create_recurring(
      auth_client,
      name="Internet",
      amount=500000,
      startMonth="2026-01",
    )
    stopped = auth_client.post(
      f"/api/recurring-expenses/{created['id']}/deactivate",
      json={"effectiveFromMonth": "2026-06"},
    )
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["isActive"] is False
    assert summary(auth_client, 2026, 5)["fixedExpenseTotal"] == 500000
    assert summary(auth_client, 2026, 6)["fixedExpenseTotal"] == 0
    assert summary(auth_client, 2026, 8)["fixedExpenseTotal"] == 0

    resumed = auth_client.post(
      f"/api/recurring-expenses/{created['id']}/reactivate",
      json={"resumeFromMonth": "2026-09"},
    )
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["isActive"] is True
    assert summary(auth_client, 2026, 8)["fixedExpenseTotal"] == 0
    assert summary(auth_client, 2026, 9)["fixedExpenseTotal"] == 500000


class TestCashFlowRecurringTotals:
  def test_fixed_only(self, auth_client: TestClient):
    salary = category(auth_client, "Salary", "income")
    create_tx(
      auth_client,
      type="income",
      categoryId=salary["id"],
      amount=50000000,
      currency="VND",
      occurredAt="2026-08-01T00:00:00Z",
    )
    create_recurring(auth_client, amount=12000000, startMonth="2026-08")
    data = summary(auth_client, 2026, 8)
    assert data["fixedExpenseTotal"] == 12000000
    assert data["variableExpenseTotal"] == 0
    assert data["loanPaymentTotal"] == 0
    assert data["expenses"] == 12000000
    assert data["netCashFlow"] == 38000000
    assert data["committedExpenseTotal"] == 12000000

  def test_fixed_plus_variable(self, auth_client: TestClient):
    create_recurring(auth_client, amount=12000000, startMonth="2026-08")
    food = category(auth_client, "Food")
    create_tx(
      auth_client,
      categoryId=food["id"],
      amount=5000000,
      currency="VND",
      occurredAt="2026-08-12T00:00:00Z",
    )
    data = summary(auth_client, 2026, 8)
    assert data["fixedExpenseTotal"] == 12000000
    assert data["variableExpenseTotal"] == 5000000
    assert data["expenses"] == 17000000

  def test_category_breakdown_merges(self, auth_client: TestClient):
    housing = category(auth_client, "Housing")
    create_recurring(
      auth_client,
      name="Rent",
      categoryId=housing["id"],
      amount=12000000,
      startMonth="2026-08",
    )
    create_tx(
      auth_client,
      categoryId=housing["id"],
      amount=2000000,
      currency="VND",
      occurredAt="2026-08-20T00:00:00Z",
      description="Repair",
    )
    data = summary(auth_client, 2026, 8)
    housing_row = next(item for item in data["categoryBreakdown"] if item["name"] == "Housing")
    assert housing_row["amount"] == 14000000

  def test_no_write_on_read(self, auth_client: TestClient, db_session: Session):
    create_recurring(auth_client, startMonth="2026-08")
    before = db_session.query(Transaction).count()
    for _ in range(10):
      summary(auth_client, 2026, 8)
    assert db_session.query(Transaction).count() == before

  def test_future_due_day_still_included(self, auth_client: TestClient):
    create_recurring(auth_client, dueDay=20, startMonth="2026-08")
    data = summary(auth_client, 2026, 8)
    assert data["fixedExpenseCount"] == 1
    assert data["recurringExpenses"][0]["dueAt"].startswith("2026-08-20")


class TestRecurringFx:
  def test_converts_with_due_date_rate(self, auth_client: TestClient):
    housing = category(auth_client, "Housing")
    create_recurring(
      auth_client,
      name="Adobe",
      categoryId=housing["id"],
      amount=20,
      currency="USD",
      dueDay=5,
      startMonth="2026-08",
    )
    data = summary(auth_client, 2026, 8, currency="VND")
    assert data["fixedExpenseTotal"] == 500000
    activity = data["recurringExpenses"][0]
    assert activity["amount"] == 20
    assert activity["currency"] == "USD"
    assert activity["reportingAmount"] == 500000
    assert activity["reportingCurrency"] == "VND"

  def test_fx_failure_discloses(
    self, auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
  ):
    housing = category(auth_client, "Housing")
    create_recurring(
      auth_client,
      name="Adobe",
      categoryId=housing["id"],
      amount=20,
      currency="USD",
      dueDay=5,
      startMonth="2026-08",
    )

    def unavailable(*_args, **_kwargs):
      raise ExchangeRateProviderError("down")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
    data = summary(auth_client, 2026, 8, currency="VND")
    assert data["fixedExpenseTotal"] == 0
    assert data["recurringExpenses"][0]["reportingAmount"] is None
    assert "USD" in data["unconvertedCurrencies"]


class TestSavingPotRecurringIntegration:
  def test_historical_recurring_reconciles(
    self, auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    from app.models import SavingPot

    freeze_now(monkeypatch, datetime(2026, 8, 15, tzinfo=timezone.utc))
    salary = category(auth_client, "Salary", "income")
    create_tx(
      auth_client,
      type="income",
      categoryId=salary["id"],
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
    assert synced["applications"][0]["amountApplied"] == 1000

    create_recurring(
      auth_client,
      amount=100,
      currency="USD",
      startMonth="2026-07",
      dueDay=20,
    )
    assert summary(auth_client, 2026, 7, "USD")["fixedExpenseTotal"] == 100

    reconciled = auth_client.get("/api/saving-pot").json()
    assert reconciled["balance"] == 1900
    assert reconciled["applications"][0]["amountApplied"] == 900

    history = auth_client.get("/api/saving-pot/history").json()["items"]
    reconciles = [item for item in history if item["entryType"] == "month_reconciliation"]
    assert len(reconciles) == 1
    assert reconciles[0]["amount"] == -100

    again = auth_client.get("/api/saving-pot").json()
    assert again["balance"] == 1900
    history2 = auth_client.get("/api/saving-pot/history").json()["items"]
    assert (
      len([item for item in history2 if item["entryType"] == "month_reconciliation"]) == 1
    )

  def test_creation_month_cutoff_for_recurring(
    self, auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    from app.models import SavingPot

    freeze_now(monkeypatch, datetime(2026, 8, 15, tzinfo=timezone.utc))
    housing = category(auth_client, "Housing")
    utilities = category(auth_client, "Utilities")
    create_recurring(
      auth_client,
      name="Rent",
      categoryId=housing["id"],
      amount=12000000,
      currency="VND",
      dueDay=5,
      startMonth="2026-07",
    )
    create_recurring(
      auth_client,
      name="Internet",
      categoryId=utilities["id"],
      amount=500000,
      currency="VND",
      dueDay=20,
      startMonth="2026-07",
    )
    put = auth_client.put("/api/saving-pot", json={"balance": 0, "currency": "VND"})
    assert put.status_code == 200
    row = db_session.query(SavingPot).filter(SavingPot.id == put.json()["id"]).one()
    row.created_at = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    db_session.commit()

    synced = auth_client.get("/api/saving-pot").json()
    # Creation-month window is Jul 15 → Aug 1: rent (Jul 5) excluded, internet included.
    assert synced["applications"][0]["amountApplied"] == -500000
    assert synced["balance"] == -500000

  def test_fx_failure_blocks_saving_pot_month(
    self, auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
  ):
    from app.models import SavingPot

    freeze_now(monkeypatch, datetime(2026, 8, 15, tzinfo=timezone.utc))
    housing = category(auth_client, "Housing")
    create_recurring(
      auth_client,
      name="Adobe",
      categoryId=housing["id"],
      amount=20,
      currency="USD",
      dueDay=5,
      startMonth="2026-07",
    )
    put = auth_client.put("/api/saving-pot", json={"balance": 100, "currency": "VND"})
    assert put.status_code == 200
    row = db_session.query(SavingPot).filter(SavingPot.id == put.json()["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    def unavailable(*_args, **_kwargs):
      raise ExchangeRateProviderError("down")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
    result = auth_client.get("/api/saving-pot").json()
    assert result["balance"] == 100
    assert result["applications"] == []
    assert result["syncWarnings"]
