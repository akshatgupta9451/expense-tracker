import { Link } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { APP_NAME } from '@/constants/app'

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold text-gray-900">
      <span className="rounded-lg bg-brand-600 p-1.5 text-white">
        <Icon name="wallet" className="h-5 w-5" />
      </span>
      {APP_NAME}
    </Link>
  )
}
