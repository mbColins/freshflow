import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import SegmentedControl from '../ui/SegmentedControl'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'
import { useGetRevenueOverviewQuery } from '../../services/dashboardApi'
import type { RevenuePeriod } from '../../services/dashboardApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { formatCompact, getTickStep } from '../../utils/charts'

const RANGES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
] as const

type Point = { label: string; mobile: number; cash: number; other: number }

const SERIES = {
  mobile: { label: 'Mobile Money (MTN/Orange)', color: '#2563eb' },
  cash: { label: 'Cash desk payment', color: '#06b6d4' },
  other: { label: 'Card & other', color: '#a78bfa' },
  average: { label: 'Running average', color: '#334155' },
}

const WIDTH = 640
const HEIGHT = 240
const MARGIN = { top: 12, right: 12, bottom: 28, left: 48 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const BASELINE = MARGIN.top + PLOT_HEIGHT
const BAR_WIDTH = 24
const BAR_RADIUS = 4
const SEGMENT_GAP = 2

// Rounded at the data end only; square where it meets the segment below
function roundedTopBar(x: number, top: number, bottom: number) {
  const right = x + BAR_WIDTH
  const radius = Math.max(0, Math.min(BAR_RADIUS, bottom - top))
  return `M${x},${bottom} V${top + radius} Q${x},${top} ${x + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${bottom} Z`
}

// Money collected per day, week or month, from GET /dashboard/revenue. `branch`
// narrows a tenant owner's view to one branch; empty means every branch they see
function RevenueChart({ branch }: { branch: string }) {
  const [range, setRange] = useState<RevenuePeriod>('DAILY')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { data, isLoading, isError, isFetching, error, refetch } = useGetRevenueOverviewQuery({
    period: range,
    ...(branch ? { branch } : {}),
  })

  const points: Point[] = (data?.points ?? []).map(({ label, mobileMoney, cash, other }) => ({
    label,
    mobile: mobileMoney,
    cash,
    other,
  }))
  const totals = points.map(({ mobile, cash, other }) => mobile + cash + other)
  const averages = totals.map(
    (_, index) =>
      totals.slice(0, index + 1).reduce((sum, total) => sum + total, 0) /
      (index + 1),
  )
  const mobileTotal = data?.totals.mobileMoney ?? 0
  const cashTotal = data?.totals.cash ?? 0
  const otherTotal = data?.totals.other ?? 0
  const grandTotal = data?.totals.total ?? 0
  const share = (value: number) => (grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0)
  const hasOther = otherTotal > 0
  const change = data?.change.percent ?? null
  // The branch's currency; XAF when several branches are covered
  const currency = data?.currency || 'XAF'
  const money = (value: number) => `${currency} ${Math.round(value).toLocaleString('en-US')}`

  const highest = Math.max(0, ...totals)
  const tickStep = getTickStep(highest)
  const yMax = Math.max(tickStep, Math.ceil(highest / tickStep) * tickStep)
  const ticks = Array.from(
    { length: Math.round(yMax / tickStep) + 1 },
    (_, index) => index * tickStep,
  )

  const band = PLOT_WIDTH / Math.max(1, points.length)
  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const y = (value: number) => BASELINE - (value / yMax) * PLOT_HEIGHT

  const active = activeIndex === null ? null : points[activeIndex]
  const tooltipAlign =
    activeIndex === 0
      ? ''
      : activeIndex === points.length - 1
        ? '-translate-x-full'
        : '-translate-x-1/2'

  function handleRangeChange(next: RevenuePeriod) {
    setRange(next)
    setActiveIndex(null)
  }

  return (
    <DashboardCard
      title="Revenue & Cashflow Overview"
      subtitle="Breakdown of cash intake vs Mobile Money payments across operating cycles"
      badge={
        change !== null && (
          <Badge tone={change >= 0 ? 'success' : 'danger'}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}% MoM
          </Badge>
        )
      }
      action={
        <SegmentedControl
          label="Chart period"
          options={RANGES}
          value={range}
          onChange={handleRangeChange}
        />
      }
      className="lg:col-span-2"
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading revenue…</p>
          <div className="h-16 animate-pulse rounded-md bg-field" />
          <div className="h-56 animate-pulse rounded-md bg-field" />
        </div>
      ) : isError && !data ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm font-bold text-ink">Couldn’t load revenue</p>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-1 flex items-center gap-1.5 text-xs font-bold text-brand hover:underline disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : (
        <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <dl className={`grid gap-3 rounded-md bg-field px-4 py-3 ${hasOther ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <div>
              <dt className="text-[10px] font-semibold text-muted">Total intake</dt>
              <dd className="mt-0.5 text-base font-bold text-ink">{money(grandTotal)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-muted">Mobile Money ({share(mobileTotal)}%)</dt>
              <dd className="mt-0.5 text-base font-bold text-ink">{money(mobileTotal)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-muted">Cash at counter ({share(cashTotal)}%)</dt>
              <dd className="mt-0.5 text-base font-bold text-ink">{money(cashTotal)}</dd>
            </div>
            {hasOther && (
              <div>
                <dt className="text-[10px] font-semibold text-muted">Card & other ({share(otherTotal)}%)</dt>
                <dd className="mt-0.5 text-base font-bold text-ink">{money(otherTotal)}</dd>
              </div>
            )}
          </dl>

          <div className="relative mt-4">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full"
              role="img"
              aria-label="Stacked bar chart of Mobile Money and cash intake per period with a running average line. Data table follows."
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 0 ? '#cbd5e1' : '#eef2f6'}
                  />
                  <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                    {formatCompact(tick)}
                  </text>
                </g>
              ))}

              {points.map(({ label, mobile, cash, other }, index) => {
                const x = xCenter(index) - BAR_WIDTH / 2
                const isToday = range === 'DAILY' && index === points.length - 1
                // The top segment present gets the rounded end
                const topValue = other > 0 ? 'other' : cash > 0 ? 'cash' : 'mobile'
                return (
                  <g key={`${label}-${index}`}>
                    {activeIndex === index && (
                      <rect
                        x={MARGIN.left + band * index}
                        y={MARGIN.top}
                        width={band}
                        height={PLOT_HEIGHT}
                        fill="#0f172a"
                        opacity="0.04"
                      />
                    )}
                    {mobile > 0 &&
                      (topValue === 'mobile' ? (
                        <path d={roundedTopBar(x, y(mobile), BASELINE)} fill={SERIES.mobile.color} />
                      ) : (
                        <rect x={x} y={y(mobile)} width={BAR_WIDTH} height={BASELINE - y(mobile)} fill={SERIES.mobile.color} />
                      ))}
                    {cash > 0 &&
                      (topValue === 'cash' ? (
                        <path
                          d={roundedTopBar(x, y(mobile + cash), y(mobile) - (mobile > 0 ? SEGMENT_GAP : 0))}
                          fill={SERIES.cash.color}
                        />
                      ) : (
                        <rect
                          x={x}
                          y={y(mobile + cash)}
                          width={BAR_WIDTH}
                          height={Math.max(0, y(mobile) - (mobile > 0 ? SEGMENT_GAP : 0) - y(mobile + cash))}
                          fill={SERIES.cash.color}
                        />
                      ))}
                    {other > 0 && (
                      <path
                        d={roundedTopBar(
                          x,
                          y(mobile + cash + other),
                          y(mobile + cash) - (mobile + cash > 0 ? SEGMENT_GAP : 0),
                        )}
                        fill={SERIES.other.color}
                      />
                    )}
                    <text
                      x={xCenter(index)}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isToday ? 700 : 400}
                      fill={isToday ? '#0f172a' : '#64748b'}
                    >
                      {isToday ? `${label} (Today)` : label}
                    </text>
                  </g>
                )
              })}

              {points.length > 0 && (
                <polyline
                  points={averages.map((average, index) => `${xCenter(index)},${y(average)}`).join(' ')}
                  fill="none"
                  stroke={SERIES.average.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {averages.map((average, index) => (
                <circle
                  key={`${points[index].label}-${index}`}
                  cx={xCenter(index)}
                  cy={y(average)}
                  r="4"
                  fill={SERIES.average.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ))}

              {points.map(({ label, mobile, cash, other }, index) => (
                <rect
                  key={`${label}-${index}`}
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${label}: Mobile Money ${money(mobile)}, cash ${money(cash)}${other > 0 ? `, card and other ${money(other)}` : ''}, running average ${money(averages[index])}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  className="outline-none focus-visible:stroke-brand focus-visible:stroke-2"
                />
              ))}
            </svg>

            {active && activeIndex !== null && (
              <div
                className={`pointer-events-none absolute z-10 w-max -translate-y-full rounded-md bg-ink px-3 py-2 text-[11px] text-white shadow-lg ${tooltipAlign}`}
                style={{
                  left: `${(xCenter(activeIndex) / WIDTH) * 100}%`,
                  top: `${((y(totals[activeIndex]) - 8) / HEIGHT) * 100}%`,
                }}
              >
                <p className="font-bold">{active.label}</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: SERIES.mobile.color }} />
                  Mobile Money: {money(active.mobile)}
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: SERIES.cash.color }} />
                  Cash: {money(active.cash)}
                </p>
                {active.other > 0 && (
                  <p className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ backgroundColor: SERIES.other.color }} />
                    Card & other: {money(active.other)}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <span className="h-0.5 w-2 bg-white" />
                  Running avg: {money(averages[activeIndex])}
                </p>
              </div>
            )}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: SERIES.mobile.color }} />
              {SERIES.mobile.label}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: SERIES.cash.color }} />
              {SERIES.cash.label}
            </li>
            {hasOther && (
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: SERIES.other.color }} />
                {SERIES.other.label}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SERIES.average.color }} />
              {SERIES.average.label}
            </li>
          </ul>

          {grandTotal === 0 && (
            <p className="mt-2 text-center text-[11px] text-muted">No payments recorded in this period yet.</p>
          )}

          <table className="sr-only">
            <caption>Revenue by period</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Mobile Money</th>
                <th scope="col">Cash</th>
                <th scope="col">Card & other</th>
                <th scope="col">Running average</th>
              </tr>
            </thead>
            <tbody>
              {points.map(({ label, mobile, cash, other }, index) => (
                <tr key={`${label}-${index}`}>
                  <th scope="row">{label}</th>
                  <td>{money(mobile)}</td>
                  <td>{money(cash)}</td>
                  <td>{money(other)}</td>
                  <td>{money(averages[index])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  )
}

export default RevenueChart
