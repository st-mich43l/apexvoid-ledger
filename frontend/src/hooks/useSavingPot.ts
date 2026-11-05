import { useQuery } from '@tanstack/react-query'
import { adjustSavingPot, fetchSavingPot, fetchSavingPotHistory, upsertSavingPot } from '../api'
import { queryClient, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { SavingPot, SavingPotAdjustInput, SavingPotEntry, SavingPotInput } from '../types'

export function useSavingPot() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const potKey = queryKeys.savingPot(userId)
  const historyKey = queryKeys.savingPotHistory(userId, 50, 0)
  const potQuery = useQuery({ queryKey: potKey, queryFn: fetchSavingPot, enabled: Boolean(user), staleTime: 60_000, gcTime: 60 * 60_000 })
  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      try { return await fetchSavingPotHistory(50, 0) }
      catch { return { items: [] as SavingPotEntry[], total: 0 } }
    },
    enabled: Boolean(user && potQuery.data),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
  })
  async function reload() { await Promise.all([potQuery.refetch(), historyQuery.refetch()]) }
  async function save(input: SavingPotInput) {
    const next = await upsertSavingPot(input)
    queryClient.setQueryData(potKey, next)
    await queryClient.invalidateQueries({ queryKey: historyKey })
    return next
  }
  async function adjust(input: SavingPotAdjustInput) {
    const next = await adjustSavingPot(input)
    queryClient.setQueryData(potKey, next)
    await queryClient.invalidateQueries({ queryKey: historyKey })
    return next
  }
  return {
    pot: potQuery.data ?? null as SavingPot | null,
    history: historyQuery.data?.items ?? [],
    historyTotal: historyQuery.data?.total ?? 0,
    loading: potQuery.isLoading,
    historyLoading: historyQuery.isFetching,
    error: potQuery.error ? 'Failed to load saving pot.' : null,
    reload,
    save,
    adjust,
  }
}
