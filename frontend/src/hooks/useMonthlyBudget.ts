import { useCallback, useEffect, useState } from 'react'
import {
  copyPreviousMonthlyBudget,
  fetchMonthlyBudget,
  resetMonthlyBudget,
  saveMonthlyBudget,
} from '../api'
import type { MonthlyBudgetInput, MonthlyBudgetSummary } from '../types'

export function useMonthlyBudget(year: number, month: number) {
  const [summary, setSummary] = useState<MonthlyBudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await fetchMonthlyBudget(year, month))
      setError(null)
    } catch {
      setError('Failed to load the monthly budget.')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(async (input: MonthlyBudgetInput) => {
    const result = await saveMonthlyBudget(year, month, input)
    setSummary(result)
    setError(null)
    return result
  }, [year, month])

  const copyPrevious = useCallback(async () => {
    const result = await copyPreviousMonthlyBudget(year, month)
    setSummary(result)
    setError(null)
    return result
  }, [year, month])

  const reset = useCallback(async () => {
    await resetMonthlyBudget(year, month)
    await reload()
  }, [year, month, reload])

  return { summary, loading, error, reload, save, copyPrevious, reset }
}
