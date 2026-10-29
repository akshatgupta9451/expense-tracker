import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/FormField'
import { CURRENCIES } from '@/constants/app'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { userService } from '@/services/userService'

const TIMEZONES = Intl.supportedValuesOf?.('timeZone') ?? ['UTC']

export default function ProfileForm() {
  const { user, setUser } = useAuth()
  const [saved, setSaved] = useState(false)

  const form = useForm(
    { name: user.name ?? '', currency: user.currency, timezone: user.timezone },
    {
      onSubmit: async (values) => {
        setSaved(false)
        const updated = await userService.updateMe({ ...values, name: values.name.trim() || null })
        setUser(updated)
        setSaved(true)
      },
    },
  )

  const currencies = CURRENCIES.includes(user.currency)
    ? CURRENCIES
    : [user.currency, ...CURRENCIES]
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES]

  return (
    <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-4">
      <Alert>{form.formError}</Alert>
      {saved && <Alert type="success">Profile saved.</Alert>}

      <Input label="Email" value={user.email} disabled hint="Email can't be changed" />
      <Input
        label="Name"
        name="name"
        value={form.values.name}
        onChange={form.handleChange}
        error={form.errors.name}
        autoComplete="name"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Currency"
          name="currency"
          value={form.values.currency}
          onChange={form.handleChange}
          error={form.errors.currency}
          hint="Used for new transactions"
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select
          label="Timezone"
          name="timezone"
          value={form.values.timezone}
          onChange={form.handleChange}
          error={form.errors.timezone}
          hint="Decides when your month starts"
        >
          {timezones.map((tz) => (
            <option key={tz}>{tz}</option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={form.submitting}>
          Save profile
        </Button>
      </div>
    </form>
  )
}
