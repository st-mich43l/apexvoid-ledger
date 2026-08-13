import { useCallback, useEffect, useRef, useState } from 'react'
import { adjustSavingPot, fetchSavingPot, upsertSavingPot } from '../api'
import type { SavingPot, SavingPotAdjustInput, SavingPotInput } from '../types'

export function useSavingPot() {
  const [pot, setPot] = useState<SavingPot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchSavingPot()
      if (activeRequest !== requestId.current) return
      setPot(next)
      setError(null)
    } catch {
      if (activeRequest === requestId.current) setError('Failed to load saving pot.')
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(async (input: SavingPotInput) => {
    const next = await upsertSavingPot(input)
    setPot(next)
    setError(null)
    return next
  }, [])

  const adjust = useCallback(async (input: SavingPotAdjustInput) => {
    const next = await adjustSavingPot(input)
    setPot(next)
    setError(null)
    return next
  }, [])

  return { pot, loading, error, reload, save, adjust }
}
