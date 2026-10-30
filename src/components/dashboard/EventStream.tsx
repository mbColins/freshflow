import type { LucideIcon } from 'lucide-react'
import { Activity, Banknote, ClipboardCheck, TriangleAlert, Truck, WashingMachine } from 'lucide-react'
import { Link } from 'react-router'
import useDashboardEventStream from '../../hooks/useDashboardEventStream'
import { useGetDashboardEventsQuery } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardEmpty, CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

const LIMIT = 20
// A narrowed card cannot use the stream (it covers the whole scope), so it polls
const POLL_MS = 60_000

function iconFor(type: string, alert: boolean): LucideIcon {
  if (alert) return TriangleAlert
  if (type === 'PAYMENT_RECEIVED') return Banknote
  if (type.startsWith('DELIVERY_')) return Truck
  if (type === 'FLOOR_MACHINE' || type === 'FLOOR_STAGE') return WashingMachine
  if (type === 'FLOOR_QC' || type === 'FLOOR_COUNT') return ClipboardCheck
  return Activity
}

const formatTime = (at: string) => {
  const date = new Date(at)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Where an event's record lives
const RELATED_ROUTES: Record<string, string> = { ORDER: '/orders', PAYMENT: '/payments', DELIVERY: '/pickup-delivery' }

// The last 24 hours of floor, payment and delivery events, kept live by the
// server's event stream
function EventStream({ branch }: { branch?: string }) {
  useDashboardEventStream(LIMIT, !branch)
  const { data, isLoading, isError, isFetching, error, refetch } = useGetDashboardEventsQuery(
    { limit: LIMIT, ...(branch ? { branch } : {}) },
    { pollingInterval: POLL_MS },
  )
  const events = data ?? []

  return (
    <DashboardCard
      title="Live Operational Event Stream"
      icon={Activity}
      badge={<Badge tone="success">{branch ? 'Auto-refresh' : 'Live stream'}</Badge>}
    >
      {isLoading ? (
        <CardLoading label="Loading events…" />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the events" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : events.length === 0 ? (
        <CardEmpty title="Quiet so far">Floor, payment and delivery events from the last 24 hours show here.</CardEmpty>
      ) : (
        <ol className="space-y-3">
          {events.map(({ at, type, title, body, alert, related }, index) => {
            const Icon = iconFor(type, alert)
            const route = related ? RELATED_ROUTES[related.kind] : undefined
            return (
              <li key={`${at}-${index}`} className="flex items-start gap-3">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    alert ? 'bg-danger/10 text-danger' : 'bg-field text-muted'
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-ink">
                    {title}
                    <time dateTime={at} className="text-[10px] font-normal text-muted">
                      {formatTime(at)}
                    </time>
                  </p>
                  {body && <p className="mt-0.5 text-[11px] leading-snug text-muted">{body}</p>}
                </div>
                {route && (
                  <Link to={route} className="shrink-0 text-[10px] font-semibold text-brand hover:underline">
                    Open
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <Link
        to="/audit"
        className="mt-4 flex h-9 w-full items-center justify-center rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        View Complete System Audit Log
      </Link>
    </DashboardCard>
  )
}

export default EventStream
