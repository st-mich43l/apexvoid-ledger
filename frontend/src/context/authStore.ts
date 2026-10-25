import { createContext } from 'react'
import type { AuthUser } from '../types'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>
  setPreferredCurrency: (currency: string) => Promise<AuthUser>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
