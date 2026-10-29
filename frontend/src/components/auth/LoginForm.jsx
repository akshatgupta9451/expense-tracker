import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/FormField'
import PasswordInput from '@/components/ui/PasswordInput'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { validateEmail } from '@/utils/validators'
import AuthHeader from './AuthHeader'

export default function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD
  const notice = location.state?.message

  const form = useForm(
    { email: location.state?.email ?? '', password: '' },
    {
      validate: ({ email, password }) => ({
        email: validateEmail(email),
        password: password ? null : 'Password is required',
      }),
      onSubmit: async (values) => {
        await login({ email: values.email.trim(), password: values.password })
        navigate(redirectTo, { replace: true })
      },
    },
  )

  return (
    <>
      <AuthHeader title="Welcome back" subtitle="Log in to see your spending and budgets." />

      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={form.submitting} className="space-y-5">
          {notice && !form.formError && <Alert type="success">{notice}</Alert>}
          <Alert title="Couldn’t log you in">{form.formError}</Alert>

          <Input
            label="Email"
            type="email"
            icon="mail"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus={!form.values.email}
            {...form.field('email')}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            autoFocus={Boolean(form.values.email)}
            {...form.field('password')}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={form.submitting}
            loadingText="Logging in…"
          >
            Log in
          </Button>
        </fieldset>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        New here?{' '}
        <Link to={ROUTES.REGISTER} className="font-semibold text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </>
  )
}
