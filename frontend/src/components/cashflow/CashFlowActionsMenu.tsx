import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Modal } from '../Modal'

interface CashFlowActionsMenuProps {
  year: number
  month: number
  onManageCategories: () => void
  onWeeklyExpenses: () => void
}

export function CashFlowActionsMenu({ year, month, onManageCategories, onWeeklyExpenses }: CashFlowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 8, left: 8 })

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const gutter = 8
    const menuWidth = Math.min(224, window.innerWidth - gutter * 2)
    const estimatedMenuHeight = 260
    const left = Math.min(Math.max(gutter, rect.right - menuWidth), window.innerWidth - menuWidth - gutter)
    const below = rect.bottom + gutter
    const top = below + estimatedMenuHeight <= window.innerHeight - gutter
      ? below
      : Math.max(gutter, rect.top - estimatedMenuHeight - gutter)
    setPosition({ top, left })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()

    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const close = () => setOpen(false)
  const planningQuery = `year=${year}&month=${month}`
  const itemClass = 'flex w-full items-center rounded-[var(--ledger-radius-control)] px-3 py-2 text-left text-sm font-medium text-ledger-text hover:bg-ledger-subtle'

  return <div>
    <Button ref={triggerRef} type="button" variant="outline" onClick={() => window.matchMedia('(max-width: 639px)').matches ? setSheetOpen(true) : setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open || sheetOpen}>More</Button>
    {sheetOpen && <Modal label="Cash Flow actions" onClose={() => setSheetOpen(false)}><h2 className="text-lg font-semibold text-ledger-text">Cash Flow actions</h2><div className="mt-4 space-y-1"><button type="button" onClick={() => { setSheetOpen(false); onManageCategories() }} className={`${itemClass} min-h-11`}>Manage categories</button><button type="button" onClick={() => { setSheetOpen(false); onWeeklyExpenses() }} className={`${itemClass} min-h-11`}>Add weekly expenses</button><Link onClick={() => setSheetOpen(false)} to={`/monthly-routine?${planningQuery}`} className={`${itemClass} min-h-11`}>Monthly Routine</Link><Link onClick={() => setSheetOpen(false)} to={`/budget?${planningQuery}`} className={`${itemClass} min-h-11`}>Monthly Budget</Link><Link onClick={() => setSheetOpen(false)} to={`/monthly-close?${planningQuery}`} className={`${itemClass} min-h-11`}>Monthly Close</Link></div></Modal>}
    {open && createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label="Cash Flow actions"
        style={position}
        className="fixed z-50 max-h-[calc(100dvh-1rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-elevated p-2 shadow-[var(--ledger-shadow-card)]"
      >
        <button autoFocus type="button" role="menuitem" onClick={() => { onManageCategories(); close() }} className={itemClass}>Manage categories</button>
        <button type="button" role="menuitem" onClick={() => { onWeeklyExpenses(); close() }} className={itemClass}>Add weekly expenses</button>
        <Link role="menuitem" onClick={close} to={`/monthly-routine?${planningQuery}`} className={itemClass}>Monthly Routine</Link>
        <Link role="menuitem" onClick={close} to={`/budget?${planningQuery}`} className={itemClass}>Monthly Budget</Link>
        <Link role="menuitem" onClick={close} to={`/monthly-close?${planningQuery}`} className={itemClass}>Monthly Close</Link>
      </div>,
      document.body,
    )}
  </div>
}
