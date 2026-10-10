import { useState } from 'react'
import { STAGES } from '../../constants/pipeline'
import type { StageId } from '../../constants/pipeline'
import DashboardCard from './DashboardCard'

const TOTAL_ACTIVE = 1248
const RADIUS = 48
// Segment lengths use pathLength=100, so shares map straight to percentages
const SEGMENT_GAP = (2 / (2 * Math.PI * RADIUS)) * 100

const SEGMENTS = STAGES.map((stage, index) => ({
  ...stage,
  offset: STAGES.slice(0, index).reduce((sum, { share }) => sum + share, 0),
}))

function OrderDistribution() {
  const [activeId, setActiveId] = useState<StageId | null>(null)
  const active = SEGMENTS.find(({ id }) => id === activeId)

  return (
    <DashboardCard
      title="Order Distribution"
      subtitle="Real-time status split of the active batch"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-44">
          <svg
            viewBox="0 0 120 120"
            className="size-full -rotate-90"
            role="img"
            aria-label="Donut chart of active orders by pipeline stage. Values are listed in the legend."
          >
            {SEGMENTS.map(({ id, share, offset, color }) => (
              <circle
                key={id}
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="14"
                pathLength="100"
                strokeDasharray={`${share - SEGMENT_GAP} ${100 - share + SEGMENT_GAP}`}
                strokeDashoffset={-offset}
                opacity={activeId && activeId !== id ? 0.3 : 1}
                className="transition-opacity"
                onMouseEnter={() => setActiveId(id)}
                onMouseLeave={() => setActiveId(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold text-ink">
              {active
                ? `${active.share}%`
                : TOTAL_ACTIVE.toLocaleString('en-US')}
            </p>
            <p className="text-[9px] font-bold tracking-wider text-muted uppercase">
              {active ? active.label : 'Total active'}
            </p>
          </div>
        </div>

        <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {SEGMENTS.map(({ id, label, share, color }) => (
            <li
              key={id}
              onMouseEnter={() => setActiveId(id)}
              onMouseLeave={() => setActiveId(null)}
              className="flex items-center gap-2 text-muted"
            >
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="font-bold text-ink tabular-nums">{share}%</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  )
}

export default OrderDistribution
