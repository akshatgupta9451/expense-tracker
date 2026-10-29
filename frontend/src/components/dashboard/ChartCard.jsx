import { cn } from '@/utils/cn'

export default function ChartCard({ title, subtitle, action, className, children }) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200',
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="relative min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  )
}
