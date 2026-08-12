import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { AdminUsersPage } from './pages/admin/Users'
import { ChangePasswordPage } from './pages/ChangePassword'
import { Dashboard } from './pages/Dashboard'
import { LoanPage } from './pages/Loan'
import { LoginPage } from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="loan" element={<LoanPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="settings/users" element={<AdminUsersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
