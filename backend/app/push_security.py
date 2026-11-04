"""Push subscription storage and endpoint validation shared by the API and worker."""
import base64
import hashlib
import json
import os
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException


def endpoint_hash(endpoint: str) -> str:
  return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()


def validate_endpoint(endpoint: str) -> str:
  try:
    parsed = urlsplit(endpoint)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment or parsed.port not in (None, 443) or len(endpoint) > 2048:
      raise ValueError("invalid endpoint")
  except ValueError as error:
    raise HTTPException(status_code=422, detail="Invalid push endpoint") from error
  return endpoint


def encryption_key() -> bytes:
  value = os.getenv("PUSH_SUBSCRIPTION_KEY", "").strip()
  try:
    key = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    if len(key) != 32:
      raise ValueError("invalid key length")
    return key
  except (ValueError, TypeError) as error:
    raise HTTPException(status_code=503, detail="Push subscription encryption is not configured") from error


def encrypt_material(endpoint: str, p256dh: str, auth: str) -> str:
  key = encryption_key()
  nonce = os.urandom(12)
  plaintext = json.dumps({"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}, separators=(",", ":")).encode("utf-8")
  return base64.urlsafe_b64encode(nonce + AESGCM(key).encrypt(nonce, plaintext, None)).decode("ascii")
