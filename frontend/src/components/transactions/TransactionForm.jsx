import { useRef } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import Modal from '@/components/ui/Modal'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '@/constants/app'
import { useForm } from '@/hooks/useForm'
import { cn } from '@/utils/cn'
import { currencySymbol } from '@/utils/format'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  toFormValues,
  toPayload,
  validateTransaction,
} from '@/utils/transactionForm'

/**
 * Add / edit dialog. `onSubmit(payload, { addAnother })` – when adding, "Save & add another"
 * keeps the dialog open with type, category and date kept for quick entry.
 */
export default function TransactionForm({ transaction, categories, currency, onClose, onSubmit }) {
  const editing = Boolean(transaction)
  const addAnother = useRef(false)

  const form = useForm(toFormValues(transaction), {
    validate: validateTransaction,
    onSubmit: async (v) => {
      const again = addAnother.current
      await onSubmit(toPayload(v), { addAnother: again })
      if (again) {
        form.reset({
          ...toFormValues(),
          type: v.type,
          category_id: v.category_id,
          transaction_date: v.transaction_date,
        })
        form.focus('title')
      }
    },
  })

  const options = categories.filter(
    (c) => c.type === form.values.type && (!c.is_archived || c.id === transaction?.category.id),
  )

  const switchType = (type) => {
    if (type === form.values.type) return
    form.setValue('type', type)
    form.setValue('category_id', '')
  }

  const submitWith = (again) => () => {
    addAnother.current = again
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          {!editing && (
            <Button
              type="submit"
              form="transaction-form"
              variant="secondary"
              onClick={submitWith(true)}
              disabled={form.submitting}
            >
              Save & add another
            </Button>
          )}
          <Button
            type="submit"
            form="transaction-form"
            onClick={submitWith(false)}
            loading={form.submitting}
          >
            {editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      <form ref={form.formRef} id="transaction-form" onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={form.submitting} className="space-y-4">
          <Alert title="Couldn’t save">{form.formError}</Alert>

          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
            role="radiogroup"
            aria-label="Type"
          >
            {TRANSACTION_TYPES.map((t) => {
              const active = form.values.type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => switchType(t.value)}
                  className={cn(
                    'rounded-lg py-2 text-sm font-medium transition',
                    active
                      ? cn(
                          'bg-white shadow-sm',
                          t.value === 'income' ? 'text-emerald-600' : 'text-rose-600',
                        )
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <Input
            label="Title"
            placeholder={form.values.type === 'income' ? 'e.g. October salary' : 'e.g. Groceries'}
            maxLength={TITLE_MAX}
            autoFocus
            {...form.field('title')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              prefix={currencySymbol(transaction?.currency ?? currency)}
              {...form.field('amount')}
            />
            <Input label="Date" type="date" {...form.field('transaction_date')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              {...form.field('category_id')}
              error={form.errors.category_id || form.errors.type}
            >
              <option value="">Select a category…</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_archived ? ' (archived)' : ''}
                </option>
              ))}
            </Select>
            <Select label="Payment method" hint="Optional" {...form.field('payment_method')}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Description"
            placeholder="Notes, who it was with, receipt number…"
            hint={`Optional · ${form.values.description.length}/${DESCRIPTION_MAX}`}
            maxLength={DESCRIPTION_MAX}
            {...form.field('description')}
          />
        </fieldset>
      </form>
    </Modal>
  )
}
