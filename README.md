# 💰 apexvoid-ledger

A personal finance dashboard, starting with loan tracking across multiple banks:
open date, disbursement amount, interest rate, term, and a calculated running
balance. Session-based accounts gate access — see [Accounts & access](#-accounts--access) below.

## 🧱 Stack

- 🖥️ `frontend/` — React + Vite + TypeScript + Tailwind CSS
- ⚙️ `backend/` — FastAPI + SQLAlchemy + Alembic, backed by PostgreSQL, session
  auth via Starlette `SessionMiddleware` + `bcrypt`

## 🏦 Loan fields

Each loan tracks:

- 🏛️ Bank name
- 📅 Open date
- 💵 Disbursement amount
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
- `/dashboard` — account overview (loan summary now; trading account and
  other asset types are planned, currently shown as "coming soon")
- `/loan` — the loan table + form (reached from `/dashboard`'s Loan card)
- `/settings/users` — admin-only user management
- `/change-password`, `/select-currency` — one-time onboarding gates,
  forced on first login before the app is reachable

Loans are scoped to their owning account — `routers/loans.py` requires
auth and filters every query by the logged-in user's id, so one account
can never see or modify another's loans (a mismatched id 404s, same as a
nonexistent one, rather than leaking that the loan belongs to someone
else). Loans created before this existed were backfilled to whichever
account was created first — see migration `0010`.

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
