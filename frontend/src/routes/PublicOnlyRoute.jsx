import { Navigate, Outlet, useLocation } from 'react-router-dom'
import FullPageSpinner from '@/components/common/FullPageSpinner'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'

/**
 * Login / register: logged-in users are sent on. This also fires the moment login succeeds,
 * so it must honour the "return to" page that ProtectedRoute stored, or it would race the
 * login form's own redirect and always win with /dashboard.
 */
export default function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || ROUTES.DASHBOARD} replace />
  }
  return <Outlet />
}
