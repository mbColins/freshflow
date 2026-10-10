import { useState } from 'react'
import SegmentedControl from '../ui/SegmentedControl'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const RANGES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

type Range = (typeof RANGES)[number]['value']

type Point = { label: string; mobile: number; cash: number }

const DATA: Record<Range, Point[]> = {
  daily: [
    { label: 'Mon 10', mobile: 520_000, cash: 300_000 },
    { label: 'Tue 11', mobile: 480_000, cash: 280_000 },
    { label: 'Wed 12', mobile: 560_000, cash: 320_000 },
    { label: 'Thu 13', mobile: 610_000, cash: 340_000 },
    { label: 'Fri 14', mobile: 640_000, cash: 360_000 },
    { label: 'Sat 15', mobile: 720_000, cash: 400_000 },
    { label: 'Sun 16', mobile: 578_800, cash: 311_200 },
  ],
  weekly: [
    { label: 'Wk 21', mobile: 3_640_000, cash: 2_180_000 },
    { label: 'Wk 22', mobile: 3_820_000, cash: 2_090_000 },
    { label: 'Wk 23', mobile: 3_950_000, cash: 2_240_000 },
    { label: 'Wk 24', mobile: 4_108_800, cash: 2_311_200 },
  ],
  monthly: [
    { label: 'Jan', mobile: 13_900_000, cash: 8_700_000 },
    { label: 'Feb', mobile: 14_400_000, cash: 8_300_000 },
    { label: 'Mar', mobile: 15_200_000, cash: 9_100_000 },
    { label: 'Apr', mobile: 15_900_000, cash: 8_900_000 },
    { label: 'May', mobile: 16_600_000, cash: 9_400_000 },
    { label: 'Jun', mobile: 17_300_000, cash: 9_600_000 },
  ],
}

const SERIES = {
  mobile: { label: 'Mobile Money (MTN/Orange)', color: '#2563eb' },
  cash: { label: 'Cash desk payment', color: '#06b6d4' },
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

function formatXaf(value: number) {
  return `XAF ${Math.round(value).toLocaleString('en-US')}`
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000}M`
  if (value >= 1_000) return `${value / 1_000}K`
  return String(value)
}

function getTickStep(max: number) {
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const multiple = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough)!
  return multiple * magnitude
}

// Rounded at the data end only; square where it meets the segment below
function roundedTopBar(x: number, top: number, bottom: number) {
  const right = x + BAR_WIDTH
  const radius = Math.min(BAR_RADIUS, bottom - top)
  return `M${x},${bottom} V${top + radius} Q${x},${top} ${x + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${bottom} Z`
}

function RevenueChart() {
  const [range, setRange] = useState<Range>('daily')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const points = DATA[range]
  const totals = points.map(({ mobile, cash }) => mobile + cash)
  const averages = totals.map(
    (_, index) =>
      totals.slice(0, index + 1).reduce((sum, total) => sum + total, 0) /
      (index + 1),
  )
  const mobileTotal = points.reduce((sum, { mobile }) => sum + mobile, 0)
  const cashTotal = points.reduce((sum, { cash }) => sum + cash, 0)
  const grandTotal = mobileTotal + cashTotal
  const mobileShare = Math.round((mobileTotal / grandTotal) * 100)

  const tickStep = getTickStep(Math.max(...totals))
  const yMax = Math.ceil(Math.max(...totals) / tickStep) * tickStep
  const ticks = Array.from(
    { length: Math.round(yMax / tickStep) + 1 },
    (_, index) => index * tickStep,
  )

  const band = PLOT_WIDTH / points.length
  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const y = (value: number) => BASELINE - (value / yMax) * PLOT_HEIGHT

  const active = activeIndex === null ? null : points[activeIndex]
  const tooltipAlign =
    activeIndex === 0
      ? ''
      : activeIndex === points.length - 1
        ? '-translate-x-full'
        : '-translate-x-1/2'

  function handleRangeChange(next: Range) {
    setRange(next)
    setActiveIndex(null)
  }

  return (
    <DashboardCard
      title="Revenue & Cashflow Overview"
      subtitle="Breakdown of cash intake vs Mobile Money payments across operating cycles"
      badge={<Badge tone="success">+12.4% MoM</Badge>}
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
      <dl className="grid gap-3 rounded-md bg-field px-4 py-3 sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-semibold text-muted">Total intake</dt>
          <dd className="mt-0.5 text-base font-bold text-ink">
            {formatXaf(grandTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold text-muted">
            Mobile Money ({mobileShare}%)
          </dt>
          <dd className="mt-0.5 text-base font-bold text-ink">
            {formatXaf(mobileTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold text-muted">
            Cash at counter ({100 - mobileShare}%)
          </dt>
          <dd className="mt-0.5 text-base font-bold text-ink">
            {formatXaf(cashTotal)}
          </dd>
        </div>
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
              <text
                x={MARGIN.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {points.map(({ label, mobile, cash }, index) => {
            const x = xCenter(index) - BAR_WIDTH / 2
            const isToday = range === 'daily' && index === points.length - 1
            return (
              <g key={label}>
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
                <rect
                  x={x}
                  y={y(mobile)}
                  width={BAR_WIDTH}
                  height={BASELINE - y(mobile)}
                  fill={SERIES.mobile.color}
                />
                <path
                  d={roundedTopBar(
                    x,
                    y(mobile + cash),
                    y(mobile) - SEGMENT_GAP,
                  )}
                  fill={SERIES.cash.color}
                />
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

          <polyline
            points={averages
              .map((average, index) => `${xCenter(index)},${y(average)}`)
              .join(' ')}
            fill="none"
            stroke={SERIES.average.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {averages.map((average, index) => (
            <circle
              key={points[index].label}
              cx={xCenter(index)}
              cy={y(average)}
              r="4"
              fill={SERIES.average.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {points.map(({ label, mobile, cash }, index) => (
            <rect
              key={label}
              x={MARGIN.left + band * index}
              y={MARGIN.top}
              width={band}
              height={PLOT_HEIGHT}
              fill="transparent"
              tabIndex={0}
              aria-label={`${label}: Mobile Money ${formatXaf(mobile)}, cash ${formatXaf(cash)}, running average ${formatXaf(averages[index])}`}
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
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: SERIES.mobile.color }}
              />
              Mobile Money: {formatXaf(active.mobile)}
            </p>
            <p className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: SERIES.cash.color }}
              />
              Cash: {formatXaf(active.cash)}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-0.5 w-2 bg-white" />
              Running avg: {formatXaf(averages[activeIndex])}
            </p>
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted">
        <li className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: SERIES.mobile.color }}
          />
          {SERIES.mobile.label}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: SERIES.cash.color }}
          />
          {SERIES.cash.label}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: SERIES.average.color }}
          />
          {SERIES.average.label}
        </li>
      </ul>

      <table className="sr-only">
        <caption>Revenue by period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Mobile Money</th>
            <th scope="col">Cash</th>
            <th scope="col">Running average</th>
          </tr>
        </thead>
        <tbody>
          {points.map(({ label, mobile, cash }, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{formatXaf(mobile)}</td>
              <td>{formatXaf(cash)}</td>
              <td>{formatXaf(averages[index])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardCard>
  )
}

export default RevenueChart
