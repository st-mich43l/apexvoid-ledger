import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models import FinancialAccount, Loan, SePayBankActivity, Transaction
from cryptography.fernet import Fernet

from app.sepay import account_number_fingerprint, encrypt_api_token


def payload(account_number: str = "10937375404", transaction_id: int = 92704, direction: str = "out") -> dict:
  return {
    "id": transaction_id,
    "gateway": "TPBank",
    "transactionDate": "2026-10-22 15:30:00",
    "accountNumber": account_number,
    "subAccount": "",
    "code": None,
    "content": "Bank transfer description",
    "transferType": direction,
    "transferAmount": 150000,
    "accumulated": 8500000,
    "description": "Bank transaction",
    "referenceCode": "FT261022123456",
  }


def webhook_headers(key: str = "webhook-test-key") -> dict[str, str]:
  return {"Authorization": f"Apikey {key}"}


def add_account(db_session: Session, user_id: str, account_number: str = "10937375404") -> FinancialAccount:
  account = FinancialAccount(
    user_id=user_id,
    provider="sepay",
    external_account_id="48673",
    bank_name="TPBank",
    account_number_masked=f"••••{account_number[-4:]}",
    account_number_fingerprint=account_number_fingerprint(account_number),
    account_name="Test User",
    currency="VND",
    balance=8500000,
    balance_status="verified",
  )
  db_session.add(account)
  db_session.commit()
  db_session.refresh(account)
  return account


def configure_rule(client: TestClient, category_id: str, **overrides) -> dict:
  response = client.put(
    "/api/bank-activities/categorization-rule",
    json={
      "enabled": True,
      "categoryId": category_id,
      "descriptionContains": "MONTHLY ALLOWANCE",
      "referenceContains": None,
      **overrides,
    },
  )
  assert response.status_code == 200, response.text
  return response.json()


def test_webhook_accepts_incoming_and_outgoing_events_once(
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  account = add_account(db_session, user.id)

  outgoing = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(direction="out"),
    headers=webhook_headers(),
  )
  incoming = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92705, direction="in"),
    headers=webhook_headers(),
  )
  duplicate = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(direction="out"),
    headers=webhook_headers(),
  )

  assert outgoing.status_code == 200, outgoing.text
  assert incoming.status_code == 200, incoming.text
  assert duplicate.status_code == 200, duplicate.text
  assert outgoing.json() == {"success": True}
  assert db_session.query(SePayBankActivity).count() == 2
  assert db_session.query(SePayBankActivity).filter(SePayBankActivity.financial_account_id == account.id).count() == 2
  stored = db_session.query(SePayBankActivity).filter(SePayBankActivity.provider_transaction_id == "92704").one()
  assert stored.processing_status == "pending_review"
  assert stored.original_payload["accountNumber"] == "••••5404"
  assert "10937375404" not in str(stored.original_payload)
  assert db_session.query(Transaction).count() == 0


def test_outgoing_without_a_rule_stays_uncategorized_for_review(
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  add_account(db_session, user.id)

  response = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92708, direction="out"),
    headers=webhook_headers(),
  )

  assert response.status_code == 200
  activity = db_session.query(SePayBankActivity).one()
  assert activity.processing_status == "pending_review"
  assert activity.classification == "unreviewed"
  assert db_session.query(Transaction).count() == 0


def test_auto_categorizes_high_confidence_outgoing_and_deduplicates_delivery(
  auth_client: TestClient,
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  add_account(db_session, user.id)
  categories = auth_client.get("/api/categories?type=expense").json()
  living = next(item for item in categories if item["name"] == "Monthly Living Budget")
  rule = configure_rule(auth_client, living["id"])
  assert rule["categoryName"] == "Monthly Living Budget"

  event = payload(
    transaction_id=92709,
    direction="out",
  )
  event["content"] = "MONTHLY ALLOWANCE OCTOBER"
  first = client.post(
    "/api/integrations/sepay/webhook", json=event, headers=webhook_headers()
  )
  duplicate = client.post(
    "/api/integrations/sepay/webhook", json=event, headers=webhook_headers()
  )

  assert first.status_code == duplicate.status_code == 200
  activity = db_session.query(SePayBankActivity).one()
  transaction = db_session.query(Transaction).one()
  assert activity.processing_status == "processed"
  assert activity.classification == "expense"
  assert activity.matched_kind == "auto_rule"
  assert activity.linked_transaction_id == transaction.id
  assert transaction.source == "sepay"
  assert transaction.external_id == "sepay:sepay:92709"
  assert transaction.category_id == living["id"]
  assert db_session.query(SePayBankActivity).count() == 1
  assert db_session.query(Transaction).filter(Transaction.source == "sepay").count() == 1


def test_rule_rejects_amount_only_and_missing_category(
  auth_client: TestClient,
  db_session: Session,
  user,
):
  add_account(db_session, user.id)
  assert auth_client.put(
    "/api/bank-activities/categorization-rule",
    json={"enabled": True, "categoryId": "missing", "descriptionContains": None},
  ).status_code == 404
  food = next(
    item for item in auth_client.get("/api/categories?type=expense").json()
    if item["name"] == "Food"
  )
  amount_only = auth_client.put(
    "/api/bank-activities/categorization-rule",
    json={"enabled": True, "categoryId": food["id"]},
  )
  assert amount_only.status_code == 422
  assert "amount alone" in amount_only.json()["detail"]


def test_matching_sepay_expense_reconciles_recurring_occurrence_once(
  auth_client: TestClient,
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  add_account(db_session, user.id)
  living = next(
    item for item in auth_client.get("/api/categories?type=expense").json()
    if item["name"] == "Monthly Living Budget"
  )
  configure_rule(auth_client, living["id"])
  recurring = auth_client.post(
    "/api/recurring-expenses",
    json={
      "name": "Monthly allowance schedule",
      "categoryId": living["id"],
      "amount": 150000,
      "currency": "VND",
      "dueDay": 22,
      "startMonth": "2026-01",
    },
  )
  assert recurring.status_code == 201, recurring.text

  event = payload(transaction_id=92710, direction="out")
  event["content"] = "MONTHLY ALLOWANCE OCTOBER"
  accepted = client.post(
    "/api/integrations/sepay/webhook", json=event, headers=webhook_headers()
  )
  assert accepted.status_code == 200

  summary = auth_client.get(
    "/api/cashflow/summary?year=2026&month=10&currency=VND"
  )
  assert summary.status_code == 200, summary.text
  body = summary.json()
  assert body["expenses"] == 150000
  assert body["variableExpenseTotal"] == 150000
  assert body["fixedExpenseTotal"] == 0
  assert body["recurringExpenses"] == []

  user.preferred_currency = "VND"
  db_session.commit()
  budget = auth_client.put(
    "/api/monthly-budget?year=2026&month=10",
    json={
      "currency": "VND",
      "plannedSavings": 0,
      "allocations": [{"categoryId": living["id"], "amount": 200000}],
    },
  )
  assert budget.status_code == 200, budget.text
  allocation = budget.json()["allocations"][0]
  assert allocation["actualSpent"] == 150000


def test_matching_loan_repayment_stays_a_bank_activity(
  auth_client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  add_account(db_session, user.id)
  loan = Loan(
    user_id=user.id,
    bank_name="Example Bank",
    open_date=datetime(2026, 9, 22, tzinfo=timezone.utc),
    disbursement_amount=Decimal("1800000"),
    currency="VND",
    interest_rate_per_year=Decimal("0"),
    duration_months=12,
    loan_type="unsecured",
  )
  db_session.add(loan)
  db_session.commit()

  accepted = auth_client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92711, direction="out"),
    headers=webhook_headers(),
  )
  assert accepted.status_code == 200, accepted.text

  activity = db_session.query(SePayBankActivity).one()
  assert activity.processing_status == "processed"
  assert activity.classification == "loan_repayment"
  assert activity.matched_kind == "loan"
  assert activity.matched_id == loan.id
  assert activity.linked_transaction_id is None
  assert db_session.query(Transaction).count() == 0

  listed = auth_client.get("/api/bank-activities?year=2026&month=10")
  assert listed.status_code == 200, listed.text
  assert listed.json()[0]["classification"] == "loan_repayment"
  assert listed.json()[0]["linkedTransactionId"] is None


def test_webhook_retains_unmatched_account(client: TestClient, db_session: Session, monkeypatch):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")

  response = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(account_number="99999999999"),
    headers=webhook_headers(),
  )

  assert response.status_code == 200, response.text
  activity = db_session.query(SePayBankActivity).one()
  assert activity.user_id is None
  assert activity.financial_account_id is None
  assert activity.processing_status == "unmatched"


def test_webhook_authentication_and_payload_validation(client: TestClient, monkeypatch):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  request = {"json": payload()}

  assert client.post("/api/integrations/sepay/webhook", **request).status_code == 401
  assert client.post(
    "/api/integrations/sepay/webhook",
    headers={"Authorization": "Bearer webhook-test-key"},
    **request,
  ).status_code == 401
  assert client.post(
    "/api/integrations/sepay/webhook",
    headers=webhook_headers("wrong-key"),
    **request,
  ).status_code == 401
  assert client.post(
    "/api/integrations/sepay/webhook",
    headers=webhook_headers(),
    content=b"{not-json",
  ).status_code == 422

  monkeypatch.delenv("SEPAY_WEBHOOK_API_KEY")
  assert client.post(
    "/api/integrations/sepay/webhook",
    json=payload(),
    headers=webhook_headers(),
  ).status_code == 401


def test_webhook_uses_the_matching_accounts_configured_key(
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
  tmp_path,
):
  monkeypatch.delenv("SEPAY_WEBHOOK_API_KEY", raising=False)
  monkeypatch.setenv("SEPAY_CREDENTIAL_KEY_FILE", str(tmp_path / "sepay-credentials.key"))
  account = add_account(db_session, user.id)
  account.webhook_auth_ciphertext = encrypt_api_token("account-webhook-key")
  db_session.commit()

  rejected = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92712),
    headers=webhook_headers("wrong-key"),
  )
  accepted = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92712),
    headers=webhook_headers("account-webhook-key"),
  )
  duplicate = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92712),
    headers=webhook_headers("account-webhook-key"),
  )

  assert rejected.status_code == 401
  assert accepted.status_code == duplicate.status_code == 200
  assert db_session.query(SePayBankActivity).count() == 1
  assert db_session.query(SePayBankActivity).one().financial_account_id == account.id


def test_webhook_verifies_hmac_against_the_raw_request_body(
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_CREDENTIAL_ENCRYPTION_KEY", Fernet.generate_key().decode())
  account = add_account(db_session, user.id)
  account.webhook_auth_type = "hmac_sha256"
  account.webhook_auth_ciphertext = encrypt_api_token("hmac-secret")
  db_session.commit()
  raw_body = json.dumps(payload(transaction_id=92713), separators=(",", ":")).encode()
  timestamp = str(int(time.time()))
  signature = "sha256=" + hmac.new(
    b"hmac-secret", timestamp.encode() + b"." + raw_body, hashlib.sha256
  ).hexdigest()

  accepted = client.post(
    "/api/integrations/sepay/webhook",
    content=raw_body,
    headers={
      "Content-Type": "application/json",
      "X-SePay-Timestamp": timestamp,
      "X-SePay-Signature": signature,
    },
  )
  rejected = client.post(
    "/api/integrations/sepay/webhook",
    content=raw_body,
    headers={"Content-Type": "application/json", "X-SePay-Timestamp": timestamp},
  )

  assert accepted.status_code == 200
  assert rejected.status_code == 401


def test_webhook_accepts_no_authentication_only_when_selected(
  client: TestClient,
  db_session: Session,
  user,
):
  account = add_account(db_session, user.id)
  account.webhook_auth_type = "none"
  db_session.commit()

  accepted = client.post("/api/integrations/sepay/webhook", json=payload(transaction_id=92714))
  assert accepted.status_code == 200


def test_oauth_client_credentials_issue_a_webhook_bearer_token(
  client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_CREDENTIAL_ENCRYPTION_KEY", Fernet.generate_key().decode())
  account = add_account(db_session, user.id)
  account.webhook_auth_type = "oauth2"
  account.webhook_auth_client_id_ciphertext = encrypt_api_token("sepay-client")
  account.webhook_auth_ciphertext = encrypt_api_token("sepay-secret")
  db_session.commit()
  basic = base64.b64encode(b"sepay-client:sepay-secret").decode()

  token = client.post(
    "/api/integrations/sepay/oauth/token",
    data={"grant_type": "client_credentials"},
    headers={"Authorization": f"Basic {basic}"},
  )
  assert token.status_code == 200, token.text
  body = token.json()
  accepted = client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92715),
    headers={"Authorization": f"Bearer {body['access_token']}"},
  )

  assert body["token_type"] == "Bearer"
  assert accepted.status_code == 200


def test_webhook_rejects_invalid_transaction_fields(client: TestClient, monkeypatch):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  invalid = payload()
  invalid["transferAmount"] = 0
  assert client.post(
    "/api/integrations/sepay/webhook",
    json=invalid,
    headers=webhook_headers(),
  ).status_code == 422

  invalid_date = payload(transaction_id=92706)
  invalid_date["transactionDate"] = "not-a-date"
  assert client.post(
    "/api/integrations/sepay/webhook",
    json=invalid_date,
    headers=webhook_headers(),
  ).status_code == 422


def test_authenticated_user_can_review_and_classify_bank_activity(
  auth_client: TestClient,
  db_session: Session,
  user,
  monkeypatch,
):
  monkeypatch.setenv("SEPAY_WEBHOOK_API_KEY", "webhook-test-key")
  add_account(db_session, user.id)

  accepted = auth_client.post(
    "/api/integrations/sepay/webhook",
    json=payload(transaction_id=92707, direction="out"),
    headers=webhook_headers(),
  )
  assert accepted.status_code == 200, accepted.text

  listed = auth_client.get("/api/bank-activities?year=2026&month=10")
  assert listed.status_code == 200, listed.text
  activity = listed.json()[0]
  categories = auth_client.get("/api/categories?type=expense")
  assert categories.status_code == 200, categories.text
  category_id = next(category["id"] for category in categories.json() if category["name"] == "Food")

  classified = auth_client.patch(
    f"/api/bank-activities/{activity['id']}",
    json={"classification": "expense", "categoryId": category_id},
  )
  assert classified.status_code == 200, classified.text
  assert classified.json()["processingStatus"] == "processed"
  assert classified.json()["categoryId"] == category_id
  assert db_session.query(Transaction).filter(Transaction.source == "sepay").count() == 1

  duplicate_review = auth_client.patch(
    f"/api/bank-activities/{activity['id']}",
    json={"classification": "expense", "categoryId": category_id},
  )
  assert duplicate_review.status_code == 200, duplicate_review.text
  assert db_session.query(Transaction).filter(Transaction.source == "sepay").count() == 1
