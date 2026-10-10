import { CircleCheck, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import AuthPanel from './AuthPanel'

const POLICY_RULES = [
  'Minimum 10 characters with mixed uppercase, lowercase & numerals',
  'Must differ from the last 3 plant shift passwords',
  'Auto-syncs across assigned Bay Terminals & Mobile Scanner',
]

function PasswordPolicyPanel() {
  return (
    <AuthPanel
      badgeIcon={ShieldCheck}
      badge="Credential protection • Protocol V4"
      title="Secure access for commercial wash & plant operations."
      description="Update your master terminal security passphrase to ensure uninterrupted shift handovers, route dispatch authentication, and machine telemetry controls."
      footer={
        <p className="flex items-center gap-2.5 text-[11px] font-semibold text-white/85">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Hardware-level AES-256 encrypted credential transmission
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

      <dl className="mt-5 space-y-2.5 rounded-lg bg-brand-dark/60 px-4 py-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
            Operator ID
          </dt>
          <dd className="text-[11px] font-bold">Marcus Vance (STF-8842)</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
            Active console
          </dt>
          <dd className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-200">
            <MonitorSmartphone className="size-3.5" aria-hidden="true" />
            Bay #4 – Station Console
          </dd>
        </div>
      </dl>
    </AuthPanel>
  )
}

export default PasswordPolicyPanel
