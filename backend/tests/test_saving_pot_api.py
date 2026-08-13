from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.exchange_rates import ExchangeRateQuote, FrankfurterExchangeRateProvider
from app.models import SavingPot
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
    return [
      ExchangeRateQuote(
        source_currency=source_currency,
        target_currency=target_currency,
        rate=Decimal("2"),
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


def put_pot(client: TestClient, balance: float, currency: str | None = None) -> dict:
  body: dict = {"balance": balance}
  if currency is not None:
    body["currency"] = currency
  response = client.put("/api/saving-pot", json=body)
  assert response.status_code == 200, response.text
  return response.json()


class TestSavingPotAuth:
  def test_requires_authentication(self, client: TestClient):
    assert client.get("/api/saving-pot").status_code == 401
    assert client.put("/api/saving-pot", json={"balance": 1}).status_code == 401
    assert (
      client.post("/api/saving-pot/adjust", json={"amount": 1, "direction": "add"}).status_code
      == 401
    )


class TestSavingPotCrud:
  def test_get_missing_returns_404(self, auth_client: TestClient):
    assert auth_client.get("/api/saving-pot").status_code == 404

  def test_create_and_overwrite_balance(self, auth_client: TestClient):
    created = put_pot(auth_client, 1000)
    assert created["balance"] == 1000
    assert created["currency"] == "USD"
    assert created["applications"] == []

    updated = put_pot(auth_client, 2500.5)
    assert updated["balance"] == 2500.5
    assert updated["id"] == created["id"]

    fetched = auth_client.get("/api/saving-pot")
    assert fetched.status_code == 200
    assert fetched.json()["balance"] == 2500.5

  def test_add_and_subtract_balance(self, auth_client: TestClient):
    put_pot(auth_client, 1000)

    added = auth_client.post(
      "/api/saving-pot/adjust", json={"amount": 250.25, "direction": "add"}
    )
    assert added.status_code == 200, added.text
    assert added.json()["balance"] == 1250.25

    subtracted = auth_client.post(
      "/api/saving-pot/adjust", json={"amount": 50, "direction": "subtract"}
    )
    assert subtracted.status_code == 200, subtracted.text
    assert subtracted.json()["balance"] == 1200.25

  def test_subtract_cannot_exceed_balance(self, auth_client: TestClient):
    put_pot(auth_client, 40)
    response = auth_client.post(
      "/api/saving-pot/adjust", json={"amount": 40.01, "direction": "subtract"}
    )
    assert response.status_code == 400
    assert auth_client.get("/api/saving-pot").json()["balance"] == 40

  def test_adjust_missing_pot_returns_404(self, auth_client: TestClient):
    response = auth_client.post(
      "/api/saving-pot/adjust", json={"amount": 10, "direction": "add"}
    )
    assert response.status_code == 404

  def test_isolation_between_users(
    self, auth_client: TestClient, other_auth_client: TestClient
  ):
    put_pot(auth_client, 100)
    put_pot(other_auth_client, 999)
    assert auth_client.get("/api/saving-pot").json()["balance"] == 100
    assert other_auth_client.get("/api/saving-pot").json()["balance"] == 999


class TestSavingPotMonthlyApply:
  def test_closed_month_applies_once_and_current_month_skipped(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))

    create_transaction(
      auth_client,
      type="income",
      amount=200,
      occurredAt="2026-07-10T00:00:00Z",
    )
    create_transaction(
      auth_client,
      type="expense",
      amount=50,
      occurredAt="2026-07-20T00:00:00Z",
    )
    create_transaction(
      auth_client,
      type="income",
      amount=5000,
      occurredAt="2026-08-05T00:00:00Z",
    )

    pot = put_pot(auth_client, 1000)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    first = auth_client.get("/api/saving-pot").json()
    assert first["balance"] == 1150
    assert len(first["applications"]) == 1
    assert first["applications"][0]["year"] == 2026
    assert first["applications"][0]["month"] == 7
    assert first["applications"][0]["amountApplied"] == 150

    second = auth_client.get("/api/saving-pot").json()
    assert second["balance"] == 1150
    assert len(second["applications"]) == 1

  def test_negative_month_decreases_balance(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(
      auth_client,
      type="expense",
      amount=80,
      occurredAt="2026-07-12T00:00:00Z",
    )
    pot = put_pot(auth_client, 100)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == 20
    assert body["applications"][0]["amountApplied"] == -80

  def test_month_before_pot_creation_not_applied(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(
      auth_client,
      type="income",
      amount=300,
      occurredAt="2026-06-10T00:00:00Z",
    )
    create_transaction(
      auth_client,
      type="income",
      amount=40,
      occurredAt="2026-07-10T00:00:00Z",
    )
    pot = put_pot(auth_client, 500)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 5, tzinfo=timezone.utc)
    db_session.commit()

    body = auth_client.get("/api/saving-pot").json()
    assert body["balance"] == 540
    assert len(body["applications"]) == 1
    assert body["applications"][0]["month"] == 7
    assert body["applications"][0]["amountApplied"] == 40

  def test_manual_overwrite_keeps_application_history(
    self,
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
  ):
    freeze_now(monkeypatch, datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc))
    create_transaction(
      auth_client,
      type="income",
      amount=100,
      occurredAt="2026-07-01T00:00:00Z",
    )
    pot = put_pot(auth_client, 10)
    row = db_session.query(SavingPot).filter(SavingPot.id == pot["id"]).one()
    row.created_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db_session.commit()

    applied = auth_client.get("/api/saving-pot").json()
    assert applied["balance"] == 110
    assert len(applied["applications"]) == 1

    overwritten = put_pot(auth_client, 50)
    assert overwritten["balance"] == 50
    assert len(overwritten["applications"]) == 1
