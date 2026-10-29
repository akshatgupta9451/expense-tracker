import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import Logo from '@/components/layout/Logo'
import Sidebar from '@/components/layout/Sidebar'
import Icon from '@/components/ui/Icon'
import Spinner from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'

/** Shell for logged-in pages: fixed sidebar on desktop, slide-in drawer on mobile. */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-200 lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <Logo to={ROUTES.DASHBOARD} />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex justify-center py-20 text-brand-600">
                  <Spinner className="h-8 w-8" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
