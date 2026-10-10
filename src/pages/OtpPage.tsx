import AuthShell from '../components/auth/AuthShell'
import OtpForm from '../components/auth/OtpForm'
import SecurityPanel from '../components/auth/SecurityPanel'

function OtpPage() {
  return (
    <AuthShell panel={<SecurityPanel />}>
      <OtpForm />
    </AuthShell>
  )
}

export default OtpPage
