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
