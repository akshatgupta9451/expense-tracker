const pad = (n) => String(n).padStart(2, '0')

/** Local calendar date as "YYYY-MM-DD". */
export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local month as "YYYY-MM". */
export function toISOMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function monthLabel(isoMonth) {
  const [y, m] = isoMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** "2026-10" shifted by `delta` months -> "2026-09" / "2026-11". */
export function addMonths(isoMonth, delta) {
  const [y, m] = isoMonth.split('-').map(Number)
  return toISOMonth(new Date(y, m - 1 + delta, 1))
}

/** "2026-02" -> { start: "2026-02-01", end: "2026-02-28" } */
export function monthRange(isoMonth) {
  const [y, m] = isoMonth.split('-').map(Number)
  return { start: `${isoMonth}-01`, end: toISODate(new Date(y, m, 0)) }
}
