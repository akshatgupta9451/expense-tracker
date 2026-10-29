import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'
import { formatCurrency } from '@/utils/format'

function Stat({ label, value, hint }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function InsightList({ items, icon, iconClass }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm text-gray-700">
          <Icon name={icon} className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function InsightsPanel({ insights, loading }) {
  if (loading && !insights) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </div>
    )
  }
  if (!insights) return null

  const { currency } = insights
  const money = (v) => formatCurrency(v, currency)
  const atRisk = insights.budgets.filter((b) => b.at_risk).length

  return (
    <div className="space-y-6">
      <Card title="Predictions">
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="This month"
            value={money(insights.projected_this_month)}
            hint={`${money(insights.month_to_date)} spent so far`}
          />
          <Stat
            label="Next month"
            value={money(insights.predicted_next_month)}
            hint="Based on recent months"
          />
        </div>
        {atRisk > 0 && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {atRisk === 1 ? '1 budget is' : `${atRisk} budgets are`} on track to be exceeded
          </p>
        )}
      </Card>

      {insights.has_data ? (
        <>
          {insights.patterns.length > 0 && (
            <Card title="Spending patterns">
              <InsightList items={insights.patterns} icon="chart" iconClass="text-brand-500" />
            </Card>
          )}
          {insights.suggestions.length > 0 && (
            <Card title="Saving suggestions">
              <InsightList items={insights.suggestions} icon="piggy" iconClass="text-emerald-500" />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p className="text-sm text-gray-500">
            Add a few transactions and the assistant will start spotting patterns and predicting
            your spending.
          </p>
        </Card>
      )}
    </div>
  )
}
