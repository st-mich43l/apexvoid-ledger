export const controlClassName = 'ui-control'
export const selectClassName = 'ui-control py-1.5 text-xs'
export function FieldHint({ children }: { children: React.ReactNode }) { return <p className="mt-1.5 text-xs text-ledger-text-secondary">{children}</p> }
export function FieldError({ children }: { children: React.ReactNode }) { return <p className="mt-1.5 text-xs font-medium text-rose-700 dark:text-rose-400">{children}</p> }
