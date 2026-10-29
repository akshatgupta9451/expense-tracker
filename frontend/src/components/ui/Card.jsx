import { cn } from '@/utils/cn'

export default function Card({ title, action, className, children }) {
  return (
    <section className={cn('rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
