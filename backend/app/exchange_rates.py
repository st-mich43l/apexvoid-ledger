from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

import httpx


class ExchangeRateProviderError(RuntimeError):
  pass


@dataclass(frozen=True)
class ExchangeRateQuote:
  source_currency: str
  target_currency: str
  rate: Decimal
  rate_date: date


class FrankfurterExchangeRateProvider:
  provider_name = "Frankfurter"
  provider_url = "https://frankfurter.dev"

  def __init__(self, client: httpx.Client | None = None) -> None:
    self._base_url = os.getenv(
      "EXCHANGE_RATE_API_URL", "https://api.frankfurter.dev/v2"
    ).rstrip("/")
    self._client = client or httpx.Client(timeout=5.0)
    self._cache: dict[
      tuple[str, str, date, date], tuple[float, tuple[ExchangeRateQuote, ...]]
    ] = {}
    self._failure_cache: dict[tuple[str, str, date, date], float] = {}
    self._cache_lock = threading.Lock()

  def get_rates(
    self,
    source_currency: str,
    target_currency: str,
    start_date: date,
    end_date: date,
  ) -> list[ExchangeRateQuote]:
    if source_currency == target_currency:
      return [
        ExchangeRateQuote(
          source_currency=source_currency,
          target_currency=target_currency,
          rate=Decimal(1),
          rate_date=start_date,
        )
      ]

    cache_key = (source_currency, target_currency, start_date, end_date)
    now = time.monotonic()
    with self._cache_lock:
      cached = self._cache.get(cache_key)
      if cached is not None and cached[0] > now:
        return list(cached[1])
      if self._failure_cache.get(cache_key, 0) > now:
        raise ExchangeRateProviderError(
          "Exchange-rate provider is temporarily unavailable"
        )

    try:
      rates = self._fetch_rates(
        source_currency, target_currency, start_date, end_date
      )
    except ExchangeRateProviderError:
      # Avoid making every dashboard render wait on the same upstream
      # outage. Native-currency totals continue to work during this
      # short circuit-breaker window.
      with self._cache_lock:
        self._failure_cache[cache_key] = now + 300
      raise
    # Some official feeds round very small direct quotes aggressively
    # (for example VND→USD). The reverse quote (USD→VND) retains materially
    # more precision, so invert that series when the direct pair is tiny.
    if rates and max(quote.rate for quote in rates) < Decimal("0.01"):
      try:
        reverse_rates = self._fetch_rates(
          target_currency, source_currency, start_date, end_date
        )
      except ExchangeRateProviderError:
        pass
      else:
        rates = [
          ExchangeRateQuote(
            source_currency=source_currency,
            target_currency=target_currency,
            rate=Decimal(1) / quote.rate,
            rate_date=quote.rate_date,
          )
          for quote in reverse_rates
        ]
    # Historical reference data changes rarely; current/future ranges can
    # receive a newer published rate, so refresh those more often.
    ttl_seconds = 3600 if end_date >= date.today() else 86400
    with self._cache_lock:
      self._cache[cache_key] = (now + ttl_seconds, tuple(rates))
      self._failure_cache.pop(cache_key, None)
    return rates

  def _fetch_rates(
    self,
    source_currency: str,
    target_currency: str,
    start_date: date,
    end_date: date,
  ) -> list[ExchangeRateQuote]:
    try:
      response = self._client.get(
        f"{self._base_url}/rates",
        params={
          "from": start_date.isoformat(),
          "to": end_date.isoformat(),
          "base": source_currency,
          "quotes": target_currency,
        },
      )
      response.raise_for_status()
      payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
      raise ExchangeRateProviderError("Exchange-rate provider is unavailable") from error

    if not isinstance(payload, list):
      raise ExchangeRateProviderError("Exchange-rate provider returned an invalid response")

    rates: list[ExchangeRateQuote] = []
    for item in payload:
      if not isinstance(item, dict):
        continue
      if (
        item.get("base") != source_currency
        or item.get("quote") != target_currency
      ):
        continue
      try:
        rate = Decimal(str(item["rate"]))
        rate_date = date.fromisoformat(str(item["date"]))
      except (KeyError, InvalidOperation, ValueError):
        continue
      if rate <= 0:
        continue
      rates.append(
        ExchangeRateQuote(
          source_currency=source_currency,
          target_currency=target_currency,
          rate=rate,
          rate_date=rate_date,
        )
      )

    rates.sort(key=lambda quote: quote.rate_date)
    if not rates:
      raise ExchangeRateProviderError(
        "No exchange rate is available for this period"
      )
    return rates


_exchange_rate_provider = FrankfurterExchangeRateProvider()


def get_exchange_rate_provider() -> FrankfurterExchangeRateProvider:
  return _exchange_rate_provider


def quote_for_date(
  rates: list[ExchangeRateQuote], transaction_date: date
) -> ExchangeRateQuote | None:
  eligible = [quote for quote in rates if quote.rate_date <= transaction_date]
  return eligible[-1] if eligible else None
