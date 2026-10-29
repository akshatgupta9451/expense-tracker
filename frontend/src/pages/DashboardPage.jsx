import { useState } from 'react'
import ExportMenu from '@/components/common/ExportMenu'
import ChartCard from '@/components/dashboard/ChartCard'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton'
import ExpensePieChart from '@/components/dashboard/ExpensePieChart'
import IncomeExpenseChart from '@/components/dashboard/IncomeExpenseChart'
import KpiCard from '@/components/dashboard/KpiCard'
import MonthlyExpenseChart from '@/components/dashboard/MonthlyExpenseChart'
import MonthSwitcher from '@/components/dashboard/MonthSwitcher'
import RecentTransactions from '@/components/dashboard/RecentTransactions'
import Alert from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { ROUTES } from '@/constants/routes'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { dashboardService } from '@/services/dashboardService'
import { transactionService } from '@/services/transactionService'
import { cn } from '@/utils/cn'
import { monthLabel, monthRange, toISOMonth } from '@/utils/dates'
import { formatCompactCurrency, formatCurrency } from '@/utils/format'

const RANGES = [
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const [month, setMonth] = useState(toISOMonth())
  const [range, setRange] = useState(6)

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        dashboardService.summary(month),
        dashboardService.monthly(range, month),
        dashboardService.byCategory({ month }),
        transactionService.list({ page_size: 5 }),
      ]).then(([summary, monthly, category, recent]) => ({ summary, monthly, category, recent })),
    [month, range],
  )

  const firstName = user?.name?.split(' ')[0]

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">
            {greeting()}
            {firstName ? `, ${firstName}` : ''} 👋
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Here’s how your money moved in {monthLabel(month)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSwitcher month={month} onChange={setMonth} />
          <ExportMenu
            label="Report"
            filters={{ start_date: monthRange(month).start, end_date: monthRange(month).end }}
            description={`All transactions in ${monthLabel(month)}.`}
          />
          <ButtonLink to={ROUTES.TRANSACTION_NEW}>
            <Icon name="plus" className="h-4 w-4" />
            Add transaction
          </ButtonLink>
        </div>
      </div>

      {error && (
        <Alert className="mb-6" title="Couldn’t load your dashboard">
          {error}{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Try again
          </button>
        </Alert>
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        <div
          className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}
          aria-busy={loading}
        >
          <KpiRow {...data} month={month} />

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              title="Income vs Expense"
              subtitle={`Last ${range} months · shaded area is what you saved`}
              className="xl:col-span-2"
              action={
                <SegmentedControl
                  label="Range"
                  options={RANGES}
                  value={range}
                  onChange={setRange}
                />
              }
            >
              <IncomeExpenseChart monthly={data.monthly} currency={data.summary.currency} />
            </ChartCard>
            <ChartCard title="Expenses by category" subtitle={monthLabel(month)}>
              <ExpensePieChart data={data.category} currency={data.summary.currency} />
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              title="Monthly expenses"
              subtitle={`Average ${formatCompactCurrency(
                data.monthly.summary.average_monthly_expense,
                data.summary.currency,
              )} / month`}
              className="xl:col-span-2"
            >
              <MonthlyExpenseChart
                monthly={data.monthly}
                currency={data.summary.currency}
                selectedMonth={month}
              />
            </ChartCard>
            <ChartCard title="Recent transactions">
              <RecentTransactions items={data.recent.items} />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  )
}

function KpiRow({ summary, monthly, month }) {
  const { currency, this_month: m } = summary
  const money = (v) => formatCurrency(v, currency)
  const series = (key) => monthly.months.map((r) => r[key])

  // Savings change vs last month isn't in the summary; derive it from the monthly series.
  const rows = monthly.months
  const idx = rows.findIndex((r) => r.month === month)
  const prevNet = idx > 0 ? rows[idx - 1].net : null
  const savingsDelta = prevNet ? ((m.net - prevNet) / Math.abs(prevNet)) * 100 : null

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        highlight
        label="Total balance"
        value={money(summary.current_balance)}
        icon="wallet"
        tone="brand"
        footnote={`${summary.transaction_count} transactions · as of ${summary.as_of}`}
      />
      <KpiCard
        label="Income"
        value={money(m.income)}
        icon="arrowUp"
        tone="income"
        delta={m.income_change_pct}
        goodWhen="up"
        trend={series('income')}
        footnote="vs last month"
      />
      <KpiCard
        label="Expense"
        value={money(m.expense)}
        icon="arrowDown"
        tone="expense"
        delta={m.expense_change_pct}
        goodWhen="down"
        trend={series('expense')}
        footnote="vs last month"
      />
      <KpiCard
        label="Savings"
        value={money(m.net)}
        icon="piggy"
        tone="savings"
        delta={savingsDelta}
        goodWhen="up"
        trend={series('net')}
        footnote={m.savings_rate != null ? `${m.savings_rate.toFixed(0)}% saved` : 'No income'}
      />
    </div>
  )
}
