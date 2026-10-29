import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Icon from '@/components/ui/Icon'
import Spinner from '@/components/ui/Spinner'

const HIGHLIGHTS = [
  'Log income and expenses in seconds',
  'Monthly trends and category breakdowns',
  'Budgets that warn you before you overspend',
]

// Decorative preview of the dashboard for the brand panel.
const BARS = [38, 52, 44, 70, 58, 82]

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-400/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative [&_a]:text-white">
        <Logo />
      </div>

      <div className="relative max-w-md">
        <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
          Take control of where your money goes.
        </h2>
        <ul className="mt-8 space-y-3">
          {HIGHLIGHTS.map((text) => (
            <li key={text} className="flex items-center gap-3 text-brand-100">
              <span className="rounded-full bg-white/15 p-1">
                <Icon name="check" className="h-4 w-4 text-white" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div
          className="mt-12 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-200">Balance</p>
              <p className="mt-1 text-2xl font-semibold text-white">$3,370.00</p>
            </div>
            <span className="rounded-full bg-green-400/20 px-2 py-0.5 text-xs font-medium text-green-200">
              +12.4%
            </span>
          </div>
          <div className="mt-5 flex h-20 items-end gap-2">
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={
                  i === BARS.length - 1
                    ? 'flex-1 rounded-t bg-white'
                    : 'flex-1 rounded-t bg-white/30'
                }
              />
            ))}
          </div>
        </div>
      </div>

      <p className="relative text-sm text-brand-200">
        Your data is private and visible only to you.
      </p>
    </div>
  )
}

/** Login / register: brand panel beside the form on desktop, form only on phones. */
export default function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col px-4 py-8 sm:px-6 lg:px-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Suspense
              fallback={
                <div className="flex justify-center text-brand-600">
                  <Spinner className="h-6 w-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
