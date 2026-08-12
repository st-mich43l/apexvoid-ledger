import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Nested inside RequireAuth, so `user` is guaranteed non-null and password
// change (if any) is already satisfied by the time this runs.
export function RequireAdmin() {
  const { user } = useAuth()

  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
