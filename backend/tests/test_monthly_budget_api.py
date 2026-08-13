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
  MonthlyBudgetAllocation,
  Loan,
  RecurringExpenseRevision,
  RecurringIncomeRevision,
  SavingPotEntry,
  Transaction,
  User,
)
from app import monthly_budget as budget_domain


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


def create_income(client: TestClient, amount: int = 39_000_000) -> dict:
  response = client.post(
    "/api/recurring-incomes",
    json={
      "name": "Monthly salary",
      "categoryId": category(client, "Salary", "income")["id"],
      "amount": amount,
      "currency": "VND",
      "expectedDay": 1,
      "startMonth": "2026-01",
    },
  )
  assert response.status_code == 201, response.text
  return response.json()


def create_fixed(client: TestClient, amount: int = 12_000_000) -> dict:
  response = client.post(
    "/api/recurring-expenses",
    json={
      "name": "Apartment rent",
      "categoryId": category(client, "Housing")["id"],
      "amount": amount,
      "currency": "VND",
      "dueDay": 5,
      "startMonth": "2026-01",
    },
  )
  assert response.status_code == 201, response.text
  return response.json()


def create_expense(
  client: TestClient,
  category_name: str,
  amount: int,
  currency: str = "VND",
  occurred_at: str = "2026-08-15T12:00:00Z",
) -> dict:
  response = client.post(
    "/api/transactions",
    json={
      "type": "expense",
      "categoryId": category(client, category_name)["id"],
      "amount": amount,
      "currency": currency,
      "occurredAt": occurred_at,
      "description": None,
    },
  )
  assert response.status_code == 201, response.text
  return response.json()


def budget_input(
  client: TestClient,
  *,
  savings: int = 5_000_000,
  allocations: list[tuple[str, int]] | None = None,
  currency: str = "VND",
) -> dict:
  allocation_values = allocations or [
    ("Food", 6_000_000),
    ("Transport", 2_000_000),
    ("Travel", 3_000_000),
    ("Shopping", 2_000_000),
    ("Entertainment", 1_500_000),
    ("Spa & Beauty", 1_500_000),
  ]
  return {
    "currency": currency,
    "plannedSavings": savings,
    "allocations": [
      {"categoryId": category(client, name)["id"], "amount": amount}
      for name, amount in allocation_values
    ],
  }


def save_budget(
  client: TestClient,
  payload: dict,
  year: int = 2026,
  month: int = 8,
) -> dict:
  response = client.put(
    f"/api/monthly-budget?year={year}&month={month}", json=payload
  )
  assert response.status_code == 200, response.text
  return response.json()


def get_budget(client: TestClient, year: int = 2026, month: int = 8) -> dict:
  response = client.get(f"/api/monthly-budget?year={year}&month={month}")
  assert response.status_code == 200, response.text
  return response.json()


class TestMonthlyBudgetAuthAndEmptyState:
  def test_requires_authentication(self, client: TestClient):
    assert client.get("/api/monthly-budget?year=2026&month=8").status_code == 401
    assert client.put("/api/monthly-budget?year=2026&month=8", json={}).status_code == 401
    assert client.delete("/api/monthly-budget?year=2026&month=8").status_code == 401
    assert client.post("/api/monthly-budget/copy-previous?year=2026&month=8").status_code == 401

  def test_no_budget_returns_baseline_without_claiming_safe_to_spend(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_income(auth_client)
    create_fixed(auth_client)
    result = get_budget(auth_client)
    assert result["hasBudget"] is False
    assert result["currency"] == "VND"
    assert result["baselineAvailable"] == 27_000_000
    assert result["plannedSavingsAmount"] is None
    assert result["plannedVariableBudgetTotal"] is None
    assert result["safeToSpend"] is None
    assert result["dailySafeToSpend"] is None

  def test_get_is_read_only(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    categories(auth_client)
    before = {
      "budget": db_session.query(MonthlyBudget).count(),
      "allocation": db_session.query(MonthlyBudgetAllocation).count(),
      "transaction": db_session.query(Transaction).count(),
      "saving": db_session.query(SavingPotEntry).count(),
      "income_revision": db_session.query(RecurringIncomeRevision).count(),
      "expense_revision": db_session.query(RecurringExpenseRevision).count(),
    }
    for _ in range(3):
      get_budget(auth_client)
    after = {
      "budget": db_session.query(MonthlyBudget).count(),
      "allocation": db_session.query(MonthlyBudgetAllocation).count(),
      "transaction": db_session.query(Transaction).count(),
      "saving": db_session.query(SavingPotEntry).count(),
      "income_revision": db_session.query(RecurringIncomeRevision).count(),
      "expense_revision": db_session.query(RecurringExpenseRevision).count(),
    }
    assert after == before


class TestMonthlyBudgetCalculations:
  def test_core_formula_and_category_spending(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_income(auth_client)
    create_fixed(auth_client)
    result = save_budget(auth_client, budget_input(auth_client))
    assert result["baselineAvailable"] == 27_000_000
    assert result["plannedSavingsAmount"] == 5_000_000
    assert result["availableForVariablePlanning"] == 22_000_000
    assert result["plannedVariableBudgetTotal"] == 16_000_000
    assert result["unallocatedBuffer"] == 6_000_000

    create_expense(auth_client, "Food", 4_200_000)
    create_expense(auth_client, "Travel", 1_600_000)
    create_expense(auth_client, "Shopping", 1_000_000)
    spent = get_budget(auth_client)
    assert spent["actualVariableExpenseTotal"] == 6_800_000
    assert spent["remainingVariableBudget"] == 9_200_000
    assert spent["safeToSpend"] == 9_200_000
    food = next(item for item in spent["allocations"] if item["categoryName"] == "Food")
    assert food["actualSpent"] == 4_200_000
    assert food["remainingAmount"] == 1_800_000
    assert food["utilizationPercent"] == 70

  def test_over_budget_is_not_clamped(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Travel", 3_000_000)]),
    )
    create_expense(auth_client, "Travel", 3_400_000)
    result = get_budget(auth_client)
    travel = result["allocations"][0]
    assert travel["remainingAmount"] == -400_000
    assert travel["utilizationPercent"] == pytest.approx(113.33)
    assert result["safeToSpend"] == -400_000

  def test_unbudgeted_spending_reduces_overall_safe_to_spend(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Food", 6_000_000)]),
    )
    create_expense(auth_client, "Food", 4_000_000)
    create_expense(auth_client, "Gifts", 1_000_000)
    result = get_budget(auth_client)
    assert result["actualVariableExpenseTotal"] == 5_000_000
    assert result["safeToSpend"] == 1_000_000
    assert result["unbudgetedSpendTotal"] == 1_000_000
    assert result["unbudgetedCategories"][0]["categoryName"] == "Gifts"
    assert result["allocations"][0]["remainingAmount"] == 2_000_000

  def test_fixed_cost_is_only_in_baseline(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_income(auth_client, 50_000_000)
    create_fixed(auth_client, 12_000_000)
    result = save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Food", 6_000_000)]),
    )
    assert result["baselineAvailable"] == 38_000_000
    assert result["actualVariableExpenseTotal"] == 0
    assert result["safeToSpend"] == 6_000_000

  def test_loan_payment_is_only_in_baseline(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_income(auth_client, 50_000_000)
    db_session.add(
      Loan(
        user_id=user.id,
        bank_name="Example Bank",
        open_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        disbursement_amount=Decimal("90000000"),
        currency="VND",
        interest_rate_per_year=Decimal("0"),
        duration_months=12,
        loan_type="unsecured",
      )
    )
    db_session.commit()
    result = save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Food", 6_000_000)]),
    )
    assert result["baselineAvailable"] == 42_500_000
    assert result["actualVariableExpenseTotal"] == 0
    assert result["safeToSpend"] == 6_000_000

  def test_daily_pace_only_for_current_month(
    self,
    auth_client: TestClient,
    db_session: Session,
    user: User,
    monkeypatch: pytest.MonkeyPatch,
  ):
    set_currency(db_session, user)
    monkeypatch.setattr(budget_domain, "current_utc_date", lambda: date(2026, 8, 14))
    save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Food", 18_000_000)]),
    )
    assert get_budget(auth_client)["dailySafeToSpend"] == 1_000_000
    save_budget(
      auth_client,
      budget_input(auth_client, savings=0, allocations=[("Food", 18_000_000)]),
      month=7,
    )
    assert get_budget(auth_client, month=7)["dailySafeToSpend"] is None


class TestMonthlyBudgetValidationAndLifecycle:
  def test_update_replaces_allocations_atomically(
    self, auth_client: TestClient, db_session: Session, user: User, other_auth_client: TestClient
  ):
    set_currency(db_session, user)
    original = budget_input(auth_client, allocations=[("Food", 6_000_000)])
    save_budget(auth_client, original)
    foreign_category = category(other_auth_client, "Travel")
    failed = auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={
        "currency": "VND",
        "plannedSavings": 1,
        "allocations": [{"categoryId": foreign_category["id"], "amount": 1}],
      },
    )
    assert failed.status_code == 404
    persisted = get_budget(auth_client)
    assert persisted["plannedSavingsAmount"] == 5_000_000
    assert [(item["categoryName"], item["allocatedAmount"]) for item in persisted["allocations"]] == [("Food", 6_000_000)]

    updated = save_budget(
      auth_client,
      budget_input(auth_client, savings=2_000_000, allocations=[("Travel", 3_000_000)]),
    )
    assert updated["plannedSavingsAmount"] == 2_000_000
    assert [item["categoryName"] for item in updated["allocations"]] == ["Travel"]

  def test_rejects_duplicate_income_inactive_and_bad_amounts(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    food = category(auth_client, "Food")
    salary = category(auth_client, "Salary", "income")
    duplicate = auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "VND", "plannedSavings": 0, "allocations": [
        {"categoryId": food["id"], "amount": 1},
        {"categoryId": food["id"], "amount": 2},
      ]},
    )
    assert duplicate.status_code == 422
    assert auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "VND", "plannedSavings": 0, "allocations": [{"categoryId": salary["id"], "amount": 1}]},
    ).status_code == 422
    assert auth_client.delete(f"/api/categories/{food['id']}").status_code == 204
    assert auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "VND", "plannedSavings": 0, "allocations": [{"categoryId": food["id"], "amount": 1}]},
    ).status_code == 422
    assert auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "VND", "plannedSavings": -1, "allocations": []},
    ).status_code == 422
    assert auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "VND", "plannedSavings": 0, "allocations": [{"categoryId": salary["id"], "amount": 0}]},
    ).status_code == 422

  def test_currency_is_persisted_and_immutable(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    save_budget(auth_client, budget_input(auth_client, allocations=[]))
    changed = auth_client.patch("/api/auth/currency", json={"currency": "USD"})
    assert changed.status_code == 200
    assert get_budget(auth_client)["currency"] == "VND"
    mismatch = auth_client.put(
      "/api/monthly-budget?year=2026&month=8",
      json={"currency": "USD", "plannedSavings": 0, "allocations": []},
    )
    assert mismatch.status_code == 409

  def test_allocated_category_cannot_change_to_income(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    food = category(auth_client, "Food")
    save_budget(auth_client, budget_input(auth_client, allocations=[("Food", 6_000_000)]))
    response = auth_client.put(
      f"/api/categories/{food['id']}",
      json={"type": "income"},
    )
    assert response.status_code == 409
    assert get_budget(auth_client)["allocations"][0]["categoryName"] == "Food"

  def test_reset_only_deletes_budget_data(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_expense(auth_client, "Food", 1_000_000)
    save_budget(auth_client, budget_input(auth_client, allocations=[("Food", 6_000_000)]))
    before_transactions = db_session.query(Transaction).count()
    response = auth_client.delete("/api/monthly-budget?year=2026&month=8")
    assert response.status_code == 204
    assert db_session.query(MonthlyBudget).count() == 0
    assert db_session.query(MonthlyBudgetAllocation).count() == 0
    assert db_session.query(Transaction).count() == before_transactions
    assert get_budget(auth_client)["hasBudget"] is False
    assert auth_client.delete("/api/monthly-budget?year=2026&month=8").status_code == 404

  def test_user_isolation(
    self, auth_client: TestClient, other_auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    save_budget(auth_client, budget_input(auth_client, allocations=[("Food", 6_000_000)]))
    assert get_budget(other_auth_client)["hasBudget"] is False
    assert other_auth_client.delete("/api/monthly-budget?year=2026&month=8").status_code == 404

  def test_admin_can_delete_user_with_planning_only_budget(
    self,
    auth_client: TestClient,
    other_auth_client: TestClient,
    db_session: Session,
    user: User,
    other_user: User,
  ):
    user.is_admin = True
    db_session.commit()
    save_budget(
      other_auth_client,
      budget_input(
        other_auth_client,
        currency="USD",
        savings=100,
        allocations=[("Food", 200)],
      ),
    )
    response = auth_client.delete(f"/api/auth/users/{other_user.id}")
    assert response.status_code == 204, response.text
    assert db_session.query(MonthlyBudget).filter(MonthlyBudget.user_id == other_user.id).count() == 0
    assert db_session.query(MonthlyBudgetAllocation).count() == 0


class TestMonthlyBudgetCopy:
  def test_copy_is_an_independent_snapshot_and_handles_year_boundary(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    august = budget_input(
      auth_client,
      savings=5_000_000,
      allocations=[("Food", 6_000_000), ("Travel", 3_000_000)],
    )
    save_budget(auth_client, august)
    copied = auth_client.post("/api/monthly-budget/copy-previous?year=2026&month=9")
    assert copied.status_code == 201, copied.text
    assert copied.json()["plannedSavingsAmount"] == 5_000_000
    save_budget(
      auth_client,
      budget_input(auth_client, savings=5_000_000, allocations=[("Food", 8_000_000)]),
    )
    september = get_budget(auth_client, month=9)
    assert next(item for item in september["allocations"] if item["categoryName"] == "Food")["allocatedAmount"] == 6_000_000

    save_budget(auth_client, august, year=2026, month=12)
    january = auth_client.post("/api/monthly-budget/copy-previous?year=2027&month=1")
    assert january.status_code == 201, january.text
    assert january.json()["month"] == 1
    assert january.json()["year"] == 2027

  def test_copy_errors_are_explicit(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    assert auth_client.post("/api/monthly-budget/copy-previous?year=2026&month=8").status_code == 404
    save_budget(auth_client, budget_input(auth_client, allocations=[("Food", 6_000_000)]), month=7)
    save_budget(auth_client, budget_input(auth_client, allocations=[("Travel", 3_000_000)]), month=8)
    assert auth_client.post("/api/monthly-budget/copy-previous?year=2026&month=8").status_code == 409

    auth_client.delete("/api/monthly-budget?year=2026&month=8")
    food = category(auth_client, "Food")
    auth_client.delete(f"/api/categories/{food['id']}")
    inactive = auth_client.post("/api/monthly-budget/copy-previous?year=2026&month=8")
    assert inactive.status_code == 422
    assert "Food" in inactive.json()["detail"]


class TestMonthlyBudgetFxAndIsolation:
  def test_historical_fx_is_used_for_category_spending(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    save_budget(auth_client, budget_input(auth_client, savings=0, allocations=[("Food", 6_000_000)]))
    create_expense(auth_client, "Food", 100, currency="USD")
    result = get_budget(auth_client)
    food = result["allocations"][0]
    assert food["actualSpent"] == 2_500_000
    assert food["remainingAmount"] == 3_500_000
    assert result["budgetComparisonComplete"] is True
    assert result["convertedCurrencies"] == ["USD"]

  def test_fx_failure_withholds_authoritative_comparisons(
    self,
    auth_client: TestClient,
    db_session: Session,
    user: User,
    monkeypatch: pytest.MonkeyPatch,
  ):
    set_currency(db_session, user)
    save_budget(auth_client, budget_input(auth_client, savings=0, allocations=[("Food", 6_000_000)]))
    create_expense(auth_client, "Food", 100, currency="USD")

    def fail(*_args, **_kwargs):
      raise ExchangeRateProviderError("offline")

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", fail)
    result = get_budget(auth_client)
    assert result["budgetComparisonComplete"] is False
    assert result["unconvertedCurrencies"] == ["USD"]
    assert result["safeToSpend"] is None
    assert result["remainingVariableBudget"] is None
    assert result["allocations"][0]["remainingAmount"] is None
    assert result["allocations"][0]["utilizationPercent"] is None

  def test_budget_mutations_do_not_change_cash_flow_or_saving_pot(
    self, auth_client: TestClient, db_session: Session, user: User
  ):
    set_currency(db_session, user)
    create_income(auth_client)
    create_expense(auth_client, "Food", 1_000_000)
    before_cashflow = auth_client.get(
      "/api/cashflow/summary?year=2026&month=8&currency=VND"
    ).json()
    before_transactions = db_session.query(Transaction).count()
    before_saving_entries = db_session.query(SavingPotEntry).count()
    save_budget(auth_client, budget_input(auth_client, allocations=[("Food", 6_000_000)]))
    auth_client.delete("/api/monthly-budget?year=2026&month=8")
    after_cashflow = auth_client.get(
      "/api/cashflow/summary?year=2026&month=8&currency=VND"
    ).json()
    assert after_cashflow == before_cashflow
    assert db_session.query(Transaction).count() == before_transactions
    assert db_session.query(SavingPotEntry).count() == before_saving_entries
