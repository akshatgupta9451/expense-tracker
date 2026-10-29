import { Bar } from 'react-chartjs-2'
import EmptyState from '@/components/ui/EmptyState'
import { axes, COLORS, tooltip } from './chartTheme'

/** Expense per month; the selected month is highlighted. */
export default function MonthlyExpenseChart({ monthly, currency, selectedMonth }) {
  const rows = monthly.months
  if (!rows.some((r) => r.expense)) {
    return <EmptyState icon="chart" title="No expenses in this period" />
  }

  return (
    <div className="relative h-64 xl:h-full xl:min-h-[16rem]">
      <Bar
        data={{
          labels: rows.map((r) => r.label.split(' ')[0]), // "Oct 2026" -> "Oct"
          datasets: [
            {
              label: 'Expense',
              data: rows.map((r) => r.expense),
              backgroundColor: rows.map((r) =>
                r.month === selectedMonth ? COLORS.brand : COLORS.brandSoft,
              ),
              hoverBackgroundColor: COLORS.brand,
              borderRadius: 6,
              borderSkipped: false,
              maxBarThickness: 36,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltip(currency),
              callbacks: {
                ...tooltip(currency).callbacks,
                title: (items) => rows[items[0].dataIndex].label,
              },
            },
          },
          scales: axes(currency),
        }}
      />
    </div>
  )
}
