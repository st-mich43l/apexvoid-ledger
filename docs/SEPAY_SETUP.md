# SePay integration setup

This document describes the SePay integration in ApexVoid Ledger v0.5.0 and
later. The integration is per user: every Ledger user connects their own SePay
API token and bank account from the Net Worth page.

For the broader application architecture and deployment diagrams, see
[ARCHITECTURE.md](ARCHITECTURE.md).

Ledger reads the selected bank account balance and receives SePay bank-activity
webhooks. It does not initiate transfers or ask for online-banking passwords or
OTPs. Webhook events are stored once, matched to the owning account, and shown
in Cash Flow for reconciliation.

## Five-minute quick start

You need Docker Compose, a SePay API token, and the visible bank account
number. The SePay token belongs in the application form, not in `.env`.

### 1. Create the local environment file

From the repository root, create `.env` with these values:

```dotenv
DATABASE_URL=postgresql://ledger:ledger@postgres:5432/apexvoid_ledger?schema=public
PORT=4000
SECRET_KEY=paste-a-random-session-secret-here
SESSION_COOKIE_SECURE=false
SEPAY_CREDENTIAL_ENCRYPTION_KEY=paste-a-fernet-key-here
SEPAY_WEBHOOK_API_KEY=paste-the-key-configured-in-sepay-here
```

Generate the two secret values with:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Paste the first output into `SECRET_KEY` and the second output into
`SEPAY_CREDENTIAL_ENCRYPTION_KEY`. Then protect the file:

```bash
chmod 600 .env
```

The Fernet key is a deployment key, not a user password. Generate it once and
keep it unchanged for the lifetime of the database.

### 2. Start the local application

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/api/health
```

The last command should return:

```json
{"ok":true}
```

Open [http://localhost:8080](http://localhost:8080) in a browser. On a brand
new database, sign in with `admin` / `admin`, then immediately choose a new
password and currency. If `.data/postgres` already exists, use the existing
local password; the default account is not recreated.

### 3. Create or obtain a SePay API token

In SePay, open the API-token area, create a token with access to the bank
account API, and copy it. Keep the token private. You need:

- the API token;
- the visible bank account number; and
- an active SePay bank account associated with that token.

Do not look up or manually enter SePay's internal numeric account ID. Ledger
finds that ID from the account number.

### 4. Connect the account in Ledger

After signing in:

1. Open **Net Worth** or go directly to `/net-worth`.
2. Paste the SePay API token into the API-token field.
3. Enter the bank account number. Spaces and hyphens are accepted.
4. Select **Connect account**.
5. Confirm that the account appears with a masked number and verified balance.

The browser sends the token only during connection. The backend validates it,
encrypts it, and stores it against the signed-in Ledger user. The token is not
shown again in the UI or API responses.

### 5. Configure the SePay webhook

The production endpoint is:

```text
POST https://ledger.apexvoid.net/api/integrations/sepay/webhook
```

Configure SePay for JSON, both incoming and outgoing transaction events, and
API-key authentication:

```http
Authorization: Apikey <the-same-value-as-SEPAY_WEBHOOK_API_KEY>
```

`SEPAY_WEBHOOK_API_KEY` authenticates inbound webhook requests. It is separate
from each user's encrypted outbound SePay API token. Never enter this webhook
key in the Net Worth form or commit it to Git. The endpoint does not require a
Ledger login session.

### 6. Refresh or disconnect later

Use **Refresh** on the account card to request a current balance. Use
**Disconnect** to remove the account and its encrypted token from Ledger. A
normal automatic refresh is limited to once every five minutes per account.

### 7. Stop the local application

```bash
docker compose down
```

This stops the containers but keeps local PostgreSQL data in `.data/postgres`.
Do not remove that directory unless you intentionally want to destroy the local
database and start over.

## Architecture

The connection flow is:

1. A signed-in user opens `/net-worth` and submits a SePay API token plus bank
   account number.
2. Ledger calls SePay's account-list endpoint and finds the matching account
   number.
3. Ledger obtains SePay's internal bank-account ID from that response.
4. Ledger calls the account-details endpoint to validate the account and read
   its balance.
5. Ledger stores the account for the current user, stores a keyed fingerprint
   of the normalized account number, and encrypts the API token with Fernet
   before saving it.
6. Later synchronizations use the stored SePay ID and decrypted token. The
   token is never returned to the browser.

Webhook flow:

1. SePay sends both `in` and `out` events to the single webhook endpoint.
2. Ledger authenticates the `Apikey` header with a constant-time comparison.
3. The event is validated, matched by full keyed account identity, and saved
   in the durable inbox with its account number redacted in the audit payload.
4. Provider transaction ID uniqueness makes retries safe. A duplicate returns
   a successful acknowledgement without creating another transaction.
5. Matching scheduled income, fixed expenses, loan payments, and manual
   records is conservative. Unknown activity remains **Needs review**.
6. Cash Flow lets users classify review items as income, expense, internal
   transfer, loan repayment, loan interest, or savings transfer. Only income
   and expense classifications create actual Cash Flow transactions.

If an event cannot be matched to exactly one connected account, it is retained
as unmatched and never assigned to another user.

SePay's internal account ID is not the same as the visible bank account
number. Users only need to enter the visible account number; Ledger resolves
the internal ID automatically. There is no owner ID in this design because
ownership is the authenticated Ledger user who created the connection.

## SePay API requirements

Create an API token in SePay with access to the bank-account API. The legacy
API-token flow used by this integration sends:

```http
Authorization: Bearer API_TOKEN
Content-Type: application/json
```

The default endpoints are:

```text
GET https://my.sepay.vn/userapi/bankaccounts/list
GET https://my.sepay.vn/userapi/bankaccounts/details/{sepay_bank_account_id}
```

The token guide and bank-account API reference are available in the
[SePay documentation](https://docs.sepay.vn/tao-api-token.html) and the
[bank-account API reference](https://docs.sepay.vn/api-tai-khoan-ngan-hang.html).

### Optional token check

If the Ledger form reports an authentication error, test the token directly
against SePay without putting the token itself in shell history:

```bash
read -r -s SEPAY_TOKEN
printf '\n'
curl -sS -i https://my.sepay.vn/userapi/bankaccounts/list \
  -H "Authorization: Bearer ${SEPAY_TOKEN}" \
  -H 'Content-Type: application/json'
unset SEPAY_TOKEN
```

An HTTP 200 response means SePay accepted the token. The response contains the
SePay internal account ID; Ledger performs this lookup automatically when the
user submits the visible account number.

## Core environment variables

There are three different places for configuration:

| Configuration | Where it belongs | Example |
| --- | --- | --- |
| Application runtime secrets | Root `.env` locally or Ansible vault in production | `SECRET_KEY`, `SEPAY_CREDENTIAL_ENCRYPTION_KEY` |
| PostgreSQL connection settings | Root `.env` locally or Ansible vault in production | `DATABASE_URL`, `POSTGRES_DB` |
| A user's SePay credential | Net Worth connection form | API token and bank account number |

Never put a user's SePay token in the shared deployment vault. The shared
Fernet key protects each user's token after the user connects their own account.

### Required for every deployment

| Variable | Purpose | Guidance |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Use the internal Compose service name in Docker, such as `postgres`. |
| `SECRET_KEY` | Signs session cookies | Generate a strong random value and keep it stable across restarts. |
| `SEPAY_CREDENTIAL_ENCRYPTION_KEY` | Encrypts per-user SePay tokens at rest | Required. Must be a valid Fernet key and must remain unchanged while stored connections exist. |
| `SEPAY_WEBHOOK_API_KEY` | Authenticates inbound SePay webhook events | Required in production. Must exactly match the API key configured in SePay. |

The production deployment also requires these PostgreSQL values in the
Ansible secret bundle:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |

`DATABASE_URL`, `SECRET_KEY`, `SEPAY_CREDENTIAL_ENCRYPTION_KEY`, and
`SEPAY_WEBHOOK_API_KEY` are passed to the backend. PostgreSQL variables are
passed to the PostgreSQL container.

### Local Docker variables

The root `.env` file is read by Docker Compose. A working local setup normally
contains:

```dotenv
DATABASE_URL=postgresql://ledger:ledger@postgres:5432/apexvoid_ledger?schema=public
PORT=4000
SECRET_KEY=replace-with-a-local-random-secret
SESSION_COOKIE_SECURE=false
SEPAY_CREDENTIAL_ENCRYPTION_KEY=replace-with-a-generated-fernet-key
SEPAY_WEBHOOK_API_KEY=replace-with-a-local-webhook-test-key
```

Generate the two key values instead of copying this example:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

The repository's `.env` is ignored by Git and should remain private. The
Compose requires `SEPAY_CREDENTIAL_ENCRYPTION_KEY` for the existing balance
integration. `SEPAY_WEBHOOK_API_KEY` is optional locally but webhook
authentication fails closed when it is absent. Compose does not require a
global SePay API token or global bank-account ID.

To check the local setup without revealing secret values:

```bash
test -s .env
test -s .env && grep -E '^(DATABASE_URL|PORT|SECRET_KEY|SESSION_COOKIE_SECURE|SEPAY_CREDENTIAL_ENCRYPTION_KEY|SEPAY_WEBHOOK_API_KEY)=' .env | cut -d= -f1
docker compose config --quiet
```

Do not use `docker compose config` without care when sharing its output: it
can render environment values into the generated configuration.

### Optional variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Backend listen port. |
| `SESSION_COOKIE_SECURE` | `false` locally | Set `true` when the app is served over HTTPS. |
| `EXCHANGE_RATE_API_URL` | `https://api.frankfurter.dev/v2` | Override the reference FX-rate provider. |
| `SEPAY_API_BASE_URL` | `https://my.sepay.vn/userapi` | Override the SePay legacy API base URL for controlled testing or a compatible proxy. |

Do not configure these removed global variables:

```text
SEPAY_API_TOKEN
SEPAY_BANK_ACCOUNT_ID
SEPAY_LEDGER_USER_ID
```

They are not part of the per-user integration and are intentionally not
needed by the current Compose or Ansible templates.

## Local setup

From the repository root:

```bash
test -f .env
docker compose config --quiet
docker compose up -d --build
curl -sS http://localhost:4000/api/health
```

Open [http://localhost:8080](http://localhost:8080), sign in, and go to
`/net-worth`. Enter the SePay token and bank account number there. The token
should not be added to the root `.env`; it is a user credential and is stored
encrypted in the database after a successful connection.

For a fresh database, the migration creates the initial `admin` account only
when the `User` table is empty. The account must change its password on first
login. An existing `.data/postgres` directory preserves its existing users and
passwords.

Useful local commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose down
```

## Production and Ansible setup

For production, prepare the shared values before deploying the application.
The user-specific SePay token is still entered by each user after deployment.

### Production checklist

1. Generate a strong `SECRET_KEY`.
2. Generate one `SEPAY_CREDENTIAL_ENCRYPTION_KEY`.
3. Generate a separate `SEPAY_WEBHOOK_API_KEY` and configure the same value
   in SePay's webhook settings.
4. Save these values in the encrypted Ansible vault.
5. Set the PostgreSQL values and a matching `DATABASE_URL`.
6. Run the Ansible syntax check.
7. Deploy the image and wait for the PostgreSQL health check and Alembic
   migrations to complete.
8. Open the deployed Ledger URL, sign in, and connect each user's SePay
   account from **Net Worth**.

The first deployment with migrations `0020` and `0021` adds encrypted
credential storage, account fingerprints, and the webhook activity inbox. It
does not need a global SePay token and does not automatically attach an account
to a user.

The deployment template injects the following backend values from the
`apexvoid_ledger_secrets` Ansible vault mapping:

```text
DATABASE_URL
SECRET_KEY
SEPAY_CREDENTIAL_ENCRYPTION_KEY
SEPAY_WEBHOOK_API_KEY
```

The same vault mapping supplies:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

The expected required keys are maintained in the separate
`ansible-library/inventory/group_vars/all/vars.yml` repository, and the
encrypted values are maintained in its `inventory/group_vars/all/vault.yml`.

Before deployment, run the deployment syntax check and verify the vault
contents locally. Do not paste the output of `ansible-vault view` into chat or
logs:

```bash
ansible-vault view inventory/group_vars/all/vault.yml
ansible-playbook -i localhost, --syntax-check \
  -e project=apexvoid-ledger \
  -e image_tag=test \
  playbooks/deploy.yml
```

Keep `SEPAY_CREDENTIAL_ENCRYPTION_KEY` stable. If it is changed or lost,
existing encrypted SePay tokens cannot be decrypted and each user must
reconnect their account. A database backup and this key should be protected as
a pair.

Keep `SEPAY_WEBHOOK_API_KEY` private and make it exactly match the key in
SePay. Rotating it requires updating both the Ansible vault and SePay's
webhook configuration.

Do not add these values to the production vault; they are intentionally not
used by the current integration:

```text
SEPAY_API_TOKEN
SEPAY_BANK_ACCOUNT_ID
SEPAY_LEDGER_USER_ID
```

## Account connection and synchronization behavior

The application endpoints are:

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `POST` | `/api/net-worth/accounts` | Validate a token and account number, then connect or update the current user's account. |
| `GET` | `/api/net-worth/accounts` | List only the current user's connected accounts. |
| `GET` | `/api/net-worth/summary` | Read the user's balances and calculated net worth. |
| `POST` | `/api/net-worth/accounts/{id}/refresh` | Force a balance refresh for an owned account. |
| `DELETE` | `/api/net-worth/accounts/{id}` | Disconnect an owned account and remove its encrypted token. |
| `POST` | `/api/integrations/sepay/webhook` | Receive authenticated incoming/outgoing SePay bank activity. |
| `GET` | `/api/bank-activities?year=2026&month=10` | List the current user's imported bank activity. |
| `PATCH` | `/api/bank-activities/{id}` | Classify a review item without changing its raw bank payload. |

Automatic synchronization is limited to once every five minutes per account.
Failed refreshes retain the last valid balance and mark it stale; an account
that has never synced successfully is shown as unavailable rather than as a
zero balance.

## Troubleshooting

### `Invalid SePay credentials`

The token was rejected by SePay. Create or rotate the token in SePay, then
reconnect the account from `/net-worth`. Do not paste the token into logs or
commit it to a file.

### `The SePay bank account was not found`

Check the visible account number. Spaces and hyphens are accepted, but the
number must otherwise contain digits and must belong to the SePay token.

### `The SePay bank account is inactive`

The account returned by SePay is inactive and cannot be connected until it is
active there.

### `SePay credential encryption is not configured` or `invalid`

Check that `SEPAY_CREDENTIAL_ENCRYPTION_KEY` is present in the backend
environment and is a valid Fernet key. Confirm the container received the
variable without printing its value:

```bash
docker compose exec backend sh -c 'test -n "$SEPAY_CREDENTIAL_ENCRYPTION_KEY" && echo configured'
```

### Existing connections fail after deployment

Confirm that the same stable Fernet key is present on the new deployment. If
the key was rotated or lost, users must reconnect their SePay accounts after
the key is restored or replaced.

## Security checklist

- Rotate any SePay token that has been exposed in chat, shell history, logs, or
  screenshots.
- Never commit `.env`, plaintext vault files, or API tokens.
- Use HTTPS and `SESSION_COOKIE_SECURE=true` in production.
- Keep the Fernet key and database backups under separate access controls.
- Grant SePay tokens only the read access required for this integration.
- Remove disconnected accounts and revoke unused SePay tokens.
