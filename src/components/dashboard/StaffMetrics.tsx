import { Users } from 'lucide-react'
import { Link } from 'react-router'
import { useGetDashboardStaffQuery } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardEmpty, CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

// 99.2 QA %, 18 Orders
const headlineOf = ({ label, value, unit }: { label: string; value: number; unit: string }) =>
  unit === '%' ? `${+value.toFixed(1)}% ${label}` : `${+value.toFixed(1)}${unit ? ` ${unit}` : ''} ${label}`.trim()

// People clocked in now, best first (managers and the owner only)
function StaffMetrics({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetDashboardStaffQuery(branch ? { branch } : undefined)
  const staff = data?.staff ?? []
  const shift = data?.shift

  return (
    <DashboardCard
      title="Staff & Shift QA Metrics"
      subtitle="Who is on duty and how they are doing today"
      icon={Users}
      badge={shift?.name ? <Badge tone="success">{shift.name}{shift.from && shift.to ? ` · ${shift.from}–${shift.to}` : ''}</Badge> : undefined}
    >
      {isLoading ? (
        <CardLoading label="Loading staff…" />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the staff" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : staff.length === 0 ? (
        <CardEmpty title="Nobody on duty">People appear here once they clock in.</CardEmpty>
      ) : (
        <ul className={`space-y-2 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {staff.map(({ id, name, role, headline, note }) => (
            <li key={id} className="flex items-center gap-3 rounded-lg bg-field p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                {initialsOf(name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{name}</p>
                <p className="truncate text-[11px] text-muted">{role}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-ink">{headlineOf(headline)}</p>
                <p className="text-[10px] text-muted">{note}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/staff"
        className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        Manage Shift Roster
      </Link>
    </DashboardCard>
  )
}

export default StaffMetrics
