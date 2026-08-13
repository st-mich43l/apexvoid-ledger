from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.exchange_rates import (
    ExchangeRateProviderError,
    ExchangeRateQuote,
    FrankfurterExchangeRateProvider,
)


@pytest.fixture(autouse=True)
def deterministic_exchange_rates(monkeypatch: pytest.MonkeyPatch):
    rates = {
        ("EUR", "USD"): Decimal("1.25"),
        ("USD", "VND"): Decimal("25000"),
        ("VND", "USD"): Decimal("0.00004"),
    }

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
                rate=rates.get((source_currency, target_currency), Decimal("2")),
                rate_date=start_date,
            )
        ]

    monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", get_rates)


def categories(client: TestClient, include_inactive: bool = False) -> list[dict]:
    response = client.get(
        "/api/categories", params={"includeInactive": str(include_inactive).lower()}
    )
    assert response.status_code == 200, response.text
    return response.json()


def category(client: TestClient, name: str, category_type: str) -> dict:
    return next(
        item
        for item in categories(client, include_inactive=True)
        if item["name"] == name and item["type"] == category_type
    )


def create_transaction(client: TestClient, **overrides) -> dict:
    food = category(client, "Food", "expense")
    payload = {
        "type": "expense",
        "categoryId": food["id"],
        "amount": 12.5,
        "currency": "USD",
        "occurredAt": "2026-08-12T08:30:00Z",
        "description": "Lunch",
        **overrides,
    }
    response = client.post("/api/transactions", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def create_loan(client: TestClient, **overrides) -> dict:
    payload = {
        "bankName": "Example Bank",
        "openDate": "2026-07-07T00:00:00Z",
        "disbursementAmount": 1200,
        "currency": "USD",
        "interestRatePerYear": 0,
        "durationMonths": 12,
        "loanType": "unsecured",
        **overrides,
    }
    response = client.post("/api/loans", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class TestCashFlowAuthentication:
    def test_endpoints_require_authentication(self, client: TestClient):
        requests = [
            client.get("/api/categories"),
            client.post(
                "/api/categories", json={"name": "Food", "type": "expense"}
            ),
            client.get("/api/transactions"),
            client.post(
                "/api/transactions",
                json={
                    "type": "expense",
                    "categoryId": "missing",
                    "amount": 1,
                    "currency": "USD",
                    "occurredAt": "2026-08-01T00:00:00Z",
                },
            ),
            client.post(
                "/api/transactions/weekly-expenses",
                json={
                    "weekEnding": "2026-08-16T12:00:00Z",
                    "currency": "USD",
                    "entries": [{"categoryId": "missing", "amount": 1}],
                },
            ),
            client.get(
                "/api/cashflow/summary",
                params={"year": 2026, "month": 8, "currency": "USD"},
            ),
        ]
        assert all(response.status_code == 401 for response in requests)


class TestCategories:
    def test_default_categories_are_seeded_idempotently(self, auth_client: TestClient):
        first = categories(auth_client)
        second = categories(auth_client)

        assert len(first) == len(second) == 19
        assert {item["name"] for item in first if item["type"] == "expense"} == {
            "Food",
            "Housing",
            "Transport",
            "Shopping",
            "Entertainment",
            "Utilities",
            "Subscriptions",
            "Health",
            "Spa & Beauty",
            "Travel",
            "Gifts",
            "Loan",
            "Credit Card",
            "Other",
        }
        assert len({item["id"] for item in first}) == 19

    def test_defaults_are_independent_per_user(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        alice_food = category(auth_client, "Food", "expense")
        bob_food = category(other_auth_client, "Food", "expense")
        assert alice_food["id"] != bob_food["id"]

    def test_create_normalizes_name_and_rejects_duplicate(self, auth_client: TestClient):
        response = auth_client.post(
            "/api/categories", json={"name": "  Side   Hustle  ", "type": "income", "icon": " 💻 "}
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Side Hustle"
        assert response.json()["icon"] == "💻"

        duplicate = auth_client.post(
            "/api/categories", json={"name": "SIDE hustle", "type": "income"}
        )
        assert duplicate.status_code == 409

    def test_same_name_is_valid_for_other_type_and_other_user(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        assert auth_client.post(
            "/api/categories", json={"name": "Reimbursement", "type": "income"}
        ).status_code == 201
        assert auth_client.post(
            "/api/categories", json={"name": "Reimbursement", "type": "expense"}
        ).status_code == 201
        assert other_auth_client.post(
            "/api/categories", json={"name": "Reimbursement", "type": "income"}
        ).status_code == 201

    def test_category_validation(self, auth_client: TestClient):
        for payload in (
            {"name": "", "type": "expense"},
            {"name": "   ", "type": "expense"},
            {"name": "x", "type": "other"},
            {"name": "x" * 81, "type": "income"},
        ):
            assert auth_client.post("/api/categories", json=payload).status_code == 422

    def test_update_and_soft_deactivate_preserve_history(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        transaction = create_transaction(auth_client, categoryId=food["id"])

        renamed = auth_client.put(
            f"/api/categories/{food['id']}", json={"name": "Dining", "icon": "🍽️"}
        )
        assert renamed.status_code == 200
        assert renamed.json()["name"] == "Dining"

        deleted = auth_client.delete(f"/api/categories/{food['id']}")
        assert deleted.status_code == 204
        assert food["id"] not in {item["id"] for item in categories(auth_client)}
        inactive = {item["id"]: item for item in categories(auth_client, True)}
        assert inactive[food["id"]]["isActive"] is False
        listed = auth_client.get("/api/transactions").json()
        assert listed[0]["id"] == transaction["id"]
        assert listed[0]["categoryName"] == "Dining"

    def test_category_with_transactions_cannot_change_type(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        create_transaction(auth_client, categoryId=food["id"])
        response = auth_client.put(f"/api/categories/{food['id']}", json={"type": "income"})
        assert response.status_code == 409

    def test_other_users_category_behaves_like_missing(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        food = category(auth_client, "Food", "expense")
        missing = other_auth_client.put("/api/categories/missing", json={"name": "Nope"})
        hidden = other_auth_client.put(
            f"/api/categories/{food['id']}", json={"name": "Nope"}
        )
        assert missing.status_code == hidden.status_code == 404
        assert missing.json() == hidden.json()
        assert other_auth_client.delete(f"/api/categories/{food['id']}").status_code == 404


class TestTransactions:
    def test_create_read_update_delete(self, auth_client: TestClient):
        created = create_transaction(auth_client)
        assert created["source"] == "manual"
        assert created["amount"] == 12.5
        assert created["description"] == "Lunch"

        salary = category(auth_client, "Salary", "income")
        updated = auth_client.put(
            f"/api/transactions/{created['id']}",
            json={
                "type": "income",
                "categoryId": salary["id"],
                "amount": 2500,
                "currency": "EUR",
                "occurredAt": "2026-08-31T23:59:59Z",
                "description": "  August salary  ",
            },
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["categoryName"] == "Salary"
        assert updated.json()["description"] == "August salary"

        assert auth_client.delete(f"/api/transactions/{created['id']}").status_code == 204
        assert auth_client.get("/api/transactions").json() == []

    def test_default_currency_and_ordering(self, auth_client: TestClient):
        older = create_transaction(auth_client, currency=None, occurredAt="2026-08-01T00:00:00Z")
        newer = create_transaction(auth_client, occurredAt="2026-08-31T23:59:59Z")
        response = auth_client.get("/api/transactions", params={"year": 2026, "month": 8})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == [newer["id"], older["id"]]
        assert older["currency"] == "USD"

    def test_filters_by_month_type_and_category(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        salary = category(auth_client, "Salary", "income")
        august_expense = create_transaction(auth_client, categoryId=food["id"])
        create_transaction(
            auth_client,
            type="income",
            categoryId=salary["id"],
            amount=100,
            occurredAt="2026-08-02T00:00:00Z",
        )
        create_transaction(auth_client, occurredAt="2026-09-01T00:00:00Z")

        response = auth_client.get(
            "/api/transactions",
            params={
                "year": 2026,
                "month": 8,
                "type": "expense",
                "categoryId": food["id"],
            },
        )
        assert [item["id"] for item in response.json()] == [august_expense["id"]]
        assert auth_client.get("/api/transactions", params={"year": 2026}).status_code == 422

    def test_rejects_invalid_values_and_category_mismatch(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        salary = category(auth_client, "Salary", "income")
        base = {
            "type": "expense",
            "categoryId": food["id"],
            "amount": 10,
            "currency": "USD",
            "occurredAt": "2026-08-12T00:00:00Z",
        }
        invalid_payloads = [
            {**base, "amount": 0},
            {**base, "amount": -1},
            {**base, "type": "refund"},
            {**base, "currency": "BTC"},
            {**base, "occurredAt": "not-a-date"},
        ]
        assert all(
            auth_client.post("/api/transactions", json=payload).status_code == 422
            for payload in invalid_payloads
        )
        mismatch = auth_client.post(
            "/api/transactions", json={**base, "categoryId": salary["id"]}
        )
        assert mismatch.status_code == 422

    def test_rejects_inactive_and_other_users_categories(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        food = category(auth_client, "Food", "expense")
        auth_client.delete(f"/api/categories/{food['id']}")
        inactive = auth_client.post(
            "/api/transactions",
            json={
                "type": "expense",
                "categoryId": food["id"],
                "amount": 1,
                "currency": "USD",
                "occurredAt": "2026-08-01T00:00:00Z",
            },
        )
        assert inactive.status_code == 409
        hidden = other_auth_client.post(
            "/api/transactions",
            json={
                "type": "expense",
                "categoryId": food["id"],
                "amount": 1,
                "currency": "USD",
                "occurredAt": "2026-08-01T00:00:00Z",
            },
        )
        assert hidden.status_code == 404

    def test_transaction_ownership_isolated_for_list_update_delete(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        transaction = create_transaction(auth_client)
        assert other_auth_client.get("/api/transactions").json() == []
        missing = other_auth_client.put("/api/transactions/missing", json={"amount": 20})
        hidden = other_auth_client.put(
            f"/api/transactions/{transaction['id']}", json={"amount": 20}
        )
        assert missing.status_code == hidden.status_code == 404
        assert missing.json() == hidden.json()
        assert other_auth_client.delete(
            f"/api/transactions/{transaction['id']}"
        ).status_code == 404


class TestWeeklyExpenses:
    def test_creates_weekly_category_totals_atomically(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        transport = category(auth_client, "Transport", "expense")
        response = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                "weekEnding": "2026-08-16T12:00:00Z",
                "currency": "USD",
                "entries": [
                    {"categoryId": food["id"], "amount": 125.25},
                    {
                        "categoryId": transport["id"],
                        "amount": 40,
                        "description": "Weekly travel",
                    },
                ],
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body) == 2
        assert body[0]["description"] == "Weekly total · 10–16 Aug"
        assert body[1]["description"] == "Weekly travel"
        assert all(item["type"] == "expense" for item in body)

        summary = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert summary["expenses"] == 165.25
        assert summary["transactionCount"] == 2

    def test_defaults_to_user_currency(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        response = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                "weekEnding": "2026-08-16T12:00:00Z",
                "entries": [{"categoryId": food["id"], "amount": 20}],
            },
        )
        assert response.status_code == 201
        assert response.json()[0]["currency"] == "USD"

    def test_partial_month_week_labels_are_preserved(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        first = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                "weekEnding": "2026-08-02T12:00:00Z",
                "currency": "USD",
                "entries": [{"categoryId": food["id"], "amount": 10}],
            },
        )
        last = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                "weekEnding": "2026-08-31T12:00:00Z",
                "currency": "USD",
                "entries": [{"categoryId": food["id"], "amount": 20}],
            },
        )

        assert first.status_code == last.status_code == 201
        assert first.json()[0]["description"] == "Weekly total · 1–2 Aug"
        assert last.json()[0]["description"] == "Weekly total · 31 Aug"

    def test_rejects_duplicates_invalid_amount_and_income_category(
        self, auth_client: TestClient
    ):
        food = category(auth_client, "Food", "expense")
        salary = category(auth_client, "Salary", "income")
        base = {"weekEnding": "2026-08-16T12:00:00Z", "currency": "USD"}
        duplicate = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                **base,
                "entries": [
                    {"categoryId": food["id"], "amount": 1},
                    {"categoryId": food["id"], "amount": 2},
                ],
            },
        )
        invalid_amount = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={**base, "entries": [{"categoryId": food["id"], "amount": 0}]},
        )
        wrong_type = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={**base, "entries": [{"categoryId": salary["id"], "amount": 1}]},
        )
        assert duplicate.status_code == invalid_amount.status_code == 422
        assert wrong_type.status_code == 422
        assert auth_client.get("/api/transactions").json() == []

    def test_foreign_category_rejects_entire_batch(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        food = category(auth_client, "Food", "expense")
        other_food = category(other_auth_client, "Food", "expense")
        response = auth_client.post(
            "/api/transactions/weekly-expenses",
            json={
                "weekEnding": "2026-08-16T12:00:00Z",
                "currency": "USD",
                "entries": [
                    {"categoryId": food["id"], "amount": 10},
                    {"categoryId": other_food["id"], "amount": 20},
                ],
            },
        )
        assert response.status_code == 404
        assert auth_client.get("/api/transactions").json() == []


class TestMonthlySummary:
    def test_aggregates_with_decimal_math_and_expense_breakdown(self, auth_client: TestClient):
        salary = category(auth_client, "Salary", "income")
        bonus = category(auth_client, "Bonus", "income")
        food = category(auth_client, "Food", "expense")
        housing = category(auth_client, "Housing", "expense")
        for transaction_type, category_id, amount in (
            ("income", salary["id"], 30000000),
            ("income", bonus["id"], 5000000),
            ("expense", food["id"], 3000000),
            ("expense", housing["id"], 7000000),
        ):
            create_transaction(
                auth_client,
                type=transaction_type,
                categoryId=category_id,
                amount=amount,
                currency="VND",
            )

        response = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["income"] == 35000000
        assert body["expenses"] == 10000000
        assert body["netCashFlow"] == 25000000
        assert body["savingsRatePercent"] == 71.43
        assert body["transactionCount"] == 4
        assert [(item["name"], item["amount"], item["percent"]) for item in body["categoryBreakdown"]] == [
            ("Housing", 7000000, 70),
            ("Food", 3000000, 30),
        ]

    def test_month_boundaries_and_other_currencies_are_converted(self, auth_client: TestClient):
        food = category(auth_client, "Food", "expense")
        create_transaction(
            auth_client, categoryId=food["id"], amount=1, occurredAt="2026-08-01T00:00:00Z"
        )
        create_transaction(
            auth_client, categoryId=food["id"], amount=2, occurredAt="2026-08-31T23:59:59Z"
        )
        create_transaction(
            auth_client, categoryId=food["id"], amount=4, occurredAt="2026-09-01T00:00:00Z"
        )
        create_transaction(
            auth_client,
            categoryId=food["id"],
            amount=8,
            currency="EUR",
            occurredAt="2026-08-15T00:00:00Z",
        )
        body = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert body["expenses"] == 13
        assert body["transactionCount"] == 3
        assert body["convertedCurrencies"] == ["EUR"]
        assert body["unconvertedCurrencies"] == []
        assert body["excludedCurrencies"] == []
        assert body["exchangeRateProvider"] == "Frankfurter"

    def test_converts_each_transaction_into_reporting_currency(
        self, auth_client: TestClient
    ):
        salary = category(auth_client, "Salary", "income")
        subscriptions = category(auth_client, "Subscriptions", "expense")
        create_transaction(
            auth_client,
            type="income",
            categoryId=salary["id"],
            amount=37000000,
            currency="VND",
            occurredAt="2026-08-01T12:00:00Z",
            description=None,
        )
        create_transaction(
            auth_client,
            categoryId=subscriptions["id"],
            amount=20,
            currency="USD",
            occurredAt="2026-08-05T12:00:00Z",
            description="Claude",
        )

        body = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        ).json()
        assert body["income"] == 37000000
        assert body["expenses"] == 500000
        assert body["netCashFlow"] == 36500000
        assert body["savingsRatePercent"] == 98.65
        assert body["transactionCount"] == 2
        assert body["categoryBreakdown"][0]["name"] == "Subscriptions"
        assert body["categoryBreakdown"][0]["amount"] == 500000
        assert body["convertedCurrencies"] == ["USD"]
        assert body["conversionRates"] == [
            {
                "sourceCurrency": "USD",
                "targetCurrency": "VND",
                "rate": 25000,
                "rateDate": "2026-07-25",
            }
        ]
        assert body["exchangeRateProviderUrl"] == "https://frankfurter.dev"

        transactions = auth_client.get(
            "/api/transactions", params={"year": 2026, "month": 8}
        ).json()
        claude = next(item for item in transactions if item["description"] == "Claude")
        assert claude["amount"] == 20
        assert claude["currency"] == "USD"

    def test_uses_rate_on_or_before_each_transaction_date(
        self, auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        food = category(auth_client, "Food", "expense")
        create_transaction(
            auth_client,
            categoryId=food["id"],
            amount=10,
            currency="USD",
            occurredAt="2026-08-03T12:00:00Z",
        )
        create_transaction(
            auth_client,
            categoryId=food["id"],
            amount=10,
            currency="USD",
            occurredAt="2026-08-12T12:00:00Z",
        )

        def dated_rates(*_args, **_kwargs) -> list[ExchangeRateQuote]:
            return [
                ExchangeRateQuote("USD", "VND", Decimal("25000"), date(2026, 8, 1)),
                ExchangeRateQuote("USD", "VND", Decimal("26000"), date(2026, 8, 10)),
            ]

        monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", dated_rates)
        body = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        ).json()
        assert body["expenses"] == 510000
        assert [rate["rateDate"] for rate in body["conversionRates"]] == [
            "2026-08-01",
            "2026-08-10",
        ]

    def test_provider_failure_keeps_native_totals_and_reports_exclusion(
        self, auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        salary = category(auth_client, "Salary", "income")
        create_transaction(
            auth_client,
            type="income",
            categoryId=salary["id"],
            amount=1000000,
            currency="VND",
        )
        create_transaction(auth_client, amount=20, currency="USD")

        def unavailable(*_args, **_kwargs):
            raise ExchangeRateProviderError("offline")

        monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
        body = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        ).json()
        assert body["income"] == 1000000
        assert body["expenses"] == 0
        assert body["transactionCount"] == 2
        assert body["convertedCurrencies"] == []
        assert body["unconvertedCurrencies"] == ["USD"]
        assert body["excludedCurrencies"] == ["USD"]
        assert body["exchangeRateProvider"] is None

    def test_empty_month_and_zero_income(self, auth_client: TestClient):
        empty = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 7, "currency": "USD"},
        ).json()
        assert empty["income"] == empty["expenses"] == empty["netCashFlow"] == 0
        assert empty["savingsRatePercent"] is None
        assert empty["categoryBreakdown"] == []

        create_transaction(auth_client, amount=25)
        expense_only = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert expense_only["netCashFlow"] == -25
        assert expense_only["savingsRatePercent"] is None

    def test_summary_is_per_user(self, auth_client: TestClient, other_auth_client: TestClient):
        create_transaction(auth_client, amount=50)
        body = other_auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert body["transactionCount"] == 0
        assert body["expenses"] == 0


class TestLinkedLoanPayments:
    def test_contractual_installment_is_included_without_creating_a_transaction(
        self, auth_client: TestClient
    ):
        loan = create_loan(auth_client)

        first = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        second = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()

        assert first["expenses"] == 100
        assert first["transactionCount"] == 0
        assert first["loanPaymentCount"] == 1
        assert first["loanPayments"] == [
            {
                "id": f"loan:{loan['id']}:1",
                "loanId": loan["id"],
                "bankName": "Example Bank",
                "term": 1,
                "dueAt": "2026-08-07T00:00:00.000Z",
                "amount": 100,
                "currency": "USD",
                "reportingAmount": 100,
                "reportingCurrency": "USD",
            }
        ]
        assert first["categoryBreakdown"] == [
            {
                "categoryId": category(auth_client, "Loan", "expense")["id"],
                "name": "Loan",
                "icon": "🏦",
                "amount": 100,
                "percent": 100,
            }
        ]
        assert second == first
        assert auth_client.get("/api/transactions").json() == []

    def test_only_schedule_months_and_the_owner_receive_linked_payments(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        create_loan(auth_client, durationMonths=1)

        before_first_due = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 7, "currency": "USD"},
        ).json()
        final_installment = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        after_maturity = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 9, "currency": "USD"},
        ).json()
        other_user = other_auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()

        assert before_first_due["loanPaymentCount"] == 0
        assert final_installment["loanPaymentCount"] == 1
        assert final_installment["expenses"] == 1200
        assert after_maturity["loanPaymentCount"] == 0
        assert other_user["loanPaymentCount"] == 0
        assert other_user["expenses"] == 0

    def test_loan_updates_and_deletion_flow_through_to_cash_flow(
        self, auth_client: TestClient
    ):
        loan = create_loan(auth_client)

        updated = auth_client.put(
            f"/api/loans/{loan['id']}", json={"disbursementAmount": 2400}
        )
        assert updated.status_code == 200, updated.text
        after_update = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert after_update["expenses"] == 200

        assert auth_client.delete(f"/api/loans/{loan['id']}").status_code == 204
        after_delete = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()
        assert after_delete["expenses"] == 0
        assert after_delete["loanPayments"] == []

    def test_linked_payment_uses_historical_fx_and_reports_provider_failure(
        self, auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        loan = create_loan(auth_client)
        converted = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        ).json()

        assert converted["expenses"] == 2500000
        assert converted["loanPayments"][0]["amount"] == 100
        assert converted["loanPayments"][0]["currency"] == "USD"
        assert converted["loanPayments"][0]["reportingAmount"] == 2500000
        assert converted["convertedCurrencies"] == ["USD"]

        def unavailable(*_args, **_kwargs):
            raise ExchangeRateProviderError("offline")

        monkeypatch.setattr(FrankfurterExchangeRateProvider, "get_rates", unavailable)
        unavailable_summary = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "VND"},
        ).json()
        assert unavailable_summary["expenses"] == 0
        assert unavailable_summary["loanPaymentCount"] == 1
        assert unavailable_summary["loanPayments"][0]["reportingAmount"] is None
        assert unavailable_summary["unconvertedCurrencies"] == ["USD"]

        assert auth_client.get(f"/api/loans/{loan['id']}").json()["currency"] == "USD"

    def test_secured_loan_links_interest_only_payment(self, auth_client: TestClient):
        create_loan(
            auth_client,
            disbursementAmount=120000,
            interestRatePerYear=12,
            loanType="secured",
        )
        summary = auth_client.get(
            "/api/cashflow/summary",
            params={"year": 2026, "month": 8, "currency": "USD"},
        ).json()

        # July 7 to August 7 is 31 days under the schedule's actual/365 rule.
        assert summary["expenses"] == 1223.01
        assert summary["loanPayments"][0]["amount"] == 1223.01
