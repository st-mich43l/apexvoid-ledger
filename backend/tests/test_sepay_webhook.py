from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models import FinancialAccount, SePayBankActivity, Transaction
from app.sepay import account_number_fingerprint


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
