import { Line } from 'react-chartjs-2'
import EmptyState from '@/components/ui/EmptyState'
import { axes, COLORS, tooltip } from './chartTheme'

const series = (chart, key) => chart.datasets.find((d) => d.key === key)?.data ?? []

/** Smoothed income vs expense area lines from GET /dashboard/monthly. */
export default function IncomeExpenseChart({ monthly, currency }) {
  const { chart } = monthly
  const income = series(chart, 'income')
  const expense = series(chart, 'expense')
  if (![...income, ...expense].some(Boolean)) {
    return <EmptyState icon="chart" title="No activity in this period" />
  }

  const line = (label, data, color, fill) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    fill,
    tension: 0.35,
    borderWidth: 2.5,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: color,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2,
  })

  return (
    <div className="relative h-72 xl:h-full xl:min-h-[18rem]">
      <Line
        data={{
          labels: chart.labels,
          datasets: [
            // Shade between the two lines: green where income is above expense (saved),
            // rose where expense is above income (overspent).
            line('Income', income, COLORS.income, {
              target: 1,
              above: 'rgba(16, 185, 129, 0.14)',
              below: 'rgba(244, 63, 94, 0.14)',
            }),
            line('Expense', expense, COLORS.expense, false),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6 },
            },
            tooltip: tooltip(currency),
          },
          scales: axes(currency),
        }}
      />
    </div>
  )
}
