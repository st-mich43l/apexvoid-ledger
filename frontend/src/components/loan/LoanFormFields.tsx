import { useId, type ChangeEvent } from 'react'
import { formatAmountDisplay, formatDateDisplay, type LoanFormValues } from '../../hooks/useLoanFormState'
import { SUPPORTED_CURRENCIES } from '../../lib/currency'

interface LoanFormFieldsProps {
  values: LoanFormValues
  onChange: (field: keyof LoanFormValues) => (e: ChangeEvent<HTMLInputElement>) => void
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDateChange: (e: ChangeEvent<HTMLInputElement>) => void
  onLoanTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onCurrencyChange: (e: ChangeEvent<HTMLSelectElement>) => void
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
  onCurrencyChange,
  disabled,
}: LoanFormFieldsProps) {
  const formId = useId()
  const bankNameId = `${formId}-bank-name`
  const openDateId = `${formId}-open-date`
  const amountId = `${formId}-amount`
  const currencyId = `${formId}-currency`
  const interestRateId = `${formId}-interest-rate`
  const termId = `${formId}-term`
  const loanTypeId = `${formId}-loan-type`
  const loanTypeDescriptionId = `${formId}-loan-type-description`

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
      <Field label="Bank name" htmlFor={bankNameId}>
        <input
          id={bankNameId}
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

      <Field label="Open date" htmlFor={openDateId}>
        <input
          id={openDateId}
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

      <Field label="Disbursement amount" htmlFor={amountId}>
        <input
          id={amountId}
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

      <Field label="Loan currency" htmlFor={currencyId}>
        <select
          id={currencyId}
          value={values.currency}
          disabled={disabled}
          onChange={onCurrencyChange}
          className={inputClass}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </Field>

      <Field label="Annual interest rate" htmlFor={interestRateId}>
        <div className="relative">
          <input
            id={interestRateId}
            required
            type="number"
            disabled={disabled}
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            value={values.interestRatePerYear}
            onChange={onChange('interestRatePerYear')}
            placeholder="6.5"
            className={`${numericInputClass} pr-10`}
          />
          <span className={suffixClass}>%</span>
        </div>
      </Field>

      <Field label="Term" htmlFor={termId}>
        <div className="relative">
          <input
            id={termId}
            required
            type="number"
            disabled={disabled}
            inputMode="numeric"
            min="1"
            max="600"
            step="1"
            value={values.durationMonths}
            onChange={onChange('durationMonths')}
            placeholder="12"
            className={`${numericInputClass} pr-20`}
          />
          <span className={suffixClass}>months</span>
        </div>
      </Field>

      <Field label="Loan type" htmlFor={loanTypeId}>
        <select
          id={loanTypeId}
          value={values.loanType}
          disabled={disabled}
          onChange={onLoanTypeChange}
          aria-describedby={loanTypeDescriptionId}
          className={inputClass}
        >
          <option value="unsecured">Unsecured</option>
          <option value="secured">Secured</option>
        </select>
        <p id={loanTypeDescriptionId} className="text-xs text-neutral-400 dark:text-neutral-500">
          {values.loanType === 'unsecured' ? 'Declining-balance EMI' : 'Fixed balance · interest-only'}
        </p>
      </Field>
    </div>
  )
}

export const inputClass =
  'min-w-0 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

const suffixClass =
  'pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-neutral-400 dark:text-neutral-500'

const numericInputClass =
  `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </label>
      {children}
    </div>
  )
}
