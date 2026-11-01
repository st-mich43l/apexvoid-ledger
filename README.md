# 💰 apexvoid-ledger

A personal finance dashboard for monthly cash-flow tracking, a primary TPBank
bank-activity feed, and loan planning. Session-based accounts gate access — see
[Accounts & access](#-accounts--access) below.

## 🧱 Stack

- 🖥️ `frontend/` — React + Vite + TypeScript + Tailwind CSS
- ⚙️ `backend/` — FastAPI + SQLAlchemy + Alembic, backed by PostgreSQL, session
  auth via Starlette `SessionMiddleware` + `bcrypt`

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — services, data ownership, request
  flows, Mermaid diagrams, deployment, and security boundaries.
- [SePay setup](docs/SEPAY_SETUP.md) — local setup, environment variables,
  per-user account connection, Ansible, and troubleshooting.
- [UI design system](docs/UI_DESIGN_SYSTEM.md) — Quiet Premium tokens,
  primitives, migration scope, accessibility, and visual verification.

## 🏦 Loan fields

Each loan tracks:

- 🏛️ Bank name
- 📅 Open date
- 💵 Disbursement amount
- 💱 Native loan currency (defaults to the account preference and remains
  attached to the loan if that preference later changes)
- 📈 Interest rate per year
- 🔁 Term (months) — Vietnamese banking's "kỳ hạn": the loan's total count of
  monthly payment periods
- 🔓/🔒 Loan type — **unsecured** (declining balance, standard EMI/annuity
  amortization) or **secured** (fixed balance, interest simply accrues on top)

From these, the dashboard calculates:

- 🧮 Accrued interest and current balance (amortization schedule for
  unsecured loans; daily-prorated simple interest on the full principal for
  secured loans — see `backend/app/calculations.py`)
- 🗓️ Monthly interest / EMI
- ⏳ Terms remaining until maturity (elapsed terms measured from the open
  date's monthly anniversary, not distance to the maturity date)

## 💸 Cash flow

`/cashflow` provides a transaction-backed monthly ledger with:

- Manual income and expense entries, using positive stored amounts and a
  unified transaction model.
- A weekend-friendly weekly review with generated Monday–Sunday groups for the
  selected month (including clipped first/last weeks), saving several category
  expense totals atomically as ordinary manual transactions.
- Per-user income/expense categories with normalized names, optional icons,
  and soft-deactivation so historical transactions always retain a category.
- Monthly income, expenses, net cash flow, and savings rate calculated by the
  backend with decimal arithmetic.
- Income-versus-expense and spending-by-category visualizations, plus a
  responsive monthly transaction list.
- Currency-aware totals that preserve every transaction's native amount while
  converting monthly reports with historical daily reference rates from
  [Frankfurter](https://frankfurter.dev). Weekend and holiday transactions use
  the latest prior published rate, and the UI discloses every rate used.
- Loan schedules provide repayment estimates only. They never create Cash
  Flow transactions or monthly expenses. A confirmed SePay repayment is
  explicitly classified from Bank Activity and recorded once as a **Loan**
  expense; it does not update a loan record or schedule.
- SePay bank activity received through the production webhook. Incoming and
  outgoing events are stored durably and idempotently, matched to the exact
  connected account, and shown in Cash Flow for review and classification.
- A default **Monthly Living Budget** expense category can be renamed and
  selected like any other category. For the intended single-account setup, the
  primary TPBank account can use a description/reference rule to classify
  matching outgoing SePay events as ordinary expenses. If both description and
  reference matchers are configured, both must match; amount alone never
  triggers classification.
- Conservative reconciliation for matching manual entries, recurring income,
  fixed costs, and loan-schedule references. Unmatched events remain pending
  review instead of being silently assigned or double-counted.

SePay webhook activity starts as a bank-activity review item. It becomes a
normal `Transaction` only after a reliable automatic rule or an explicit user
classification. Configured Monthly Living Budget matches are ordinary
`source=sepay` expenses and are included once in Cash Flow totals, category
summaries, budgets, Monthly Close, and Saving Pot reconciliation. Net Worth
still uses verified bank balances and outstanding loan liabilities, not Cash
Flow activity. No destination account or internal-transfer model is created
for the primary-account allowance workflow.

Default categories are created lazily and idempotently the first time each
account accesses cash flow. All categories and transactions are scoped to the
authenticated account, and foreign resource IDs return `404` just like missing
ones.

## 🏦 Saving pot

`/saving-pot` tracks a single per-account savings balance with an immutable
activity ledger:

- Create the pot with an opening balance (recorded as an **opening** entry).
- Use **Add** / **Subtract** for deposits and withdrawals (optional note).
  Manual subtract cannot exceed the current balance.
- Use **Correct balance** when the real-world total differs; only the delta is
  recorded as a **balance correction**.
- After a calendar month ends, Cash Flow net is synchronized into the pot.
  The creation month only includes activity occurring at or after pot creation
  (so the opening balance is not double-counted). Later months use the full
  calendar month of recorded Cash Flow activity. Contractual loan schedules
  are estimates only and do not create Cash Flow expenses.
- If Cash Flow for an already-applied month later changes, Saving Pot
  **reconciles** only the difference (never re-applies the whole month).
- Incomplete FX conversion never permanently applies a partial month; the pot
  stays unchanged for that month and the UI shows a synchronization warning.
- One native currency per pot — changing currency after creation is rejected.
- `SavingPot.balance` remains the current snapshot; every mutation also writes
  a `SavingPotEntry`. Migration `0014` backfills a legacy baseline plus known
  monthly applications without changing existing balances.

## 🔐 Accounts & access

- Registration is **admin-gated** — there's no public sign-up. Admins invite
  new accounts from `/settings/users` (list, invite, delete).
- The first admin (`admin` / `admin`) auto-seeds on first deploy, only when
  the `User` table is empty, with a forced password change on first login
  (enforced server-side).
- Currency is a per-account preference (chosen once on first login, editable
  anytime from the header), not a per-browser setting.
- Locked out, or need to bootstrap a recovery account without the UI?
  `python -m app.cli create-user` / `reset-password` (inside the backend
  container or a local venv) — see `backend/app/cli.py`.

### Page structure

- `/login` — sign in (username, not email)
- `/home` — admin hub: portal shortcuts, dashboard entry, compound-interest
  calculator, and a loan calculator (disbursement, annual rate, term,
  unsecured/secured) that derives monthly payment. Calculators do not write
  ledger data. Admins only; other users skip straight to `/dashboard`.
- `/dashboard` — account overview with saving pot, current-month cash flow, and
  loan summary (trading remains planned)
- `/net-worth` — verified SePay bank assets minus outstanding loan liabilities,
  with stale/unavailable balance states and manual synchronization
- `/cashflow` — monthly cash-flow summary, visualizations, transaction CRUD,
  category management, **Monthly Fixed Costs** (recurring expenses), and
  SePay bank-activity review/classification
- `/monthly-routine` — expected monthly income plan composed with fixed costs
  and actual variable spending (baseline available + projected remainder)
- `/budget` — monthly planned savings, variable category allocations,
  budget-versus-actual progress, and safe-to-spend guidance
- `/monthly-close` — month-end financial review, immutable close snapshots,
  drift detection, and re-close
- `/saving-pot` — savings balance, add/subtract/correct, and activity history;
  closed months sync and reconcile from cash flow
- `/loan` — the loan table + form (reached from `/dashboard`'s Loan card)
- `/settings/users` — password management for every user, plus account
  management and non-admin password resets for admins
- `/select-currency` — one-time onboarding gate, forced after a password
  update when no preferred currency is set

Financial resources are scoped to their owning account. Loan, category,
transaction, recurring-expense, monthly-budget, monthly-close, and saving-pot routers require authentication
and filter every resource query by
the logged-in user's id, so a mismatched id 404s instead of leaking that it
belongs to someone else. Loans created before ownership existed were backfilled
to whichever account was created first — see migration `0010`; migration `0011`
adds the cash-flow schema, migration `0012` adds native loan currency for
safe cross-currency reporting, migration `0013` adds Saving Pot,
migration `0014` adds the Saving Pot activity ledger with a non-destructive
backfill, migration `0015` adds recurring expenses with effective-dated
revisions, migration `0016` adds recurring expected income for Monthly
Routine planning, and migration `0017` adds monthly budgets and category
allocations. Migration 0018 adds monthly-close snapshots, and migration
  0019 adds user-owned financial accounts for Net Worth, migration 0020 adds
  encrypted per-user SePay credentials, and migration 0021 adds the durable
  SePay webhook activity inbox and account-number fingerprint. Migration 0022
  adds the optional outgoing categorization rule to the existing connected
  account. Migration `0023` adds encrypted per-account webhook credentials,
  and migration `0024` records the selected webhook mode plus the encrypted
  OAuth client ID where applicable.

### Net Worth and SePay

For complete local, production, Ansible, environment-variable, API, and
troubleshooting instructions, see [docs/SEPAY_SETUP.md](docs/SEPAY_SETUP.md).

Net Worth is intentionally limited to:

- verified balances from explicitly linked SePay bank accounts;
- outstanding balances from the existing Loan calculation.

Cash-flow income/expenses, expected income, Saving Pots, and scheduled loan
payments are not added as separate assets or liabilities. Saving Pots are
excluded because they may already be part of a synchronized bank balance.

To enable a per-user SePay connection, the user enters the primary TPBank
SePay API token, visible bank account number, and webhook-authentication
settings in `/net-worth`. The backend validates the token with SePay, then
encrypts it and any webhook credentials at rest with an installation key that
it creates and keeps in its persistent backend volume. The user never supplies
that encryption key.

- SEPAY_API_BASE_URL — optional test/deployment override; defaults to
  https://my.sepay.vn/userapi.

Each user connects from `/net-worth` with the primary account's SePay API token
and visible bank account number. The backend resolves SePay's internal account
ID, validates the connection, stores only Fernet-encrypted credentials, and
never returns secrets to the browser. The form supports SePay's four delivery
modes: **HMAC-SHA256** (recommended), **API Key**, **OAuth 2.0**, and **None**
for controlled testing only. Accounts are isolated by the authenticated Ledger
user. See the setup guide for the exact request contract, headers, token
endpoint, migration recovery, and review workflow.
Balances synchronize on demand while the Net Worth/Dashboard UI is active, no
more often than every five minutes, and manual refreshes are server-rate-limited.
The integration is read-only: it does not import transactions, initiate
transfers, or request bank credentials/OTPs. A failed synchronization preserves
the last valid balance and marks it stale; an unavailable balance is shown as
unavailable rather than as 0.

### Monthly Routine (expected income)

`/monthly-routine` answers what a normal month should look like before
discretionary spending:

- **Expected income** — effective-dated recurring income rules (salary,
  allowance, retainers). Each covered month is auto-linked into Cash Flow
  without creating `Transaction` rows; historical covered months are derived
  from the same schedule and update automatically.
  A first-time setup pre-fills a monthly salary baseline; the amount remains
  required, and users can add more income sources or update future months.
  Inactive schedules can be permanently deleted from Manage. Deletion removes
  that schedule's derived projections (including prior months) but never
  deletes recorded Cash Flow transactions or bank activity. Active schedules
  must be stopped before they can be deleted.
- **Committed costs** — existing recurring fixed expenses. Loan schedules
  remain estimates; a completed repayment is tracked from the matching bank
  activity instead of becoming a generated Cash Flow expense.
- **Baseline available** = expected income − committed costs.
- **Projected remainder** = baseline − actual variable expenses, including
  categorized SePay expenses.
- Actual manually recorded income is shown side-by-side with scheduled income.
  Do not enter the same salary manually unless it is a separate adjustment.

Scheduled income contributes to Cash Flow totals; manual income remains an
editable transaction and is counted separately.

SePay activity uses the Vietnam banking day (`Asia/Ho_Chi_Minh`) for its display
date, review filter, Cash Flow, budget, Saving Pot, and trend reporting. The
application stores timestamps in UTC, but an early-morning local transaction is
never shifted into the preceding calendar month.

### Monthly Budget (spending plan)

`/budget` turns Monthly Routine's established baseline into one independent
plan per account and calendar month:

- **Planned savings** is an optional reservation from baseline available.
- **Category allocations** set boundaries for variable expense categories;
  progress compares those allocations with actual Cash Flow transactions in the
  same month, including categorized SePay expenses.
- **Unallocated buffer** = baseline available − planned savings − category
  allocations. It remains visible when negative so intentional over-plans are
  not hidden.
- **Safe to spend** = total category allocations − all actual variable
  spending. Expenses in categories without allocations are surfaced as
  unbudgeted spending and still reduce this amount.
- **Daily spending pace** is shown for the current calendar month using the
  remaining safe amount and days left including today.
- A previous month's plan can be copied as a one-time snapshot. Later edits to
  either month do not propagate.
- Budget currency is captured from the account reporting currency when the
  month is first created and remains stable for that month. Actual foreign
  spending uses Ledger's existing historical FX path; incomplete conversion
  is disclosed and safe-to-spend is withheld instead of presenting a partial
  value as authoritative.

Budget plans do not create transactions and do not directly move Saving Pot
balances. Fixed recurring costs are excluded from variable budget usage because
they are already represented in Monthly Routine's committed costs. A confirmed
SePay loan repayment is an imported **Loan** expense, so it is included in
Cash Flow and budget actuals exactly once rather than generated by a schedule.

### Monthly Close (financial review)

`/monthly-close` stores an auditable checkpoint of a completed month. It
snapshots Cash Flow, the month's Budget result when one exists, and the
relevant Saving Pot month application.

- Closing a month **does not lock** historical transactions, recurring rules,
  loans, or budgets.
- Each close creates an immutable `MonthlyCloseSnapshot` revision. Re-closing
  after a correction creates a new revision; earlier snapshots are never
  rewritten.
- If historical financial data later changes, Ledger marks the month as
  **Needs review** instead of mutating the original close.
- The current calendar month can be previewed but cannot be closed until it
  has ended.
- Explicit close may run the existing closed-month Saving Pot
  synchronization. Ordinary Monthly Close GET requests remain read-only.
- Manual Saving Pot add/subtract activity does not by itself cause month-close
  drift, because close identity uses the month application amount, not the
  pot's current balance.
- Incomplete FX conversion blocks close so partial totals are never stored as
  official.
- Linked loan installments remain contractual schedule projections, not
  payment-completion records. Monthly Close does not add paid/unpaid loan
  tracking.

### Monthly Fixed Costs (recurring expenses)

Cash Flow can include scheduled monthly obligations (rent, support, internet,
subscriptions, etc.) without recreating them every month.

- Rules live as `RecurringExpense` + effective-dated `RecurringExpenseRevision`
  rows — **not** as auto-generated `Transaction` records.
- Each month’s due date is derived in the shared cash-flow engine (same path as
  manual transactions and linked loan installments), then converted with
  historical FX when needed.
- Editing is effective-dated: changing rent from September leaves earlier
  months at the previous amount. Stop ends the schedule from a chosen month;
  Resume starts a new period (gaps are not backfilled).
- Inactive schedules can be permanently deleted from Manage. This removes the
  schedule's derived projections, including historical ones, while leaving
  manual and imported bank transactions untouched. An active schedule must be
  stopped first.
- Fixed costs are **planned obligations**, not payment confirmation — similar
  to linked loan expenses.
- Monthly summary exposes fixed / variable / loan / committed totals:
  `expenses = fixed + variable + loan`, and
  `committed = fixed + loan`.
- Saving Pot sync/reconciliation picks up recurring costs automatically because
  it consumes the same shared aggregation — no special Saving Pot write path.
- Do not also enter the same monthly obligation as a manual expense unless it
  is a separate adjustment.

## 🚀 Running locally

1. Start the full stack (Postgres + backend + frontend):

   ```bash
   docker compose up -d --build
   ```

   Postgres stores data under `./.data/postgres` (gitignored). Rebuilds and
   `docker compose down` / `down -v` keep that directory, so local test accounts
   and transactions survive. Delete `./.data/postgres` only when you want a
   clean database.

   Or start only Postgres and run the API/UI on the host:

   ```bash
   docker compose up -d postgres
   ```

2. Backend (host mode):

   ```bash
   cd backend
   cp .env.example .env   # if not already present — sets SECRET_KEY and
                           # SESSION_COOKIE_SECURE=false for local http dev
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head    # also auto-seeds admin:admin if User is empty
   uvicorn app.main:app --reload --port 4000   # http://localhost:4000
   ```

3. Frontend (host mode):

   ```bash
   cd frontend
   npm install
   npm run dev              # http://localhost:5173
   ```

Full-stack UI: http://localhost:8080. Host-mode frontend proxies `/api/*` to
the backend on port 4000. Log in with `admin` / `admin`, then set a new
password and currency when prompted.

## 🚢 Deployment

CI/CD deploys via [`ansible-library`](https://github.com/st-mich43l/ansible-library)
(project key `apexvoid-ledger`), same pattern as the other `apexvoid-*` services:
`.github/workflows/deploy.yml` builds `backend/` and `frontend/` images, pushes
them to Docker Hub, then Ansible renders `deployment-template/docker-compose.yml.j2`
on the VPS and pulls/starts the stack (backend + frontend + its own Postgres).

🌐 Public at **https://ledger.apexvoid.net** via the shared [`routing`](https://github.com/st-mich43l/routing)
nginx project — `backend` and `frontend` join the external `routing` Docker
network, and `routing`'s `nginx/includes/apexvoid-ledger-routes.conf` proxies
`/api/*` to `apexvoid-ledger-backend:4000` and everything else to
`apexvoid-ledger-frontend:80`.

### 🔧 One-time setup before the first deploy

- 🔑 Repo secrets (`Settings → Secrets and variables → Actions`):
  - `DOCKERHUB_TOKEN` — Docker Hub access token for the `mich43l` namespace.
  - `ANSIBLE_VAULT_PASSWORD` — same vault password used by the other
    `apexvoid-*` repos.
- 🔐 In `ansible-library`, `inventory/group_vars/all/vault.yml` needs a
  `vault_apexvoid_ledger_env` entry with `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DB`, `DATABASE_URL` (host must be `postgres`, the compose service
  name) and **`SECRET_KEY`**. `SECRET_KEY` is an operator-owned application
  secret used for session cookies and signed OAuth webhook tokens; it is not a
  SePay credential and is never entered by users. Individual SePay tokens,
  webhook secrets, OAuth client IDs, and bank account numbers are entered by
  users and stored securely by the application. The backend-generated
  credential-encryption key is kept in the persistent `backend_secrets`
  volume, so `SEPAY_CREDENTIAL_ENCRYPTION_KEY` is not required in Compose or
  the vault.

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
