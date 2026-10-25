import { type ReactNode } from 'react'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../lib/currency'
import { useAuth } from '../hooks/useAuth'
import { CurrencyContext } from './currencyStore'

function isCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return value != null && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

// Sourced from the account (user.preferredCurrency), not localStorage — picked
// once on first login (RequireAuth forces /select-currency while it's null,
// the same way it forces the User Accounts password update) and changeable anytime afterward
// from the header's CurrencySelector. Both paths go through
// AuthContext.setPreferredCurrency, so the choice stays in sync across
// devices instead of being stuck to one browser.
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, setPreferredCurrency } = useAuth()
  const currency = isCurrencyCode(user?.preferredCurrency) ? user.preferredCurrency : 'USD'

  function setCurrency(code: CurrencyCode) {
    // Fire-and-forget from the caller's perspective (CurrencySelector doesn't
    // await this) — swallow failures here rather than leave an unhandled
    // rejection; the UI just won't reflect the change until a retry.
    setPreferredCurrency(code).catch(() => {})
  }

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}
