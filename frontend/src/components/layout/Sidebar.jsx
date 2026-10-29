import { NavLink } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import Logo from './Logo'

const NAV = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: 'dashboard' },
  { to: ROUTES.TRANSACTIONS, label: 'Transactions', icon: 'list' },
  { to: ROUTES.BUDGETS, label: 'Budgets', icon: 'target' },
  { to: ROUTES.ASSISTANT, label: 'AI Assistant', icon: 'sparkles' },
  { to: ROUTES.PROFILE, label: 'Profile', icon: 'user' },
]

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center border-b border-gray-100 px-5">
        <Logo to={ROUTES.DASHBOARD} />
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2 truncate px-3 text-sm">
          <p className="truncate font-medium text-gray-900">{user?.name || 'Account'}</p>
          <p className="truncate text-gray-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <Icon name="logout" />
          Log out
        </button>
      </div>
    </div>
  )
}
