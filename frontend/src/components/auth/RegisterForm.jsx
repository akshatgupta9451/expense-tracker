import { Link, useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/FormField'
import PasswordInput from '@/components/ui/PasswordInput'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { validateEmail, validatePassword } from '@/utils/validators'
import AuthHeader from './AuthHeader'
import PasswordStrength from './PasswordStrength'

const DUPLICATE_EMAIL = 'An account with this email already exists'

export default function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const form = useForm(
    { name: '', email: '', password: '', confirmPassword: '' },
    {
      validate: ({ name, email, password, confirmPassword }) => ({
        name: name.length > 120 ? 'Name must be at most 120 characters' : null,
        email: validateEmail(email),
        password: validatePassword(password),
        confirmPassword: !confirmPassword
          ? 'Please confirm your password'
          : password !== confirmPassword
            ? 'Passwords do not match'
            : null,
      }),
      // The API answers a taken email with 409 (no field details); show it on the email field.
      mapError: (err) => (err.response?.status === 409 ? { email: DUPLICATE_EMAIL } : null),
      onSubmit: async ({ name, email, password }) => {
        await register({ name: name.trim(), email: email.trim(), password })
        navigate(ROUTES.DASHBOARD, { replace: true })
      },
    },
  )

  const emailTaken = form.errors.email === DUPLICATE_EMAIL

  return (
    <>
      <AuthHeader
        title="Create your account"
        subtitle="Start tracking income and expenses in minutes."
      />

      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={form.submitting} className="space-y-5">
          <Alert title="Couldn’t create your account">{form.formError}</Alert>

          <Input
            label="Name"
            icon="user"
            autoComplete="name"
            placeholder="Ada Lovelace"
            hint="Optional"
            autoFocus
            maxLength={120}
            {...form.field('name')}
          />
          <div>
            <Input
              label="Email"
              type="email"
              icon="mail"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.field('email')}
            />
            {emailTaken && (
              <p className="mt-1 text-sm text-gray-600">
                <Link
                  to={ROUTES.LOGIN}
                  state={{ email: form.values.email.trim() }}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Log in instead →
                </Link>
              </p>
            )}
          </div>
          <div>
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              placeholder="Create a password"
              {...form.field('password')}
            />
            <PasswordStrength password={form.values.password} />
          </div>
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            {...form.field('confirmPassword')}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={form.submitting}
            loadingText="Creating account…"
          >
            Create account
          </Button>
        </fieldset>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </>
  )
}
