import { useState } from 'react'
import { formatRevenue } from '../../utils/branches'

// Validated chart colours: series blue, with the comparison period in recessive grey
const CURRENT_COLOR = '#2a78d6'
const PREVIOUS_COLOR = '#94a3b8'
const GRID_SHARES = [0, 0.5, 1]

function niceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map((step) => step * magnitude)
    .find((step) => step >= value)!
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
  const lastIndex = Math.max(labels.length - 1, 1)
  // Positions are percentages of the plot, so the lines stretch while the text stays crisp
  const x = (index: number) => (index / lastIndex) * 100
  const y = (value: number) => (1 - value / max) * 100
  const path = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ')
  // Show at most ~5 axis labels so they never collide, even on a phone
  const labelEvery = Math.ceil(labels.length / 5)

  return (
    <figure className="relative">
      <div className="relative h-56">
        {GRID_SHARES.map((share) => (
          <span
            key={share}
            className="absolute left-0 w-11 -translate-y-1/2 pr-1.5 text-right text-[10px] text-muted tabular-nums"
            style={{ top: `calc(8px + (100% - 32px) * ${1 - share})` }}
            aria-hidden="true"
          >
            {formatRevenue(max * share).replace('XAF ', '')}
          </span>
        ))}
        <div
          className="absolute top-2 right-2 bottom-6 left-11"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const share = (event.clientX - rect.left) / rect.width
            setHover(Math.min(lastIndex, Math.max(0, Math.round(share * lastIndex))))
          }}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block size-full overflow-visible"
            role="img"
            aria-label="Revenue over time; the data table follows"
          >
            {GRID_SHARES.map((share) => (
              <line key={share} x1={0} x2={100} y1={y(max * share)} y2={y(max * share)} stroke="#e2e8f0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
            {previous && (
              <path d={path(previous)} fill="none" stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
            <path d={path(current)} fill="none" stroke={CURRENT_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {hover !== null &&
            [
              ...(previous ? [[previous[hover], PREVIOUS_COLOR] as const] : []),
              [current[hover], CURRENT_COLOR] as const,
            ].map(([value, color]) => (
              <span
                key={color}
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                style={{ left: `${x(hover)}%`, top: `${y(value)}%`, background: color }}
                aria-hidden="true"
              />
            ))}
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lg"
              style={{
                left: `${x(hover)}%`,
                transform: `translateX(${hover > lastIndex / 2 ? 'calc(-100% - 10px)' : '10px'})`,
              }}
            >
              <p className="font-semibold">{labels[hover]}</p>
              <p>Current: <span className="font-bold tabular-nums">{formatRevenue(current[hover], false)}</span></p>
              {previous && (
                <p className="text-white/75">Previous: <span className="tabular-nums">{formatRevenue(previous[hover], false)}</span></p>
              )}
            </div>
          )}
          {labels.map((label, index) =>
            (labels.length - 1 - index) % labelEvery === 0 ? (
              <span
                key={label}
                className={`absolute top-full mt-1.5 text-[10px] whitespace-nowrap text-muted ${
                  index === labels.length - 1 ? '-translate-x-full' : index === 0 ? '' : '-translate-x-1/2'
                }`}
                style={{ left: `${x(index)}%` }}
                aria-hidden="true"
              >
                {label.replace('Week to ', '')}
              </span>
            ) : null,
          )}
        </div>
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
