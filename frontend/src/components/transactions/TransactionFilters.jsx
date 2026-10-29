import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/FormField'
import Icon from '@/components/ui/Icon'
import { TRANSACTION_TYPES } from '@/constants/app'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * Search + filters. Search is typed into local state and pushed to the URL after a pause,
 * so each keystroke doesn't fire a request or add a history entry.
 */
export default function TransactionFilters({ query, categories }) {
  const { filters, update, invalid, activeFilterCount, clearFilters } = query
  const [search, setSearch] = useState(filters.q)
  const debounced = useDebounce(search, 350)
  const [showMore, setShowMore] = useState(
    Boolean(filters.min_amount || filters.max_amount || filters.start_date || filters.end_date),
  )

  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // Keep the box in sync when the URL changes elsewhere (Back button, "Clear filters").
  useEffect(() => setSearch(filters.q), [filters.q])

  const set = (key) => (e) => update({ [key]: e.target.value })
  const visibleCategories = filters.type
    ? categories.filter((c) => c.type === filters.type)
    : categories

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex-1">
          <Input
            aria-label="Search"
            type="search"
            icon="search"
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select
            aria-label="Type"
            value={filters.type}
            onChange={(e) => update({ type: e.target.value, category_id: '' })}
            className="sm:w-36"
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Category"
            value={filters.category_id}
            onChange={set('category_id')}
            className="sm:w-44"
          >
            <option value="">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_archived ? ' (archived)' : ''}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="more-filters"
            className="col-span-2 sm:col-span-1"
          >
            <Icon name="filter" className="h-4 w-4" />
            More filters
          </Button>
        </div>
      </div>

      {showMore && (
        <div
          id="more-filters"
          className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Input
            label="From"
            type="date"
            value={filters.start_date}
            onChange={set('start_date')}
            error={invalid.dates ? 'Must be before “To”' : null}
          />
          <Input label="To" type="date" value={filters.end_date} onChange={set('end_date')} />
          <Input
            label="Min amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={filters.min_amount}
            onChange={set('min_amount')}
            error={invalid.amount ? 'Must be ≤ max' : null}
          />
          <Input
            label="Max amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={filters.max_amount}
            onChange={set('max_amount')}
          />
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
