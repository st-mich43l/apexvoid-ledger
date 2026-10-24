import { useState } from 'react'
import { LoanBreakdownChart } from '../components/LoanBreakdownChart'
import { LoanForm } from '../components/LoanForm'
import { LoanMonthlyPaymentSummary } from '../components/LoanMonthlyPaymentSummary'
import { LoanTable } from '../components/LoanTable'
import { DeleteLoanDialog } from '../components/loan/DeleteLoanDialog'
import { useLoans } from '../hooks/useLoans'
import type { Loan } from '../types'
import { PageHeader } from '../components/layout/PageHeader'

export function LoanPage() {
  const { loans, loading, error, createLoan, deleteLoan } = useLoans()
  const [pendingDelete, setPendingDelete] = useState<Loan | null>(null)
  const hasBalanceBreakdown = loans.some((loan) => loan.currentBalance > 0)

  return (
    <section>
      <PageHeader title="Loans" description="Track active borrowing and estimated repayment." meta={<span className="text-sm text-ledger-text-secondary">{loans.length} {loans.length === 1 ? 'loan' : 'loans'}</span>} />

      {error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && (
        <div className={`mb-6 grid gap-4 ${hasBalanceBreakdown ? 'lg:grid-cols-2' : ''}`}>
          <LoanMonthlyPaymentSummary loans={loans} />
          <LoanBreakdownChart loans={loans} />
        </div>
      )}

      <div className="mb-6">
        <LoanForm onSubmit={createLoan} />
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <LoanTable loans={loans} onRequestDelete={setPendingDelete} />
      )}

      {pendingDelete && (
        <DeleteLoanDialog
          loan={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteLoan(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </section>
  )
}
