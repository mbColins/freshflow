import AuthShell from '../components/auth/AuthShell'
import PasswordPolicyPanel from '../components/auth/PasswordPolicyPanel'
import ResetPasswordForm from '../components/auth/ResetPasswordForm'

function ResetPasswordPage() {
  return (
    <AuthShell panel={<PasswordPolicyPanel />}>
      <ResetPasswordForm />
    </AuthShell>
  )
}

export default ResetPasswordPage
