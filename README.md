# apexvoid-ledger

A personal dashboard for tracking loans across multiple banks: open date, disbursement amount, interest rate, and calculated running balance.

## Stack

- `frontend/` — React + Vite + TypeScript + Tailwind CSS
- `backend/` — Express + TypeScript + Prisma, backed by PostgreSQL

## Loan fields

Each loan tracks:

- Open date
- Disbursement amount
- Interest rate per year
- Bank name

From these, the dashboard calculates (simple interest, prorated daily):

- Days elapsed since the open date
- Accrued interest
- Current balance (disbursement amount + accrued interest)
- Monthly interest

## Running locally

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
