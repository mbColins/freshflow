import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type DashboardCardProps = {
  title: string
  subtitle?: string
  icon?: LucideIcon
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl bg-white p-4 ring-1 ring-line ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {Icon && (
              <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
            )}
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
          )}
        </div>
        {action}
      </header>

      <div className="mt-4 flex-1">{children}</div>
    </section>
  )
}

export default DashboardCard
