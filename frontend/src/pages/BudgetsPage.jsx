import { useState } from 'react'
import BudgetForm from '@/components/budgets/BudgetForm'
import CategoryBudgetCard from '@/components/budgets/CategoryBudgetCard'
import OverallBudgetCard from '@/components/budgets/OverallBudgetCard'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MonthSwitcher from '@/components/dashboard/MonthSwitcher'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import Skeleton from '@/components/ui/Skeleton'
import { useAsync } from '@/hooks/useAsync'
import { useCategories } from '@/hooks/useCategories'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/hooks/useToast'
import { budgetService } from '@/services/budgetService'
import { dashboardService } from '@/services/dashboardService'
import { cn } from '@/utils/cn'
import { addMonths, monthLabel, toISOMonth } from '@/utils/dates'
import { getErrorMessage } from '@/utils/errors'
import { formatCurrency } from '@/utils/format'

export default function BudgetsPage() {
  useDocumentTitle('Budgets')
  const { notify } = useToast()
  const { expenseCategories } = useCategories()
  const [month, setMonth] = useState(toISOMonth())
  const previous = addMonths(month, -1)

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        budgetService.summary(month),
        // Last month's spending, shown as a guide when choosing a limit.
        dashboardService.byCategory({ month: previous, limit: undefined }),
      ]).then(([summary, last]) => ({
        summary,
        lastMonth: {
          total: last.total,
          byCategory: Object.fromEntries(last.categories.map((c) => [c.category_id, c.total])),
        },
      })),
    [month],
  )

  const [dialog, setDialog] = useState(null) // { kind: 'overall' | 'category', budget? }
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const summary = data?.summary
  const budgetedIds = new Set(summary?.categories.map((b) => b.category.id))
  const availableCategories = expenseCategories.filter(
    (c) => !c.is_archived && !budgetedIds.has(c.id),
  )

  const save = async (payload) => {
    if (dialog.budget) {
      const { monthly_limit, alert_threshold } = payload
      await budgetService.update(dialog.budget.id, { monthly_limit, alert_threshold })
      notify('Budget updated')
    } else {
      await budgetService.create({ ...payload, month })
      notify(
        dialog.kind === 'overall'
          ? `Monthly budget set for ${monthLabel(month)}`
          : 'Category budget added',
      )
    }
    setDialog(null)
    reload()
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await budgetService.remove(pendingDelete.id)
      notify('Budget removed')
      setPendingDelete(null)
      reload()
    } catch (err) {
      notify(getErrorMessage(err), { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const copyPrevious = async () => {
    setBusy(true)
    try {
      const copied = await budgetService.copy(previous, month)
      notify(
        copied
          ? `Copied ${copied} budget${copied > 1 ? 's' : ''} from ${monthLabel(previous)}`
          : 'Nothing new to copy',
      )
      reload()
    } catch (err) {
      notify(getErrorMessage(err), { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const canCopy =
    summary?.previous_month_has_budgets && (!summary.overall || availableCategories.length > 0)

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Budgets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set a monthly limit and see how much you have left.
          </p>
        </div>
        {/* Budgets can be planned up to a year ahead. */}
        <MonthSwitcher month={month} onChange={setMonth} max={addMonths(toISOMonth(), 12)} />
      </div>

      {error && (
        <Alert className="mb-6" title="Couldn’t load budgets">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      {!data && loading && <BudgetsSkeleton />}

      {summary && (
        <div
          className={cn('space-y-8', loading && 'opacity-60 transition-opacity')}
          aria-busy={loading}
        >
          {summary.overall ? (
            <OverallBudgetCard
              summary={summary}
              onEdit={() => setDialog({ kind: 'overall', budget: summary.overall })}
              onDelete={() =>
                setPendingDelete({ id: summary.overall.id, label: 'your monthly budget' })
              }
            />
          ) : (
            <section className="rounded-2xl border-2 border-dashed border-gray-200 bg-white">
              <EmptyState
                icon="target"
                title={`No monthly budget for ${monthLabel(month)}`}
                description={
                  Number(summary.total_spent) > 0
                    ? `You’ve spent ${formatCurrency(summary.total_spent, summary.currency)} so far. Set a limit to track what’s left.`
                    : 'Set a spending limit to see how much you have left as the month goes on.'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={() => setDialog({ kind: 'overall' })}>
                      Set monthly budget
                    </Button>
                    {canCopy && (
                      <Button variant="secondary" onClick={copyPrevious} loading={busy}>
                        <Icon name="copy" className="h-4 w-4" />
                        Copy {monthLabel(previous).split(' ')[0]}’s budgets
                      </Button>
                    )}
                  </div>
                }
              />
            </section>
          )}

          <section aria-labelledby="category-budgets">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="category-budgets" className="text-lg font-semibold text-gray-900">
                  Category budgets
                </h2>
                <p className="text-sm text-gray-500">Optional limits for individual categories.</p>
              </div>
              <div className="flex gap-2">
                {summary.overall && canCopy && (
                  <Button variant="secondary" size="sm" onClick={copyPrevious} loading={busy}>
                    <Icon name="copy" className="h-4 w-4" />
                    Copy from {monthLabel(previous).split(' ')[0]}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialog({ kind: 'category' })}
                  disabled={!availableCategories.length}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add category budget
                </Button>
              </div>
            </div>

            {summary.categories.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {summary.categories.map((b) => (
                  <CategoryBudgetCard
                    key={b.id}
                    budget={b}
                    currency={summary.currency}
                    onEdit={() => setDialog({ kind: 'category', budget: b })}
                    onDelete={() =>
                      setPendingDelete({ id: b.id, label: `the ${b.category.name} budget` })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-gray-500 ring-1 ring-gray-200">
                No category budgets yet. Add one to keep a closer eye on e.g. groceries or dining
                out.
              </p>
            )}

            {Number(summary.unbudgeted_spent) > 0 && summary.categories.length > 0 && (
              <p className="mt-4 text-sm text-gray-500">
                {formatCurrency(summary.unbudgeted_spent, summary.currency)} was spent in categories
                without a budget this month.
              </p>
            )}
          </section>
        </div>
      )}

      {dialog && (
        <BudgetForm
          kind={dialog.kind}
          budget={dialog.budget}
          month={month}
          categories={availableCategories}
          currency={summary.currency}
          lastMonth={data.lastMonth}
          onClose={() => setDialog(null)}
          onSubmit={save}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove budget?"
        message={
          pendingDelete &&
          `This removes ${pendingDelete.label} for ${monthLabel(month)}. Transactions aren’t affected.`
        }
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading budgets">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-56" />
        <Skeleton className="mt-6 h-3 w-full" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
