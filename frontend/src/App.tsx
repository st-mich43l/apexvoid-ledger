import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { useAuth } from './context/AuthContext'
import { AdminUsersPage } from './pages/admin/Users'
import { ChangePasswordPage } from './pages/ChangePassword'
import { Dashboard } from './pages/Dashboard'
import { HomePage } from './pages/Home'
import { LoanPage } from './pages/Loan'
import { LoginPage } from './pages/Login'

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
        {/* Standalone, like /login — this is a gate between login and the app
            (only reachable via the forced-password-change redirect), not a
            page within it, so it skips Layout's header/chrome entirely. */}
        <Route path="change-password" element={<ChangePasswordPage />} />

        <Route element={<Layout />}>
          <Route index element={<DefaultRoute />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="loan" element={<LoanPage />} />

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
