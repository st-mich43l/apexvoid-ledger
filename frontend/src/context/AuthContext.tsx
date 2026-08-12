import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null))
    api.fetchMe().then(setUser).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    setUser(await api.login(email, password))
  }

  async function logout() {
    await api.logout()
    setUser(null)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    setUser(await api.changePassword(currentPassword, newPassword))
  }

  async function refresh() {
    setUser(await api.fetchMe())
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
