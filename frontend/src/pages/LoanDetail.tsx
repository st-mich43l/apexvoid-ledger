import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteLoan } from '../api'
import { PremiumCard } from '../components/PremiumCard'
import { DeleteLoanDialog } from '../components/loan/DeleteLoanDialog'
import { EditLoanDialog } from '../components/loan/EditLoanDialog'
import { LoanBalanceChart } from '../components/loan/LoanBalanceChart'
import { LoanCostSummary } from '../components/loan/LoanCostSummary'
import { LoanPaymentBreakdownChart } from '../components/loan/LoanPaymentBreakdownChart'
import { LoanProgress } from '../components/loan/LoanProgress'
import { LoanScheduleTable } from '../components/loan/LoanScheduleTable'
import { LoanSummary } from '../components/loan/LoanSummary'
import { useLoanDetail } from '../hooks/useLoanDetail'
import { formatCurrency } from '../lib/currency'

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>()
  const { detail, schedule, loading, notFound, error, refetch } = useLoanDetail(loanId ?? '')
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (notFound) {
    return (
      <section className="rounded-3xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Loan not found</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          It may have been deleted, or it doesn't belong to your account.
        </p>
        <Link
          to="/loan"
          className="mt-4 inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          Back to loans
        </Link>
      </section>
    )
  }

  if (loading || !detail) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
  }

  const monthlyPaymentSubtitle = detail.loanType === 'unsecured' ? 'Fixed EMI' : 'Interest only'
  const monthlyPaymentTitle = detail.loanType === 'unsecured' ? 'Monthly payment' : 'Est. monthly interest'

  return (
    <section className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      <LoanSummary detail={detail} onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PremiumCard
          title="Estimated outstanding"
          accent="violet"
          value={formatCurrency(detail.estimatedOutstandingBalance, detail.currency)}
          subtitle={detail.isMatured ? 'Matured' : `${detail.termsRemaining} terms left`}
          icon={<BankIcon />}
        />
        <PremiumCard
          title={monthlyPaymentTitle}
          accent="cyan"
          value={formatCurrency(detail.monthlyPayment, detail.currency)}
          subtitle={monthlyPaymentSubtitle}
          icon={<RepeatIcon />}
        />
        <PremiumCard
          title="Terms remaining"
          accent="amber"
          value={String(detail.termsRemaining)}
          subtitle={`of ${detail.durationMonths} total`}
          icon={<HourglassIcon />}
        />
        <PremiumCard
          title="Total estimated interest"
          accent="emerald"
          value={formatCurrency(detail.totalInterest, detail.currency)}
          subtitle="Over the full term"
          icon={<TrendingUpIcon />}
        />
      </div>

      <LoanBalanceChart schedule={schedule} openDate={detail.openDate} disbursementAmount={detail.disbursementAmount} currency={detail.currency} />
      <LoanPaymentBreakdownChart schedule={schedule} currency={detail.currency} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LoanProgress detail={detail} />
        <LoanCostSummary detail={detail} />
      </div>

      <LoanScheduleTable schedule={schedule} currency={detail.currency} />

      {editOpen && (
        <EditLoanDialog
          loan={detail}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false)
            await refetch()
          }}
        />
      )}

      {deleteOpen && (
        <DeleteLoanDialog
          loan={detail}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            await deleteLoan(detail.id)
            navigate('/loan')
          }}
        />
      )}
    </section>
  )
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 4l9 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9M9 10v9M15 10v9M19 10v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m17 2 4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 22-4-4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 22h14M5 2h14" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 2c0 4 3 5.5 4.5 6.5.5.33.5.67 0 1C9 10.5 6 12 6 16v0m12-14c0 4-3 5.5-4.5 6.5-.5.33-.5.67 0 1 1.5 1 4.5 2.5 4.5 6.5v0M6 22c0-4 3-5.5 4.5-6.5.5-.33 1-.33 1.5 0C13.5 16.5 18 18 18 22"
      />
    </svg>
  )
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h6v6" />
    </svg>
  )
}
