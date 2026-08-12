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

Income and ordinary expenses remain manual in v0.3.0; bank synchronization,
imports, general recurring transactions, payment reconciliation, and budgets
are not included yet.

Default categories are created lazily and idempotently the first time each
account accesses cash flow. All categories and transactions are scoped to the
authenticated account, and foreign resource IDs return `404` just like missing
ones.

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
- `/dashboard` — account overview with current-month cash flow and loan summary
  (trading and other asset types remain planned)
- `/cashflow` — monthly cash-flow summary, visualizations, transaction CRUD,
  and category management
- `/loan` — the loan table + form (reached from `/dashboard`'s Loan card)
- `/settings/users` — admin-only user management
- `/change-password`, `/select-currency` — one-time onboarding gates,
  forced on first login before the app is reachable

Financial resources are scoped to their owning account. Loan, category, and
transaction routers require authentication and filter every resource query by
the logged-in user's id, so a mismatched id 404s instead of leaking that it
belongs to someone else. Loans created before ownership existed were backfilled
to whichever account was created first — see migration `0010`; migration `0011`
adds the cash-flow schema, and migration `0012` adds native loan currency for
safe cross-currency reporting.

## 🚀 Running locally

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env   # if not already present — sets SECRET_KEY and
                           # SESSION_COOKIE_SECURE=false for local http dev
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head    # also auto-seeds admin:admin if User is empty
   uvicorn app.main:app --reload --port 4000   # http://localhost:4000
   ```

3. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev              # http://localhost:5173
   ```

The frontend dev server proxies `/api/*` to the backend on port 4000. Log in
with `admin` / `admin`, then set a new password and currency when prompted.

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
