import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import Spinner from './Spinner'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary:
    'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-brand-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-brand-500',
}

const SIZES = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

/** A router <Link> that looks like a Button. */
export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }) {
  return <Link className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Spinner decorative className="h-4 w-4" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}
