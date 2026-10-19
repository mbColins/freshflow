import { useState } from 'react'
import { formatXaf } from '../../utils/orders'
import SegmentedControl from '../ui/SegmentedControl'
import { formatCompact, getTickStep } from '../../utils/charts'

const RANGES = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
] as const

type Range = (typeof RANGES)[number]['value']
type Measure = 'orders' | 'spend'

const WIDTH = 640
const HEIGHT = 200
const MARGIN = { top: 20, right: 8, bottom: 26, left: 44 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const BASELINE = MARGIN.top + PLOT_HEIGHT
const BAR_WIDTH = 24
const BAR_COLOR = '#2563eb'

function roundedTopBar(x: number, top: number) {
  const right = x + BAR_WIDTH
  const radius = Math.min(4, BASELINE - top)
  return `M${x},${BASELINE} V${top + radius} Q${x},${top} ${x + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${BASELINE} Z`
}

type CustomerActivityChartProps = {
  monthlyOrders: number[]
  monthlySpend: number[]
  now: number
  showFinancials: boolean
  // Wording for the money series: customers spend, services earn revenue
  moneyLabel?: string
  moneyVerb?: string
}

function CustomerActivityChart({
  monthlyOrders,
  monthlySpend,
  now,
  showFinancials,
  moneyLabel = 'Spending',
  moneyVerb = 'spent',
}: CustomerActivityChartProps) {
  const measures: { value: Measure; label: string }[] = [
    { value: 'orders', label: 'Orders' },
    { value: 'spend', label: moneyLabel },
  ]
  const [range, setRange] = useState<Range>('12')
  const [measure, setMeasure] = useState<Measure>('orders')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const count = Number(range)
  const spending = showFinancials && measure === 'spend'
  const values = (spending ? monthlySpend : monthlyOrders).slice(-count)
  const labels = values.map((_, index) => {
    const date = new Date(now)
    date.setDate(1)
    date.setMonth(date.getMonth() - (values.length - 1 - index))
    return date.toLocaleDateString('en-US', { month: 'short' })
  })
  const format = (value: number) =>
    spending ? formatXaf(value) : `${value} ${value === 1 ? 'order' : 'orders'}`

  const tickStep = getTickStep(Math.max(...values))
  const yMax = Math.max(tickStep, Math.ceil(Math.max(...values) / tickStep) * tickStep)
  const ticks = Array.from(
    { length: Math.round(yMax / tickStep) + 1 },
    (_, index) => index * tickStep,
  )
  const band = PLOT_WIDTH / values.length
  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const y = (value: number) => BASELINE - (value / yMax) * PLOT_HEIGHT
  const peakIndex = values.indexOf(Math.max(...values))
  const total = values.reduce((sum, value) => sum + value, 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          <span className="text-base font-bold text-ink">
            {spending ? formatXaf(total) : total}
          </span>{' '}
          {spending ? moneyVerb : 'orders'} in the last {count} months
        </p>
        <div className="flex flex-wrap gap-2">
          {showFinancials && (
            <SegmentedControl
              label="Measure"
              options={measures}
              value={measure}
              onChange={setMeasure}
            />
          )}
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
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Bar chart of ${spending ? moneyLabel.toLowerCase() : 'orders'} per month. Data table follows.`}
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
          {values.map((value, index) => (
            <g key={labels[index] + index}>
              {value > 0 && (
                <path
                  d={roundedTopBar(xCenter(index) - BAR_WIDTH / 2, y(value))}
                  fill={BAR_COLOR}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                />
              )}
              {index === peakIndex && value > 0 && (
                <text
                  x={xCenter(index)}
                  y={y(value) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  {spending ? formatCompact(value) : value}
                </text>
              )}
              <text
                x={xCenter(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {labels[index]}
              </text>
              <rect
                x={MARGIN.left + band * index}
                y={MARGIN.top}
                width={band}
                height={PLOT_HEIGHT}
                fill="transparent"
                tabIndex={0}
                aria-label={`${labels[index]}: ${format(value)}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className="outline-none focus-visible:stroke-brand focus-visible:stroke-2"
              />
            </g>
          ))}
        </svg>

        {activeIndex !== null && (
          <div
            className={`pointer-events-none absolute z-10 w-max -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg ${
              activeIndex === 0
                ? ''
                : activeIndex === values.length - 1
                  ? '-translate-x-full'
                  : '-translate-x-1/2'
            }`}
            style={{
              left: `${(xCenter(activeIndex) / WIDTH) * 100}%`,
              top: `${((y(values[activeIndex]) - 6) / HEIGHT) * 100}%`,
            }}
          >
            <span className="font-bold">{labels[activeIndex]}</span> ·{' '}
            {format(values[activeIndex])}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{spending ? moneyLabel : 'Orders'} per month</caption>
        <tbody>
          {values.map((value, index) => (
            <tr key={labels[index] + index}>
              <th scope="row">{labels[index]}</th>
              <td>{format(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CustomerActivityChart
