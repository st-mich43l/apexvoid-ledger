import { useState } from 'react'
import type { LoanInput, LoanType } from '../types'

interface LoanFormProps {
  onSubmit: (input: LoanInput) => Promise<void>
}

const emptyForm = {
  bankName: '',
  openDate: '',
  disbursementAmount: '',
  interestRatePerYear: '',
  durationMonths: '12',
  loanType: 'unsecured' as LoanType,
}

function sanitizeAmountInput(value: string): string {
  let cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  return cleaned
}

function formatAmountDisplay(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

// Date is stored as raw ddmmyyyy digits so display is always dd/mm/yyyy
// regardless of the visitor's browser/OS locale, then converted to ISO on submit.
function formatDateDisplay(digits: string): string {
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  return [dd, mm, yyyy].filter(Boolean).join('/')
}

function dateDigitsToIso(digits: string): string {
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  return yyyy.length === 4 ? `${yyyy}-${mm}-${dd}` : ''
}

export function LoanForm({ onSubmit }: LoanFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeAmountInput(e.target.value)
    setForm((prev) => ({ ...prev, disbursementAmount: cleaned }))
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    setForm((prev) => ({ ...prev, openDate: digits }))
  }

  const handleLoanTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, loanType: e.target.value as LoanType }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        bankName: form.bankName,
        openDate: dateDigitsToIso(form.openDate),
        disbursementAmount: Number(form.disbursementAmount),
        interestRatePerYear: Number(form.interestRatePerYear),
        durationMonths: Number(form.durationMonths),
        loanType: form.loanType,
      })
      setForm(emptyForm)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] transition-shadow sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            type="text"
            inputMode="numeric"
            pattern="\d{2}/\d{2}/\d{4}"
            title="dd/mm/yyyy"
            value={formatDateDisplay(form.openDate)}
            onChange={handleDateChange}
            placeholder="dd/mm/yyyy"
            className={inputClass}
          />
        </Field>

        <Field label="Disbursement amount">
          <input
            required
            type="text"
            inputMode="decimal"
            value={formatAmountDisplay(form.disbursementAmount)}
            onChange={handleAmountChange}
            placeholder="10,000"
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

        <Field label="Term (months)">
          <input
            required
            type="number"
            min="1"
            step="1"
            value={form.durationMonths}
            onChange={handleChange('durationMonths')}
            placeholder="12"
            className={inputClass}
          />
        </Field>

        <Field label="Loan type">
          <select value={form.loanType} onChange={handleLoanTypeChange} className={inputClass}>
            <option value="unsecured">Unsecured (declining balance)</option>
            <option value="secured">Secured (fixed balance)</option>
          </select>
        </Field>
      </div>

      <div className="relative mt-5">
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
  'rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</label>
      {children}
    </div>
  )
}
