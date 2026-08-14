# 💰 apexvoid-ledger

A personal finance dashboard for monthly cash-flow tracking and loans across
multiple banks. Session-based accounts gate access — see
[Accounts & access](#-accounts--access) below.

## 🧱 Stack

- 🖥️ `frontend/` — React + Vite + TypeScript + Tailwind CSS
- ⚙️ `backend/` — FastAPI + SQLAlchemy + Alembic, backed by PostgreSQL, session
  auth via Starlette `SessionMiddleware` + `bcrypt`

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
- Contractual loan installments linked automatically from each owned loan's
  repayment schedule. They appear as read-only monthly activity under the Loan
  category, update immediately when a loan changes, and are removed when the
  loan is deleted. They are projections, not confirmation that a payment was
  completed, and are converted using the same historical-rate path.

Ordinary variable expenses remain manual; bank synchronization, imports,
payment reconciliation, and automatic categorization are not included.

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
  calendar month, including linked loan schedule expenses.
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
- `/home` — admin hub: portal shortcuts + overview (admins only; other users
  skip straight to `/dashboard`)
- `/dashboard` — account overview with saving pot, current-month cash flow, and
  loan summary (trading remains planned)
- `/cashflow` — monthly cash-flow summary, visualizations, transaction CRUD,
  category management, and **Monthly Fixed Costs** (recurring expenses)
- `/monthly-routine` — expected monthly income plan composed with fixed costs,
  loan obligations, and actual variable spending (baseline available +
  projected remainder)
- `/budget` — monthly planned savings, variable category allocations,
  budget-versus-actual progress, and safe-to-spend guidance
- `/monthly-close` — month-end financial review, immutable close snapshots,
  drift detection, and re-close
- `/saving-pot` — savings balance, add/subtract/correct, and activity history;
  closed months sync and reconcile from cash flow
- `/loan` — the loan table + form (reached from `/dashboard`'s Loan card)
- `/settings/users` — admin-only user management
- `/change-password`, `/select-currency` — one-time onboarding gates,
  forced on first login before the app is reachable

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
allocations.

### Monthly Routine (expected income)

`/monthly-routine` answers what a normal month should look like before
discretionary spending:

- **Expected income** — effective-dated recurring income rules (salary,
  allowance, retainers). Each covered month is auto-linked into Cash Flow
  without creating `Transaction` rows; historical covered months are derived
  from the same schedule and update automatically.
  A first-time setup pre-fills a monthly salary baseline; the amount remains
  required, and users can add more income sources or update future months.
- **Committed costs** — existing recurring fixed expenses + linked loan
  installments (same obligation semantics as Cash Flow).
- **Baseline available** = expected income − committed costs.
- **Projected remainder** = baseline − actual variable (manual) expenses.
- Actual manually recorded income is shown side-by-side with scheduled income.
  Do not enter the same salary manually unless it is a separate adjustment.

Scheduled income contributes to Cash Flow totals; manual income remains an
editable transaction and is counted separately.

### Monthly Budget (spending plan)

`/budget` turns Monthly Routine's established baseline into one independent
plan per account and calendar month:

- **Planned savings** is an optional reservation from baseline available.
- **Category allocations** set boundaries for manual variable expense
  categories; progress compares those allocations with actual Cash Flow
  transactions in the same month.
- **Unallocated buffer** = baseline available − planned savings − category
  allocations. It remains visible when negative so intentional over-plans are
  not hidden.
- **Safe to spend** = total category allocations − all actual manual variable
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
balances. Fixed recurring costs and loans are excluded from variable budget
usage because they are already represented in Monthly Routine's committed
costs and therefore already reduce the baseline.

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
  name), and **`SECRET_KEY`** (session cookie signing key — generate with
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Missing
  `SECRET_KEY` isn't cosmetic: `main.py` hard-requires it at startup and the
  backend container crash-loops without it — `ansible-library`'s
  `required_secret_keys` for this project now asserts it's present before
  deploying, so this fails loudly instead of shipping a broken container.

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
