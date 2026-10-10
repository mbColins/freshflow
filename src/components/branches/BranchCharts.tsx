import { useState } from 'react'
import { formatRevenue } from '../../utils/branches'

const WIDTH = 640
const HEIGHT = 220
const PAD = { left: 56, right: 14, top: 12, bottom: 26 }
// Validated chart colours: series blue, with the comparison period in recessive grey
const CURRENT_COLOR = '#2a78d6'
const PREVIOUS_COLOR = '#94a3b8'

function niceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((step) => step >= value)!
}

export function RevenueChart({
  labels,
  current,
  previous,
}: {
  labels: string[]
  current: number[]
  previous: number[] | null
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(...current, ...(previous ?? [])))
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (index * plotWidth) / Math.max(labels.length - 1, 1)
  const y = (value: number) => PAD.top + (1 - value / max) * plotHeight
  const path = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const band = plotWidth / Math.max(labels.length - 1, 1)
  // Show at most ~7 axis labels so they never collide
  const labelEvery = Math.ceil(labels.length / 7)

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Revenue over time; the data table follows">
          {[0, 0.5, 1].map((share) => (
            <g key={share}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(max * share)} y2={y(max * share)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(max * share) + 3} textAnchor="end" fontSize={10} fill="#64748b">
                {formatRevenue(max * share).replace('XAF ', '')}
              </text>
            </g>
          ))}
          {labels.map((label, index) =>
            (labels.length - 1 - index) % labelEvery === 0 ? (
              <text
                key={label}
                x={x(index)}
                y={HEIGHT - 8}
                textAnchor={index === labels.length - 1 ? 'end' : index === 0 ? 'start' : 'middle'}
                fontSize={10}
                fill="#64748b"
              >
                {label.replace('Week to ', '')}
              </text>
            ) : null,
          )}
          {previous && (
            <path d={path(previous)} fill="none" stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
          )}
          <path d={path(current)} fill="none" stroke={CURRENT_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#94a3b8" strokeWidth={1} />
              {previous && <circle cx={x(hover)} cy={y(previous[hover])} r={4} fill={PREVIOUS_COLOR} stroke="#fff" strokeWidth={2} />}
              <circle cx={x(hover)} cy={y(current[hover])} r={4} fill={CURRENT_COLOR} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          {labels.map((label, index) => (
            <rect
              key={label}
              x={x(index) - band / 2}
              y={PAD.top}
              width={band}
              height={plotHeight}
              fill="transparent"
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lg"
            style={{
              left: `${(x(hover) / WIDTH) * 100}%`,
              transform: `translateX(${hover > labels.length / 2 ? 'calc(-100% - 8px)' : '8px'})`,
            }}
          >
            <p className="font-semibold">{labels[hover]}</p>
            <p>Current: <span className="font-bold tabular-nums">{formatRevenue(current[hover], false)}</span></p>
            {previous && (
              <p className="text-white/75">Previous: <span className="tabular-nums">{formatRevenue(previous[hover], false)}</span></p>
            )}
          </div>
        )}
      </div>
      {previous && (
        <figcaption className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full" style={{ background: CURRENT_COLOR }} aria-hidden="true" />
            Current period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed" style={{ borderColor: PREVIOUS_COLOR }} aria-hidden="true" />
            Previous period
          </span>
        </figcaption>
      )}
      <table className="sr-only">
        <caption>Revenue by period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Current</th>
            {previous && <th scope="col">Previous</th>}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{formatRevenue(current[index], false)}</td>
              {previous && <td>{formatRevenue(previous[index], false)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// One measure across stages: a single hue, every bar labelled with its value
export function OrderStageChart({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(...stages.map(({ value }) => value), 1)
  return (
    <ul className="space-y-2">
      {stages.map(({ label, value }) => (
        <li key={label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs" title={`${label}: ${value.toLocaleString('en-US')} orders`}>
          <span className="text-muted">{label}</span>
          <span className="h-4 rounded-sm bg-field">
            <span
              className="block h-full rounded-r"
              style={{ width: `${(value / max) * 100}%`, background: CURRENT_COLOR, minWidth: value > 0 ? 2 : 0 }}
            />
          </span>
          <span className="text-right font-bold text-ink tabular-nums">{value.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  )
}
