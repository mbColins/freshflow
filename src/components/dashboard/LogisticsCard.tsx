import { Truck } from 'lucide-react'
import { Link } from 'react-router'
import { useGetDashboardLogisticsQuery } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

function LogisticsCard({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetDashboardLogisticsQuery(branch ? { branch } : undefined)

  const stats = [
    { label: 'Pickups', value: data?.pickups ?? 0 },
    { label: 'Deliveries', value: data?.deliveries ?? 0 },
    { label: 'In transit', value: data?.inTransit ?? 0 },
    { label: 'Delivered', value: data?.delivered ?? 0 },
  ]

  return (
    <DashboardCard
      title="Pickup & Delivery Logistics"
      subtitle="Today’s runs and the drivers on route"
      icon={Truck}
      badge={data ? <Badge tone="brand">{data.activeRuns} active {data.activeRuns === 1 ? 'run' : 'runs'}</Badge> : undefined}
      action={
        <Link
          to="/pickup-delivery"
          className="rounded-md bg-field px-2.5 py-1.5 text-[10px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Manifest & Stops
        </Link>
      }
    >
      {isLoading ? (
        <CardLoading label="Loading logistics…" rows={2} />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the logistics" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <dl className="grid grid-cols-4 gap-2 rounded-md bg-field px-3 py-2.5 text-center">
            {stats.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold text-muted">{label}</dt>
                <dd className="text-base font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {data && data.vehicles.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {data.vehicles.map(({ driver, vehicle, stopsDone, stopsTotal, currentStop, etaMinutes }, index) => (
                <li key={`${driver}-${index}`} className="rounded-lg bg-field p-3 text-[11px] text-muted">
                  <p className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-success" />
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">
                      {driver || 'Driver'}
                      {vehicle && <span className="font-normal text-muted"> · {vehicle}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {stopsDone} of {stopsTotal} stops
                    </span>
                  </p>
                  {(currentStop || etaMinutes !== null) && (
                    <p className="mt-1 truncate pl-3.5">
                      {currentStop && `Now: ${currentStop}`}
                      {currentStop && etaMinutes !== null && ' · '}
                      {etaMinutes !== null && `ETA ${etaMinutes} min`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-center text-[11px] text-muted">No driver is on route right now.</p>
          )}
        </div>
      )}
    </DashboardCard>
  )
}

export default LogisticsCard
