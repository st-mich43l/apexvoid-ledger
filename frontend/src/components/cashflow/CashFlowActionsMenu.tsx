import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'

interface CashFlowActionsMenuProps {
  year: number
  month: number
  onManageCategories: () => void
  onWeeklyExpenses: () => void
}

export function CashFlowActionsMenu({ year, month, onManageCategories, onWeeklyExpenses }: CashFlowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const close = () => setOpen(false)
  const planningQuery = `year=${year}&month=${month}`
  const itemClass = 'flex w-full items-center rounded-[var(--ledger-radius-control)] px-3 py-2 text-left text-sm font-medium text-ledger-text hover:bg-ledger-subtle'

  return <div ref={menuRef} className="relative">
    <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open}>More</Button>
    {open && <div role="menu" aria-label="Cash Flow actions" className="absolute right-0 z-30 mt-2 w-56 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-elevated p-2 shadow-[var(--ledger-shadow-card)]">
      <button type="button" role="menuitem" onClick={() => { onManageCategories(); close() }} className={itemClass}>Manage categories</button>
      <button type="button" role="menuitem" onClick={() => { onWeeklyExpenses(); close() }} className={itemClass}>Add weekly expenses</button>
      <Link role="menuitem" onClick={close} to={`/monthly-routine?${planningQuery}`} className={itemClass}>Monthly Routine</Link>
      <Link role="menuitem" onClick={close} to={`/budget?${planningQuery}`} className={itemClass}>Monthly Budget</Link>
      <Link role="menuitem" onClick={close} to={`/monthly-close?${planningQuery}`} className={itemClass}>Monthly Close</Link>
    </div>}
  </div>
}
