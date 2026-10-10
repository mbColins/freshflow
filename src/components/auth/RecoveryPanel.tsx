import { KeyRound, PhoneCall, Shield, ShieldCheck, Timer } from 'lucide-react'
import AuthPanel from './AuthPanel'

function RecoveryPanel() {
  return (
    <AuthPanel
      badgeIcon={KeyRound}
      badge="Secure account recovery"
      title="Fast recovery for plant & terminal operators."
      description="Reset your master security credentials or request hardware key re-pairing to resume laundry bay shift operations without downtime."
      footer={
        <p className="flex items-center gap-2.5 text-[11px] font-semibold text-white/85">
          <Shield className="size-4 shrink-0" aria-hidden="true" />
          Encrypted recovery token linked to operator NFC badge ID
        </p>
      }
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-xs font-semibold">Support &amp; Dispatch Protocols</p>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200 uppercase">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Dispatch online
        </span>
      </div>

      <ul className="mt-5 space-y-4 text-xs text-white/85">
        <li className="flex items-center gap-3">
          <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Central Helpdesk{' '}
            <span className="font-bold text-white">Ext. 402</span>
          </span>
        </li>
        <li className="flex items-center gap-3">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Authorized Supervisor Override Available
        </li>
        <li className="flex items-center gap-3">
          <Timer className="size-4 shrink-0" aria-hidden="true" />
          <span>
            SLA Response:{' '}
            <span className="font-bold text-white">
              Immediate (&lt; 2 mins)
            </span>
          </span>
        </li>
      </ul>
    </AuthPanel>
  )
}

export default RecoveryPanel
