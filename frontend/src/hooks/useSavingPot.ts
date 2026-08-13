import { useCallback, useEffect, useRef, useState } from 'react'
import {
  adjustSavingPot,
  fetchSavingPot,
  fetchSavingPotHistory,
  upsertSavingPot,
} from '../api'
import type {
  SavingPot,
  SavingPotAdjustInput,
  SavingPotEntry,
  SavingPotInput,
} from '../types'

export function useSavingPot() {
  const [pot, setPot] = useState<SavingPot | null>(null)
  const [history, setHistory] = useState<SavingPotEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const page = await fetchSavingPotHistory(50, 0)
      setHistory(page.items)
      setHistoryTotal(page.total)
    } catch {
      // Pot may not exist yet; leave history empty.
      setHistory([])
      setHistoryTotal(0)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchSavingPot()
      if (activeRequest !== requestId.current) return
      setPot(next)
      setError(null)
      if (next) {
        await reloadHistory()
      } else {
        setHistory([])
        setHistoryTotal(0)
      }
    } catch {
      if (activeRequest === requestId.current) setError('Failed to load saving pot.')
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [reloadHistory])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(async (input: SavingPotInput) => {
    const next = await upsertSavingPot(input)
    setPot(next)
    setError(null)
    await reloadHistory()
    return next
  }, [reloadHistory])

  const adjust = useCallback(async (input: SavingPotAdjustInput) => {
    const next = await adjustSavingPot(input)
    setPot(next)
    setError(null)
    await reloadHistory()
    return next
  }, [reloadHistory])

  return {
    pot,
    history,
    historyTotal,
    loading,
    historyLoading,
    error,
    reload,
    save,
    adjust,
  }
}
