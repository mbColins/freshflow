import { CircleCheck, ShieldCheck } from 'lucide-react'
import AuthPanel from './AuthPanel'

const POLICY_RULES = [
  '8 to 128 characters, with at least one letter and one number',
  'Must be different from your current password',
]

function PasswordPolicyPanel() {
  return (
    <AuthPanel
      badgeIcon={ShieldCheck}
      badge="Password security"
      title="Choose a new password."
      description="Pick a password you don't use anywhere else. You will use it the next time you sign in."
      footer={
        <p className="flex items-center gap-2.5 text-[11px] font-semibold text-white/85">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Your password is sent over an encrypted connection
        </p>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Password Security Policy
        </p>
        <span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-bold text-emerald-950">
          Active
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {POLICY_RULES.map((rule) => (
          <li key={rule} className="flex items-start gap-3 text-xs leading-snug">
            <CircleCheck
              className="mt-px size-4 shrink-0 text-white/80"
              aria-hidden="true"
            />
            {rule}
          </li>
        ))}
      </ul>
    </AuthPanel>
  )
}

export default PasswordPolicyPanel
