import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  ClipboardList,
  Hourglass,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useGetKpisQuery } from '../../services/dashboardCardsApi'
import type { KpiPeriod, KpiTile } from '../../services/dashboardCardsApi'

type Kpi = {
  label: string
  value: string
  unit?: string
  icon: LucideIcon
  note: string
  noteTone: 'up' | 'down' | 'alert' | 'neutral'
  trend: number[]
}

const PERIODS: { value: KpiPeriod; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: '7 days' },
  { value: 'MONTH', label: '30 days' },
]

const COMPARED_TO: Record<string, string> = {
  YESTERDAY: 'yesterday',
  PREVIOUS_WEEK: 'previous week',
  PREVIOUS_MONTH: 'previous month',
}

// 4 850 000 -> 4.85M, 18 500 -> 18,500
function formatAmount(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${+(value / 1_000_000).toFixed(2)}M`
  return Math.round(value).toLocaleString('en-US')
}

function changeNote(tile: KpiTile, fallback: string): Pick<Kpi, 'note' | 'noteTone'> {
  if (tile.changePercent === null) return { note: fallback, noteTone: 'neutral' }
  const sign = tile.changePercent >= 0 ? '+' : ''
  return {
    note: `${sign}${tile.changePercent}% vs ${COMPARED_TO[tile.compareTo] ?? 'previous period'}`,
    noteTone: tile.changePercent >= 0 ? 'up' : 'down',
  }
}

const PLACEHOLDERS: Pick<Kpi, 'label' | 'icon'>[] = [
  { label: 'Total orders', icon: ClipboardList },
  { label: 'Revenue', icon: Wallet },
  { label: 'Pending', icon: Hourglass },
  { label: 'Completed', icon: CircleCheck },
  { label: 'Customers', icon: Users },
  { label: 'Avg ticket (AOV)', icon: Ticket },
]

const NOTE_CLASSES = {
  up: 'text-success',
  down: 'text-danger',
  alert: 'text-danger',
  neutral: 'text-muted',
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="h-6 w-16 shrink-0" aria-hidden="true" />
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

function KpiStrip({ branch }: { branch?: string }) {
  const [period, setPeriod] = useState<KpiPeriod>('TODAY')
  const { data, isLoading, isError, isFetching } = useGetKpisQuery({ period, ...(branch ? { branch } : {}) })

  const kpis: Kpi[] = data
    ? [
        {
          label: 'Total orders',
          value: data.totalOrders.value.toLocaleString('en-US'),
          icon: ClipboardList,
          trend: data.totalOrders.trend,
          ...changeNote(data.totalOrders, 'New orders in the period'),
        },
        {
          label: 'Revenue',
          value: formatAmount(data.revenue.value),
          unit: data.currency,
          icon: Wallet,
          trend: data.revenue.trend,
          ...changeNote(data.revenue, 'Payments received'),
        },
        {
          label: 'Pending',
          value: data.pending.value.toLocaleString('en-US'),
          icon: Hourglass,
          trend: data.pending.trend,
          note: `${data.pending.urgent} urgent in queue`,
          noteTone: data.pending.urgent > 0 ? 'alert' : 'neutral',
        },
        {
          label: 'Completed',
          value: data.completed.value.toLocaleString('en-US'),
          icon: CircleCheck,
          trend: data.completed.trend,
          note: data.completed.onTimePercent === null ? 'Nothing completed yet' : `${data.completed.onTimePercent}% on-time rate`,
          noteTone: data.completed.onTimePercent === null ? 'neutral' : 'up',
        },
        {
          label: 'Customers',
          value: data.customers.value.toLocaleString('en-US'),
          icon: Users,
          trend: data.customers.trend,
          note: `+${data.customers.newToday} new today`,
          noteTone: data.customers.newToday > 0 ? 'up' : 'neutral',
        },
        {
          label: 'Avg ticket (AOV)',
          value: formatAmount(data.averageTicket.value),
          unit: data.currency,
          icon: Ticket,
          trend: data.averageTicket.trend,
          ...changeNote(data.averageTicket, 'Per completed order'),
        },
      ]
    : []

  const state = isLoading ? 'skeleton' : isError && !data ? 'error' : 'normal'

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div role="group" aria-label="KPI period" className="inline-flex rounded-md bg-field p-0.5">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded px-2.5 py-1 text-[10px] font-bold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                period === value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-3 xl:grid-cols-6 ${isFetching && state === 'normal' ? 'opacity-60' : ''}`}>
        {PLACEHOLDERS.map(({ label, icon: Icon }, index) => {
          const tile = state === 'normal' ? kpis[index] : undefined
          return (
            <section key={label} className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-[11px] font-semibold text-muted">{label}</h2>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-field text-muted">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
              </div>

              {state === 'skeleton' ? (
                <div className="mt-3 animate-pulse space-y-2" aria-label="Loading">
                  <div className="h-6 w-20 rounded bg-field" />
                  <div className="h-3 w-24 rounded bg-field" />
                </div>
              ) : tile ? (
                <>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="flex items-baseline gap-1 text-xl font-bold text-ink">
                      {tile.value}
                      {tile.unit && <span className="text-[10px] font-semibold text-muted">{tile.unit}</span>}
                    </p>
                    <Sparkline points={tile.trend} />
                  </div>
                  <p className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${NOTE_CLASSES[tile.noteTone]}`}>
                    {tile.noteTone === 'up' && <TrendingUp className="size-3 shrink-0" aria-hidden="true" />}
                    {tile.noteTone === 'down' && <TrendingDown className="size-3 shrink-0" aria-hidden="true" />}
                    {tile.note}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xl font-bold text-muted/50">—</p>
                  <p className="mt-2 text-[10px] font-semibold text-muted">
                    {state === 'error' ? 'Failed to load' : 'No data yet'}
                  </p>
                </>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default KpiStrip
