# 📜 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### ✨ Added
- 📅 Monthly Routine (`/monthly-routine`): expected recurring income plus
  committed fixed costs/loans, baseline available, actual variable spending,
  and projected remainder — without inventing Cash Flow or Saving Pot income.
- 💼 Recurring expected income with effective-dated revisions, stop/resume,
  and `/api/recurring-incomes` (+ `/api/monthly-routine`).
- 🧬 Migration `0016` adds `RecurringIncome` and `RecurringIncomeRevision`.
- 🏠 Monthly Fixed Costs (recurring expenses): define rent, support, utilities,
  and other monthly obligations once with due day, start month, and optional
  end month. Effective-dated revisions preserve history on edit; stop/resume
  end or restart the schedule without deleting past Cash Flow.
- 📊 Cash Flow summary breakdowns: `fixedExpenseTotal`, `variableExpenseTotal`,
  `loanPaymentTotal`, `committedExpenseTotal`, plus recurring activity in the
  monthly list and category chart (shared aggregation — no generated
  `Transaction` rows).
- 🧬 Migration `0015` adds `RecurringExpense` and `RecurringExpenseRevision`.
- 📒 Saving Pot activity ledger (`SavingPotEntry`) for opening balances, manual
  add/subtract, balance corrections, monthly cash-flow applications, and
  reconciliations — with optional notes and `/api/saving-pot/history`.
- 🔁 Closed-month cash-flow reconciliation: when historical transactions or
  linked loan schedule amounts change, only the delta is applied.
- ⏱️ Creation-month cutoff so pre-pot activity is not double-counted against
  the opening balance.
- 💱 FX-safe month sync: incomplete conversion skips that month with a warning
  instead of persisting a partial net.
- 🧬 Migration `0014` adds `SavingPotEntry` and backfills legacy balances
  without changing `SavingPot.balance`.

### 🔧 Changed
- Saving Pot page shows recent activity and a Correct balance action.
- Shared cash-flow aggregation supports arbitrary periods (used by monthly
  summary and Saving Pot sync).

### ✨ Previously unreleased
- 🏦 Saving Pot v1: one pot per account with opening balance create, manual
  add/subtract adjustments, plus lazy end-of-month auto-apply of Cash Flow net
  (plus or minus) recorded once per closed month. Dashboard card and
  `/saving-pot` page included.
- 🧬 Migration `0013` adds `SavingPot` and `SavingPotMonthApplication`.
- 💳 New default expense category for Credit Card, seeded idempotently for
  existing accounts the next time they open Cash Flow.
- 🛟 New default expense category for Support, seeded idempotently for
  existing accounts the next time they open Cash Flow.

### 🔧 Previously unreleased
- Local `docker-compose.yml` bind-mounts Postgres to `./.data/postgres` so
  test data survives rebuilds and `docker compose down -v`.
- Monthly cash-flow aggregation extracted to a shared helper used by both the
  summary endpoint and saving-pot month apply.

### 📋 Deployment note
- The auth work below needs `SECRET_KEY` (session signing key) added to
  `apexvoid_ledger_secrets` in `ansible-library`'s vault — `main.py`
  hard-requires it at startup and the container crash-loops without it.

## [0.3.0] — 2026-08-12

### ✨ Added
- 💸 Cash Flow Core: a new `/cashflow` route with URL-driven month navigation,
  income, expenses, net cash flow, savings rate, and a responsive transaction
  history.
- 📊 Lightweight income-versus-expense and spending-by-category charts using
  backend-provided monthly totals; empty months have purposeful empty states.
- 🧾 Unified manual transaction CRUD for income and expenses, including an
  accessible shared add/edit dialog and explicit delete confirmation.
- 🗓️ Weekend-friendly weekly expense review for recording several category
  totals in one atomic save without introducing a separate weekly-total model.
- 🗓️ Month-aware weekly group choices such as `1–2 Aug`, `3–9 Aug`,
  and `10–16 Aug`, with clear range labels retained on generated entries.
- 🗂️ Per-user category CRUD with normalized uniqueness, useful lazily seeded
  defaults, activation management, and soft-deletion that preserves history.
- 💆 New default expense categories for Spa & Beauty, Travel, and Gifts,
  automatically added idempotently for existing accounts.
- 🧮 Decimal-based backend aggregation with expense category percentages,
  zero-income handling, strict calendar boundaries, and explicit reporting of
  any currencies that remain unconverted after a provider failure.
- 💱 Historical daily currency conversion for monthly reporting, with original
  transaction amounts preserved, auditable per-date rates, precision-safe
  inversion for low-valued base currencies, caching, and graceful partial
  totals when the external reference-rate provider is unavailable.
- 🔗 Automatic, read-only monthly loan obligations derived from each owned
  loan's contractual schedule, grouped under Loan expenses and kept in sync
  without duplicating transaction records.
- 💵 Native currency on every loan, including owner-preference backfill for
  existing records and historical FX conversion for linked installments.
- 🧬 Migration `0011` adds indexed `Category` and `Transaction` tables with
  user/category foreign keys and ownership-safe constraints.
- 🧬 Migration `0012` adds and validates the native currency on loans.
- 🧪 Comprehensive API coverage for authentication, isolation, validation,
  category consistency, CRUD, date boundaries, currency isolation, and summary
  calculations.

### 🔧 Changed
- Dashboard Cash Flow card is now active and shows current-month net, income,
  and expenses in the account's preferred currency.
- Loan and transaction forms share the same robust `dd/mm/yyyy` date helpers.
- Loan schedules now use native-currency precision: cents for decimal
  currencies and whole units for VND/JPY.

## [2026-08-12] — Per-user loan scoping

### 🔒 Security
- 🔐 `routers/loans.py` now requires auth and filters every query by the
  logged-in user's id — closes the gap where every loan was visible to
  every logged-in account. A loan id that belongs to someone else 404s
  exactly like a nonexistent one, so it can't be used to probe whether an
  id is valid for another account.
- 🧬 Migration `0010` backfills every pre-existing (previously unowned)
  loan to whichever account was created first, then enforces `userId`
  `NOT NULL` — verified against a simulated legacy DB (a loan inserted
  with no owner, then migrated and confirmed reassigned) before shipping.

## [2026-08-12] — Authentication, admin accounts, per-account preferences

### ✨ Added
- 🔐 Session-based auth (Starlette `SessionMiddleware`, signed httpOnly
  cookie) with `bcrypt` password hashing. Login is by **username**, not
  email — the seeded admin account was never an email address to begin
  with.
- 👑 Admin role (`isAdmin`). Registration is admin-gated: no public
  sign-up, only an existing admin can create accounts, from a dedicated
  `/settings/users` portal (list, invite, delete — guarded against
  deleting yourself, the last remaining admin, or a user who still owns
  loans).
- 🌱 First admin account (`admin` / `admin`) auto-seeds on first deploy,
  only when the `User` table is completely empty — never re-seeds over a
  real setup. Forced password change on first login, enforced
  server-side, not just a frontend nudge.
- 🏠 `/home` hub for admins — Admin Portal + Dashboard cards; regular
  users still land on `/dashboard` directly.
- 💱 Currency is now an account-level preference, not a per-browser one.
  Chosen once on first login (same forced-gate pattern as the password
  change) and changeable anytime from the header — persists across
  devices since it's stored on the account, not `localStorage`.
- 🎨 A real brand mark ("Rising Balance": the trending-up line every loan
  card already draws, ending in an open ring) replacing the generic
  placeholder favicon/logo. Brand renamed from `apexvoid` to **ApexVoid
  Ledger** throughout the UI.
- 🚩 Real SVG country flags (`flag-icons`) in the currency picker,
  replacing emoji flags — emoji flags don't render on Windows, which was
  showing raw two-letter codes instead of a flag.

### 🔧 Changed
- `/change-password` and the new `/select-currency` moved out of the
  app's `Layout` chrome — both are one-time gates between login and the
  app, not pages within it, so they're standalone like `/login` instead
  of showing the full header around a form you can't back out of.

## [2026-08-11] — Loan dashboard, Python backend, premium UI

### ✨ Added
- 💰 Loan tracking dashboard: React/Vite/Tailwind frontend, each loan
  tracking bank name, open date, disbursement amount, and interest rate
  per year. Calculated fields: accrued interest, current balance, and
  monthly interest.
- 🐳 Multi-stage Docker images, CI/CD via
  [`ansible-library`](https://github.com/st-mich43l/ansible-library)'s
  image-mode deploy pipeline, public routing at `ledger.apexvoid.net`
  through the shared [`routing`](https://github.com/st-mich43l/routing)
  project.
- 🐍 Backend rewritten from Node/Express/Prisma to **FastAPI +
  SQLAlchemy + Alembic** on the same Postgres schema — migrations adopt
  the existing `Loan` table rather than resetting it.
- 📅 Loan duration (term caps interest accrual) and secured vs.
  unsecured loan types — unsecured loans amortize on a standard
  EMI/annuity schedule, secured loans accrue interest against a fixed
  balance.
- 🖥️ `/dashboard` and `/loan` routes with premium stat cards, plus a
  currency selector (display-only at this point — became a real
  per-account preference in the 2026-08-12 entry above).
- 💅 Premium light/dark visual pass: neutral + violet palette,
  rounded-3xl cards, dd/mm/yyyy dates, live comma-formatted amount
  input.
