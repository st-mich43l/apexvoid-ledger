# ApexVoid Ledger architecture

This document explains the runtime architecture, security boundaries, data
ownership, and deployment topology of ApexVoid Ledger. It is written for
developers and operators who need to understand where a request goes and
which component owns each responsibility.

## System overview

ApexVoid Ledger is a same-origin web application:

- The React frontend is compiled into static files and served by Nginx.
- Nginx serves the single-page application and proxies `/api/*` to FastAPI.
- FastAPI owns authentication, authorization, business rules, calculations,
  provider integrations, and database access.
- PostgreSQL stores users and financial records.
- SePay supplies the read-only balance for the primary bank account explicitly
  connected by each Ledger user and sends its bank activity to a public
  webhook authenticated per account with HMAC-SHA256, API Key, OAuth 2.0, or
  (only for controlled testing) no authentication.
- Frankfurter supplies historical reference exchange rates when a report needs
  currency conversion.

```mermaid
flowchart LR
    U[User] --> B[Browser]
    B -->|HTML, JS, CSS| N[Nginx frontend]
    B -->|same-origin /api/* with session cookie| N
    N -->|proxy /api/*| A[FastAPI backend]
    A --> DB[(PostgreSQL)]
    A -->|Bearer token, read-only balance sync| S[SePay API]
    S -->|Authenticated webhook events| A
    A -->|historical FX rates| FX[Frankfurter API]
    OPS[Ansible deployment] --> VPS[Docker host]
    VPS --> N
    VPS --> A
    VPS --> DB
```

The browser never calls SePay or the exchange-rate provider directly. This
keeps provider credentials and integration policy on the backend.

## Runtime services

| Service | Local container | Production role | Responsibility |
| --- | --- | --- | --- |
| Frontend | `apexvoid-ledger-frontend-1` | Nginx container behind shared routing | Serves the React SPA and proxies `/api/` to the backend. |
| Backend | `apexvoid-ledger-backend-1` | FastAPI container | Session auth, API routers, domain logic, calculations, migrations, and provider calls. |
| PostgreSQL | `apexvoid-ledger-postgres-1` | PostgreSQL container with persistent volume | Durable application data and encrypted SePay credential ciphertext. |
| Shared routing | Host-level routing project | Public HTTPS entry point | Terminates or routes public traffic to the frontend container in production. |

Local Docker publishes the frontend on port `8080`, the backend on `4000`,
and PostgreSQL on `5432`. Production uses the external routing network and
does not need to publish those container ports publicly.

## Request and authentication flow

Authentication is session-based rather than token-based for the Ledger UI. The
backend sets a signed Starlette session cookie after a successful login. API
requests use same-origin relative URLs and include that cookie automatically.

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant API as FastAPI
    participant DB as PostgreSQL

    Browser->>Nginx: POST /api/auth/login
    Nginx->>API: Forward JSON credentials
    API->>DB: Find username and bcrypt hash
    DB-->>API: User record
    API-->>Nginx: User JSON + signed session cookie
    Nginx-->>Browser: 200 response + cookie

    Browser->>Nginx: GET /api/net-worth/summary + cookie
    Nginx->>API: Forward request and cookie
    API->>API: Validate session user_id
    API->>DB: Query only resources owned by user
    DB-->>API: User-scoped records
    API-->>Nginx: JSON response
    Nginx-->>Browser: JSON response
```

Password and currency onboarding are separate gates after login. A user with
`mustChangePassword=true` is sent to User Accounts (`/settings/users`) and
can still reach `/me` and `/api/auth/change-password`, but protected financial
routes and admin actions remain blocked until the password update is complete.

## Frontend structure

The frontend is a React/Vite single-page application. `App.tsx` defines the
route tree and the guards enforce the main UI boundaries:

```mermaid
flowchart TD
    App[App router]
    App --> Login[/login]
    App --> AuthGuard[RequireAuth]
    AuthGuard --> Password[/settings/users for password update]
    AuthGuard --> Currency[/select-currency]
    AuthGuard --> Layout[Authenticated layout]
    Layout --> Dashboard[/dashboard]
    Layout --> CashFlow[/cashflow]
    Layout --> NetWorth[/net-worth]
    Layout --> SavingPot[/saving-pot]
    Layout --> Loans[/loan and /loan/:id]
    Layout --> Planning[/monthly-routine, /budget, /monthly-close]
    Layout --> Accounts[/settings/users]
    Layout --> AdminGuard[RequireAdmin]
    AdminGuard --> Home[/home]
    AdminGuard --> Users[/settings/users]
```

Pages use hooks for loading and mutation state. `frontend/src/api.ts` is the
single HTTP client layer: it sends same-origin requests, parses API errors,
and clears client auth state when an authenticated request returns `401`.

## Backend structure

The backend is intentionally split into thin HTTP routers and domain modules:

| Layer | Location | Responsibility |
| --- | --- | --- |
| Application entrypoint | `backend/app/main.py` | FastAPI app, session middleware, router registration, health endpoint. |
| Auth boundary | `backend/app/auth.py`, `routers/auth.py` | Bcrypt verification, signed sessions, admin checks, onboarding gates. |
| HTTP routers | `backend/app/routers/` | Request validation, ownership lookup, response shaping, and HTTP error mapping. |
| Domain services | `backend/app/net_worth.py`, `cashflow.py`, `saving_pot_domain.py`, and related modules | Business rules, calculations, synchronization, and transactional updates. |
| Provider clients | `backend/app/sepay.py`, `exchange_rates.py` | External HTTP calls, response normalization, timeout handling, and safe provider errors. |
| Persistence | `backend/app/models.py`, `database.py` | SQLAlchemy models, sessions, constraints, and database connection setup. |
| Schema/migrations | `backend/app/schemas.py`, `backend/alembic/versions/` | API contracts and incremental PostgreSQL changes. |

Routers should remain responsible for HTTP concerns. Provider response parsing,
financial calculations, and synchronization policy belong in domain or provider
modules so they can be tested without a live browser request.

## Data ownership and tenant isolation

Every financial resource is scoped to the authenticated `User`. The important
ownership relationships are:

```mermaid
erDiagram
    USER ||--o{ FINANCIAL_ACCOUNT : owns
    USER ||--o{ LOAN : owns
    USER ||--o{ TRANSACTION : owns
    USER ||--o{ CATEGORY : owns
    USER ||--o| SAVING_POT : owns
    USER ||--o{ SEPAY_BANK_ACTIVITY : reviews
    FINANCIAL_ACCOUNT ||--o{ SEPAY_BANK_ACTIVITY : receives
    TRANSACTION ||--o{ SEPAY_BANK_ACTIVITY : links
    FINANCIAL_ACCOUNT {
        uuid id PK
        string user_id FK
        string provider
        string external_account_id
        string credential_ciphertext "encrypted, never in API output"
        string account_number_masked
        decimal balance
        string balance_status
        string webhook_auth_type
        string webhook_auth_ciphertext "encrypted secret"
        string webhook_auth_client_id_ciphertext "encrypted OAuth ID"
        string auto_category_id FK
        string auto_description_contains
        string auto_reference_contains
        boolean auto_rule_enabled
    }
    SEPAY_BANK_ACTIVITY {
        uuid id PK
        string provider_transaction_id UK
        uuid user_id FK
        uuid financial_account_id FK
        string account_number_fingerprint
        datetime occurred_at
        string direction
        decimal amount
        string processing_status
        string classification
        uuid linked_transaction_id FK
    }
    USER {
        uuid id PK
        string username UK
        string hashed_password
        boolean is_admin
        boolean must_change_password
        string preferred_currency
    }
```

The diagram shows logical ownership. The database schema uses explicit foreign
keys for newer user-owned resources; all routers still apply an authenticated
user filter even where an older table uses a plain user-id column.

The API does not trust an object ID by itself. Every lookup combines the object
ID with the current user's ID, so another user's resource behaves like a
missing resource and returns `404`.

## SePay integration boundary

SePay has two separate trust boundaries:

- The authenticated Ledger user supplies an individual SePay API token for
  read-only account lookup and balance synchronization. Ledger encrypts that
  token at rest.
- SePay sends inbound activity to the public webhook using the mode selected
  for that connected account: HMAC-SHA256 (recommended), API Key, OAuth 2.0,
  or no authentication for controlled tests. The API/HMAC secret and OAuth
  client ID/secret are encrypted at rest and selected only after the payload
  identifies the account. The webhook does not require a browser session, JWT,
  or CSRF token. It rejects missing or invalid account-specific credentials;
  older deployments may retain a global API-key compatibility fallback, but
  new deployments do not configure one.

```mermaid
sequenceDiagram
    participant User
    participant UI as Net Worth UI
    participant API as Net Worth router
    participant Service as net_worth.py
    participant SePay
    participant DB as PostgreSQL

    User->>UI: Enter token, visible account number, and webhook mode
    UI->>API: POST /api/net-worth/accounts
    API->>Service: connect_sepay_account(current_user, token, number)
    Service->>SePay: GET /userapi/bankaccounts/list
    SePay-->>Service: Matching account + internal SePay ID
    Service->>SePay: GET /userapi/bankaccounts/details/{id}
    SePay-->>Service: Active account + balance
    Service->>Service: Encrypt token and selected webhook credentials with Fernet
    Service->>DB: Save user-owned account, mode, and ciphertext
    DB-->>Service: Account record without token in response schema
    Service-->>API: Masked account + balance
    API-->>UI: Connected account JSON
```

The database stores `credentialCiphertext`, webhook secret ciphertext, and—when
OAuth is selected—client-ID ciphertext; it never stores those values in
plaintext. The response schema exposes the provider, masked account number,
balance, status, timestamps, and the selected authentication mode, but not any
credential ciphertext or secret. The backend-managed Fernet key is generated
under `/var/lib/apexvoid-ledger/sepay-credentials.key` and persists in the
`backend_secrets` volume. The database and that volume must be backed up
together.

Account matching uses a keyed fingerprint of the normalized full bank account
number. The full number is never used as a cross-user lookup key in logs or
API responses. An activity is retained as unmatched when it cannot be linked
to exactly one connected account.

For the primary-account workflow, the user connects only the TPBank account
used for the allowance transfer. The receiving bank is outside Ledger's model:
there is no destination `FinancialAccount`, inferred destination balance, or
internal-transfer transaction created by the categorization rule. The
`/api/bank-activities/categorization-rule` endpoint resolves the user's primary
SePay account and stores the rule on that existing `FinancialAccount`.

### SePay webhook and reconciliation flow

```mermaid
sequenceDiagram
    participant SePay
    participant Proxy as Nginx / routing
    participant API as Webhook router
    participant Inbox as PostgreSQL inbox
    participant Match as Reconciliation service
    participant Cash as Cash Flow
    participant Net as Net Worth sync

    SePay->>Proxy: POST /api/integrations/sepay/webhook
    Proxy->>API: Forward JSON + configured authentication headers
    API->>API: Verify HMAC, API key, OAuth Bearer, or controlled test mode
    API->>API: Validate direction, amount, date, account
    API->>Inbox: Insert provider + transaction ID
    Inbox-->>API: Duplicate or newly stored activity
    API->>Match: Match exact account and known activity
    Match->>Cash: Create one ordinary expense for a configured text/reference match
    Match-->>Cash: Otherwise pending review
    API->>Net: Trigger throttled balance sync when due
    API-->>SePay: 200 acknowledgement
```

The inbox is the source of truth for delivery and idempotency. A duplicate
provider transaction ID is acknowledged without creating another bank activity
or Cash Flow transaction. Incoming and outgoing events use the same path, and
unmatched or ambiguous events remain reviewable rather than being assigned to
another user. `income`, `expense`, and `loan_interest` classifications create
ordinary Cash Flow transactions; `internal_transfer`, `loan_repayment`, and
`savings_transfer` remain bank-activity classifications so they cannot inflate
income or expense totals.

The Monthly Living Budget rule is stored on the existing connected primary
account. It is enabled only with an active expense category and at least one
textual matcher. Description and reference matching is case-insensitive literal
substring matching; when both matchers are present, both must match. Amount,
date, and running balance are never sufficient by themselves. A confident
outgoing match creates one ordinary `Transaction` with `source=sepay`. When
that transaction also matches a recurring fixed-cost occurrence, the imported
transaction is authoritative and the generated recurring entry is omitted from
the report.

## Balance synchronization lifecycle

```mermaid
stateDiagram-v2
    [*] --> unavailable: account created
    unavailable --> verified: successful connect or sync
    verified --> verified: sync succeeds
    verified --> stale: provider/network/decryption failure
    verified --> inactive: SePay marks account inactive
    stale --> verified: later sync succeeds
    stale --> stale: failed sync preserves last balance
    inactive --> verified: account reactivated and reconnects
    unavailable --> unavailable: no valid balance yet
```

Synchronization is guarded per account and rate-limited to five minutes. A
failed synchronization does not replace a known balance with zero. Instead,
the last balance is retained and the UI reports `stale`, `inactive`, or
`unavailable`. Only verified balances are included in confirmed net worth.

## Net worth calculation

Net worth combines two independent sources:

```mermaid
flowchart LR
    Accounts[Verified SePay balances] --> FX[Currency conversion at sync timestamp]
    Loans[Outstanding loan calculations] --> FX2[Currency conversion at report date]
    FX --> Assets[Confirmed assets]
    FX2 --> Liabilities[Confirmed liabilities]
    Assets --> Result[Net worth = assets - liabilities]
    Liabilities --> Result
    FX --> Warnings[Conversion or freshness warnings]
    FX2 --> Warnings
```

Cash-flow transactions, expected income, saving-pot balances, and loan
schedule estimates are not added again as net-worth assets or liabilities. A saving
pot may already be represented by a connected bank balance, so including it
separately would double-count money.

If a required exchange rate is unavailable, the response marks valuation as
incomplete rather than presenting a misleading complete total.

## Deployment topology

### Local Docker Compose

```mermaid
flowchart TB
    subgraph Local[Developer machine]
        Browser[Browser :8080]
        Frontend[Frontend Nginx]
        Backend[Backend FastAPI :4000]
        Postgres[(PostgreSQL :5432)]
        Data[(.data/postgres)]
        Browser --> Frontend
        Frontend --> Backend
        Backend --> Postgres
        Postgres --> Data
    end
```

The local database bind mount preserves users and test data across image
rebuilds and ordinary `docker compose down`. Delete `.data/postgres` only when
you intentionally want a clean database.

### Production

```mermaid
flowchart LR
    Internet[HTTPS clients] --> Routing[Shared routing / TLS]
    Routing --> Frontend[Ledger frontend container]
    Frontend --> Backend[Ledger backend container]
    Backend --> DB[(PostgreSQL volume)]
    Backend --> SePay[SePay API]
    Backend --> FX[Frankfurter API]
    Ansible[ansible-library] --> Routing
    Ansible --> Frontend
    Ansible --> Backend
    Ansible --> DB
```

The production Compose template attaches frontend and backend to the external
`routing` network. Runtime secrets are rendered from the encrypted Ansible
vault. User SePay tokens are not placed in that vault; they are connected and
encrypted after users sign in.

## Configuration and secret boundaries

| Secret or setting | Owner | Storage/use |
| --- | --- | --- |
| `SECRET_KEY` | Operator | Backend environment; signs session cookies and short-lived OAuth webhook tokens. |
| SePay credential key | Backend | Generated on first use and retained in the backend-only persistent Docker volume. |
| SePay webhook authentication | Individual user + SePay webhook | The form stores `hmac_sha256`, `api_key`, `oauth2`, or `none`, plus encrypted per-account secret/client ID; validates events for that account. |
| `DATABASE_URL` | Operator | Backend environment; database connection. |
| PostgreSQL credentials | Operator | PostgreSQL environment and encrypted deployment vault. |
| SePay API token | Individual user | Submitted over the authenticated UI, then Fernet-encrypted in `FinancialAccount`. |
| SePay bank account number | Individual user | Used to resolve the provider account; only a masked value is returned/stored for display. |

Deleting the backend secrets volume makes existing SePay ciphertext unreadable.
Database backups and that volume therefore need coordinated protection.

## Database migrations

Alembic migrations run before the backend starts in both local and production
container workflows. The relevant Net Worth migrations are:

- `0019_add_financial_account.py` creates user-owned financial accounts.
- `0020_add_sepay_credential.py` adds encrypted per-user SePay credential
  storage and changes uniqueness to user + provider + external account.
- `0021_add_sepay_webhook_activity.py` adds the durable SePay activity inbox,
  idempotency constraint, and keyed account-number fingerprint.
- `0022_add_sepay_categorization_rule.py` adds the optional outgoing
  description/reference categorization rule to `FinancialAccount`.
- `0023_add_sepay_account_webhook_auth.py` adds encrypted per-account webhook
  secret storage.
- `0024_add_sepay_webhook_auth_type.py` records the selected webhook mode and
  adds encrypted OAuth client-ID storage. Existing encrypted webhook secrets
  are backfilled as `api_key` for compatibility.

Do not edit an already-applied migration. Add a new migration for a schema
change, and verify it against a copy of the production database before
deployment.

## Operational checks

```bash
docker compose ps
curl -fsS http://localhost:8080/api/health
docker compose logs --tail=100 backend
```

When investigating SePay issues, inspect status and error messages but never
log or paste the `Authorization` header, plaintext token, Fernet key, session
secret, or database password.
