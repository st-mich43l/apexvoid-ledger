import { useEffect, useState } from 'react'
import { ApiError } from '../../api'
import type { Category, SePayCategorizationRuleInput } from '../../types'
import { useSePayCategorizationRule } from '../../hooks/useSePayCategorizationRule'

const inputClass = 'mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50'

export function SePayCategorizationRuleCard({ categories }: { categories: Category[] }) {
  const { rule, loading, error, save } = useSePayCategorizationRule()
  const [enabled, setEnabled] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const expenseCategories = categories.filter((category) => category.type === 'expense' && category.isActive)

  useEffect(() => {
    if (!rule) return
    setEnabled(rule.enabled)
    setCategoryId(rule.categoryId ?? '')
    setDescription(rule.descriptionContains ?? '')
    setReference(rule.referenceContains ?? '')
  }, [rule])

  async function submit() {
    setSaving(true)
    setMessage(null)
    const input: SePayCategorizationRuleInput = {
      enabled,
      categoryId: categoryId || null,
      descriptionContains: description.trim() || null,
      referenceContains: reference.trim() || null,
    }
    try {
      await save(input)
      setMessage('Rule saved. Matching outgoing events will be recorded as expenses.')
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save the rule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400">SePay automation</p>
        <h3 className="mt-1 font-semibold text-neutral-900 dark:text-neutral-50">Monthly living budget rule</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Classify outgoing TPBank events only when their description or bank reference matches. Amount alone is never used.</p>
      </div>
      {loading ? <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading rule…</p> : error ? (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">Connect the primary TPBank SePay account in Net Worth to configure this rule.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-end">
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={saving} />
            Enabled
          </label>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Expense category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving} className={inputClass}><option value="">Select category</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}</select></label>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Description contains<input value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} maxLength={160} className={inputClass} placeholder="e.g. MONTHLY ALLOWANCE" /></label>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Reference contains<input value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} maxLength={160} className={inputClass} placeholder="e.g. ALLOWANCE" /></label>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save rule'}</button>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </article>
  )
}
