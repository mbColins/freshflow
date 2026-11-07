import type { ReportChart as ChartHint, ReportColumn } from '../../services/reportsApi'
import { formatReportValue } from '../../utils/reports'

const W = 900
const H = 230
const PAD = { top: 12, right: 12, bottom: 34, left: 52 }
const MAX_POINTS = 40

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0
}

// "1.2M", "45K", "320"
const compact = (value: number) =>
  Math.abs(value) >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : Math.abs(value) >= 1_000 ? `${+(value / 1_000).toFixed(1)}K` : String(+value.toFixed(1))

// The chart the report asks for: a bar or line of its first plotted value
// against its x key, drawn from the rows on this page
export default function ReportChart({
  chart,
  rows,
  columns,
  currency,
}: {
  chart: ChartHint
  rows: Record<string, unknown>[]
  columns: ReportColumn[]
  currency: string
}) {
  const yKey = chart.y[0]
  const column = columns.find(({ key }) => key === yKey)
  const label = column?.label ?? yKey
  const points = rows.slice(0, MAX_POINTS).map((row) => ({ x: String(row[chart.x] ?? ''), y: toNumber(row[yKey]), raw: row[yKey] }))
  if (points.length === 0) return null

  const max = Math.max(0, ...points.map(({ y }) => y))
  const min = Math.min(0, ...points.map(({ y }) => y))
  const range = max - min || 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const step = plotW / points.length
  const yOf = (value: number) => PAD.top + plotH - ((value - min) / range) * plotH
  const xOf = (index: number) => PAD.left + step * index + step / 2
  const ticks = [min, min + range / 2, max]
  // Show about eight x labels however many bars there are
  const every = Math.ceil(points.length / 8)
  const truncate = (text: string) => (text.length > 12 ? `${text.slice(0, 11)}…` : text)
  const line = points.map(({ y }, index) => `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(y)}`).join(' ')

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label} by ${chart.x}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 6} y={yOf(tick) + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {compact(tick)}
            </text>
          </g>
        ))}
        {chart.type === 'LINE' ? (
          <>
            <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(({ x, y, raw }, index) => (
              <circle key={index} cx={xOf(index)} cy={yOf(y)} r="3.5" fill="#2563eb">
                <title>{`${x}: ${formatReportValue(raw, column?.type ?? 'NUMBER', currency)}`}</title>
              </circle>
            ))}
          </>
        ) : (
          points.map(({ x, y, raw }, index) => (
            <rect
              key={index}
              x={xOf(index) - Math.max(2, step * 0.32)}
              y={Math.min(yOf(y), yOf(0))}
              width={Math.max(4, step * 0.64)}
              height={Math.max(1, Math.abs(yOf(y) - yOf(0)))}
              rx="3"
              fill="#2563eb"
            >
              <title>{`${x}: ${formatReportValue(raw, column?.type ?? 'NUMBER', currency)}`}</title>
            </rect>
          ))
        )}
        {points.map(({ x }, index) =>
          index % every === 0 ? (
            <text key={index} x={xOf(index)} y={H - 12} textAnchor="middle" fontSize="10" fill="#64748b">
              {truncate(x)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-1 text-[11px] text-muted">
        {label}
        {rows.length > MAX_POINTS && ` · first ${MAX_POINTS} rows of this page`}
      </figcaption>
    </figure>
  )
}
