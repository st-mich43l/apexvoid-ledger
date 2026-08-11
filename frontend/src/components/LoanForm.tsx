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
      className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Bank name
        </label>
        <input
          required
          type="text"
          value={form.bankName}
          onChange={handleChange('bankName')}
          placeholder="e.g. Chase"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Open date
        </label>
        <input
          required
          type="date"
          value={form.openDate}
          onChange={handleChange('openDate')}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Disbursement amount
        </label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.disbursementAmount}
          onChange={handleChange('disbursementAmount')}
          placeholder="10000"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Interest rate / year (%)
        </label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.interestRatePerYear}
          onChange={handleChange('interestRatePerYear')}
          placeholder="6.5"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add loan'}
        </button>
      </div>
    </form>
  )
}
