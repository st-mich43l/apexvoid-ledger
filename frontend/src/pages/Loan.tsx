import { useState } from 'react'
import { LoanBreakdownChart } from '../components/LoanBreakdownChart'
import { LoanForm } from '../components/LoanForm'
import { LoanMonthlyPaymentSummary } from '../components/LoanMonthlyPaymentSummary'
import { LoanTable } from '../components/LoanTable'
import { DeleteLoanDialog } from '../components/loan/DeleteLoanDialog'
import { useLoans } from '../hooks/useLoans'
import type { Loan } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Modal } from '../components/Modal'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'

export function LoanPage() {
  const { loans, loading, error, createLoan, deleteLoan } = useLoans()
  const [pendingDelete, setPendingDelete] = useState<Loan | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const hasBalanceBreakdown = loans.some((loan) => loan.currentBalance > 0)

  return (
    <section>
      <PageHeader title="Loans" description="Track contractual borrowing and estimated repayment; due schedules are not confirmed payment records." meta={<span className="text-sm text-ledger-text-secondary">{loans.length} {loans.length === 1 ? 'loan' : 'loans'}</span>} actions={<Button type="button" onClick={() => setShowCreate(true)}>Add loan</Button>} />

      {error && <Alert tone="danger" className="mb-6">{error}</Alert>}

      {!loading && (
        <div className={`mb-6 grid gap-4 ${hasBalanceBreakdown ? 'lg:grid-cols-2' : ''}`}>
          <LoanMonthlyPaymentSummary loans={loans} />
          <LoanBreakdownChart loans={loans} />
        </div>
      )}

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
      {showCreate && <Modal label="Add loan" onClose={() => setShowCreate(false)}><LoanForm onSubmit={async (input) => { await createLoan(input); setShowCreate(false) }} /></Modal>}
    </section>
  )
}
