import { forwardRef, useState } from 'react'
import { Input } from './FormField'
import Icon from './Icon'

/** Password field with a show/hide toggle and a Caps Lock warning. */
const PasswordInput = forwardRef(function PasswordInput({ hint, onKeyUp, onBlur, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      icon="lock"
      hint={capsLock ? 'Caps Lock is on' : hint}
      onKeyUp={(e) => {
        setCapsLock(e.getModifierState?.('CapsLock') ?? false)
        onKeyUp?.(e)
      }}
      onBlur={(e) => {
        setCapsLock(false)
        onBlur?.(e)
      }}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={props.disabled}
        >
          <Icon name={visible ? 'eyeSlash' : 'eye'} className="h-5 w-5" />
        </button>
      }
      {...props}
    />
  )
})

export default PasswordInput
