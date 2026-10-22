from datetime import datetime, timezone
from decimal import Decimal

import httpx
import pytest

from app.sepay import SePayClient, SePayConfig, SePayError, get_sepay_config


def _config() -> SePayConfig:
  return SePayConfig("test-token", "42", "user-1")


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
            "active": True,
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


def test_missing_configuration_is_distinguished_from_unconfigured_environment(monkeypatch):
  for name in ("SEPAY_API_TOKEN", "SEPAY_BANK_ACCOUNT_ID", "SEPAY_LEDGER_USER_ID"):
    monkeypatch.delenv(name, raising=False)
  assert get_sepay_config() is None
  monkeypatch.setenv("SEPAY_API_TOKEN", "token")
  with pytest.raises(SePayError, match="incomplete"):
    get_sepay_config()
