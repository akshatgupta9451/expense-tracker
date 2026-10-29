import { forwardRef, useId } from 'react'
import { cn } from '@/utils/cn'
import Icon from './Icon'

const control =
  'block w-full rounded-lg border-0 py-2.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ' +
  'transition-shadow placeholder:text-gray-400 focus:ring-2 focus:ring-inset ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

function Field({ id, label, labelAction, error, hint, children }) {
  return (
    <div>
      {(label || labelAction) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
          )}
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
          <Icon name="exclamation" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function controlProps(id, { error, hint, className }) {
  return {
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: cn(
      control,
      error ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-brand-500',
      className,
    ),
  }
}

/**
 * Text input. Optional `icon` (Icon name) on the left and `trailing` node on the right,
 * e.g. a show-password button.
 */
export const Input = forwardRef(function Input(
  { label, labelAction, error, hint, icon, prefix, trailing, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <Field id={fieldId} label={label} labelAction={labelAction} error={error} hint={hint}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            {prefix}
          </span>
        )}
        {icon && (
          <Icon
            name={icon}
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2',
              error ? 'text-red-400' : 'text-gray-400',
            )}
          />
        )}
        <input
          ref={ref}
          {...controlProps(fieldId, {
            error,
            hint,
            className: cn(
              icon ? 'pl-10' : prefix ? (prefix.length > 1 ? 'pl-11' : 'pl-7') : 'pl-3',
              trailing ? 'pr-10' : 'pr-3',
              className,
            ),
          })}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>
        )}
      </div>
    </Field>
  )
})

export const Select = forwardRef(function Select(
  { label, error, hint, className, id, children, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <Field id={fieldId} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        {...controlProps(fieldId, { error, hint, className: cn('pl-3 pr-8', className) })}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <Field id={fieldId} label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        rows={3}
        {...controlProps(fieldId, { error, hint, className: cn('px-3', className) })}
        {...props}
      />
    </Field>
  )
})
