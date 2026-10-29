import RegisterForm from '@/components/auth/RegisterForm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function RegisterPage() {
  useDocumentTitle('Create account')
  return <RegisterForm />
}
