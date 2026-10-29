import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'
import DeltaBadge from './DeltaBadge'
import Sparkline from './Sparkline'

const TONES = {
  brand: { icon: 'bg-indigo-50 text-indigo-600', spark: '#4f46e5' },
  income: { icon: 'bg-emerald-50 text-emerald-600', spark: '#10b981' },
  expense: { icon: 'bg-rose-50 text-rose-600', spark: '#f43f5e' },
  savings: { icon: 'bg-amber-50 text-amber-600', spark: '#f59e0b' },
}

export default function KpiCard({
  label,
  value,
  icon,
  tone,
  delta,
  goodWhen,
  trend,
  footnote,
  highlight,
}) {
  const t = TONES[tone]
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-2xl p-5 shadow-sm ring-1',
        highlight
          ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white ring-indigo-500'
          : 'bg-white ring-gray-200',
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cn('text-sm font-medium', highlight ? 'text-indigo-100' : 'text-gray-500')}>
          {label}
        </p>
        <span className={cn('rounded-xl p-2', highlight ? 'bg-white/15 text-white' : t.icon)}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p
        className={cn(
          'mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]',
          highlight ? 'text-white' : 'text-gray-900',
        )}
      >
        {value}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className={cn('min-w-0 text-xs', highlight ? 'text-indigo-100' : 'text-gray-500')}>
          {delta !== undefined ? <DeltaBadge value={delta} goodWhen={goodWhen} /> : footnote}
          {delta !== undefined && footnote && <p className="mt-1 truncate">{footnote}</p>}
        </div>
        <Sparkline data={trend} color={highlight ? '#ffffff' : t.spark} />
      </div>
    </div>
  )
}
