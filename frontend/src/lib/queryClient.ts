import { QueryClient } from '@tanstack/react-query'

// Financial responses stay in memory only. Never add persistence plugins here.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

export const queryKeys = {
  account: (userId: string | null) => ['account', userId] as const,
  categories: (userId: string | null, includeInactive: boolean) => ['account', userId, 'categories', includeInactive] as const,
  transactions: (userId: string | null, year: number, month: number) => ['account', userId, 'transactions', year, month] as const,
  bankActivities: (userId: string | null, year: number, month: number, filters: object = {}) => ['account', userId, 'bank-activities', year, month, filters] as const,
  sepayRule: (userId: string | null) => ['account', userId, 'sepay-rule'] as const,
  cashFlowSummary: (userId: string | null, year: number, month: number, currency: string) => ['account', userId, 'cashflow-summary', year, month, currency] as const,
  cashFlowTrend: (userId: string | null, year: number, month: number, range: number, currency: string) => ['account', userId, 'cashflow-trend', year, month, range, currency] as const,
  budget: (userId: string | null, year: number, month: number) => ['account', userId, 'budget', year, month] as const,
  monthlyRoutine: (userId: string | null, year: number, month: number, currency: string) => ['account', userId, 'monthly-routine', year, month, currency] as const,
  monthlyClose: (userId: string | null, year: number, month: number) => ['account', userId, 'monthly-close', year, month] as const,
  netWorth: (userId: string | null) => ['account', userId, 'net-worth'] as const,
  loans: (userId: string | null) => ['account', userId, 'loans'] as const,
  loanDetail: (userId: string | null, loanId: string) => ['account', userId, 'loan-detail', loanId] as const,
  recurringExpenses: (userId: string | null) => ['account', userId, 'recurring-expenses'] as const,
  recurringIncomes: (userId: string | null) => ['account', userId, 'recurring-incomes'] as const,
  savingPot: (userId: string | null) => ['account', userId, 'saving-pot'] as const,
  savingPotHistory: (userId: string | null, limit: number, offset: number) => ['account', userId, 'saving-pot-history', limit, offset] as const,
}

export function periodStaleTime(year: number, month: number, currentMs: number, historicalMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const currentYear = Number(parts.find((part) => part.type === 'year')?.value)
  const currentMonth = Number(parts.find((part) => part.type === 'month')?.value)
  return year === currentYear && month === currentMonth ? currentMs : historicalMs
}

export function invalidateAccountData(userId: string | null, sections: string[]) {
  if (!userId) return Promise.resolve()
  return Promise.all(sections.map((section) => queryClient.invalidateQueries({ queryKey: ['account', userId, section] }))).then(() => undefined)
}

export const invalidateCashFlow = (userId: string | null) => invalidateAccountData(userId, [
  'transactions', 'bank-activities', 'cashflow-summary', 'cashflow-trend', 'monthly-routine', 'monthly-close',
])

export const invalidateRecurring = (userId: string | null) => invalidateAccountData(userId, [
  'recurring-expenses', 'recurring-incomes', 'monthly-routine', 'cashflow-summary', 'cashflow-trend', 'monthly-close',
])

export const invalidateLoans = (userId: string | null) => invalidateAccountData(userId, [
  'loans', 'net-worth', 'loan-detail', 'monthly-routine', 'cashflow-summary', 'cashflow-trend', 'monthly-close',
])
