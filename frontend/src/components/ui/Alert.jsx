import { cn } from '@/utils/cn'
import Icon from './Icon'

const STYLES = {
  error: {
    box: 'bg-red-50 text-red-700 ring-red-200',
    icon: 'exclamation',
    iconColor: 'text-red-500',
  },
  success: {
    box: 'bg-green-50 text-green-700 ring-green-200',
    icon: 'checkCircle',
    iconColor: 'text-green-500',
  },
  info: { box: 'bg-blue-50 text-blue-700 ring-blue-200', icon: 'info', iconColor: 'text-blue-500' },
}

export default function Alert({ type = 'error', title, children, className }) {
  // Render only when there is a message, so callers can pass a title plus maybe-null content.
  if (!children) return null
  const style = STYLES[type]
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset',
        style.box,
        className,
      )}
    >
      <Icon name={style.icon} className={cn('h-5 w-5 shrink-0', style.iconColor)} />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}
