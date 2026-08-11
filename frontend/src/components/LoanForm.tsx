import { useState } from 'react'
import type { LoanInput } from '../types'

interface LoanFormProps {
  onSubmit: (input: LoanInput) => Promise<void>
}

const emptyForm = {
  bankName: '',
  openDate: '',
  disbursementAmount: '',
  interestRatePerYear: '',
}

export function LoanForm({ onSubmit }: LoanFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        bankName: form.bankName,
        openDate: form.openDate,
        disbursementAmount: Number(form.disbursementAmount),
        interestRatePerYear: Number(form.interestRatePerYear),
      })
      setForm(emptyForm)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
    >
      <Field label="Bank name">
        <input
          required
          type="text"
          value={form.bankName}
          onChange={handleChange('bankName')}
          placeholder="e.g. Chase"
          className={inputClass}
        />
      </Field>

      <Field label="Open date">
        <input
          required
          type="date"
          value={form.openDate}
          onChange={handleChange('openDate')}
          className={inputClass}
        />
      </Field>

      <Field label="Disbursement amount">
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.disbursementAmount}
          onChange={handleChange('disbursementAmount')}
          placeholder="10000"
          className={inputClass}
        />
      </Field>

      <Field label="Interest rate / year (%)">
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.interestRatePerYear}
          onChange={handleChange('interestRatePerYear')}
          placeholder="6.5"
          className={inputClass}
        />
      </Field>

      <div className="sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {submitting ? 'Adding…' : 'Add loan'}
        </button>
      </div>
    </form>
  )
}

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</label>
      {children}
    </div>
  )
}
