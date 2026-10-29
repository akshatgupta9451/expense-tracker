import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/FormField'
import Modal from '@/components/ui/Modal'
import { useForm } from '@/hooks/useForm'
import { ALERT_THRESHOLDS } from '@/utils/budgets'
import { monthLabel } from '@/utils/dates'
import { currencySymbol, formatCurrency } from '@/utils/format'
import { validateAmount } from '@/utils/validators'

/**
 * Create or edit a budget.
 * - kind "overall": the monthly budget (all spending)
 * - kind "category": a limit for one expense category (chosen when creating)
 * `lastMonth` = { total, byCategory: { [id]: amount } } shows what was spent last month as a guide.
 */
export default function BudgetForm({
  kind,
  budget,
  month,
  categories,
  currency,
  lastMonth,
  onClose,
  onSubmit,
}) {
  const editing = Boolean(budget)
  const form = useForm(
    {
      category_id: budget?.category?.id ?? '',
      monthly_limit: budget?.monthly_limit ?? '',
      alert_threshold: String(budget?.alert_threshold ?? 80),
    },
    {
      validate: (v) => ({
        category_id: kind === 'category' && !editing && !v.category_id ? 'Choose a category' : null,
        monthly_limit: validateAmount(v.monthly_limit),
      }),
      // A budget for that category/month already exists (409) → show on the category field.
      mapError: (err) =>
        err.response?.status === 409
          ? {
              [kind === 'category' ? 'category_id' : 'monthly_limit']:
                'A budget for this already exists this month',
            }
          : err.response?.status === 400
            ? { category_id: err.response.data?.error?.message }
            : null,
      onSubmit: (v) =>
        onSubmit({
          category_id: kind === 'category' ? v.category_id || budget?.category?.id : null,
          monthly_limit: String(v.monthly_limit),
          alert_threshold: Number(v.alert_threshold),
        }),
    },
  )

  const categoryId = form.values.category_id || budget?.category?.id
  const reference = kind === 'overall' ? lastMonth?.total : lastMonth?.byCategory?.[categoryId]
  const title =
    kind === 'overall'
      ? editing
        ? 'Edit monthly budget'
        : 'Set monthly budget'
      : editing
        ? `Edit ${budget.category.name} budget`
        : 'Add category budget'

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button type="submit" form="budget-form" loading={form.submitting}>
            {editing ? 'Save changes' : 'Save budget'}
          </Button>
        </>
      }
    >
      <form ref={form.formRef} id="budget-form" onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={form.submitting} className="space-y-4">
          <p className="text-sm text-gray-500">
            {kind === 'overall'
              ? `The most you want to spend in total in ${monthLabel(month)}.`
              : `A spending limit for one category in ${monthLabel(month)}.`}
          </p>
          <Alert title="Couldn’t save">{form.formError}</Alert>

          {kind === 'category' && !editing && (
            <Select label="Category" {...form.field('category_id')}>
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Monthly limit"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            prefix={currencySymbol(currency)}
            autoFocus
            hint={
              reference != null
                ? `Last month you spent ${formatCurrency(reference, currency)}${kind === 'category' ? ' here' : ''}.`
                : undefined
            }
            {...form.field('monthly_limit')}
          />

          <Select
            label="Warn me when spending reaches"
            hint="The bar turns amber and shows “Near limit” past this point."
            {...form.field('alert_threshold')}
          >
            {ALERT_THRESHOLDS.map((t) => (
              <option key={t} value={t}>
                {t}% of the limit
              </option>
            ))}
          </Select>
        </fieldset>
      </form>
    </Modal>
  )
}
