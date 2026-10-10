import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleAlert, Inbox, RefreshCw } from 'lucide-react'
import { useDashboardView } from './dashboardState'

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
  const { viewState, onRetry } = useDashboardView()

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
        {viewState === 'normal' && action}
      </header>

      <div className="mt-4 flex-1">
        {viewState === 'normal' && children}

        {viewState === 'skeleton' && (
          <div className="animate-pulse space-y-3" aria-label="Loading">
            <div className="h-3 w-2/3 rounded bg-field" />
            <div className="h-20 rounded-md bg-field" />
            <div className="h-3 w-1/2 rounded bg-field" />
            <div className="h-3 w-3/4 rounded bg-field" />
          </div>
        )}

        {viewState === 'empty' && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox className="size-6 text-muted/60" aria-hidden="true" />
            <p className="text-xs font-semibold text-ink">Nothing to show yet</p>
            <p className="text-[11px] text-muted">
              No records for this branch and period.
            </p>
          </div>
        )}

        {viewState === 'error' && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2 py-8 text-center"
          >
            <CircleAlert className="size-6 text-danger" aria-hidden="true" />
            <p className="text-xs font-semibold text-ink">
              Couldn’t load this module
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-field px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default DashboardCard
