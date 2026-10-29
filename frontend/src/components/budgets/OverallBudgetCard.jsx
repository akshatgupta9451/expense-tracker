import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'
import BudgetProgress from './BudgetProgress'
import StatusBadge from './StatusBadge'

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={cn('mt-1 text-lg font-semibold tabular-nums', tone ?? 'text-gray-900')}>
        {value}
      </dd>
    </div>
  )
}

/** The overall monthly budget: limit, spent, remaining, and pacing for the current month. */
export default function OverallBudgetCard({ summary, onEdit, onDelete }) {
  const { overall: budget, currency } = summary
  const money = (v) => formatCurrency(v, currency)
  const remaining = Number(budget.remaining)
  const over = remaining < 0
  const projected = summary.projected_spend != null ? Number(summary.projected_spend) : null
  const projectedOver = projected != null && projected > Number(budget.monthly_limit)

  return (
    <section
      aria-labelledby="overall-budget"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="overall-budget" className="text-sm font-medium text-gray-500">
              Monthly budget
            </h2>
            <StatusBadge status={budget.status} />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
            {over ? money(-remaining) : money(remaining)}
            <span className="ml-2 text-base font-medium text-gray-500">
              {over ? 'over budget' : 'left to spend'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Icon name="pencil" className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Remove monthly budget">
            <Icon name="trash" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <BudgetProgress budget={budget} size="lg" />
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>
            {money(budget.spent)} spent · {Math.round(budget.percent_used)}%
          </span>
          <span>Alert at {budget.alert_threshold}%</span>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Budget limit" value={money(budget.monthly_limit)} />
        <Stat label="Current spending" value={money(budget.spent)} />
        <Stat
          label="Remaining"
          value={money(budget.remaining)}
          tone={over ? 'text-rose-600' : 'text-emerald-600'}
        />
        {summary.daily_allowance != null ? (
          <Stat
            label={`Per day · ${summary.days_left} days left`}
            value={money(summary.daily_allowance)}
          />
        ) : (
          <Stat
            label={summary.days_elapsed === 0 ? 'Starts in' : 'Month'}
            value={summary.days_elapsed === 0 ? `${summary.days_in_month} days` : 'Closed'}
          />
        )}
      </dl>

      {projectedOver && !over && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="trendUp" className="mt-0.5 h-4 w-4 shrink-0" />
          At this pace you’ll spend about {money(projected)} this month,{' '}
          {money(projected - Number(budget.monthly_limit))} over your budget.
        </p>
      )}
    </section>
  )
}
