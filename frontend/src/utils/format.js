/** 1234.5 -> "$1,234.50" (accepts numbers or the API's decimal strings like "12.50"). */
export function formatCurrency(value, currency = 'USD') {
  const amount = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount || 0)
}

/** "2026-10-27" -> "Oct 27, 2026", parsed as a calendar date (no timezone shift). */
export function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** 12.3 -> "+12.3%", null -> "—" */
export function formatPercent(value) {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/** 1530 -> "$1.5K" for chart axes and tight spaces. */
export function formatCompactCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0)
}

/** "USD" -> "$", "EUR" -> "€" (locale-aware). */
export function currencySymbol(currency = 'USD') {
  return (
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  )
}
