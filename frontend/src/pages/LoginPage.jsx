import LoginForm from '@/components/auth/LoginForm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function LoginPage() {
  useDocumentTitle('Log in')
  return <LoginForm />
}
