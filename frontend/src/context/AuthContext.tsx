import { useEffect, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { AuthUser } from '../types'
import { AuthContext } from './authStore'

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

  async function setPreferredCurrency(currency: string) {
    const updated = await api.setPreferredCurrency(currency)
    setUser(updated)
    return updated
  }

  async function refresh() {
    setUser(await api.fetchMe())
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, changePassword, setPreferredCurrency, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}
