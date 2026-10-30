import { FlaskConical } from 'lucide-react'
import { Link } from 'react-router'
import { useGetDashboardSuppliesQuery } from '../../services/dashboardCardsApi'
import type { SupplyLevel } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardEmpty, CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

const LEVELS: Record<SupplyLevel, { label: string; fill: string; track: string; tone: 'success' | 'warning' | 'danger' }> = {
  OK: { label: 'Healthy', fill: 'bg-success', track: 'bg-success/15', tone: 'success' },
  LOW: { label: 'Low', fill: 'bg-warning', track: 'bg-warning/15', tone: 'warning' },
  CRITICAL: { label: 'Critical', fill: 'bg-danger', track: 'bg-danger/15', tone: 'danger' },
  OUT: { label: 'Out', fill: 'bg-danger', track: 'bg-danger/15', tone: 'danger' },
}

const quantity = (value: number) => +value.toFixed(2)

// The stock running lowest, from GET /dashboard/supplies
function SupplyStock({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetDashboardSuppliesQuery(branch ? { branch } : undefined)
  const items = data?.items ?? []

  return (
    <DashboardCard
      title="Chemical & Supplies Stock"
      subtitle="The stock running lowest"
      icon={FlaskConical}
      badge={data && data.critical > 0 ? <Badge tone="danger">{data.critical} critical</Badge> : undefined}
    >
      {isLoading ? (
        <CardLoading label="Loading supplies…" />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the supplies" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <CardEmpty title="No stock yet">Items you add to the inventory appear here.</CardEmpty>
      ) : (
        <ul className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {items.map(({ id, name, stock, max, unit, level, daysLeft }) => {
            const { label, fill, track, tone } = LEVELS[level]
            // Without a maximum there is nothing to measure the bar against
            const percent = max && max > 0 ? Math.min(100, (stock / max) * 100) : null
            return (
              <li key={id}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate font-semibold text-ink">{name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-muted tabular-nums">
                    {quantity(stock)}
                    {unit}
                    {max ? ` / ${quantity(max)}${unit}` : ''}
                    <Badge tone={tone}>{label}</Badge>
                  </span>
                </div>
                {percent !== null && (
                  <div
                    className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${track}`}
                    role="meter"
                    aria-label={`${name} stock`}
                    aria-valuenow={stock}
                    aria-valuemin={0}
                    aria-valuemax={max ?? 0}
                  >
                    <div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} />
                  </div>
                )}
                {daysLeft !== null && (
                  <p className="mt-1 text-[10px] text-muted">
                    {daysLeft === 0 ? 'Nothing available' : `About ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Link
        to="/inventory"
        className="mt-4 flex h-9 w-full items-center justify-center rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        Open inventory
      </Link>
    </DashboardCard>
  )
}

export default SupplyStock
