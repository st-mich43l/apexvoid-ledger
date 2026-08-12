# 📜 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### 📋 Deployment note
- The auth work below needs `SECRET_KEY` (session signing key) added to
  `apexvoid_ledger_secrets` in `ansible-library`'s vault — `main.py`
  hard-requires it at startup and the container crash-loops without it.

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
