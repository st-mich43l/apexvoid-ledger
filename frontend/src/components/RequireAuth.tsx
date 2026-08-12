import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // Runs after the password gate, not before — no point picking a display
  // currency before you're even properly logged in.
  if (!user.mustChangePassword && !user.preferredCurrency && location.pathname !== '/select-currency') {
    return <Navigate to="/select-currency" replace />
  }

  return <Outlet />
}
