import { cn } from '@/utils/cn'

/** `decorative`: hidden from screen readers (e.g. inside a button that sets aria-busy). */
export default function Spinner({ className, decorative = false }) {
  return (
    <span
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : 'Loading'}
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
