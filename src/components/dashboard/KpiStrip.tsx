import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  ClipboardList,
  Hourglass,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useDashboardView } from './dashboardState'

type Kpi = {
  label: string
  value: string
  unit?: string
  icon: LucideIcon
  note: string
  noteTone: 'up' | 'alert' | 'neutral'
  trend: number[]
}

const KPIS: Kpi[] = [
  {
    label: 'Total orders',
    value: '1,248',
    icon: ClipboardList,
    note: '+12.8% vs yesterday',
    noteTone: 'up',
    trend: [38, 42, 40, 47, 45, 52, 50, 56, 54, 60, 63, 68],
  },
  {
    label: 'Revenue',
    value: '4.85M',
    unit: 'XAF',
    icon: Wallet,
    note: '+8.4% vs last cycle',
    noteTone: 'up',
    trend: [30, 34, 33, 38, 41, 39, 44, 47, 46, 51, 53, 57],
  },
  {
    label: 'Pending',
    value: '86',
    icon: Hourglass,
    note: '12 urgent in queue',
    noteTone: 'alert',
    trend: [60, 58, 62, 57, 55, 59, 54, 52, 56, 51, 49, 50],
  },
  {
    label: 'Completed',
    value: '1,042',
    icon: CircleCheck,
    note: '94.2% on-time rate',
    noteTone: 'up',
    trend: [35, 39, 41, 40, 45, 48, 47, 52, 55, 54, 59, 62],
  },
  {
    label: 'Customers',
    value: '2,438',
    icon: Users,
    note: '+18 new today',
    noteTone: 'up',
    trend: [40, 41, 43, 44, 44, 46, 48, 49, 51, 52, 54, 56],
  },
  {
    label: 'Avg ticket (AOV)',
    value: '18,500',
    unit: 'XAF',
    icon: Ticket,
    note: '+3.2% vs prev week',
    noteTone: 'up',
    trend: [44, 43, 46, 45, 47, 46, 49, 48, 50, 51, 50, 53],
  },
]

const NOTE_CLASSES = {
  up: 'text-success',
  alert: 'text-danger',
  neutral: 'text-muted',
}

function Sparkline({ points }: { points: number[] }) {
  const width = 64
  const height = 24
  const min = Math.min(...points)
  const range = Math.max(...points) - min || 1
  const coords = points.map((point, index) => ({
    x: 2 + (index / (points.length - 1)) * (width - 6),
    y: height - 4 - ((point - min) / range) * (height - 8),
  }))
  const last = coords[coords.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-6 w-16 shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={coords.map(({ x, y }) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="#2563eb" />
    </svg>
  )
}

function KpiStrip() {
  const { viewState } = useDashboardView()

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {KPIS.map(({ label, value, unit, icon: Icon, note, noteTone, trend }) => (
        <section
          key={label}
          className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-[11px] font-semibold text-muted">
              {label}
            </h2>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-field text-muted">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
          </div>

          {viewState === 'skeleton' ? (
            <div className="mt-3 animate-pulse space-y-2" aria-label="Loading">
              <div className="h-6 w-20 rounded bg-field" />
              <div className="h-3 w-24 rounded bg-field" />
            </div>
          ) : viewState === 'normal' ? (
            <>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="flex items-baseline gap-1 text-xl font-bold text-ink">
                  {value}
                  {unit && (
                    <span className="text-[10px] font-semibold text-muted">
                      {unit}
                    </span>
                  )}
                </p>
                <Sparkline points={trend} />
              </div>
              <p
                className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${NOTE_CLASSES[noteTone]}`}
              >
                {noteTone === 'up' && (
                  <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
                )}
                {note}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-bold text-muted/50">—</p>
              <p className="mt-2 text-[10px] font-semibold text-muted">
                {viewState === 'error' ? 'Failed to load' : 'No data yet'}
              </p>
            </>
          )}
        </section>
      ))}
    </div>
  )
}

export default KpiStrip
