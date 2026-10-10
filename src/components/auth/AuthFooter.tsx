import { ShieldCheck } from 'lucide-react'

type AuthFooterProps = {
  showAssistance?: boolean
}

function AuthFooter({ showAssistance = true }: AuthFooterProps) {
  return (
    <footer className="mt-6 space-y-3 text-[11px] text-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          256-bit SSL Hardware Encryption Active
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Core Ops:
          <span className="font-bold text-success">Operational (99.98%)</span>
        </p>
      </div>
      {showAssistance && (
        <p>
          Assistance or locked account? Call Central Dispatch or{' '}
          <a href="#" className="font-semibold text-brand hover:underline">
            Support Portal
          </a>
        </p>
      )}
    </footer>
  )
}

export default AuthFooter
