# 📜 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### 🔒 Security
- ⚠️ No authentication yet — anyone with the deployed URL can read and edit
  loan data. Tracked as a required follow-up before the app is relied on.

## [2026-08-11] — Initial dashboard + deployment

### ✨ Added
- 💰 Loan tracking dashboard: React/Vite/Tailwind frontend, Express/Prisma
  backend on PostgreSQL. Each loan tracks bank name, open date, disbursement
  amount, and interest rate per year.
- 🧮 Calculated fields per loan: days elapsed, accrued interest, current
  balance, and monthly interest (simple interest, prorated daily).
- 🐳 Multi-stage Docker images for backend (runs `prisma migrate deploy` on
  boot) and frontend (nginx, proxies `/api` to the backend).
- 🚢 CI/CD via [`ansible-library`](https://github.com/st-mich43l/ansible-library)'s
  image-mode deploy pipeline (build → push → pull on the VPS).
- 🌐 Public routing at `ledger.apexvoid.net` through the shared
  [`routing`](https://github.com/st-mich43l/routing) nginx project.
