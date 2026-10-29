import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export const SORTS = {
  DATE_DESC: '-transaction_date',
  DATE_ASC: 'transaction_date',
  AMOUNT_DESC: '-amount',
  AMOUNT_ASC: 'amount',
}

export const FILTER_KEYS = [
  'q',
  'type',
  'category_id',
  'start_date',
  'end_date',
  'min_amount',
  'max_amount',
]
const DEFAULTS = { sort: SORTS.DATE_DESC, page: 1, page_size: 10 }
export const PAGE_SIZES = [10, 25, 50]

/**
 * Filters, sort and page live in the URL (?type=expense&sort=-amount&page=2), so they survive
 * reloads, work with Back/Forward and can be shared as a link.
 */
export function useTransactionQuery() {
  const [params, setParams] = useSearchParams()

  const state = useMemo(() => {
    const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))
    const sort = Object.values(SORTS).includes(params.get('sort'))
      ? params.get('sort')
      : DEFAULTS.sort
    const page = Math.max(1, Number.parseInt(params.get('page'), 10) || DEFAULTS.page)
    const size = Number.parseInt(params.get('page_size'), 10)
    const pageSize = PAGE_SIZES.includes(size) ? size : DEFAULTS.page_size
    return { filters, sort, page, pageSize }
  }, [params])

  const { filters } = state

  // Ranges that would be rejected by the API are left out of the request (and flagged in the UI).
  const invalid = {
    amount:
      filters.min_amount !== '' &&
      filters.max_amount !== '' &&
      Number(filters.min_amount) > Number(filters.max_amount),
    dates: filters.start_date && filters.end_date && filters.start_date > filters.end_date,
  }

  const apiQuery = {
    ...filters,
    ...(invalid.amount && { min_amount: '', max_amount: '' }),
    ...(invalid.dates && { start_date: '', end_date: '' }),
    sort: state.sort,
    page: state.page,
    page_size: state.pageSize,
  }

  /** Merge `patch` into the URL. Changing filters/sort/size goes back to page 1. */
  const update = useCallback(
    (patch, { replace = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            const isDefault = String(value) === String(DEFAULTS[key] ?? '')
            if (value === '' || value == null || isDefault) next.delete(key)
            else next.set(key, String(value))
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(
    () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, '']))),
    [update],
  )

  const activeFilterCount = FILTER_KEYS.filter((k) => filters[k] !== '').length

  return {
    ...state,
    invalid,
    apiQuery,
    update,
    clearFilters,
    activeFilterCount,
    search: params.toString(),
  }
}
