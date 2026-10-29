import { Doughnut } from 'react-chartjs-2'
import EmptyState from '@/components/ui/EmptyState'
import { formatCompactCurrency, formatCurrency } from '@/utils/format'
import { tooltip } from './chartTheme'

/** Expense breakdown by category from GET /dashboard/category, with the total in the middle. */
export default function ExpensePieChart({ data, currency }) {
  if (!data.categories.length) {
    return (
      <EmptyState
        icon="chart"
        title="No expenses this month"
        description="Spending by category shows up here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative mx-auto h-40 w-40">
        <Doughnut
          data={{
            labels: data.chart.labels,
            datasets: data.chart.datasets.map((d) => ({
              ...d,
              label: 'Spent',
              borderColor: '#fff',
              borderWidth: 3,
              hoverOffset: 6,
            })),
          }}
          options={{
            cutout: '72%',
            plugins: {
              legend: { display: false },
              tooltip: {
                ...tooltip(currency),
                callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed, currency)}` },
              },
            },
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Total</span>
          <span className="text-xl font-semibold text-gray-900 tabular-nums">
            {formatCompactCurrency(data.total, currency)}
          </span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {data.categories.map((c) => (
          <li key={c.category_id ?? 'other'}>
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1 truncate text-gray-700">{c.name}</span>
              <span className="font-medium text-gray-900 tabular-nums">
                {formatCurrency(c.total, currency)}
              </span>
              <span className="w-10 text-right text-xs text-gray-500 tabular-nums">
                {Math.round(c.percentage)}%
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${c.percentage}%`, backgroundColor: c.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
