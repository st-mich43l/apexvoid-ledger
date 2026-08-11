import { useCurrency } from '../context/CurrencyContext'
import { currencyFlag, SUPPORTED_CURRENCIES, type CurrencyCode } from '../lib/currency'

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        aria-label="Display currency"
        className="h-9 appearance-none rounded-full border border-neutral-200 bg-white py-0 pr-8 pl-3.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
      >
        {SUPPORTED_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {currencyFlag(code)} {code}
          </option>
        ))}
      </select>

      <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
    </div>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}
