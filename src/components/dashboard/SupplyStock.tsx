import { FlaskConical, Plus } from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const LEVELS = {
  healthy: {
    label: 'Healthy',
    fill: 'bg-success',
    track: 'bg-success/15',
    tone: 'success',
  },
  low: {
    label: 'Low',
    fill: 'bg-warning',
    track: 'bg-warning/15',
    tone: 'warning',
  },
  critical: {
    label: 'Critical',
    fill: 'bg-danger',
    track: 'bg-danger/15',
    tone: 'danger',
  },
} as const

type Supply = {
  name: string
  current: number
  capacity: number
  unit: string
  level: keyof typeof LEVELS
}

const SUPPLIES: Supply[] = [
  { name: 'Industrial Detergent EcoClean', current: 18, capacity: 50, unit: 'L', level: 'low' },
  { name: 'Fabric Softener Lavender Mist', current: 45, capacity: 60, unit: 'L', level: 'healthy' },
  { name: 'Garment Poly Bags XL (Pack 500)', current: 120, capacity: 500, unit: '', level: 'critical' },
  { name: 'Wooden Suit Hangers', current: 340, capacity: 400, unit: '', level: 'healthy' },
  { name: 'Oxygen Bleach Booster', current: 22, capacity: 30, unit: 'L', level: 'healthy' },
]

const CRITICAL_COUNT = SUPPLIES.filter(
  ({ level }) => level === 'critical',
).length

function SupplyStock() {
  return (
    <DashboardCard
      title="Chemical & Supplies Stock"
      subtitle="Detergents, sanitizers, wrappers, and hanger reserves"
      icon={FlaskConical}
      badge={<Badge tone="danger">{CRITICAL_COUNT} critical</Badge>}
    >
      <ul className="space-y-3">
        {SUPPLIES.map(({ name, current, capacity, unit, level }) => {
          const { label, fill, track, tone } = LEVELS[level]
          return (
            <li key={name}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate font-semibold text-ink">
                  {name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted tabular-nums">
                  {current}
                  {unit} / {capacity}
                  {unit}
                  <Badge tone={tone}>{label}</Badge>
                </span>
              </div>
              <div
                className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${track}`}
                role="meter"
                aria-label={`${name} stock`}
                aria-valuenow={current}
                aria-valuemin={0}
                aria-valuemax={capacity}
              >
                <div
                  className={`h-full rounded-full ${fill}`}
                  style={{ width: `${(current / capacity) * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand text-[11px] font-bold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Restock Consumables
        </button>
        <button
          type="button"
          className="h-9 rounded-md bg-field px-4 text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Audit
        </button>
      </div>
    </DashboardCard>
  )
}

export default SupplyStock
