import AuthShell from '../components/auth/AuthShell'
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm'
import RecoveryPanel from '../components/auth/RecoveryPanel'

function ForgotPasswordPage() {
  return (
    <AuthShell panel={<RecoveryPanel />}>
      <ForgotPasswordForm />
    </AuthShell>
  )
}

export default ForgotPasswordPage
