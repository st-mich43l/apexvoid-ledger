import { useEffect, useRef } from 'react'
import type { CurrencyCode } from '../../lib/currency'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type { LoanScheduleItem, ScheduleStatus } from '../../types'

interface LoanScheduleTableProps {
  schedule: LoanScheduleItem[]
  currency: CurrencyCode
}

export function LoanScheduleTable({ schedule, currency }: LoanScheduleTableProps) {
  const currentRowRef = useRef<HTMLTableRowElement>(null)
  const currentCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Bring the current period into view automatically — the whole point of
    // an auto-updating schedule is that the user shouldn't have to hunt for
    // "where are we now" in a 60+ row table.
    const target = currentRowRef.current ?? currentCardRef.current
    target?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="p-6 pb-0 sm:p-7 sm:pb-0">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Repayment schedule</h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Every contractual installment, {schedule.length} terms in total.
        </p>
      </div>

      {/* Desktop / tablet: full table */}
      <div className="mt-4 hidden max-h-[32rem] overflow-auto sm:block">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900/95">
            <tr>
              <Th>Term</Th>
              <Th>Due date</Th>
              <Th align="right">Opening</Th>
              <Th align="right">Installment</Th>
              <Th align="right">Principal</Th>
              <Th align="right">Interest</Th>
              <Th align="right">Closing</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {schedule.map((item) => (
              <ScheduleRow key={item.term} item={item} currency={currency} rowRef={item.status === 'current' ? currentRowRef : undefined} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: compact stacked cards instead of a squeezed 8-column table */}
      <div className="mt-4 max-h-[32rem] divide-y divide-neutral-100 overflow-auto sm:hidden dark:divide-neutral-800">
        {schedule.map((item) => (
          <ScheduleCard
            key={item.term}
            item={item}
            currency={currency}
            cardRef={item.status === 'current' ? currentCardRef : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function ScheduleRow({
  item,
  rowRef,
  currency,
}: {
  item: LoanScheduleItem
  currency: CurrencyCode
  rowRef?: React.RefObject<HTMLTableRowElement | null>
}) {
  return (
    <tr
      ref={rowRef}
      className={
        item.status === 'current'
          ? 'bg-violet-50/70 dark:bg-violet-500/10'
          : item.status === 'completed'
            ? 'text-neutral-400 dark:text-neutral-500'
            : ''
      }
    >
      <Td className="font-medium text-neutral-900 dark:text-neutral-50">{item.term}</Td>
      <Td>{formatDate(item.dueDate)}</Td>
      <Td align="right">{formatCurrency(item.openingPrincipal, currency)}</Td>
      <Td align="right">{formatCurrency(item.payment, currency)}</Td>
      <Td align="right">{formatCurrency(item.principal, currency)}</Td>
      <Td align="right">{formatCurrency(item.interest, currency)}</Td>
      <Td align="right" className="font-semibold text-neutral-900 dark:text-neutral-50">
        {formatCurrency(item.closingPrincipal, currency)}
      </Td>
      <Td>
        <StatusBadge status={item.status} />
      </Td>
    </tr>
  )
}

function ScheduleCard({
  item,
  cardRef,
  currency,
}: {
  item: LoanScheduleItem
  currency: CurrencyCode
  cardRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={cardRef} className={`p-4 ${item.status === 'current' ? 'bg-violet-50/70 dark:bg-violet-500/10' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Term {item.term}</span>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{formatDate(item.dueDate)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <Field label="Installment" value={formatCurrency(item.payment, currency)} />
        <Field label="Closing balance" value={formatCurrency(item.closingPrincipal, currency)} emphasis />
        <Field label="Principal" value={formatCurrency(item.principal, currency)} />
        <Field label="Interest" value={formatCurrency(item.interest, currency)} />
      </dl>
    </div>
  )
}

function Field({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-neutral-400 dark:text-neutral-500">{label}</dt>
      <dd
        className={
          emphasis
            ? 'font-semibold text-neutral-900 dark:text-neutral-50'
            : 'font-medium text-neutral-600 dark:text-neutral-300'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
  if (status === 'completed') {
    return (
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        Completed
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
        Current
      </span>
    )
  }
  return (
    <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-400 dark:bg-neutral-800/60 dark:text-neutral-500">
      Upcoming
    </span>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={`px-4 py-2 text-sm whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      {children}
    </td>
  )
}
