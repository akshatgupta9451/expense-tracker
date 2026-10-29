import { BUDGET_STATUS } from '@/utils/budgets'
import { cn } from '@/utils/cn'

export default function StatusBadge({ status }) {
  const s = BUDGET_STATUS[status]
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.badge)}>{s.label}</span>
  )
}
