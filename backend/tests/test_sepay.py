from datetime import datetime, timezone
from decimal import Decimal

import httpx
import pytest

from cryptography.fernet import Fernet

from app.sepay import SePayClient, SePayConfig, SePayError, decrypt_api_token, encrypt_api_token


def _config() -> SePayConfig:
  return SePayConfig("test-token", "42")


def test_parses_decimal_zero_and_masks_account_number():
  client = httpx.Client(
    transport=httpx.MockTransport(
      lambda request: httpx.Response(
        200,
        json={
          "bankaccount": {
            "id": 42,
            "bank_short_name": "TPB",
            "bank_full_name": "Tien Phong Commercial Joint Stock Bank",
            "account_number": "0123456789",
            "account_holder_name": "ALICE",
            "accumulated": "0",
            "active": "1",
            "last_transaction": {"transaction_date": "2026-10-22T01:02:03Z"},
          }
        },
      )
    )
  )
  result = SePayClient(_config(), client=client).get_account_details()
  assert result.balance == Decimal("0")
  assert result.account_number_masked == "••••6789"
  assert result.last_transaction_at == datetime(2026, 10, 22, 1, 2, 3, tzinfo=timezone.utc)


def test_lists_accounts_and_resolves_bank_account_number():
  client = httpx.Client(
    transport=httpx.MockTransport(
      lambda request: httpx.Response(
        200,
        json={
          "bankaccounts": [
            {"id": "92484", "account_number": "10937375404", "bank_short_name": "TPB", "active": "1"},
          ]
        },
      )
    )
  )
  result = SePayClient(SePayConfig("test-token"), client=client).find_account("10 937 375 404")
  assert result.external_account_id == "92484"
  assert result.account_number == "10937375404"


@pytest.mark.parametrize(
  "response",
  [
    httpx.Response(200, json={"bankaccount": {"id": 42, "accumulated": "NaN", "account_number": "1234"}}),
    httpx.Response(200, json={"bankaccount": {"id": 42, "accumulated": "Infinity", "account_number": "1234"}}),
    httpx.Response(200, json={"unexpected": True}),
  ],
)
def test_rejects_invalid_provider_responses(response: httpx.Response):
  client = httpx.Client(transport=httpx.MockTransport(lambda _request: response))
  with pytest.raises(SePayError, match="invalid"):
    SePayClient(_config(), client=client).get_account_details()


@pytest.mark.parametrize(
  ("status", "kind"),
  [(401, "authentication"), (429, "rate_limit")],
)
def test_maps_authentication_and_rate_limit_errors(status: int, kind: str):
  client = httpx.Client(
    transport=httpx.MockTransport(lambda _request: httpx.Response(status, headers={"Retry-After": "60"}))
  )
  with pytest.raises(SePayError) as raised:
    SePayClient(_config(), client=client).get_account_details()
  assert raised.value.kind == kind
  assert "token" not in str(raised.value).lower()


def test_maps_timeout_without_exposing_credentials():
  def timeout(_request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout("timed out")

  client = httpx.Client(transport=httpx.MockTransport(timeout))
  with pytest.raises(SePayError) as raised:
    SePayClient(_config(), client=client).get_account_details()
  assert raised.value.kind == "timeout"
  assert raised.value.status_code == 503


def test_encrypts_and_decrypts_tokens(monkeypatch):
  monkeypatch.setenv("SEPAY_CREDENTIAL_ENCRYPTION_KEY", Fernet.generate_key().decode())
  ciphertext = encrypt_api_token("test-token")
  assert ciphertext != "test-token"
  assert decrypt_api_token(ciphertext) == "test-token"
