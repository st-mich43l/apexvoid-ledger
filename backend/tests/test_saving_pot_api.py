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
from app.models import SavingPot, SavingPotEntry, SavingPotMonthApplication
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
      # Default deterministic conversion for unlisted pairs used in tests.
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


def category(client: TestClient, name: str, category_type: str) -> dict:
  return next(
    item for item in categories(client) if item["name"] == name and item["type"] == category_type
  )


def create_transaction(client: TestClient, **overrides) -> dict:
  food = category(client, "Food", "expense")
  salary = category(client, "Salary", "income")
  payload = {
    "type": "expense",
    "categoryId": food["id"],
    "amount": 10,
    "currency": "USD",
    "occurredAt": "2026-07-15T12:00:00Z",
    "description": None,
    **overrides,
  }
  if payload["type"] == "income" and "categoryId" not in overrides:
    payload["categoryId"] = salary["id"]
  response = client.post("/api/transactions", json=payload)
  assert response.status_code == 201, response.text
  return response.json()


def put_pot(client: TestClient, balance: float, currency: str | None = None, note: str | None = None) -> dict:
  body: dict = {"balance": balance}
  if currency is not None:
    body["currency"] = currency
  if note is not None:
    body["note"] = note
  response = client.put("/api/saving-pot", json=body)
  assert response.status_code == 200, response.text
  return response.json()


def history(client: TestClient) -> list[dict]:
  response = client.get("/api/saving-pot/history")
  assert response.status_code == 200, response.text
  return response.json()["items"]


class TestSavingPotAuth:
  def test_requires_authentication(self, client: TestClient):
    assert client.get("/api/saving-pot").status_code == 401
    assert client.put("/api/saving-pot", json={"balance": 1}).status_code == 401
    assert (
      client.post("/api/saving-pot/adjust", json={"amount": 1, "direction": "add"}).status_code
      == 401
    )
    assert client.get("/api/saving-pot/history").status_code == 401


class TestSavingPotCrudAndLedger:
  def test_get_missing_returns_404(self, auth_client: TestClient):
    assert auth_client.get("/api/saving-pot").status_code == 404

  def test_create_opening_entry_once(self, auth_client: TestClient):
    created = put_pot(auth_client, 1000, note="Seed")
    assert created["balance"] == 1000
    items = history(auth_client)
    assert len(items) == 1
    assert items[0]["entryType"] == "opening"
    assert items[0]["amount"] == 1000
    assert items[0]["note"] == "Seed"

  def test_add_and_subtract_create_signed_entries(self, auth_client: TestClient):
    put_pot(auth_client, 1000)
    added = auth_client.post(
      "/api/saving-pot/adjust",
      json={"amount": 250.25, "direction": "add", "note": "Bonus"},
    )
    assert added.status_code == 200
    assert added.json()["balance"] == 1250.25

    subtracted = auth_client.post(
      "/api/saving-pot/adjust",
      json={"amount": 50, "direction": "subtract", "note": "Repair"},
    )
    assert subtracted.status_code == 200
    assert subtracted.json()["balance"] == 1200.25

    types = [item["entryType"] for item in history(auth_client)]
    assert types[:2] == ["manual_subtract", "manual_add"]
    assert history(auth_client)[0]["amount"] == -50
    assert history(auth_client)[1]["amount"] == 250.25
    assert history(auth_client)[0]["note"] == "Repair"

  def test_subtract_beyond_balance_creates_no_entry(self, auth_client: TestClient, db_session: Session):
    put_pot(auth_client, 40)
    before = db_session.query(SavingPotEntry).count()
    response = auth_client.post(
      "/api/saving-pot/adjust", json={"amount": 40.01, "direction": "subtract"}
    )
    assert response.status_code == 400
    assert auth_client.get("/api/saving-pot").json()["balance"] == 40
    assert db_session.query(SavingPotEntry).count() == before

  def test_balance_correction_stores_delta_only(
    self, auth_client: TestClient
  ):
    put_pot(auth_client, 1000)
    corrected = put_pot(auth_client, 1300, note="Bank reconcile")
    assert corrected["balance"] == 1300
    items = history(auth_client)
    assert items[0]["entryType"] == "balance_correction"
    assert items[0]["amount"] == 300

    put_pot(auth_client, 1200)
    assert history(auth_client)[0]["amount"] == -100

    unchanged = put_pot(auth_client, 1200)
    assert unchanged["balance"] == 1200
    assert history(auth_client)[0]["amount"] == -100  # no new zero entry

  def test_currency_change_rejected(self, auth_client: TestClient):
    put_pot(auth_client, 100, currency="USD")
    response = auth_client.put("/api/saving-pot", json={"balance": 100, "currency": "VND"})
    assert response.status_code == 400
    assert auth_client.get("/api/saving-pot").json()["currency"] == "USD"

  def test_isolation_between_users(
    self, auth_client: TestClient, other_auth_client: TestClient
  ):
    put_pot(auth_client, 100)
    put_pot(other_auth_client, 999)
    assert auth_client.get("/api/saving-pot").json()["balance"] == 100
    assert other_auth_client.get("/api/saving-pot").json()["balance"] == 999
    assert history(auth_client)[0]["amount"] == 100
    assert history(other_auth_client)[0]["amount"] == 999


class TestSavingPotMonthlySync:
  def test_closed_month_applies_once_and_current_month_skipped(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(auth_client, type="income", amount=200, occurredAt="2026-07-10T00:00:00Z")
    create_transaction(auth_client, type="expense", amount=50, occurredAt="2026-07-20T00:00:00Z")
    create_transaction(auth_client, type="income", amount=5000, occurredAt="2026-08-05T00:00:00Z")

    pot = put_pot(auth_client, 1000)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    first = auth_client.get("/api/saving-pot").json()
    assert first["balance"] == 1150
    assert len(first["applications"]) == 1
    assert first["applications"][0]["amountApplied"] == 150

    second = auth_client.get("/api/saving-pot").json()
    assert second["balance"] == 1150
    month_entries = [e for e in history(auth_client) if e["entryType"] == "month_apply"]
    assert len(month_entries) == 1

  def test_creation_month_excludes_pre_creation_activity(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(auth_client, type="income", amount=500, occurredAt="2026-07-05T00:00:00Z")
    create_transaction(auth_client, type="income", amount=200, occurredAt="2026-07-20T00:00:00Z")
    create_transaction(auth_client, type="expense", amount=50, occurredAt="2026-07-25T00:00:00Z")

    pot = put_pot(auth_client, 1000)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == 1150
    assert body["applications"][0]["amountApplied"] == 150

  def test_month_before_pot_creation_not_applied(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(auth_client, type="income", amount=300, occurredAt="2026-06-10T00:00:00Z")
    create_transaction(auth_client, type="income", amount=40, occurredAt="2026-07-10T00:00:00Z")
    pot = put_pot(auth_client, 500)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 5, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == 540
    assert len(body["applications"]) == 1
    assert body["applications"][0]["month"] == 7

  def test_negative_month_can_drive_balance_negative(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(auth_client, type="expense", amount=80, occurredAt="2026-07-12T00:00:00Z")
    pot = put_pot(auth_client, 50)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == -30
    assert body["applications"][0]["amountApplied"] == -80


class TestSavingPotReconciliation:
  def test_historical_expense_reconciles_delta(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(auth_client, type="income", amount=200, occurredAt="2026-07-10T00:00:00Z")
    create_transaction(auth_client, type="expense", amount=50, occurredAt="2026-07-12T00:00:00Z")
    pot = put_pot(auth_client, 1000)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    assert auth_client.get("/api/saving-pot").json()["balance"] == 1150

    create_transaction(auth_client, type="expense", amount=25, occurredAt="2026-07-18T00:00:00Z")
    reconciled = auth_client.get("/api/saving-pot").json()
    assert reconciled["balance"] == 1125
    assert reconciled["applications"][0]["amountApplied"] == 125
    assert history(auth_client)[0]["entryType"] == "month_reconciliation"
    assert history(auth_client)[0]["amount"] == -25

    again = auth_client.get("/api/saving-pot").json()
    assert again["balance"] == 1125
    assert sum(1 for e in history(auth_client) if e["entryType"] == "month_reconciliation") == 1

  def test_edit_and_delete_transaction_reconcile(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    expense = create_transaction(
      auth_client, type="expense", amount=30, occurredAt="2026-07-12T00:00:00Z"
    )
    create_transaction(auth_client, type="income", amount=100, occurredAt="2026-07-10T00:00:00Z")
    pot = put_pot(auth_client, 0)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()
    assert auth_client.get("/api/saving-pot").json()["balance"] == 70

    updated = auth_client.put(
      f"/api/transactions/{expense['id']}",
      json={
        "type": "expense",
        "categoryId": expense["categoryId"],
        "amount": 50,
        "currency": "USD",
        "occurredAt": "2026-07-12T00:00:00Z",
        "description": None,
      },
    )
    assert updated.status_code == 200
    assert auth_client.get("/api/saving-pot").json()["balance"] == 50

    deleted = auth_client.delete(f"/api/transactions/{expense['id']}")
    assert deleted.status_code == 204
    assert auth_client.get("/api/saving-pot").json()["balance"] == 100


class TestSavingPotFxSafety:
  def test_incomplete_fx_does_not_mutate_balance(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))

    def failing_rates(*_args, **_kwargs):
      raise ExchangeRateProviderError("provider down")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", failing_rates)

    create_transaction(auth_client, type="expense", amount=10, currency="USD", occurredAt="2026-07-12T00:00:00Z")
    create_transaction(
      auth_client,
      type="expense",
      amount=5,
      currency="EUR",
      occurredAt="2026-07-13T00:00:00Z",
    )
    pot = put_pot(auth_client, 1000, currency="USD")
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == 1000
    assert body["applications"] == []
    assert body["syncWarnings"]
    assert db_session.query(SavingPotMonthApplication).count() == 0
