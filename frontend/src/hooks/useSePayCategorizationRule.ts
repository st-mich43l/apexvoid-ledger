import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchSePayCategorizationRule, updateSePayCategorizationRule } from '../api'
import type { SePayCategorizationRule, SePayCategorizationRuleInput } from '../types'

export function useSePayCategorizationRule() {
  const [rule, setRule] = useState<SePayCategorizationRule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setRule(await fetchSePayCategorizationRule())
      setError(null)
    } catch (caught) {
      // No connected account simply means the rule cannot be configured yet.
      if (!(caught instanceof ApiError && caught.status === 404)) setError('Failed to load the SePay categorization rule.')
      setRule(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (input: SePayCategorizationRuleInput) => {
    const next = await updateSePayCategorizationRule(input)
    setRule(next)
    setError(null)
    return next
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rule, loading, error, reload, save }
}
