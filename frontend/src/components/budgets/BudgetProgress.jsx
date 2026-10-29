import { BUDGET_STATUS } from '@/utils/budgets'
import { cn } from '@/utils/cn'

/** Spending bar for a budget, with a tick where the alert threshold sits. */
export default function BudgetProgress({ budget, size = 'md' }) {
  const pct = Math.min(budget.percent_used, 100)
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-gray-100',
        size === 'lg' ? 'h-3' : 'h-2',
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(budget.percent_used)}
      aria-label={`${Math.round(budget.percent_used)}% of budget used`}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          BUDGET_STATUS[budget.status].bar,
        )}
        style={{ width: `${pct}%` }}
      />
      {budget.alert_threshold < 100 && (
        <span
          className="absolute inset-y-0 w-0.5 bg-gray-400/70"
          style={{ left: `${budget.alert_threshold}%` }}
          title={`Alert at ${budget.alert_threshold}%`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
