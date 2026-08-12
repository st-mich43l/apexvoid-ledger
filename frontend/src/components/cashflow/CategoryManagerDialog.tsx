import { useState } from 'react'
import { ApiError, createCategory, deleteCategory, updateCategory } from '../../api'
import type { Category, TransactionType } from '../../types'
import { Modal } from '../Modal'

interface CategoryManagerDialogProps {
  categories: Category[]
  onClose: () => void
  onChanged: () => Promise<void>
}

interface Draft {
  id?: string
  name: string
  type: TransactionType
  icon: string
}

const emptyDraft = (type: TransactionType): Draft => ({ name: '', type, icon: '' })

export function CategoryManagerDialog({ categories, onClose, onChanged }: CategoryManagerDialogProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return
    const name = draft.name.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('Category name is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const input = { name, type: draft.type, icon: draft.icon.trim() || null }
      if (draft.id) await updateCategory(draft.id, input)
      else await createCategory(input)
      await onChanged()
      setDraft(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this category.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(category: Category) {
    setSaving(true)
    setError(null)
    try {
      await deleteCategory(category.id)
      await onChanged()
      if (draft?.id === category.id) setDraft(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not deactivate this category.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate(category: Category) {
    setSaving(true)
    setError(null)
    try {
      await updateCategory(category.id, { isActive: true })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reactivate this category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal label="Manage categories" onClose={onClose} dismissible={!saving}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Categories</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Organize income and expenses without losing history.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close category manager" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200">✕</button>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{error}</p>}

      {draft && (
        <form onSubmit={handleSave} className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{draft.id ? 'Edit category' : 'New category'}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Name
              <input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={saving} maxLength={80} className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950" />
            </label>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Type
              <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as TransactionType })} disabled={saving} className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950">
                <option value="expense">Expense</option><option value="income">Income</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Icon
              <input value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} disabled={saving} maxLength={32} placeholder="e.g. 🍜" className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950" />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => { setDraft(null); setError(null) }} disabled={saving} className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save category'}</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {(['expense', 'income'] as const).map((type) => {
          const active = categories.filter((item) => item.type === type && item.isActive)
          return (
            <section key={type}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize text-neutral-900 dark:text-neutral-100">{type} categories</h3>
                <button type="button" disabled={saving} onClick={() => { setDraft(emptyDraft(type)); setError(null) }} className="text-xs font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">+ Add</button>
              </div>
              <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {active.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="w-6 text-center" aria-hidden="true">{item.icon || '•'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-200">{item.name}</span>
                    <button type="button" disabled={saving} onClick={() => { setDraft({ id: item.id, name: item.name, type: item.type, icon: item.icon ?? '' }); setError(null) }} className="text-xs text-neutral-500 hover:text-violet-600 dark:text-neutral-400">Edit</button>
                    <button type="button" disabled={saving} onClick={() => void handleDeactivate(item)} className="text-xs text-neutral-500 hover:text-red-600 dark:text-neutral-400">Deactivate</button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {categories.some((item) => !item.isActive) && (
        <section className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Inactive</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.filter((item) => !item.isActive).map((item) => (
              <button key={item.id} type="button" disabled={saving} onClick={() => void handleReactivate(item)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:border-violet-300 hover:text-violet-600 dark:border-neutral-700 dark:text-neutral-400">
                {item.icon} {item.name} · Reactivate
              </button>
            ))}
          </div>
        </section>
      )}
    </Modal>
  )
}
