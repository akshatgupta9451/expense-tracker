import { Navigate, Outlet, useLocation } from 'react-router-dom'
import FullPageSpinner from '@/components/common/FullPageSpinner'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'

/** Only for logged-in users. Others go to /login and come back here afterwards. */
export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unauthenticated') {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />
  }
  return <Outlet />
}
