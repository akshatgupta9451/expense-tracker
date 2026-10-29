import { Link } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Icon from '@/components/ui/Icon'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const FEATURES = [
  { icon: 'list', title: 'Track everything', text: 'Log income and expenses in seconds.' },
  { icon: 'chart', title: 'See the trends', text: 'Monthly charts and category breakdowns.' },
  { icon: 'shield', title: 'Private by design', text: 'Your data is visible only to you.' },
]

const primary =
  'rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700'
const secondary =
  'rounded-lg px-5 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50'

export default function HomePage() {
  useDocumentTitle()
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-3 text-sm font-medium">
          {isAuthenticated ? (
            <Link to={ROUTES.DASHBOARD} className={primary}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className="text-gray-700 hover:text-gray-900">
                Log in
              </Link>
              <Link to={ROUTES.REGISTER} className={primary}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Know where your money goes
          </h1>
          <p className="mt-5 text-lg text-gray-600">
            Track income and expenses, see monthly trends, and stay on top of your budget.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.REGISTER} className={primary}>
              {isAuthenticated ? 'Go to dashboard' : 'Get started free'}
            </Link>
            {!isAuthenticated && (
              <Link to={ROUTES.LOGIN} className={secondary}>
                I have an account
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="mb-3 inline-flex rounded-lg bg-brand-50 p-2 text-brand-600">
                <Icon name={f.icon} />
              </div>
              <h2 className="font-semibold text-gray-900">{f.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
