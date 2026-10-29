import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'
import { passwordRules, passwordScore } from '@/utils/validators'

const LEVELS = [
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Weak', bar: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'Fair', bar: 'bg-yellow-500', text: 'text-yellow-700' },
  { label: 'Good', bar: 'bg-lime-500', text: 'text-lime-700' },
  { label: 'Strong', bar: 'bg-green-600', text: 'text-green-700' },
]

/** Live strength meter + checklist of the rules the backend enforces. */
export default function PasswordStrength({ password }) {
  if (!password) return null
  const score = passwordScore(password)
  const level = LEVELS[score]

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= score ? level.bar : 'bg-gray-200',
              )}
            />
          ))}
        </div>
        <span className={cn('w-16 text-right text-xs font-medium', level.text)}>{level.label}</span>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {passwordRules.map((rule) => {
          const ok = rule.test(password)
          return (
            <li
              key={rule.label}
              className={cn('flex items-center gap-1.5', ok ? 'text-green-700' : 'text-gray-500')}
            >
              <Icon name={ok ? 'checkCircle' : 'exclamation'} className="h-4 w-4 shrink-0" />
              <span>
                {rule.label}
                <span className="sr-only">{ok ? ' (done)' : ' (missing)'}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
