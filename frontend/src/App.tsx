import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { useAuth } from './context/AuthContext'

const AdminUsersPage = lazy(() => import('./pages/admin/Users').then((module) => ({ default: module.AdminUsersPage })))
const CashFlowPage = lazy(() => import('./pages/CashFlow').then((module) => ({ default: module.CashFlowPage })))
const BudgetPage = lazy(() => import('./pages/Budget').then((module) => ({ default: module.BudgetPage })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const HomePage = lazy(() => import('./pages/Home').then((module) => ({ default: module.HomePage })))
const LoanPage = lazy(() => import('./pages/Loan').then((module) => ({ default: module.LoanPage })))
const LoanDetailPage = lazy(() => import('./pages/LoanDetail').then((module) => ({ default: module.LoanDetailPage })))
const LoginPage = lazy(() => import('./pages/Login').then((module) => ({ default: module.LoginPage })))
const MonthlyClosePage = lazy(() => import('./pages/MonthlyClose').then((module) => ({ default: module.MonthlyClosePage })))
const MonthlyRoutinePage = lazy(() => import('./pages/MonthlyRoutine').then((module) => ({ default: module.MonthlyRoutinePage })))
const NetWorthPage = lazy(() => import('./pages/NetWorth').then((module) => ({ default: module.NetWorthPage })))
const SavingPotPage = lazy(() => import('./pages/SavingPot').then((module) => ({ default: module.SavingPotPage })))
const SelectCurrencyPage = lazy(() => import('./pages/SelectCurrency').then((module) => ({ default: module.SelectCurrencyPage })))

// Admins land on /home (admin portal, dashboard hub, and finance tools);
// everyone else goes straight to /dashboard.
function DefaultRoute() {
  const { user } = useAuth()
  return <Navigate to={user?.isAdmin ? '/home' : '/dashboard'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="login" element={<LazyPage><LoginPage /></LazyPage>} />

      <Route element={<RequireAuth />}>
        {/* Kept as a compatibility redirect for bookmarked links. Password
            management now lives in the in-app User Accounts section. */}
        <Route path="change-password" element={<Navigate to="/settings/users" replace />} />
        <Route path="select-currency" element={<LazyPage><SelectCurrencyPage /></LazyPage>} />

        <Route element={<Layout />}>
          <Route index element={<DefaultRoute />} />
          <Route path="dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
          <Route path="cashflow" element={<LazyPage><CashFlowPage /></LazyPage>} />
          <Route path="budget" element={<LazyPage><BudgetPage /></LazyPage>} />
          <Route path="monthly-close" element={<LazyPage><MonthlyClosePage /></LazyPage>} />
          <Route path="monthly-routine" element={<LazyPage><MonthlyRoutinePage /></LazyPage>} />
          <Route path="net-worth" element={<LazyPage><NetWorthPage /></LazyPage>} />
          <Route path="saving-pot" element={<LazyPage><SavingPotPage /></LazyPage>} />
          <Route path="loan" element={<LazyPage><LoanPage /></LazyPage>} />
          <Route path="loan/:loanId" element={<LazyPage><LoanDetailPage /></LazyPage>} />
          <Route path="tools" element={<Navigate to="/home" replace />} />

          <Route path="settings/users" element={<LazyPage><AdminUsersPage /></LazyPage>} />

          <Route element={<RequireAdmin />}>
            <Route path="home" element={<LazyPage><HomePage /></LazyPage>} />
          </Route>

          <Route path="*" element={<DefaultRoute />} />
        </Route>
      </Route>
    </Routes>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-36 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-surface p-5 text-sm text-ledger-text-secondary">Loading workspace…</div>}>{children}</Suspense>
}

export default App
