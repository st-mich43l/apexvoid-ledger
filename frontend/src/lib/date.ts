// dd/mm/yyyy, independent of the visitor's browser/OS locale — same
// rationale as LoanForm's masked date input.
export function formatDate(iso: string): string {
  const date = new Date(iso)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatMonthYear(iso: string): string {
  const date = new Date(iso)
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}
