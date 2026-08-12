import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type { CashFlowMonthlySummary, CurrencyConversionRate } from '../../types'

function formatRate(rate: CurrencyConversionRate): string {
  if (rate.rate >= 0.01) return formatCurrency(rate.rate, rate.targetCurrency)
  return `${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 }).format(rate.rate)} ${rate.targetCurrency}`
}

export function CurrencyConversionNotice({ summary }: { summary: CashFlowMonthlySummary }) {
  const hasConverted = summary.convertedCurrencies.length > 0
  const hasUnconverted = summary.unconvertedCurrencies.length > 0
  if (!hasConverted && !hasUnconverted) return null

  return (
    <div className="mb-5 space-y-3">
      {hasConverted && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          <p>
            Converted {summary.convertedCurrencies.join(', ')} into {summary.currency} using
            {' '}daily reference rates. Transaction-list amounts remain in their original currencies.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">View conversion rates</summary>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-sky-800 dark:text-sky-300">
              {summary.conversionRates.map((rate) => (
                <li key={`${rate.sourceCurrency}-${rate.targetCurrency}-${rate.rateDate}-${rate.rate}`}>
                  1 {rate.sourceCurrency} = {formatRate(rate)} · {formatDate(rate.rateDate)}
                </li>
              ))}
            </ul>
            {summary.exchangeRateProviderUrl && summary.exchangeRateProvider && (
              <a
                href={summary.exchangeRateProviderUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium underline decoration-sky-400/60 underline-offset-2"
              >
                Rates by {summary.exchangeRateProvider}
              </a>
            )}
          </details>
        </div>
      )}

      {hasUnconverted && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Could not convert {summary.unconvertedCurrencies.join(', ')} into {summary.currency}.
          Those transactions are temporarily excluded from totals; their original values are unchanged.
        </p>
      )}
    </div>
  )
}
