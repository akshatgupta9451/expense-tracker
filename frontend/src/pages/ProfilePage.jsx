import PageHeader from '@/components/common/PageHeader'
import PasswordForm from '@/components/profile/PasswordForm'
import ProfileForm from '@/components/profile/ProfileForm'
import Card from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate } from '@/utils/format'

export default function ProfilePage() {
  useDocumentTitle('Profile')
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        title="Profile"
        description={`Member since ${formatDate(user.created_at.slice(0, 10))}`}
      />
      <div className="grid max-w-3xl gap-6">
        <Card title="Personal details">
          <ProfileForm />
        </Card>
        <Card title="Password">
          <PasswordForm />
        </Card>
      </div>
    </>
  )
}
