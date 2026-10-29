import { useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/FormField'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { userService } from '@/services/userService'
import { validatePassword } from '@/utils/validators'

export default function PasswordForm() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const form = useForm(
    { current_password: '', new_password: '', confirm: '' },
    {
      validate: (v) => ({
        current_password: v.current_password ? null : 'Enter your current password',
        new_password:
          validatePassword(v.new_password) ||
          (v.new_password === v.current_password ? 'Choose a different password' : null),
        confirm: v.new_password !== v.confirm ? 'Passwords do not match' : null,
      }),
      onSubmit: async (v) => {
        await userService.changePassword(v.current_password, v.new_password)
        // The backend signs out every session after a password change.
        await logout()
        navigate(ROUTES.LOGIN, {
          replace: true,
          state: { message: 'Password changed. Please log in with your new password.' },
        })
      },
    },
  )

  return (
    <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-4">
      <Alert>{form.formError}</Alert>
      <Input
        label="Current password"
        name="current_password"
        type="password"
        autoComplete="current-password"
        value={form.values.current_password}
        onChange={form.handleChange}
        error={form.errors.current_password}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="New password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          value={form.values.new_password}
          onChange={form.handleChange}
          error={form.errors.new_password}
        />
        <Input
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.values.confirm}
          onChange={form.handleChange}
          error={form.errors.confirm}
        />
      </div>
      <p className="text-xs text-gray-500">You’ll be signed out on all devices.</p>
      <div className="flex justify-end">
        <Button type="submit" loading={form.submitting}>
          Change password
        </Button>
      </div>
    </form>
  )
}
