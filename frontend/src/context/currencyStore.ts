import { createContext } from 'react'
import type { CurrencyCode } from '../lib/currency'

export interface CurrencyContextValue { currency: CurrencyCode; setCurrency: (currency: CurrencyCode) => void }
export const CurrencyContext = createContext<CurrencyContextValue | null>(null)
