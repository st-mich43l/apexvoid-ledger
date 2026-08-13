from datetime import date
from decimal import Decimal

import httpx
import pytest

from app.exchange_rates import ExchangeRateProviderError, FrankfurterExchangeRateProvider


def test_parses_and_caches_historical_rates():
  requests: list[httpx.Request] = []

  def handler(request: httpx.Request) -> httpx.Response:
    requests.append(request)
    return httpx.Response(
      200,
      json=[
        {"date": "2026-08-04", "base": "USD", "quote": "VND", "rate": 26209},
        {"date": "2026-08-05", "base": "USD", "quote": "VND", "rate": 26203},
      ],
    )

  client = httpx.Client(transport=httpx.MockTransport(handler))
  provider = FrankfurterExchangeRateProvider(client=client)
  first = provider.get_rates("USD", "VND", date(2026, 8, 1), date(2026, 8, 31))
  second = provider.get_rates("USD", "VND", date(2026, 8, 1), date(2026, 8, 31))

  assert first == second
  assert len(requests) == 1
  assert first[1].rate == Decimal("26203")
  assert first[1].rate_date == date(2026, 8, 5)
  assert requests[0].url.params["base"] == "USD"
  assert requests[0].url.params["quotes"] == "VND"


def test_inverts_reverse_pair_when_direct_quote_is_too_coarse():
  requested_bases: list[str] = []

  def handler(request: httpx.Request) -> httpx.Response:
    base = request.url.params["base"]
    quote = request.url.params["quotes"]
    requested_bases.append(base)
    rate = 0.000038 if base == "VND" else 26203
    return httpx.Response(
      200,
      json=[{"date": "2026-08-05", "base": base, "quote": quote, "rate": rate}],
    )

  client = httpx.Client(transport=httpx.MockTransport(handler))
  provider = FrankfurterExchangeRateProvider(client=client)
  rates = provider.get_rates("VND", "USD", date(2026, 8, 1), date(2026, 8, 31))

  assert requested_bases == ["VND", "USD"]
  assert rates[0].source_currency == "VND"
  assert rates[0].target_currency == "USD"
  assert rates[0].rate == Decimal(1) / Decimal(26203)


@pytest.mark.parametrize(
  "response",
  [httpx.Response(503), httpx.Response(200, json={"unexpected": True})],
)
def test_provider_failures_are_explicit(response: httpx.Response):
  client = httpx.Client(transport=httpx.MockTransport(lambda _request: response))
  provider = FrankfurterExchangeRateProvider(client=client)
  with pytest.raises(ExchangeRateProviderError):
    provider.get_rates("USD", "VND", date(2026, 8, 1), date(2026, 8, 31))


def test_provider_failure_is_short_circuited_temporarily():
  request_count = 0

  def unavailable(_request: httpx.Request) -> httpx.Response:
    nonlocal request_count
    request_count += 1
    return httpx.Response(503)

  client = httpx.Client(transport=httpx.MockTransport(unavailable))
  provider = FrankfurterExchangeRateProvider(client=client)
  for _attempt in range(2):
    with pytest.raises(ExchangeRateProviderError):
      provider.get_rates("USD", "VND", date(2026, 8, 1), date(2026, 8, 31))
  assert request_count == 1
