import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import FullPageSpinner from '@/components/common/FullPageSpinner'
import { ROUTES } from '@/constants/routes'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'

// Each page is its own chunk, so e.g. Chart.js only downloads when the dashboard is opened.
const HomePage = lazy(() => import('@/pages/HomePage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage'))
const AssistantPage = lazy(() => import('@/pages/AssistantPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function AppRouter() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path={ROUTES.HOME} element={<HomePage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.TRANSACTIONS} element={<TransactionsPage />}>
              {/* Rendered by TransactionsPage as a dialog over the list. */}
              <Route path="new" element={null} />
              <Route path=":id/edit" element={null} />
            </Route>
            <Route path={ROUTES.BUDGETS} element={<BudgetsPage />} />
            <Route path={ROUTES.ASSISTANT} element={<AssistantPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
