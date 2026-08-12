import { SUPPORTED_CURRENCIES } from '../../lib/currency'
import { formatDateInput } from '../../lib/date'
import { formatAmountInput, type TransactionFormValues } from '../../hooks/useTransactionFormState'
import type { Category } from '../../types'

interface TransactionFormFieldsProps {
  values: TransactionFormValues
  categories: Category[]
  disabled: boolean
  onTypeChange: React.ChangeEventHandler<HTMLSelectElement>
  onCategoryChange: React.ChangeEventHandler<HTMLSelectElement>
  onAmountChange: React.ChangeEventHandler<HTMLInputElement>
  onCurrencyChange: React.ChangeEventHandler<HTMLSelectElement>
  onDateChange: React.ChangeEventHandler<HTMLInputElement>
  onDescriptionChange: React.ChangeEventHandler<HTMLInputElement>
}

const labelClass = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300'
const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

export function TransactionFormFields({
  values,
  categories,
  disabled,
  onTypeChange,
  onCategoryChange,
  onAmountChange,
  onCurrencyChange,
  onDateChange,
  onDescriptionChange,
}: TransactionFormFieldsProps) {
  const availableCategories = categories.filter(
    (category) => category.type === values.type && (category.isActive || category.id === values.categoryId),
  )

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className={labelClass}>
        Type
        <select value={values.type} onChange={onTypeChange} disabled={disabled} className={inputClass}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>

      <label className={labelClass}>
        Category
        <select
          value={values.categoryId}
          onChange={onCategoryChange}
          disabled={disabled}
          className={inputClass}
          required
        >
          <option value="">Select a category</option>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ''}{category.name}
              {!category.isActive ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Amount
        <input
          value={formatAmountInput(values.amount)}
          onChange={onAmountChange}
          disabled={disabled}
          className={inputClass}
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          required
        />
      </label>

      <label className={labelClass}>
        Currency
        <select value={values.currency} onChange={onCurrencyChange} disabled={disabled} className={inputClass}>
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Date
        <input
          value={formatDateInput(values.occurredAt)}
          onChange={onDateChange}
          disabled={disabled}
          className={inputClass}
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          autoComplete="off"
          required
        />
      </label>

      <label className={labelClass}>
        Description <span className="font-normal text-neutral-400">(optional)</span>
        <input
          value={values.description}
          onChange={onDescriptionChange}
          disabled={disabled}
          className={inputClass}
          maxLength={240}
          placeholder="What was this for?"
        />
      </label>
    </div>
  )
}
