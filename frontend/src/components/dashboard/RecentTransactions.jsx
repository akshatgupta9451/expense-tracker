import { Link } from 'react-router-dom'
import EmptyState from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate } from '@/utils/format'

export default function RecentTransactions({ items }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No transactions yet"
        description="Your latest activity will appear here."
      />
    )
  }
  return (
    <ul className="-my-2 divide-y divide-gray-100">
      {items.map((t) => {
        const income = t.type === 'income'
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: t.category.color }}
              aria-hidden="true"
            >
              {t.category.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{t.title}</p>
              <p className="truncate text-xs text-gray-500">
                {t.category.name} · {formatDate(t.transaction_date)}
              </p>
            </div>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                income ? 'text-emerald-600' : 'text-gray-900',
              )}
            >
              {income ? '+' : '−'}
              {formatCurrency(t.amount, t.currency)}
            </span>
          </li>
        )
      })}
      <li className="pt-3">
        <Link
          to={ROUTES.TRANSACTIONS}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View all transactions →
        </Link>
      </li>
    </ul>
  )
}
