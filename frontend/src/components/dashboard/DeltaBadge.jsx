import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'

/**
 * "+12.4%" pill vs the previous period. `goodWhen` says which direction is good, so a rise in
 * expenses shows red while a rise in income shows green.
 */
export default function DeltaBadge({ value, goodWhen = 'up' }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-xs text-gray-400">No data last month</span>
  }
  const flat = Math.abs(value) < 0.05
  const up = value > 0
  const good = flat ? null : (up && goodWhen === 'up') || (!up && goodWhen === 'down')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        good === null && 'bg-gray-100 text-gray-600',
        good === true && 'bg-emerald-50 text-emerald-700',
        good === false && 'bg-rose-50 text-rose-700',
      )}
    >
      {!flat && <Icon name={up ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" strokeWidth={2.5} />}
      {flat ? '0%' : `${Math.abs(value).toFixed(1)}%`}
      <span className="sr-only">{up ? 'increase' : 'decrease'} vs last month</span>
    </span>
  )
}
