import { useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { OVERVIEW_SERIES, PAY_METHODS } from '../../constants/payments'
import type { OverviewMetric, OverviewRange } from '../../constants/payments'
import type { PayMethod, Transaction } from '../../types/payment'
import { formatXaf } from '../../utils/orders'
import { getCollected, isCollected, sum } from '../../utils/payments'
import SegmentedControl from '../ui/SegmentedControl'
import { getTickStep } from '../../utils/charts'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
] as const

const METRICS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'refunds', label: 'Refunds' },
] as const

const WIDTH = 640
const HEIGHT = 220
const MARGIN = { top: 14, right: 14, bottom: 26, left: 44 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const BASELINE = MARGIN.top + PLOT_HEIGHT
const CURRENT = '#2563eb'
const PREVIOUS = '#94a3b8'

export function OverviewChart() {
  const [range, setRange] = useState<OverviewRange>('today')
  const [metric, setMetric] = useState<OverviewMetric>('revenue')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const series = OVERVIEW_SERIES[range]
  const [current, previous] = series[metric]
  // Money series are stored in thousands of XAF
  const money = metric !== 'transactions'
  const format = (value: number) =>
    money ? formatXaf(value * 1_000) : `${value} transactions`
  const tick = (value: number) =>
    money ? (value >= 1_000 ? `${value / 1_000}M` : `${value}K`) : String(value)

  const max = Math.max(...current, ...previous)
  const step = getTickStep(max)
  const yMax = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const x = (index: number) =>
    MARGIN.left + (index / (series.points.length - 1)) * PLOT_WIDTH
  const y = (value: number) => BASELINE - (value / yMax) * PLOT_HEIGHT
  const line = (values: readonly number[]) =>
    values.map((value, index) => `${x(index)},${y(value)}`).join(' ')

  const totalCurrent = sum([...current], (value) => value)
  const totalPrevious = sum([...previous], (value) => value)
  const growth = ((totalCurrent - totalPrevious) / totalPrevious) * 100
  const revenueTotal = sum([...series.revenue[0]], (value) => value) * 1_000
  const txnTotal = sum([...series.transactions[0]], (value) => value)
  // More refunds is the bad direction; more revenue or transactions is good
  const good = metric === 'refunds' ? growth <= 0 : growth >= 0
  const band = PLOT_WIDTH / (series.points.length - 1)

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line lg:col-span-2">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">Payment Overview</h2>
          <p className="text-[11px] text-muted">{series.label} (sample trend)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            label="Metric"
            options={METRICS}
            value={metric}
            onChange={setMetric}
          />
          <SegmentedControl
            label="Period"
            options={RANGES}
            value={range}
            onChange={(next) => {
              setRange(next)
              setActiveIndex(null)
            }}
          />
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['Total collected', formatXaf(revenueTotal)],
            ['Transaction count', txnTotal.toLocaleString('en-US')],
            ['Average transaction', formatXaf(revenueTotal / txnTotal)],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="rounded-md bg-field px-3 py-2">
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="text-sm font-bold text-ink">{value}</dd>
          </div>
        ))}
        <div className="rounded-md bg-field px-3 py-2">
          <dt className="text-[10px] font-semibold text-muted">Vs previous period</dt>
          <dd
            className={`flex items-center gap-1 text-sm font-bold ${good ? 'text-success' : 'text-danger'}`}
          >
            {growth >= 0 ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {growth >= 0 ? '+' : ''}
            {growth.toFixed(1)}%
          </dd>
        </div>
      </dl>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Line chart of ${metric} for the current and previous period. Data table follows.`}
        >
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(value)}
                y2={y(value)}
                stroke={value === 0 ? '#cbd5e1' : '#eef2f6'}
              />
              <text x={MARGIN.left - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {tick(value)}
              </text>
            </g>
          ))}
          {series.points.map((label, index) => (
            <text
              key={label}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {series.points.length > 8 && index % 2 === 1 ? '' : label}
            </text>
          ))}

          <polygon
            points={`${MARGIN.left},${BASELINE} ${line(current)} ${WIDTH - MARGIN.right},${BASELINE}`}
            fill={CURRENT}
            opacity="0.1"
          />
          <polyline points={line(previous)} fill="none" stroke={PREVIOUS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={line(current)} fill="none" stroke={CURRENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {activeIndex !== null && (
            <g>
              <line x1={x(activeIndex)} x2={x(activeIndex)} y1={MARGIN.top} y2={BASELINE} stroke="#cbd5e1" />
              <circle cx={x(activeIndex)} cy={y(previous[activeIndex])} r="4" fill={PREVIOUS} stroke="#fff" strokeWidth="2" />
              <circle cx={x(activeIndex)} cy={y(current[activeIndex])} r="4" fill={CURRENT} stroke="#fff" strokeWidth="2" />
            </g>
          )}

          {series.points.map((label, index) => (
            <rect
              key={label}
              x={x(index) - band / 2}
              y={MARGIN.top}
              width={band}
              height={PLOT_HEIGHT}
              fill="transparent"
              tabIndex={0}
              aria-label={`${label}: ${format(current[index])}, previous period ${format(previous[index])}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              className="outline-none"
            />
          ))}
        </svg>

        {activeIndex !== null && (
          <div
            className={`pointer-events-none absolute top-0 z-10 w-max rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg ${
              activeIndex > series.points.length / 2 ? '-translate-x-full -ml-2' : 'ml-2'
            }`}
            style={{ left: `${(x(activeIndex) / WIDTH) * 100}%` }}
          >
            <p className="font-bold">{series.points[activeIndex]}</p>
            <p className="flex items-center gap-1.5">
              <span className="h-0.5 w-3" style={{ backgroundColor: CURRENT }} />
              Current: {format(current[activeIndex])}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-0.5 w-3" style={{ backgroundColor: PREVIOUS }} />
              Previous: {format(previous[activeIndex])}
            </p>
          </div>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: CURRENT }} />
          Current period
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: PREVIOUS }} />
          Previous period
        </li>
      </ul>

      <table className="sr-only">
        <caption>{metric} by period</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">Current</th>
            <th scope="col">Previous</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{format(current[index])}</td>
              <td>{format(previous[index])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const RADIUS = 48

export function MethodsDonut({
  transactions,
  selected,
  onSelect,
}: {
  transactions: Transaction[]
  selected: PayMethod | ''
  onSelect: (method: PayMethod | '') => void
}) {
  const [hovered, setHovered] = useState<PayMethod | null>(null)
  const collected = transactions.filter(isCollected)
  const total = getCollected(collected)
  const gap = (2 / (2 * Math.PI * RADIUS)) * 100

  const segments = PAY_METHODS.map(({ id, color }) => ({
    id,
    color,
    amount: sum(
      collected.filter(({ method }) => method === id),
      ({ amount }) => amount,
    ),
  }))
    .filter(({ amount }) => amount > 0)
    .map((segment, index, list) => ({
      ...segment,
      share: (segment.amount / total) * 100,
      offset: sum(list.slice(0, index), ({ amount }) => (amount / total) * 100),
    }))
  const focus = segments.find(({ id }) => id === (hovered ?? selected))

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
      <h2 className="text-sm font-bold text-ink">Payment Methods</h2>
      <p className="text-[11px] text-muted">Collected today; click a method to filter</p>

      <div className="mt-3 flex flex-col items-center gap-4">
        <div className="relative size-40">
          <svg
            viewBox="0 0 120 120"
            className="size-full -rotate-90"
            role="img"
            aria-label="Donut chart of money collected by payment method. Values are listed below."
          >
            {segments.map(({ id, color, share, offset }) => (
              <circle
                key={id}
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="14"
                pathLength="100"
                strokeDasharray={`${Math.max(0.5, share - gap)} ${100 - Math.max(0.5, share - gap)}`}
                strokeDashoffset={-offset}
                opacity={focus && focus.id !== id ? 0.3 : 1}
                className="transition-opacity"
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-base font-bold text-ink">
              {focus ? `${focus.share.toFixed(1)}%` : formatXaf(total)}
            </p>
            <p className="text-[9px] font-bold tracking-wider text-muted uppercase">
              {focus ? focus.id : 'Total intake'}
            </p>
          </div>
        </div>

        <ul className="w-full space-y-1">
          {segments.map(({ id, color, amount, share }) => (
            <li key={id}>
              <button
                type="button"
                aria-pressed={selected === id}
                onClick={() => onSelect(selected === id ? '' : id)}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected === id ? 'bg-brand/5 ring-1 ring-brand/40' : 'hover:bg-field'
                }`}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-muted">{id}</span>
                <span className="font-bold text-ink tabular-nums">{formatXaf(amount)}</span>
                <span className="w-10 text-right text-muted tabular-nums">
                  {share.toFixed(0)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
