from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx


class SePayError(RuntimeError):
  """A safe, user-facing provider error with no upstream response leakage."""

  def __init__(
    self,
    public_message: str,
    *,
    kind: str,
    status_code: int = 502,
    retry_after: int | None = None,
  ) -> None:
    super().__init__(public_message)
    self.public_message = public_message
    self.kind = kind
    self.status_code = status_code
    self.retry_after = retry_after


class SePayConfigurationError(SePayError):
  def __init__(self, message: str = "SePay integration is not configured") -> None:
    super().__init__(message, kind="configuration", status_code=503)


@dataclass(frozen=True)
class SePayConfig:
  api_token: str
  bank_account_id: str
  ledger_user_id: str


@dataclass(frozen=True)
class SePayAccountDetails:
  external_account_id: str
  bank_name: str
  account_number_masked: str
  account_name: str | None
  balance: Decimal
  last_transaction_at: datetime | None


def get_sepay_config() -> SePayConfig | None:
  token = os.getenv("SEPAY_API_TOKEN", "").strip()
  account_id = os.getenv("SEPAY_BANK_ACCOUNT_ID", "").strip()
  ledger_user_id = os.getenv("SEPAY_LEDGER_USER_ID", "").strip()

  if not token and not account_id and not ledger_user_id:
    return None
  if not token or not account_id or not ledger_user_id:
    raise SePayConfigurationError("SePay integration configuration is incomplete")
  if not account_id.isdigit() or int(account_id) <= 0:
    raise SePayConfigurationError("SePay bank account configuration is invalid")
  return SePayConfig(token, account_id, ledger_user_id)


def _mask_account_number(value: str) -> str:
  compact = "".join(value.split())
  if not compact:
    raise SePayError("SePay returned an invalid account number", kind="invalid_response")
  return f"••••{compact[-4:]}"


def _parse_datetime(value: Any) -> datetime | None:
  if value is None:
    return None
  if isinstance(value, dict):
    for key in ("transaction_date", "transactionDate", "created_at", "createdAt", "date"):
      if key in value:
        return _parse_datetime(value[key])
    return None
  if not isinstance(value, str):
    return None
  text = value.strip()
  if not text:
    return None
  try:
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
  except ValueError:
    return None
  if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
  return parsed.astimezone(timezone.utc)


class SePayClient:
  def __init__(
    self,
    config: SePayConfig,
    client: httpx.Client | None = None,
  ) -> None:
    self._config = config
    self._base_url = os.getenv(
      "SEPAY_API_BASE_URL", "https://my.sepay.vn/userapi"
    ).rstrip("/")
    self._client = client or httpx.Client(
      timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
    )
    self._owns_client = client is None

  def close(self) -> None:
    if self._owns_client:
      self._client.close()

  def get_account_details(self) -> SePayAccountDetails:
    try:
      response = self._client.get(
        f"{self._base_url}/bankaccounts/details/{self._config.bank_account_id}",
        headers={"Authorization": f"Bearer {self._config.api_token}"},
      )
    except httpx.TimeoutException as error:
      raise SePayError(
        "SePay is temporarily unavailable",
        kind="timeout",
        status_code=503,
      ) from error
    except httpx.HTTPError as error:
      raise SePayError(
        "SePay is temporarily unavailable",
        kind="network",
        status_code=503,
      ) from error

    if response.status_code == 401:
      raise SePayError("Invalid SePay credentials", kind="authentication", status_code=502)
    if response.status_code == 429:
      retry_after = response.headers.get("Retry-After")
      try:
        retry_seconds = max(60, int(retry_after)) if retry_after else 300
      except ValueError:
        retry_seconds = 300
      raise SePayError(
        "SePay rate limit reached",
        kind="rate_limit",
        status_code=429,
        retry_after=retry_seconds,
      )
    if response.status_code >= 400:
      raise SePayError("SePay is temporarily unavailable", kind="http_error", status_code=502)

    try:
      payload = response.json()
    except ValueError as error:
      raise SePayError(
        "SePay returned an invalid response", kind="invalid_response"
      ) from error

    if not isinstance(payload, dict) or not isinstance(payload.get("bankaccount"), dict):
      raise SePayError("SePay returned an invalid response", kind="invalid_response")
    bank_account = payload["bankaccount"]

    raw_id = bank_account.get("id")
    if str(raw_id) != self._config.bank_account_id:
      raise SePayError("SePay returned an invalid account", kind="invalid_response")

    raw_balance = bank_account.get("accumulated")
    try:
      balance = Decimal(str(raw_balance))
    except (InvalidOperation, TypeError, ValueError) as error:
      raise SePayError(
        "SePay returned an invalid balance", kind="invalid_response"
      ) from error
    if not balance.is_finite() or abs(balance) >= Decimal("10000000000000000"):
      raise SePayError("SePay returned an invalid balance", kind="invalid_response")

    active = bank_account.get("active")
    if active is False:
      raise SePayError("The SePay bank account is inactive", kind="inactive", status_code=503)
    if active is not None and not isinstance(active, bool):
      raise SePayError("SePay returned an invalid response", kind="invalid_response")

    raw_account_number = bank_account.get("account_number")
    if not isinstance(raw_account_number, str):
      raise SePayError("SePay returned an invalid account", kind="invalid_response")

    bank_name = bank_account.get("bank_full_name") or bank_account.get("bank_short_name")
    if not isinstance(bank_name, str) or not bank_name.strip():
      bank_name = "TPBank"
    account_name = bank_account.get("account_holder_name")
    if not isinstance(account_name, str):
      account_name = None

    return SePayAccountDetails(
      external_account_id=self._config.bank_account_id,
      bank_name=bank_name.strip()[:100],
      account_number_masked=_mask_account_number(raw_account_number),
      account_name=account_name.strip()[:160] if account_name else None,
      balance=balance,
      last_transaction_at=_parse_datetime(bank_account.get("last_transaction")),
    )
