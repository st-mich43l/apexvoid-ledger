import { useEffect, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { AuthUser } from '../types'
import { AuthContext } from './authStore'
import { discardLocalPush, reconcileLocalPushForUser, releaseCurrentPush } from '../lib/push'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUser(null)
      void discardLocalPush().catch(() => {})
    })
    api.fetchMe().then(async current => {
      await reconcileLocalPushForUser(current?.id ?? null).catch(() => {})
      setUser(current)
    }).finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const updated = await api.login(username, password)
    await reconcileLocalPushForUser(updated.id).catch(() => {})
    setUser(updated)
    return updated
  }

  async function logout() {
    try {
      if (user) await releaseCurrentPush(user.id)
      else await discardLocalPush()
    } catch { /* Push cleanup failure must not prevent signing out. */ }
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
    const current = await api.fetchMe()
    await reconcileLocalPushForUser(current?.id ?? null).catch(() => {})
    setUser(current)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, changePassword, setPreferredCurrency, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}
