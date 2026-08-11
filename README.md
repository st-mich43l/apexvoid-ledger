# 💰 apexvoid-ledger

A personal dashboard for tracking loans across multiple banks: open date, disbursement amount, interest rate, and calculated running balance.

## 🧱 Stack

- 🖥️ `frontend/` — React + Vite + TypeScript + Tailwind CSS
- ⚙️ `backend/` — Express + TypeScript + Prisma, backed by PostgreSQL

## 🏦 Loan fields

Each loan tracks:

- 📅 Open date
- 💵 Disbursement amount
- 📈 Interest rate per year
- 🏛️ Bank name

From these, the dashboard calculates (simple interest, prorated daily):

- ⏳ Days elapsed since the open date
- 🧮 Accrued interest
- 💳 Current balance (disbursement amount + accrued interest)
- 🗓️ Monthly interest

## 🚀 Running locally

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env   # if not already present
   npm install
   npx prisma migrate dev
   npm run dev             # http://localhost:4000
   ```

3. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev              # http://localhost:5173
   ```

The frontend dev server proxies `/api/*` to the backend on port 4000.

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

> [!WARNING]
> 🔓 The app currently ships with **no authentication**. Anyone with the URL
> can read and edit loan data. Add auth before relying on this being deployed.

### 🔧 One-time setup before the first deploy

- 🔑 Repo secrets (`Settings → Secrets and variables → Actions`):
  - `DOCKERHUB_TOKEN` — Docker Hub access token for the `mich43l` namespace.
  - `ANSIBLE_VAULT_PASSWORD` — same vault password used by the other
    `apexvoid-*` repos.
- 🔐 In `ansible-library`, `inventory/group_vars/all/vault.yml` needs a
  `vault_apexvoid_ledger_env` entry with `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DB`, and `DATABASE_URL` (host must be `postgres`, the compose
  service name).

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
