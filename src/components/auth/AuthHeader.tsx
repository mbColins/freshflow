import { WashingMachine } from 'lucide-react'

type AuthHeaderProps = {
  title: string
  subtitle: string
}

function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-white">
          <WashingMachine className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg leading-tight font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-field px-2.5 py-1 text-[10px] font-semibold text-muted">
        <span className="size-1.5 rounded-full bg-success" />
        Terminal #402
      </span>
    </header>
  )
}

export default AuthHeader
