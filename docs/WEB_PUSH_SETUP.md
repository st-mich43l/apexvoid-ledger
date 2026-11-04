# Web Push setup (draft)

This feature is under development in PR #61. Do not enable it in production until
the unresolved items below are completed and real browser delivery is verified.

## Architecture

The existing FastAPI application authenticates users and writes an inbox entry
and one PostgreSQL outbox row per enabled device in the same transaction as a
new SePay event. A separate Go worker claims deliveries with PostgreSQL row
locks, encrypts Web Push messages, and sends them to the browser's push service.
Service-worker notifications use generic text. A successful push-service
response is recorded as `accepted`, not as confirmed device delivery.

## Local configuration

Generate a persistent VAPID key pair once from `push-worker` with
`go run . --generate-vapid`. Store both values in an approved secret store; do
not commit, log, or regenerate the private key during deployment. Generate a
separate 32-byte URL-safe base64 key for `PUSH_SUBSCRIPTION_KEY`, for example
with Python's `secrets.token_urlsafe(32)`. Keep this key stable: losing or
changing it makes stored device subscriptions unreadable.

Configure these environment variables for the backend and worker:

| Variable | Backend | Worker | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Yes | PostgreSQL connection. |
| `VAPID_PUBLIC_KEY` | Yes | Yes | Public application-server key. |
| `VAPID_PRIVATE_KEY` | No | Yes | Private VAPID signing key. |
| `VAPID_SUBJECT` | No | Yes | Contact URI, such as a `mailto:` address. |
| `PUSH_SUBSCRIPTION_KEY` | Yes | Yes | Shared 32-byte encryption key for subscription material. |

Apply Alembic migrations before starting the worker. For local Compose, enable
the optional worker with `docker compose --profile push up --build`. The worker
needs outbound HTTPS access on port 443 to browser push services; endpoints are
validated and private addresses are rejected. Web Push requires HTTPS, except
that browsers normally treat `localhost` as a secure development context.

The production Compose template only enables the worker when all four push
secrets exist in the deployment vault. This change does not provision secrets or
deploy the application.

## Current verification and limitations

The implementation has not yet demonstrated real Web Push delivery to a
browser. Budget thresholds, scheduled payment reminders, monthly summaries,
and comprehensive device/account-switching behavior are not complete. In
particular, revocation after an expired session and delivery under multiple
browser accounts need further design and testing. Worker integration tests use
a simulated push-service response and are not evidence of device delivery.
An attempted Chromium subscription in this environment failed with
`AbortError: Registration failed - permission denied` even after the test
context was granted notifications permission. Device/browser compatibility
remains unverified.
