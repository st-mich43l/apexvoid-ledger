from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import FinancialAccount, Loan
from cryptography.fernet import Fernet

from app.net_worth import build_net_worth, connect_sepay_account, sync_account
from app.routers.net_worth import get_summary
from app.sepay import SePayAccountDetails, SePayAccountReference, SePayError


class FakeSePayClient:
  details = SePayAccountDetails(
    external_account_id="42",
    bank_name="TPBank",
    account_number_masked="••••6789",
    account_name="ALICE",
    balance=Decimal("2500000"),
    last_transaction_at=None,
  )
  failure: SePayError | None = None

  def __init__(self, _config):
    pass

  def find_account(self, _account_number):
    return SePayAccountReference("42", "1234", "TPBank", True)

  def get_account_details(self):
    if self.failure:
      raise self.failure
    return self.details

  def close(self):
    pass


def _configure(monkeypatch, user):
  FakeSePayClient.failure = None
  monkeypatch.setenv("SEPAY_CREDENTIAL_ENCRYPTION_KEY", Fernet.generate_key().decode())


def test_sync_updates_owned_account_and_net_worth(db_session, user, monkeypatch):
  user.preferred_currency = "VND"
  db_session.commit()
  _configure(monkeypatch, user)
  monkeypatch.setattr("app.net_worth.SePayClient", FakeSePayClient)
  account = connect_sepay_account(db_session, user, api_token="token", account_number="1234")
  assert account is not None
  sync_account(db_session, account)
  result = build_net_worth(db_session, user, [account])
  assert account.balance == Decimal("2500000.00")
  assert account.balance_status == "verified"
  assert result.valuation_complete is True
  assert result.total_assets == Decimal("2500000.00")
  assert result.net_worth == Decimal("2500000.00")


def test_provider_failure_preserves_last_valid_balance_and_marks_stale(
  db_session, user, monkeypatch
):
  _configure(monkeypatch, user)
  monkeypatch.setattr("app.net_worth.SePayClient", FakeSePayClient)
  account = connect_sepay_account(db_session, user, api_token="token", account_number="1234")
  assert account is not None
  sync_account(db_session, account)
  account.last_sync_attempt_at = datetime.now(timezone.utc) - timedelta(minutes=10)
  db_session.commit()

  FakeSePayClient.failure = SePayError("SePay is temporarily unavailable", kind="timeout", status_code=503)
  try:
    sync_account(db_session, account, force=True)
  except SePayError:
    pass
  db_session.refresh(account)
  assert account.balance == Decimal("2500000.00")
  assert account.balance_status == "stale"
  assert account.last_sync_error == "SePay is temporarily unavailable"


def test_user_ownership_isolation(db_session, user, other_user, monkeypatch):
  _configure(monkeypatch, user)
  monkeypatch.setattr("app.net_worth.SePayClient", FakeSePayClient)
  account = connect_sepay_account(db_session, user, api_token="token", account_number="1234")
  assert account is not None
  assert db_session.query(FinancialAccount).filter(FinancialAccount.user_id == other_user.id).count() == 0
  other_result = build_net_worth(db_session, other_user, [])
  assert other_result.asset_breakdown == []
  assert other_result.net_worth is None


def test_loan_liabilities_use_existing_calculation_and_do_not_count_saving_pot(
  db_session, user, monkeypatch
):
  user.preferred_currency = "VND"
  loan = Loan(
    user_id=user.id,
    bank_name="Test Bank",
    open_date=datetime.now(timezone.utc) - timedelta(days=30),
    disbursement_amount=Decimal("1000000"),
    currency="VND",
    interest_rate_per_year=Decimal("0"),
    duration_months=12,
    loan_type="unsecured",
  )
  db_session.add(loan)
  db_session.commit()
  result = build_net_worth(db_session, user, [])
  assert len(result.liability_breakdown) == 1
  assert result.liability_breakdown[0]["amount"] > 0
  assert all(line["type"] != "saving_pot" for line in result.asset_breakdown)


def test_summary_route_serializes_owned_data_without_provider_secrets(
  db_session, user, monkeypatch
):
  user.preferred_currency = "VND"
  db_session.commit()
  _configure(monkeypatch, user)
  monkeypatch.setattr("app.net_worth.SePayClient", FakeSePayClient)
  account = connect_sepay_account(db_session, user, api_token="token", account_number="1234")
  assert account is not None
  sync_account(db_session, account)

  response = get_summary(db_session, user)
  assert response.total_assets == 2500000
  assert response.asset_breakdown[0].amount == 2500000
  assert "SEPAY_API_TOKEN" not in str(response.model_dump())
