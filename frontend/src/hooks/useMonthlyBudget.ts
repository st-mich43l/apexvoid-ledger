import { useQuery } from '@tanstack/react-query'
import { copyPreviousMonthlyBudget, fetchMonthlyBudget, resetMonthlyBudget, saveMonthlyBudget } from '../api'
import { periodStaleTime, queryClient, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { MonthlyBudgetInput, MonthlyBudgetSummary } from '../types'

export function useMonthlyBudget(year: number, month: number, enabled = true) {
  const { user } = useAuth()
  const key = queryKeys.budget(user?.id ?? null, year, month)
  const query = useQuery({ queryKey: key, queryFn: () => fetchMonthlyBudget(year, month), enabled: Boolean(user && enabled), staleTime: periodStaleTime(year, month, 60_000, 10 * 60_000), gcTime: 60 * 60_000 })
  async function apply(result: MonthlyBudgetSummary) {
    queryClient.setQueryData(key, result)
    await queryClient.invalidateQueries({ queryKey: queryKeys.monthlyClose(user?.id ?? null, year, month) })
    return result
  }
  return {
    summary: query.data ?? null as MonthlyBudgetSummary | null,
    loading: query.isLoading,
    error: query.error ? 'Failed to load the monthly budget.' : null,
    reload: async () => { await query.refetch() },
    save: async (input: MonthlyBudgetInput) => apply(await saveMonthlyBudget(year, month, input)),
    copyPrevious: async () => apply(await copyPreviousMonthlyBudget(year, month)),
    reset: async () => { await resetMonthlyBudget(year, month); await queryClient.invalidateQueries({ queryKey: key }); await queryClient.invalidateQueries({ queryKey: queryKeys.monthlyClose(user?.id ?? null, year, month) }) },
  }
}
