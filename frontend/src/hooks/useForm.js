import { useEffect, useRef, useState } from 'react'
import { getErrorMessage, getFieldErrors } from '@/utils/errors'

/**
 * Form state with validation that feels responsive but not naggy:
 * - a field shows client-side errors once it has been "touched" (blurred with a value, or
 *   the form was submitted), and they update live as the user types a fix;
 * - submit validates everything and focuses the first invalid field;
 * - API field errors (422 details, plus anything `mapError(err)` returns) are shown on the
 *   matching field until that field is edited.
 *
 * `validate(values)` returns { field: message | null }.
 */
export function useForm(initialValues, { validate, onSubmit, mapError } = {}) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [apiErrors, setApiErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)
  // Fields sit in a fieldset that is disabled while submitting, and disabled inputs can't take
  // focus, so focusing after a server error waits until submitting has finished.
  const [focusTarget, setFocusTarget] = useState(null)

  useEffect(() => {
    if (!focusTarget || submitting) return
    formRef.current?.elements.namedItem(focusTarget)?.focus?.()
    setFocusTarget(null)
  }, [focusTarget, submitting])

  // Client errors are derived, never stored, so they can't go stale.
  const clientErrors = validate ? validate(values) : {}
  const errors = {}
  for (const name of Object.keys(values)) {
    const message = apiErrors[name] || (touched[name] && clientErrors[name]) || null
    if (message) errors[name] = message
  }

  const setValue = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setApiErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }

  const handleChange = (e) => setValue(e.target.name, e.target.value)

  const handleBlur = (e) => {
    const { name, value } = e.target
    // Tabbing past an empty field shouldn't flag it; submitting will.
    if (name && value !== '') setTouched((t) => (t[name] ? t : { ...t, [name]: true }))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setFormError(null)
    setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])))

    const firstInvalid = Object.keys(values).find((k) => clientErrors[k])
    if (firstInvalid) {
      setFocusTarget(firstInvalid)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err) {
      const fieldErrors = { ...getFieldErrors(err), ...(mapError?.(err) ?? {}) }
      const fields = Object.keys(fieldErrors).filter((k) => k in values)
      if (fields.length) {
        setApiErrors(fieldErrors)
        setFocusTarget(fields[0])
      } else {
        setFormError(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** Spread onto an input: name, value, onChange, onBlur, error. */
  const field = (name) => ({
    name,
    value: values[name],
    onChange: handleChange,
    onBlur: handleBlur,
    error: errors[name],
  })

  return {
    values,
    errors,
    formError,
    submitting,
    formRef,
    field,
    setValue,
    setValues,
    handleChange,
    handleBlur,
    handleSubmit,
    /** Focus a field by name once the form is no longer submitting. */
    focus: setFocusTarget,
    /** Start over with `next` values and no errors (e.g. "Save & add another"). */
    reset: (next = initialValues) => {
      setValues(next)
      setTouched({})
      setApiErrors({})
      setFormError(null)
    },
  }
}
