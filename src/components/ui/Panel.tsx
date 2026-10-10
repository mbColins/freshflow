import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type PanelProps = {
  title: string
  subtitle?: string
  icon?: LucideIcon
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  children,
  className = '',
}: PanelProps) {
  return (
    <section className={`min-w-0 rounded-xl bg-white p-4 ring-1 ring-line ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
            {Icon && <Icon className="size-4 text-brand" aria-hidden="true" />}
            {title}
            {badge}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
      {children}
    </p>
  )
}

export default Panel
