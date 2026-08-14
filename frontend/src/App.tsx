import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { useAuth } from './context/AuthContext'
import { AdminUsersPage } from './pages/admin/Users'
import { ChangePasswordPage } from './pages/ChangePassword'
import { CashFlowPage } from './pages/CashFlow'
import { BudgetPage } from './pages/Budget'
import { Dashboard } from './pages/Dashboard'
import { HomePage } from './pages/Home'
import { LoanPage } from './pages/Loan'
import { LoanDetailPage } from './pages/LoanDetail'
import { LoginPage } from './pages/Login'
import { MonthlyClosePage } from './pages/MonthlyClose'
import { MonthlyRoutinePage } from './pages/MonthlyRoutine'
import { SavingPotPage } from './pages/SavingPot'
import { SelectCurrencyPage } from './pages/SelectCurrency'

// Admins land on /home (admin portal + dashboard hub); everyone else goes
// straight to /dashboard, since /home has nothing for them.
function DefaultRoute() {
  const { user } = useAuth()
  return <Navigate to={user?.isAdmin ? '/home' : '/dashboard'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        {/* Standalone, like /login — these are gates between login and the app
            (only reachable via RequireAuth's forced redirects), not pages
            within it, so they skip Layout's header/chrome entirely. */}
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="select-currency" element={<SelectCurrencyPage />} />

        <Route element={<Layout />}>
          <Route index element={<DefaultRoute />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cashflow" element={<CashFlowPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="monthly-close" element={<MonthlyClosePage />} />
          <Route path="monthly-routine" element={<MonthlyRoutinePage />} />
          <Route path="saving-pot" element={<SavingPotPage />} />
          <Route path="loan" element={<LoanPage />} />
          <Route path="loan/:loanId" element={<LoanDetailPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="home" element={<HomePage />} />
            <Route path="settings/users" element={<AdminUsersPage />} />
          </Route>

          <Route path="*" element={<DefaultRoute />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
