from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

LOAN_PAYLOAD = {
    "bankName": "Shinhan",
    "openDate": "2026-05-07",
    "disbursementAmount": 596000000,
    "interestRatePerYear": 12,
    "durationMonths": 60,
    "loanType": "unsecured",
}


def create_loan(client: TestClient, **overrides) -> dict:
    res = client.post("/api/loans", json={**LOAN_PAYLOAD, **overrides})
    assert res.status_code == 201, res.text
    return res.json()


class TestLoanDetailOwnership:
    def test_owner_can_view_their_loan_detail(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.get(f"/api/loans/{loan['id']}")
        assert res.status_code == 200
        body = res.json()
        assert body["termsElapsed"] == 3
        assert body["estimatedOutstandingBalance"] == 574038167

    def test_owner_can_view_their_loan_schedule(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.get(f"/api/loans/{loan['id']}/schedule")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 60
        assert items[0]["term"] == 1
        assert items[-1]["closingPrincipal"] == 0

    def test_other_user_gets_404_on_detail(self, auth_client: TestClient, other_auth_client: TestClient):
        loan = create_loan(auth_client)
        res = other_auth_client.get(f"/api/loans/{loan['id']}")
        assert res.status_code == 404

    def test_other_user_gets_404_on_schedule(self, auth_client: TestClient, other_auth_client: TestClient):
        loan = create_loan(auth_client)
        res = other_auth_client.get(f"/api/loans/{loan['id']}/schedule")
        assert res.status_code == 404

    def test_other_users_loan_list_does_not_include_it(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        create_loan(auth_client)
        res = other_auth_client.get("/api/loans")
        assert res.status_code == 200
        assert res.json() == []

    def test_nonexistent_loan_id_returns_404(self, auth_client: TestClient):
        res = auth_client.get("/api/loans/does-not-exist/schedule")
        assert res.status_code == 404

    def test_a_missing_loan_and_someone_elses_loan_404_identically(
        self, auth_client: TestClient, other_auth_client: TestClient
    ):
        loan = create_loan(auth_client)
        other_users_loan = other_auth_client.get(f"/api/loans/{loan['id']}")
        missing = other_auth_client.get("/api/loans/totally-made-up-id")
        assert other_users_loan.status_code == missing.status_code == 404
        assert other_users_loan.json() == missing.json()


class TestLoanDetailAuth:
    def test_unauthenticated_detail_request_is_rejected(self, client: TestClient):
        res = client.get("/api/loans/some-id")
        assert res.status_code == 401

    def test_unauthenticated_schedule_request_is_rejected(self, client: TestClient):
        res = client.get("/api/loans/some-id/schedule")
        assert res.status_code == 401

    def test_unauthenticated_list_request_is_rejected(self, client: TestClient):
        res = client.get("/api/loans")
        assert res.status_code == 401


class TestLoanDetailContent:
    def test_secured_loan_detail_shows_flat_principal(self, auth_client: TestClient):
        loan = create_loan(auth_client, loanType="secured")
        res = auth_client.get(f"/api/loans/{loan['id']}")
        assert res.status_code == 200
        body = res.json()
        assert body["currentPrincipal"] == 596000000
        assert body["principalRepaid"] == 0
        assert body["principalRepaidPercent"] == 0

    def test_schedule_reflects_secured_flat_balance(self, auth_client: TestClient):
        loan = create_loan(auth_client, loanType="secured")
        res = auth_client.get(f"/api/loans/{loan['id']}/schedule")
        items = res.json()
        assert all(item["openingPrincipal"] == 596000000 for item in items)
        assert all(item["principal"] == 0 for item in items)

    def test_list_exposes_monthly_payment_with_legacy_alias(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.get("/api/loans")

        assert res.status_code == 200
        body = next(item for item in res.json() if item["id"] == loan["id"])
        assert body["monthlyPayment"] > 0
        assert body["monthlyPayment"] == body["monthlyInterest"]


class TestLoanCreateValidation:
    def test_blank_bank_name_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "bankName": ""})
        assert res.status_code == 422

    def test_whitespace_only_bank_name_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "bankName": "    "})
        assert res.status_code == 422

    def test_bank_name_over_max_length_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "bankName": "A" * 101})
        assert res.status_code == 422

    def test_bank_name_at_max_length_accepted(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "bankName": "A" * 100})
        assert res.status_code == 201

    def test_bank_name_is_trimmed(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "bankName": "  Shinhan  "})
        assert res.status_code == 201
        assert res.json()["bankName"] == "Shinhan"

    def test_zero_principal_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "disbursementAmount": 0})
        assert res.status_code == 422

    def test_negative_principal_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "disbursementAmount": -1000000})
        assert res.status_code == 422

    def test_negative_interest_rate_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "interestRatePerYear": -1})
        assert res.status_code == 422

    def test_interest_rate_over_100_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "interestRatePerYear": 150})
        assert res.status_code == 422

    def test_zero_interest_rate_accepted(self, auth_client: TestClient):
        # A legitimate promotional/interest-free loan - only negative rates
        # and absurd (>100%) ones are actually invalid data.
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "interestRatePerYear": 0})
        assert res.status_code == 201

    def test_zero_duration_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "durationMonths": 0})
        assert res.status_code == 422

    def test_negative_duration_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "durationMonths": -12})
        assert res.status_code == 422

    def test_duration_over_max_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "durationMonths": 601})
        assert res.status_code == 422

    def test_duration_at_max_accepted(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "durationMonths": 600})
        assert res.status_code == 201

    def test_invalid_loan_type_rejected(self, auth_client: TestClient):
        res = auth_client.post("/api/loans", json={**LOAN_PAYLOAD, "loanType": "not-a-type"})
        assert res.status_code == 422


class TestLoanUpdateValidation:
    def test_update_with_blank_bank_name_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"bankName": ""})
        assert res.status_code == 422

    def test_update_with_whitespace_only_bank_name_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"bankName": "   "})
        assert res.status_code == 422

    def test_update_with_zero_principal_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"disbursementAmount": 0})
        assert res.status_code == 422

    def test_update_with_negative_principal_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"disbursementAmount": -5})
        assert res.status_code == 422

    def test_update_with_negative_interest_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"interestRatePerYear": -2})
        assert res.status_code == 422

    def test_update_with_zero_duration_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"durationMonths": 0})
        assert res.status_code == 422

    def test_update_with_negative_duration_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"durationMonths": -3})
        assert res.status_code == 422

    def test_update_with_invalid_loan_type_rejected(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"loanType": "bogus"})
        assert res.status_code == 422

    def test_valid_partial_update_succeeds_and_leaves_other_fields_untouched(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(f"/api/loans/{loan['id']}", json={"interestRatePerYear": 9.5})
        assert res.status_code == 200
        body = res.json()
        assert body["interestRatePerYear"] == 9.5
        assert body["bankName"] == loan["bankName"]
        assert body["disbursementAmount"] == loan["disbursementAmount"]

    def test_full_update_of_all_fields_succeeds(self, auth_client: TestClient):
        loan = create_loan(auth_client)
        res = auth_client.put(
            f"/api/loans/{loan['id']}",
            json={
                "bankName": "UOB",
                "openDate": "2026-01-01",
                "disbursementAmount": 100000000,
                "interestRatePerYear": 8.5,
                "durationMonths": 24,
                "loanType": "secured",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["bankName"] == "UOB"
        assert body["disbursementAmount"] == 100000000
        assert body["loanType"] == "secured"


class TestLoanMutationOwnership:
    def test_other_user_cannot_update_loan(self, auth_client: TestClient, other_auth_client: TestClient):
        loan = create_loan(auth_client)
        res = other_auth_client.put(f"/api/loans/{loan['id']}", json={"bankName": "Hijacked"})
        assert res.status_code == 404

        untouched = auth_client.get(f"/api/loans/{loan['id']}")
        assert untouched.json()["bankName"] == "Shinhan"

    def test_other_user_cannot_delete_loan(self, auth_client: TestClient, other_auth_client: TestClient):
        loan = create_loan(auth_client)
        res = other_auth_client.delete(f"/api/loans/{loan['id']}")
        assert res.status_code == 404

        still_there = auth_client.get(f"/api/loans/{loan['id']}")
        assert still_there.status_code == 200

    def test_update_of_missing_loan_404s(self, auth_client: TestClient):
        res = auth_client.put("/api/loans/does-not-exist", json={"bankName": "X"})
        assert res.status_code == 404

    def test_delete_of_missing_loan_404s(self, auth_client: TestClient):
        res = auth_client.delete("/api/loans/does-not-exist")
        assert res.status_code == 404


class _FixedDateTime(datetime):
    """A real datetime subclass with .now() pinned to a specific instant -
    lets API-level tests deterministically control "today" (which the list
    endpoint doesn't accept as a parameter) without a time-mocking
    dependency or any production code change. Everything else (arithmetic,
    .weekday(), .replace()) behaves exactly like the real datetime class,
    since this *is* the real class, just with one classmethod overridden.
    """

    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 6, 7, 12, 0, tzinfo=tz)  # a Sunday


class TestListReflectsWeekendAdjustedSchedule:
    def test_terms_elapsed_and_remaining_on_list(self, auth_client: TestClient):
        loan = create_loan(auth_client, openDate="2026-05-07", durationMonths=60)

        res = auth_client.get("/api/loans")
        assert res.status_code == 200
        body = next(item for item in res.json() if item["id"] == loan["id"])
        assert "termsElapsed" in body
        assert "termsRemaining" in body
        assert body["termsElapsed"] + body["termsRemaining"] == 60

    def test_terms_elapsed_on_list_matches_known_reference_instant(self, auth_client: TestClient):
        # Pinning "now" makes this the same reference scenario verified
        # against a real bank statement elsewhere: by 2026-08-11, exactly 3
        # of 60 terms have elapsed.
        loan = create_loan(auth_client, openDate="2026-05-07", durationMonths=60)

        class _ReferenceInstant(datetime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2026, 8, 11, 12, 0, tzinfo=tz)

        with patch("app.calculations.datetime", _ReferenceInstant):
            res = auth_client.get("/api/loans")

        body = next(item for item in res.json() if item["id"] == loan["id"])
        assert body["termsElapsed"] == 3
        assert body["termsRemaining"] == 57

    def test_installment_not_elapsed_until_adjusted_monday(self, auth_client: TestClient):
        # 2026-06-07 (the nominal, unadjusted 1-month anniversary of
        # 2026-05-07) is a Sunday; the real due date is pushed to Monday
        # 2026-06-08. Listing loans on that Sunday must not count the term
        # as elapsed yet.
        loan = create_loan(auth_client, openDate="2026-05-07", durationMonths=60)

        with patch("app.calculations.datetime", _FixedDateTime):
            res = auth_client.get("/api/loans")

        assert res.status_code == 200
        body = next(item for item in res.json() if item["id"] == loan["id"])
        assert body["termsElapsed"] == 0
        assert body["termsRemaining"] == 60
