import { cloneElement, isValidElement, lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { useAuth } from './hooks/useAuth'
import { useMoneyPrivacy } from './lib/moneyPrivacy'
import { loadCashFlow, loadDashboard, loadNetWorth } from './lib/routePreload'

const AdminUsersPage = lazy(() => import('./pages/admin/Users').then((module) => ({ default: module.AdminUsersPage })))
const CashFlowPage = lazy(loadCashFlow)
const BudgetPage = lazy(() => import('./pages/Budget').then((module) => ({ default: module.BudgetPage })))
const Dashboard = lazy(loadDashboard)
const HomePage = lazy(() => import('./pages/Home').then((module) => ({ default: module.HomePage })))
const LoanPage = lazy(() => import('./pages/Loan').then((module) => ({ default: module.LoanPage })))
const LoanDetailPage = lazy(() => import('./pages/LoanDetail').then((module) => ({ default: module.LoanDetailPage })))
const LoginPage = lazy(() => import('./pages/Login').then((module) => ({ default: module.LoginPage })))
const MonthlyClosePage = lazy(() => import('./pages/MonthlyClose').then((module) => ({ default: module.MonthlyClosePage })))
const MonthlyRoutinePage = lazy(() => import('./pages/MonthlyRoutine').then((module) => ({ default: module.MonthlyRoutinePage })))
const NetWorthPage = lazy(loadNetWorth)
const NotificationsPage = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.NotificationsPage })))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettings').then((module) => ({ default: module.NotificationSettingsPage })))
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
      <Route path="login" element={<LazyPage label="Sign in"><LoginPage /></LazyPage>} />

      <Route element={<RequireAuth />}>
        {/* Kept as a compatibility redirect for bookmarked links. Password
            management now lives in the in-app User Accounts section. */}
        <Route path="change-password" element={<Navigate to="/settings/users" replace />} />
        <Route path="select-currency" element={<LazyPage label="Currency setup"><SelectCurrencyPage /></LazyPage>} />

        <Route element={<Layout />}>
          <Route index element={<DefaultRoute />} />
          <Route path="dashboard" element={<LazyPage label="Dashboard"><Dashboard /></LazyPage>} />
          <Route path="cashflow" element={<LazyPage label="Cash Flow"><CashFlowPage /></LazyPage>} />
          <Route path="budget" element={<LazyPage label="Budget"><BudgetPage /></LazyPage>} />
          <Route path="monthly-close" element={<LazyPage label="Month close"><MonthlyClosePage /></LazyPage>} />
          <Route path="monthly-routine" element={<LazyPage label="Monthly Routine"><MonthlyRoutinePage /></LazyPage>} />
          <Route path="net-worth" element={<LazyPage label="Net Worth"><NetWorthPage /></LazyPage>} />
          <Route path="saving-pot" element={<LazyPage label="Saving Pot"><SavingPotPage /></LazyPage>} />
          <Route path="loan" element={<LazyPage label="Loans"><LoanPage /></LazyPage>} />
          <Route path="loan/:loanId" element={<LazyPage label="Loan details"><LoanDetailPage /></LazyPage>} />
          <Route path="tools" element={<Navigate to="/home" replace />} />

          <Route path="settings/users" element={<LazyPage label="User accounts"><AdminUsersPage /></LazyPage>} />
          <Route path="notifications" element={<LazyPage label="Notifications"><NotificationsPage /></LazyPage>} />
          <Route path="settings/notifications" element={<LazyPage label="Notification settings"><NotificationSettingsPage /></LazyPage>} />

          <Route element={<RequireAdmin />}>
            <Route path="home" element={<LazyPage label="Home"><HomePage /></LazyPage>} />
          </Route>

          <Route path="*" element={<DefaultRoute />} />
        </Route>
      </Route>
    </Routes>
  )
}

function LazyPage({ children, label = 'Workspace' }: { children: ReactNode; label?: string }) {
  // Re-render the current page on a privacy change without remounting it or losing form state.
  useMoneyPrivacy()
  return <Suspense fallback={<PageLoading label={label} />}>{isValidElement(children) ? cloneElement(children) : children}</Suspense>
}

function PageLoading({ label }: { label: string }) {
  return <section role="status" aria-label={`Loading ${label}`} aria-busy="true" className="min-h-48 space-y-4">
    <div className="h-5 w-28 rounded bg-ledger-subtle" />
    <div className="h-8 w-52 max-w-full rounded bg-ledger-subtle" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="h-24 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-surface" /><div className="h-24 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-surface" /></div>
    <span className="sr-only">Loading {label}…</span>
  </section>
}

export default App
