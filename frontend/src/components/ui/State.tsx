import { Card } from './Card'
export function LoadingState({ label = 'Loading…' }: { label?: string }) { return <Card variant="subtle" className="text-sm text-ledger-text-secondary">{label}</Card> }
export function EmptyState({ children }: { children: React.ReactNode }) { return <Card variant="subtle" className="border-dashed text-sm text-ledger-text-secondary">{children}</Card> }
