import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../lib/currency'

const STORAGE_KEY = 'apexvoid-ledger:currency'

function isCurrencyCode(value: string | null): value is CurrencyCode {
  return value != null && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

function getInitialCurrency(): CurrencyCode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isCurrencyCode(stored) ? stored : 'USD'
}

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(getInitialCurrency)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency)
  }, [currency])

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider')
  return ctx
}
