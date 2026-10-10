import { Lock, ShieldCheck } from 'lucide-react'
import AuthPanel from './AuthPanel'

const SESSION_INTEL = [
  { label: 'Terminal ID', value: '#402' },
  { label: 'Authorized IP subnet', value: '192.168.1.140' },
]

function SecurityPanel() {
  return (
    <AuthPanel
      badgeIcon={ShieldCheck}
      badge="Secure terminal session"
      title="One more step to secure this workstation."
      description="Two-factor verification protects plant hardware, order records, and dispatch controls on every shared laundry bay terminal."
      footer={
        <p className="flex items-center gap-3 text-sm font-semibold">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <span>
            Never share your verification code.
            <span className="mt-0.5 block text-xs font-normal text-white/75">
              FreshFlow staff will never ask for it.
            </span>
          </span>
        </p>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 rounded-full bg-emerald-400" />
          Terminal Session Intel
        </p>
        <span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold">
          Session Pending 2FA
        </span>
      </div>

      <dl className="mt-5 space-y-2">
        {SESSION_INTEL.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-4 py-3 ring-1 ring-white/10"
          >
            <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
              {label}
            </dt>
            <dd className="font-mono text-sm font-bold">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-4 py-3 ring-1 ring-white/10">
          <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
            FIPS 140-2
          </dt>
          <dd className="flex items-center gap-1.5 text-sm font-bold text-emerald-300">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Compliant
          </dd>
        </div>
      </dl>
    </AuthPanel>
  )
}

export default SecurityPanel
