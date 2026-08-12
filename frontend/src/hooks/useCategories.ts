import { useCallback, useEffect, useState } from 'react'
import { fetchCategories } from '../api'
import type { Category } from '../types'

export function useCategories(includeInactive = false) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await fetchCategories(includeInactive))
      setError(null)
    } catch {
      setError('Failed to load categories.')
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    void reload()
  }, [reload])

  return { categories, loading, error, reload }
}
