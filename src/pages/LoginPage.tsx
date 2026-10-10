import AuthShell from '../components/auth/AuthShell'
import BrandPanel from '../components/auth/BrandPanel'
import LoginForm from '../components/auth/LoginForm'

function LoginPage() {
  return (
    <AuthShell panel={<BrandPanel />}>
      <LoginForm />
    </AuthShell>
  )
}

export default LoginPage
