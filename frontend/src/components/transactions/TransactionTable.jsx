import { useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import { SORTS } from '@/hooks/useTransactionQuery'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate } from '@/utils/format'

function Amount({ txn }) {
  const income = txn.type === 'income'
  return (
    <span
      className={cn('font-semibold tabular-nums', income ? 'text-emerald-600' : 'text-gray-900')}
    >
      {income ? '+' : '−'}
      {formatCurrency(txn.amount, txn.currency)}
    </span>
  )
}

function TypeBadge({ type }) {
  const income = type === 'income'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        income ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      )}
    >
      {income ? 'Income' : 'Expense'}
    </span>
  )
}

function CategoryBadge({ category }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  )
}

function RowActions({ txn, onEdit, onDelete }) {
  const btn = 'rounded-md p-1.5 text-gray-400 transition-colors'
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(txn)}
        className={cn(btn, 'hover:bg-gray-100 hover:text-gray-700')}
        aria-label={`Edit ${txn.title}`}
      >
        <Icon name="pencil" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(txn)}
        className={cn(btn, 'hover:bg-rose-50 hover:text-rose-600')}
        aria-label={`Delete ${txn.title}`}
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    </div>
  )
}

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
    />
  )
}

/** Column header that toggles between descending and ascending for `field`. */
function SortHeader({ label, field, sort, onSort, align = 'left' }) {
  const desc = `-${field}`
  const active = sort === field || sort === desc
  const nextSort = sort === desc ? field : desc
  return (
    <th
      scope="col"
      aria-sort={active ? (sort === desc ? 'descending' : 'ascending') : 'none'}
      className={cn('py-3 pr-4', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-900',
          active && 'text-gray-900',
        )}
      >
        {label}
        <Icon
          name={active && sort !== desc ? 'chevronUp' : 'chevronDown'}
          className={cn('h-3.5 w-3.5', !active && 'opacity-30')}
          strokeWidth={2.5}
        />
      </button>
    </th>
  )
}

/** Table on wide screens, stacked cards on phones. */
export default function TransactionTable({
  items,
  selected,
  onToggle,
  onToggleAll,
  sort,
  onSort,
  onEdit,
  onDelete,
}) {
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id))
  const someSelected = !allSelected && items.some((t) => selected.has(t.id))

  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th scope="col" className="w-10 py-3 pr-2">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onToggleAll}
                label="Select all on this page"
              />
            </th>
            <SortHeader label="Date" field={SORTS.DATE_ASC} sort={sort} onSort={onSort} />
            <th scope="col" className="py-3 pr-4">
              Title
            </th>
            <th scope="col" className="py-3 pr-4">
              Category
            </th>
            <th scope="col" className="py-3 pr-4">
              Type
            </th>
            <SortHeader
              label="Amount"
              field={SORTS.AMOUNT_ASC}
              sort={sort}
              onSort={onSort}
              align="right"
            />
            <th scope="col" className="py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((txn) => (
            <tr
              key={txn.id}
              className={cn('group', selected.has(txn.id) ? 'bg-brand-50/60' : 'hover:bg-gray-50')}
            >
              <td className="py-3 pr-2">
                <Checkbox
                  checked={selected.has(txn.id)}
                  onChange={() => onToggle(txn.id)}
                  label={`Select ${txn.title}`}
                />
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-gray-500">
                {formatDate(txn.transaction_date)}
              </td>
              <td className="max-w-xs py-3 pr-4">
                <p className="truncate font-medium text-gray-900">{txn.title}</p>
                {txn.description && (
                  <p className="truncate text-xs text-gray-500">{txn.description}</p>
                )}
              </td>
              <td className="py-3 pr-4">
                <CategoryBadge category={txn.category} />
              </td>
              <td className="py-3 pr-4">
                <TypeBadge type={txn.type} />
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-right">
                <Amount txn={txn} />
              </td>
              <td className="py-3">
                <RowActions txn={txn} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        <label className="flex items-center gap-2 border-b border-gray-100 pb-3 text-sm text-gray-600">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={onToggleAll}
            label="Select all on this page"
          />
          Select all
        </label>
        <ul className="divide-y divide-gray-100">
          {items.map((txn) => (
            <li key={txn.id} className="flex items-start gap-3 py-3">
              <div className="pt-0.5">
                <Checkbox
                  checked={selected.has(txn.id)}
                  onChange={() => onToggle(txn.id)}
                  label={`Select ${txn.title}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{txn.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{formatDate(txn.transaction_date)}</span>
                  <CategoryBadge category={txn.category} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Amount txn={txn} />
                <RowActions txn={txn} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
