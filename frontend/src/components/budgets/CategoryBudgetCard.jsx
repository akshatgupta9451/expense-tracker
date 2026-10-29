import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'
import BudgetProgress from './BudgetProgress'
import StatusBadge from './StatusBadge'

export default function CategoryBudgetCard({ budget, currency, onEdit, onDelete }) {
  const money = (v) => formatCurrency(v, currency)
  const remaining = Number(budget.remaining)
  const { category } = budget

  return (
    <article className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        >
          {category.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-gray-900">{category.name}</h3>
          <StatusBadge status={budget.status} />
        </div>
        <div className="flex">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={`Edit ${category.name} budget`}
          >
            <Icon name="pencil" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Remove ${category.name} budget`}
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        <span className="text-lg font-semibold text-gray-900 tabular-nums">
          {money(budget.spent)}
        </span>{' '}
        of {money(budget.monthly_limit)}
      </p>
      <div className="mt-2">
        <BudgetProgress budget={budget} />
      </div>
      <p
        className={cn(
          'mt-2 text-xs font-medium',
          remaining < 0 ? 'text-rose-600' : 'text-gray-500',
        )}
      >
        {remaining < 0 ? `${money(-remaining)} over` : `${money(remaining)} left`}
      </p>
    </article>
  )
}
