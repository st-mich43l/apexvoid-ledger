from __future__ import annotations

import hashlib
import hmac
import os
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken


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
  bank_account_id: str | None = None


@dataclass(frozen=True)
class SePayAccountReference:
  external_account_id: str
  account_number: str
  bank_name: str
  active: bool | None


@dataclass(frozen=True)
class SePayAccountDetails:
  external_account_id: str
  bank_name: str
  account_number_masked: str
  account_name: str | None
  balance: Decimal
  last_transaction_at: datetime | None


def _credential_fernet() -> Fernet:
  # Compatibility for installations that already encrypted credentials with
  # an explicit key. New installations use the backend-managed key file below.
  configured_key = os.getenv("SEPAY_CREDENTIAL_ENCRYPTION_KEY", "").strip()
  if configured_key:
    try:
      return Fernet(configured_key.encode("ascii"))
    except (ValueError, TypeError) as error:
      raise SePayConfigurationError("SePay credential encryption is invalid") from error

  path = Path(
    os.getenv("SEPAY_CREDENTIAL_KEY_FILE", "/var/lib/apexvoid-ledger/sepay-credentials.key")
  )
  try:
    key = path.read_text(encoding="ascii").strip()
  except FileNotFoundError:
    try:
      path.parent.mkdir(parents=True, exist_ok=True)
      generated_key = Fernet.generate_key().decode("ascii")
      try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
      except FileExistsError:
        key = path.read_text(encoding="ascii").strip()
      else:
        with os.fdopen(descriptor, "w", encoding="ascii") as key_file:
          key_file.write(generated_key)
        key = generated_key
    except OSError as error:
      raise SePayConfigurationError("Server credential encryption is unavailable") from error
  try:
    return Fernet(key.encode("ascii"))
  except (ValueError, TypeError) as error:
    raise SePayConfigurationError("Server credential encryption is invalid") from error


def encrypt_api_token(api_token: str) -> str:
  token = api_token.strip()
  if not token:
    raise SePayConfigurationError("SePay API token is empty")
  return _credential_fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_api_token(ciphertext: str) -> str:
  try:
    token = _credential_fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8").strip()
  except (InvalidToken, UnicodeDecodeError, ValueError, TypeError) as error:
    raise SePayConfigurationError("Stored SePay credentials are invalid") from error
  if not token:
    raise SePayConfigurationError("Stored SePay credentials are empty")
  return token


def normalize_account_number(value: str) -> str:
  normalized = "".join(value.split()).replace("-", "")
  if not normalized or not normalized.isdigit():
    raise SePayError("Bank account number is invalid", kind="validation", status_code=422)
  return normalized


def account_number_fingerprint(value: str) -> str:
  """Return a keyed, non-reversible identity for a normalized bank number."""
  key = os.getenv("SEPAY_ACCOUNT_FINGERPRINT_KEY", "").strip() or os.getenv("SECRET_KEY", "").strip()
  if not key:
    raise SePayConfigurationError("SePay account fingerprinting is not configured")
  return hmac.new(
    key.encode("utf-8"),
    normalize_account_number(value).encode("utf-8"),
    hashlib.sha256,
  ).hexdigest()


def _mask_account_number(value: str) -> str:
  compact = normalize_account_number(value)
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


def _parse_active(value: Any) -> bool | None:
  if value is None:
    return None
  if value is True or value == 1 or value == "1":
    return True
  if value is False or value == 0 or value == "0":
    return False
  raise SePayError("SePay returned an invalid response", kind="invalid_response")


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

  def _get_json(self, path: str) -> dict[str, Any]:
    try:
      response = self._client.get(
        f"{self._base_url}/{path.lstrip('/')}",
        headers={
          "Authorization": f"Bearer {self._config.api_token}",
          "Content-Type": "application/json",
        },
      )
    except httpx.TimeoutException as error:
      raise SePayError(
        "SePay is temporarily unavailable", kind="timeout", status_code=503
      ) from error
    except httpx.HTTPError as error:
      raise SePayError(
        "SePay is temporarily unavailable", kind="network", status_code=503
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
    if not isinstance(payload, dict):
      raise SePayError("SePay returned an invalid response", kind="invalid_response")
    return payload

  def list_accounts(self) -> list[SePayAccountReference]:
    payload = self._get_json("bankaccounts/list")
    raw_accounts = payload.get("bankaccounts")
    if not isinstance(raw_accounts, list):
      raise SePayError("SePay returned an invalid response", kind="invalid_response")

    accounts: list[SePayAccountReference] = []
    for raw_account in raw_accounts:
      if not isinstance(raw_account, dict):
        raise SePayError("SePay returned an invalid response", kind="invalid_response")
      raw_id = raw_account.get("id")
      raw_number = raw_account.get("account_number")
      if raw_id is None or not str(raw_id).isdigit() or not isinstance(raw_number, str):
        raise SePayError("SePay returned an invalid account", kind="invalid_response")
      bank_name = raw_account.get("bank_full_name") or raw_account.get("bank_short_name")
      if not isinstance(bank_name, str) or not bank_name.strip():
        bank_name = "SePay bank account"
      accounts.append(
        SePayAccountReference(
          external_account_id=str(raw_id),
          account_number=normalize_account_number(raw_number),
          bank_name=bank_name.strip()[:100],
          active=_parse_active(raw_account.get("active")),
        )
      )
    return accounts

  def find_account(self, account_number: str) -> SePayAccountReference:
    normalized = normalize_account_number(account_number)
    matches = [account for account in self.list_accounts() if account.account_number == normalized]
    if not matches:
      raise SePayError("The SePay bank account was not found", kind="not_found", status_code=404)
    if len(matches) > 1:
      raise SePayError("The SePay bank account is ambiguous", kind="invalid_response")
    if matches[0].active is False:
      raise SePayError("The SePay bank account is inactive", kind="inactive", status_code=503)
    return matches[0]

  def get_account_details(self) -> SePayAccountDetails:
    if not self._config.bank_account_id:
      raise SePayConfigurationError("SePay bank account is not selected")
    payload = self._get_json(f"bankaccounts/details/{self._config.bank_account_id}")
    if not isinstance(payload.get("bankaccount"), dict):
      raise SePayError("SePay returned an invalid response", kind="invalid_response")
    bank_account = payload["bankaccount"]

    raw_id = bank_account.get("id")
    if str(raw_id) != self._config.bank_account_id:
      raise SePayError("SePay returned an invalid account", kind="invalid_response")

    raw_balance = bank_account.get("accumulated")
    try:
      balance = Decimal(str(raw_balance))
    except (InvalidOperation, TypeError, ValueError) as error:
      raise SePayError("SePay returned an invalid balance", kind="invalid_response") from error
    if not balance.is_finite() or abs(balance) >= Decimal("10000000000000000"):
      raise SePayError("SePay returned an invalid balance", kind="invalid_response")

    if _parse_active(bank_account.get("active")) is False:
      raise SePayError("The SePay bank account is inactive", kind="inactive", status_code=503)

    raw_account_number = bank_account.get("account_number")
    if not isinstance(raw_account_number, str):
      raise SePayError("SePay returned an invalid account", kind="invalid_response")
    bank_name = bank_account.get("bank_full_name") or bank_account.get("bank_short_name")
    if not isinstance(bank_name, str) or not bank_name.strip():
      bank_name = "SePay bank account"
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
