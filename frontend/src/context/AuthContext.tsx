import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  // Return the freshly-updated user, not just void — callers that need to
  // make an immediate routing decision (e.g. isAdmin) can't rely on `user`
  // from the render closure, since the setUser() below won't have re-rendered
  // this component yet by the time the async call resolves.
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>
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

  async function login(username: string, password: string) {
    const updated = await api.login(username, password)
    setUser(updated)
    return updated
  }

  async function logout() {
    await api.logout()
    setUser(null)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const updated = await api.changePassword(currentPassword, newPassword)
    setUser(updated)
    return updated
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
