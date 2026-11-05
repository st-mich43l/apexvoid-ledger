import { setMoneyHidden, useMoneyPrivacy } from '../lib/moneyPrivacy'

export function MoneyPrivacyToggle({ context }: { context?: string }) {
  const hidden = useMoneyPrivacy()
  return <button type="button" aria-label={context ? `Hide monetary amounts (${context})` : 'Hide monetary amounts'} aria-pressed={hidden} title={hidden ? 'Show all amounts' : 'Hide all amounts'} onClick={() => setMoneyHidden(!hidden)} className={`inline-flex ${context ? 'h-11 w-11' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-xl text-ledger-text-secondary transition-colors hover:bg-ledger-subtle hover:text-ledger-text`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{hidden && <path d="M4 4l16 16" />}</svg>
  </button>
}
