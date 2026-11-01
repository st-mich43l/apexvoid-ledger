# SePay integration setup

This document describes the SePay integration in ApexVoid Ledger v0.5.0 and
later. The integration is per user: every Ledger user connects their own SePay
API token and bank account from the Net Worth page.

For the broader application architecture and deployment diagrams, see
[ARCHITECTURE.md](ARCHITECTURE.md).

Ledger reads the selected primary TPBank account balance and receives SePay
bank-activity webhooks. It does not initiate transfers, create a destination
bank account, infer a destination balance, or ask for online-banking passwords
or OTPs. Webhook events are stored once, matched to the owning account, and
shown in Cash Flow for reconciliation.

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
```

Generate the server secret with:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Paste the output into `SECRET_KEY`, then protect the file:

```bash
chmod 600 .env
```

Ledger creates its separate credential-encryption key on first use in the
backend's persistent Docker volume. Users never provide an encryption key.

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
4. Select the webhook authentication mode you will configure in SePay:
   **HMAC-SHA256** (recommended), **API Key**, **OAuth 2.0**, or **None**
   (testing only). Enter the matching secret or OAuth client credentials.
5. Select **Connect account**.
6. Confirm that the account appears with a masked number and verified balance.

The browser sends the token only during connection. The backend validates it,
encrypts it, and stores it against the signed-in Ledger user. The token is not
shown again in the UI or API responses.

### 5. Configure the SePay webhook

The production endpoint is:

```text
POST https://ledger.apexvoid.net/api/integrations/sepay/webhook
```

Configure SePay for JSON and both incoming and outgoing transaction events.
Ledger supports all four SePay security modes:

- **HMAC-SHA256** (recommended): enter the same Secret Key in both places.
  Ledger verifies SePay's raw-body signature and five-minute timestamp window.
- **API Key**: enter the same key in both places. SePay sends
  `Authorization: Apikey <key>`.
- **OAuth 2.0**: enter the client ID and secret in Ledger, then configure the
  displayed `/api/integrations/sepay/oauth/token` URL in SePay.
- **None**: testing only; Ledger accepts an unauthenticated webhook after its
  account number has been matched.

Webhook credentials are separate from each user's SePay API token. Ledger
encrypts user-entered secrets and OAuth credentials and uses them only for the
matched account; they are never returned to the UI or API. The webhook and
OAuth token endpoints do not require a Ledger login session. A server-wide
`SEPAY_WEBHOOK_API_KEY` remains only as a compatibility fallback for existing
installations; it is not required by the current Compose or production
templates.

### Webhook authentication reference

The selected method belongs to the individual connected account, not to the
server. It must match the SePay webhook configuration exactly. New
installations should use one of the first three modes, rather than the legacy
global fallback.

| Mode | Enter in Ledger | Configure in SePay | Ledger checks | Recommended use |
| --- | --- | --- | --- | --- |
| HMAC-SHA256 | Secret key | The same secret | Raw-body HMAC and timestamp | Production default |
| API Key | API key | The same key | `Authorization: Apikey <key>` | Shared-key delivery |
| OAuth 2.0 | Client ID and client secret | Ledger's token endpoint | Account-bound Bearer token | OAuth delivery |
| None | Nothing | No authentication | Account matching only | Controlled testing only |

#### HMAC-SHA256 (recommended)

SePay sends an `X-SePay-Timestamp` Unix-second value and an
`X-SePay-Signature` header in the form `sha256=<hex-hmac>`. Ledger computes
HMAC-SHA256 over the exact byte sequence `{timestamp}.{raw_body}`. The body is
not parsed, reformatted, or normalized before signature verification. Ledger
rejects timestamps more than five minutes away from the server clock and uses
a constant-time comparison. Keep the production clock synchronized.

#### API Key

SePay sends the configured key as `Authorization: Apikey <key>`. Ledger
compares it to the encrypted per-account value in constant time. The API key
is never returned after the connection is saved.

#### OAuth 2.0

Configure this token URL in SePay:

```text
POST https://ledger.apexvoid.net/api/integrations/sepay/oauth/token
```

Ledger accepts SePay's standard client-credentials request using HTTP Basic
credentials and `application/x-www-form-urlencoded`:

```http
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

It returns `access_token`, `token_type` (`Bearer`), `expires_in` (3600), and
`refresh_token`. A refresh request uses `grant_type=refresh_token` and the
prior `refresh_token`. For SePay's custom OAuth option, Ledger also accepts
JSON `{"clientId":"…","clientSecret":"…"}` and returns
`{"data":{"accessToken":"…","refreshToken":"…","expiredIn":3600}}`.
Access tokens last one hour; refresh tokens last 30 days. SePay sends the
resulting token as `Authorization: Bearer <access-token>` with each webhook.

`SECRET_KEY` signs these short-lived OAuth tokens. It does not encrypt the
stored client ID, client secret, API key, HMAC secret, or SePay API token.

#### None

No secret is stored. Ledger accepts the event only when its account number
matches exactly one connected account. This is not adequate authentication for
a public production webhook and is intended only for local or controlled tests.

The SePay authentication reference is available at
[SePay webhook authentication](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc).

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
2. After the event identifies its account, Ledger authenticates the selected
   account-specific HMAC-SHA256 signature, API key, OAuth Bearer token, or
   (for controlled tests only) no-auth delivery.
3. The event is validated, matched by full keyed account identity, and saved
   in the durable inbox with its account number redacted in the audit payload.
4. Provider transaction ID uniqueness makes retries safe. A duplicate returns
   a successful acknowledgement without creating another transaction.
5. Matching scheduled income, fixed expenses, explicit Monthly Living Budget
   text/reference rules, and manual records is conservative. Unknown activity
   remains **Needs review**.
6. Cash Flow lets users classify review items as income, expense, internal
   transfer, loan repayment, loan interest, or savings transfer. Income,
   expense, loan-interest, and outgoing loan-repayment classifications create
   actual Cash Flow transactions. A loan repayment creates one linked **Loan**
   expense and does not update a loan record or schedule.

The inbox is the source of truth for delivery idempotency. A repeated provider
transaction identity is acknowledged without creating a second activity or
Cash Flow transaction. Account matching failure also remains unmatched rather
than risking assignment to another user.

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
| Application runtime secrets | Root `.env` locally or Ansible vault in production | `SECRET_KEY` |
| PostgreSQL connection settings | Root `.env` locally or Ansible vault in production | `DATABASE_URL`, `POSTGRES_DB` |
| A user's SePay credential | Net Worth connection form | API token and bank account number |

Never put a user's SePay token or bank account number in the shared deployment
vault. Each user enters both in the Net Worth connection form; the backend
encrypts the API token before storing it.

### Required for every deployment

| Variable | Purpose | Guidance |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Use the internal Compose service name in Docker, such as `postgres`. |
| `SECRET_KEY` | Signs session cookies | Generate a strong random value and keep it stable across restarts. |

The production deployment also requires these PostgreSQL values in the
Ansible secret bundle:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |

`DATABASE_URL` and `SECRET_KEY` are passed to the backend. PostgreSQL variables are
passed to the PostgreSQL container.

### Local Docker variables

The root `.env` file is read by Docker Compose. A working local setup normally
contains:

```dotenv
DATABASE_URL=postgresql://ledger:ledger@postgres:5432/apexvoid_ledger?schema=public
PORT=4000
SECRET_KEY=replace-with-a-local-random-secret
SESSION_COOKIE_SECURE=false
```

Generate `SECRET_KEY` instead of copying this example:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

The repository's `.env` is ignored by Git and should remain private. Compose
does not require a global SePay API token, webhook key, bank-account ID, or
credential-encryption variable. Configure the selected webhook mode and its
credential in the signed-in Net Worth form; inbound webhooks fail closed for
accounts that do not have account-specific authentication (unless a legacy
global API key is configured).

To check the local setup without revealing secret values:

```bash
test -s .env
test -s .env && grep -E '^(DATABASE_URL|PORT|SECRET_KEY|SESSION_COOKIE_SECURE)=' .env | cut -d= -f1
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
| `SEPAY_CREDENTIAL_KEY_FILE` | `/var/lib/apexvoid-ledger/sepay-credentials.key` | Advanced operator override for the backend-managed key file. The provided Compose templates do not require it. |

Do not configure these removed global variables:

```text
SEPAY_API_TOKEN
SEPAY_BANK_ACCOUNT_ID
SEPAY_LEDGER_USER_ID
```

They are not part of the per-user integration and are intentionally not
needed by the current Compose or Ansible templates.

`SEPAY_WEBHOOK_API_KEY` and `SEPAY_CREDENTIAL_ENCRYPTION_KEY` are also not
required by current deployments. The former is accepted only as a legacy
server-wide API-key fallback. The latter is accepted only for compatibility
with installations that already used an explicitly configured encryption key;
new deployments generate the credential key in the persistent backend volume.

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

## Verification and tests

Run the focused backend coverage after changing the integration:

```bash
cd backend
pytest -q tests/test_sepay_webhook.py tests/test_net_worth.py tests/test_cashflow_api.py tests/test_monthly_budget_api.py
```

The SePay tests cover:

- automatic outgoing categorization into **Monthly Living Budget**;
- rejection of amount-only rules and missing-category rules;
- missing or uncertain rules staying `pending_review` / `unreviewed`;
- repeated webhook delivery producing one activity and one transaction;
- account-specific API-key authentication;
- HMAC verification against the exact raw request body and timestamp;
- OAuth client-credentials token issuance and Bearer webhook delivery;
- controlled no-auth mode;
- unmatched account retention;
- recurring-expense reconciliation without a second expense; and
- loan repayment classification as one linked Loan Cash Flow expense without
  loan-schedule reconciliation.

For a full local release check, also run:

```bash
cd frontend
npm run lint
npm run build
cd ..
docker compose config --quiet
git diff --check
```

Do not use real SePay credentials in tests. The test suite uses isolated
credentials and test accounts, and production credentials must remain in the
signed-in form or the protected backend storage described below.

## Production and Ansible setup

For production, prepare only the shared application and PostgreSQL values
before deploying. Each user enters the primary TPBank SePay API token, bank
account number, and selected webhook authentication settings after deployment.

### Production checklist

1. Generate a strong `SECRET_KEY`.
2. Save the server values in the encrypted Ansible vault.
3. Set the PostgreSQL values and a matching `DATABASE_URL`.
4. Run the Ansible syntax check.
5. Deploy the image and wait for the PostgreSQL health check and Alembic
   migrations to complete.
6. Open the deployed Ledger URL, sign in, and connect each user's SePay
   account from **Net Worth**. Select webhook authentication there when you
   configure the corresponding key in SePay.

The first deployment with migrations `0020` through `0024` adds encrypted
credential storage, account fingerprints, the webhook activity inbox, the
optional outgoing categorization rule, per-account webhook credentials, and
the selected webhook mode plus encrypted OAuth client ID. Migration `0024`
labels existing per-account webhook secrets as `api_key`; it cannot recover
ciphertext encrypted under a key that is no longer available. The deployment
does not need global SePay credentials and does not automatically attach an
account to a user.

The deployment template injects the following backend values from the
`apexvoid_ledger_secrets` Ansible vault mapping:

```text
DATABASE_URL
SECRET_KEY
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

Keep the `backend_secrets` Docker volume. If it is deleted while the database
is retained, existing encrypted SePay tokens cannot be decrypted and users
must reconnect their accounts.

The backend owns the encryption-key lifecycle: it creates
`/var/lib/apexvoid-ledger/sepay-credentials.key` with restrictive permissions
inside that volume on first use. The database stores ciphertext while the
volume stores the decryption key, so protect and back up both together. Do not
ask users for that key and do not add it as a required Compose variable.

Each user changes a webhook setting by reconnecting the relevant account with
the selected mode and new value, then making the corresponding change in
SePay. API keys, HMAC secrets, OAuth client IDs, and OAuth client secrets are
encrypted and are not returned through the UI or API. Reconnecting requires
entering the SePay API token again because secrets are deliberately write-only.

Do not add these values to the production vault; they are intentionally not
used by the current integration:

```text
SEPAY_API_TOKEN
SEPAY_BANK_ACCOUNT_ID
SEPAY_LEDGER_USER_ID
SEPAY_WEBHOOK_API_KEY
SEPAY_CREDENTIAL_ENCRYPTION_KEY
```

## Monthly Living Budget and transaction counting

**Monthly Living Budget** is a normal default expense category. Users can
rename, edit, deactivate, or select it manually through the existing category
management UI. It is not a special transfer type and it does not create a
second bank account.

For automatic classification, configure the connected primary account's
outgoing categorization rule in Cash Flow bank-activity review. Select the
Monthly Living Budget category and provide reliable text from the SePay
description and/or bank reference. At least one matcher is required; if both
are configured, both must match. A matching outgoing event becomes one
ordinary Expense with that category.

The rule never classifies on amount alone. When its text/reference evidence is
missing, conflicting, or insufficient, the activity stays uncategorized for
review. Once classified, the expense appears in the month’s Cash Flow,
expense summaries, category breakdown, budget actuals, Monthly Close, and
Saving Pot reconciliation.

Webhook duplicate delivery is safe: the provider transaction identity can be
stored only once, so a retry cannot create another activity or transaction. A
recurring expense occurrence is also suppressed when a matching imported SePay
expense already represents it. Contractual loan schedules are estimates only;
they never classify or generate repayment expenses. An explicitly classified
bank repayment is one linked Loan expense in Cash Flow and budget actuals.

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
| `GET/PUT` | `/api/bank-activities/categorization-rule` | Read or configure the primary account's outgoing description/reference rule. |
| `PATCH` | `/api/bank-activities/{id}` | Classify a review item without changing its raw bank payload. |

### Connection request contract

`POST /api/net-worth/accounts` is a signed-in, password-complete Ledger request.
The request uses the frontend's camel-case JSON fields:

```json
{
  "apiToken": "user-entered-sepay-api-token",
  "accountNumber": "0123456789",
  "webhookAuthType": "hmac_sha256",
  "webhookAuthSecret": "same-secret-configured-in-sepay"
}
```

The accepted `webhookAuthType` values are `hmac_sha256`, `api_key`, `oauth2`,
and `none`. OAuth additionally requires `webhookOauthClientId`; its client
secret is sent as `webhookAuthSecret`. The API token and secret/client-ID
fields are write-only: a successful response returns the masked account,
balance state, and selected `webhookAuthType`, never the submitted secrets.
Submitting the form again updates the existing connected account and rotates
its stored credentials while preserving the account's bank-activity history and
categorization rule.

The primary account's safe response shape is equivalent to:

```json
{
  "provider": "sepay",
  "bankName": "Ngân hàng TMCP Tiên Phong",
  "accountNumberMasked": "••••5404",
  "currency": "VND",
  "balance": 16818085,
  "balanceStatus": "verified",
  "webhookAuthEnabled": true,
  "webhookAuthType": "hmac_sha256"
}
```

The response does not include the SePay internal account ID as a user input
requirement, the full bank account number, the API token, the webhook secret,
or the OAuth client ID.

### Webhook payload contract

The webhook accepts a JSON object with these SePay fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Provider transaction identity; the provider plus this ID is the idempotency key. |
| `accountNumber` | Yes | Visible bank account number used to locate the connected account. Spaces and hyphens are normalized. |
| `transferType` | Yes | `in` or `out`. |
| `transferAmount` | Yes | Positive transaction amount. |
| `transactionDate` | Yes | ISO date/time; timezone-less values are interpreted as Vietnam time. |
| `content` or `description` | No | Transaction description used by the categorization rule and review UI. |
| `referenceCode` or `code` | No | Bank/provider reference used by the categorization rule and review UI. |
| `accumulated` | No | Running balance supplied by SePay; it is stored as activity context and does not replace Net Worth synchronization. |

Example outgoing event:

```json
{
  "id": 92709,
  "accountNumber": "0123456789",
  "transferType": "out",
  "transferAmount": 1500000,
  "transactionDate": "2026-10-24 10:30:00",
  "content": "MONTHLY ALLOWANCE OCTOBER",
  "referenceCode": "ALLOWANCE-2026-10",
  "accumulated": 16818085
}
```

Ledger validates the direction, positive amount, date, currency assumptions,
and account identity. The stored audit payload redacts the account number to
its final four digits. The raw event is never used to create an additional
account or to infer the recipient bank's balance.

### Categorization-rule contract

The primary account rule is managed from the Cash Flow bank-activity review:

```http
GET /api/bank-activities/categorization-rule
PUT /api/bank-activities/categorization-rule
Content-Type: application/json
```

```json
{
  "enabled": true,
  "categoryId": "expense-category-id",
  "descriptionContains": "MONTHLY ALLOWANCE",
  "referenceContains": "ALLOWANCE-"
}
```

An enabled rule requires an active expense category and at least one of the two
textual matchers. Matchers are literal, case-insensitive substrings. If both
are provided, both must be present in the corresponding SePay fields. A
missing description, missing reference, amount match, date match, or running
balance match cannot satisfy the rule. A disabled or uncertain rule leaves an
outgoing activity as `pending_review` / `unreviewed` for manual review.

Saving a rule reprocesses existing pending activities for that primary account.
It does not rewrite already-linked manual or SePay transactions. Select
**Monthly Living Budget** as the category to implement the monthly allowance
workflow, or select another active expense category when the account's policy
changes. The category itself is a normal user-owned category and can be
renamed, edited, deactivated, and selected manually through the existing
category manager. Category changes keep the same category ID, so existing
transactions and a configured rule continue to point to the renamed category;
deactivating it prevents new automatic matches and prevents new budget
allocations.

The category endpoints used by the existing manager are:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/categories?type=expense` | List the user's active expense categories; lazily creates missing defaults, including Monthly Living Budget. |
| `POST` | `/api/categories` | Create a user-owned income or expense category. |
| `PUT` | `/api/categories/{id}` | Rename, edit the icon/type where allowed, or activate/deactivate a category. |
| `DELETE` | `/api/categories/{id}` | Soft-deactivate a category without deleting historical transactions. |

For a pending item, Cash Flow sends the selected classification to
`PATCH /api/bank-activities/{id}`. `income`, `expense`, and `loan_interest`
require a category of the matching type. An outgoing `loan_repayment` uses the
default active **Loan** expense category and creates one normal linked expense;
it does not use or modify any loan record.
`internal_transfer` and `savings_transfer` remain bank activity without
creating a normal income/expense transaction. Sending `unreviewed` returns the
item to review when it has no linked transaction.

### Classification and exactly-once behavior

An accepted event follows this state model:

1. The account number is matched by a keyed fingerprint of the normalized full
   number. An account-specific authentication mode is then checked; unmatched
   or ambiguous account matches are not assigned to another user.
2. A new provider transaction ID is inserted into `SePayBankActivity` with
   `pending_review` and `unreviewed` defaults.
3. Ledger first checks an unambiguous matching manual transaction, then the
   configured outgoing text/reference rule, then scheduled income/fixed-cost
   references. Loan schedules are not reconciliation inputs.
4. A confident rule match creates one ordinary expense with
   `source=sepay`, links the activity to it, and marks the activity
   `processed`.
5. An explicit outgoing `loan_repayment` creates one linked Cash Flow expense
   in the default **Loan** category, without reading or updating a loan record
   or schedule. An internal or savings transfer remains a bank-activity
   classification. `income`, `expense`, and `loan_interest` manual
   classifications create a linked Cash Flow transaction with the required
   category.
6. A repeated delivery of the same provider transaction ID returns a successful
   acknowledgement and reuses the existing activity. The unique provider/ID
   constraint and the `sepay:<provider>:<transaction-id>` transaction identity
   prevent a second activity or expense.

Imported categorized expenses are ordinary monthly Cash Flow entries. They
contribute to total expenses, the category breakdown, expense summaries,
budget actuals, Monthly Close, and Saving Pot month reconciliation. If an
imported SePay expense matches a recurring fixed-cost occurrence, the imported
transaction is the authoritative occurrence and the generated recurring line
is omitted, so the expense is counted once. Loan schedules remain estimates
used for reconciliation; they do not become paid expenses just because a
schedule exists.

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

### `Server credential encryption is unavailable`

Check that the backend can write to `/var/lib/apexvoid-ledger`, which is backed
by the `backend_secrets` Docker volume in the provided Compose files.

### Existing connections fail after deployment

Confirm that the `backend_secrets` Docker volume remains attached to the new
deployment. If it was removed, users must reconnect their SePay accounts.

### `Stored SePay credentials are invalid` or a stale balance warning

Ledger preserves the last known balance but excludes it from confirmed Net
Worth while it is stale; it would be misleading to treat an unverified balance
as current. Use **Refresh** first. If an old connection was encrypted under a
missing legacy key, reconnect from Net Worth with the user's SePay API token,
account number, selected webhook mode, and corresponding secret or OAuth
client credentials. There is no safe way to reconstruct the old secret.

### `401 Invalid webhook authentication`

- **HMAC-SHA256:** check the matching secret, `sha256=` prefix, raw-body
  signature input, Unix-second timestamp, and backend clock.
- **API Key:** check `Authorization: Apikey <key>` and that Ledger is set to
  API Key mode for that account.
- **OAuth 2.0:** check the exact token URL, client ID/client secret, and the
  `Authorization: Bearer <access-token>` delivery header.
- **None:** verify the payload account maps to exactly one connected account;
  do not use this mode to bypass production authentication.

### A Monthly Living Budget transfer stayed uncategorized

Review the raw description/reference and update the outgoing rule to use
reliable textual evidence from that activity. An amount match alone is
intentionally ignored. Classify the activity manually when its wording is not
reliable enough to automate.

## Security checklist

- Rotate any SePay token that has been exposed in chat, shell history, logs, or
  screenshots.
- Never commit `.env`, plaintext vault files, or API tokens.
- Use HTTPS and `SESSION_COOKIE_SECURE=true` in production.
- Keep the backend secrets volume and database backups under separate access controls.
- Grant SePay tokens only the read access required for this integration.
- Remove disconnected accounts and revoke unused SePay tokens.
