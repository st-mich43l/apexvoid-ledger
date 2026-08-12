import type { ChangeEvent } from 'react'
import { formatAmountDisplay, formatDateDisplay, type LoanFormValues } from '../../hooks/useLoanFormState'

interface LoanFormFieldsProps {
  values: LoanFormValues
  onChange: (field: keyof LoanFormValues) => (e: ChangeEvent<HTMLInputElement>) => void
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDateChange: (e: ChangeEvent<HTMLInputElement>) => void
  onLoanTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
}

// Shared by the create form (LoanForm) and EditLoanDialog — same fields,
// same dd/mm/yyyy + comma-formatted inputs, same validation affordances.
export function LoanFormFields({
  values,
  onChange,
  onAmountChange,
  onDateChange,
  onLoanTypeChange,
  disabled,
}: LoanFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Field label="Bank name">
        <input
          required
          type="text"
          disabled={disabled}
          value={values.bankName}
          onChange={onChange('bankName')}
          placeholder="e.g. Chase"
          maxLength={100}
          className={inputClass}
        />
      </Field>

      <Field label="Open date">
        <input
          required
          type="text"
          disabled={disabled}
          inputMode="numeric"
          pattern="\d{2}/\d{2}/\d{4}"
          title="dd/mm/yyyy"
          value={formatDateDisplay(values.openDate)}
          onChange={onDateChange}
          placeholder="dd/mm/yyyy"
          className={inputClass}
        />
      </Field>

      <Field label="Disbursement amount">
        <input
          required
          type="text"
          disabled={disabled}
          inputMode="decimal"
          value={formatAmountDisplay(values.disbursementAmount)}
          onChange={onAmountChange}
          placeholder="10,000"
          className={inputClass}
        />
      </Field>

      <Field label="Interest rate / year (%)">
        <input
          required
          type="number"
          disabled={disabled}
          min="0"
          max="100"
          step="0.01"
          value={values.interestRatePerYear}
          onChange={onChange('interestRatePerYear')}
          placeholder="6.5"
          className={inputClass}
        />
      </Field>

      <Field label="Term (months)">
        <input
          required
          type="number"
          disabled={disabled}
          min="1"
          max="600"
          step="1"
          value={values.durationMonths}
          onChange={onChange('durationMonths')}
          placeholder="12"
          className={inputClass}
        />
      </Field>

      <Field label="Loan type">
        <select value={values.loanType} disabled={disabled} onChange={onLoanTypeChange} className={inputClass}>
          <option value="unsecured">Unsecured (declining balance)</option>
          <option value="secured">Secured (fixed balance)</option>
        </select>
      </Field>
    </div>
  )
}

export const inputClass =
  'rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</label>
      {children}
    </div>
  )
}
