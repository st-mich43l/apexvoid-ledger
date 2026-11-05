import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchSePayCategorizationRule, updateSePayCategorizationRule } from '../api'
import { queryClient, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { SePayCategorizationRule, SePayCategorizationRuleInput } from '../types'

export function useSePayCategorizationRule() {
  const { user } = useAuth()
  const key = queryKeys.sepayRule(user?.id ?? null)
  const query = useQuery({ queryKey: key, queryFn: fetchSePayCategorizationRule, enabled: Boolean(user), staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1 })
  async function reload() { await query.refetch() }
  async function save(input: SePayCategorizationRuleInput) {
    const result = await updateSePayCategorizationRule(input)
    queryClient.setQueryData(key, result)
    return result
  }
  const notConnected = query.error instanceof ApiError && query.error.status === 404
  return {
    rule: notConnected ? null : query.data ?? null as SePayCategorizationRule | null,
    loading: query.isLoading,
    error: query.error && !notConnected ? 'Failed to load the SePay categorization rule.' : null,
    reload,
    save,
  }
}
