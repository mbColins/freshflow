import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { STAGES } from '../../constants/pipeline'
import { useGetOrderDistributionQuery } from '../../services/dashboardApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { secondaryButton } from '../orders/styles'
import DashboardCard from './DashboardCard'

const RADIUS = 48
// Segment lengths use pathLength=100, so shares map straight to percentages
const SEGMENT_GAP = (2 / (2 * Math.PI * RADIUS)) * 100

// The card's stages follow the backend's, in the same order, so look and
// feel (label, color) come from the pipeline and the numbers from the API
function OrderDistribution({ branch }: { branch: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { data, isLoading, isError, isFetching, error, refetch } = useGetOrderDistributionQuery(branch ? { branch } : undefined)

  const segments = (data?.stages ?? []).map((stage, index) => ({
    ...stage,
    label: STAGES[index]?.label ?? stage.id,
    color: STAGES[index]?.color ?? '#94a3b8',
    offset: (data?.stages ?? []).slice(0, index).reduce((sum, { percent }) => sum + percent, 0),
  }))
  const active = activeIndex === null ? undefined : segments[activeIndex]
  const totalActive = data?.totalActive ?? 0

  return (
    <DashboardCard title="Order Distribution" subtitle="Real-time status split of the active batch">
      {isLoading ? (
        <div className="flex animate-pulse flex-col items-center gap-4" aria-busy="true">
          <p className="sr-only" role="status">Loading order distribution…</p>
          <div className="size-44 rounded-full border-[14px] border-field" />
          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-3 rounded bg-field" />
            ))}
          </div>
        </div>
      ) : isError && !data ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-bold text-ink">Couldn’t load the distribution</p>
          <p className="max-w-xs text-xs text-muted">
            {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-1`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : (
        <div className={`flex flex-col items-center gap-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="relative size-44">
            <svg
              viewBox="0 0 120 120"
              className="size-full -rotate-90"
              role="img"
              aria-label="Donut chart of active orders by pipeline stage. Values are listed in the legend."
            >
              {totalActive === 0 && <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="14" className="text-field" />}
              {segments.map(({ id, percent, offset, color }, index) =>
                percent > 0 ? (
                  <circle
                    key={id}
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth="14"
                    pathLength="100"
                    strokeDasharray={`${Math.max(percent - SEGMENT_GAP, 0.5)} ${100 - percent + SEGMENT_GAP}`}
                    strokeDashoffset={-offset}
                    opacity={activeIndex !== null && activeIndex !== index ? 0.3 : 1}
                    className="transition-opacity"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  />
                ) : null,
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-ink">
                {active ? `${active.percent}%` : totalActive.toLocaleString('en-US')}
              </p>
              <p className="text-[9px] font-bold tracking-wider text-muted uppercase">
                {active ? active.label : 'Total active'}
              </p>
            </div>
          </div>

          <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            {segments.map(({ id, label, count, percent, color }, index) => (
              <li
                key={id}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className="flex items-center gap-2 text-muted"
                title={`${count.toLocaleString('en-US')} ${count === 1 ? 'order' : 'orders'}`}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="font-bold text-ink tabular-nums">{percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  )
}

export default OrderDistribution
