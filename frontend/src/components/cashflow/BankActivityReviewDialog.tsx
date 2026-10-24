import type { BankActivity, Category } from '../../types'
import { Modal } from '../Modal'
import { BankActivityList } from './BankActivityList'

interface BankActivityReviewDialogProps {
  activities: BankActivity[]
  categories: Category[]
  loading: boolean
  monthLabel: string
  onClose: () => void
  onChanged: () => Promise<void>
}

export function BankActivityReviewDialog({ activities, categories, loading, monthLabel, onClose, onChanged }: BankActivityReviewDialogProps) {
  return <Modal label="Review bank activity" onClose={onClose}>
    <div className="mb-5"><h2 className="text-lg font-semibold text-ledger-text">Review bank activity</h2><p className="mt-1 text-sm text-ledger-text-secondary">Classify received SePay events once. Saved classifications preserve the linked transaction and never create a duplicate.</p></div>
    <BankActivityList activities={activities} categories={categories} loading={loading} monthLabel={monthLabel} onChanged={onChanged} />
  </Modal>
}
