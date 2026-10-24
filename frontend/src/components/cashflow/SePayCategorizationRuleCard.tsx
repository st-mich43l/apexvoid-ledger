import { useEffect, useState } from 'react'
import { ApiError } from '../../api'
import { useSePayCategorizationRule } from '../../hooks/useSePayCategorizationRule'
import type { Category, SePayCategorizationRuleInput } from '../../types'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { controlClassName } from '../ui/Field'

export function SePayCategorizationRuleCard({ categories }: { categories: Category[] }) {
  const { rule, loading, error, save } = useSePayCategorizationRule()
  const [enabled, setEnabled] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const expenseCategories = categories.filter((category) => category.type === 'expense' && category.isActive)

  useEffect(() => {
    if (!rule) return
    setEnabled(rule.enabled); setCategoryId(rule.categoryId ?? ''); setDescription(rule.descriptionContains ?? ''); setReference(rule.referenceContains ?? '')
  }, [rule])

  async function submit() {
    setSaving(true); setMessage(null)
    const input: SePayCategorizationRuleInput = { enabled, categoryId: categoryId || null, descriptionContains: description.trim() || null, referenceContains: reference.trim() || null }
    try { await save(input); setMessage('Rule saved. Matching outgoing events will be recorded as expenses.') } catch (caught) { setMessage(caught instanceof ApiError ? caught.message : 'Could not save the rule.') } finally { setSaving(false) }
  }

  return <Card variant="subtle" padding="sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ledger-primary">SePay automation</p><h3 className="mt-1 font-semibold text-ledger-text">Monthly living budget rule</h3><p className="mt-1 text-sm text-ledger-text-secondary">Matches outgoing descriptions or references. Amount is never used alone.</p></div>{!loading && !error && <Button type="button" variant="outline" size="sm" aria-controls="sepay-rule-editor" aria-expanded={showEditor} onClick={() => setShowEditor((current) => !current)}>{showEditor ? 'Hide' : rule?.enabled ? 'Edit rule' : 'Configure'}</Button>}</div>
    {loading ? <p className="mt-4 text-sm text-ledger-text-secondary">Loading rule…</p> : error ? <p className="mt-4 text-sm text-ledger-text-secondary">Connect the primary TPBank SePay account in Net Worth to configure this rule.</p> : <><div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={rule?.enabled ? 'success' : 'neutral'}>{rule?.enabled ? 'Enabled' : 'Disabled'}</Badge><span className="text-sm text-ledger-text-secondary">{rule?.categoryName ? `Expense category: ${rule.categoryName}` : 'No expense category selected'}</span></div>{showEditor && <div id="sepay-rule-editor" className="mt-4 border-t border-ledger-border pt-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] lg:items-end"><label className="flex items-center gap-2 pb-2 text-sm font-medium text-ledger-text"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={saving} /> Enabled</label><label className="text-xs font-semibold text-ledger-text-secondary">Expense category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving} className={`mt-1 ${controlClassName}`}><option value="">Select category</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}</select></label><label className="text-xs font-semibold text-ledger-text-secondary">Description contains<input value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} maxLength={160} className={`mt-1 ${controlClassName}`} placeholder="MONTHLY ALLOWANCE" /></label><label className="text-xs font-semibold text-ledger-text-secondary">Reference contains<input value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} maxLength={160} className={`mt-1 ${controlClassName}`} placeholder="ALLOWANCE" /></label><Button type="button" onClick={() => void submit()} loading={saving}>Save rule</Button></div></div>}</>}
    {message && <Alert tone={message.startsWith('Rule saved') ? 'success' : 'danger'} className="mt-3">{message}</Alert>}
  </Card>
}
