import Icon from '@/components/ui/Icon'
import { addMonths, monthLabel, toISOMonth } from '@/utils/dates'

export default function MonthSwitcher({ month, onChange, max = toISOMonth() }) {
  const atMax = month >= max
  const btn =
    'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
      </button>
      <span
        className="min-w-[8.5rem] text-center text-sm font-medium text-gray-900"
        aria-live="polite"
      >
        {monthLabel(month)}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addMonths(month, 1))}
        disabled={atMax}
        aria-label="Next month"
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>
    </div>
  )
}
