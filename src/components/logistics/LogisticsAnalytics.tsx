import { useState } from 'react'
import { ChartColumn } from 'lucide-react'
import { COST_SUMMARY, TYPE_COLORS, WEEKLY_VOLUME } from '../../constants/logistics'
import type { DispatchJob, Driver } from '../../types/logistics'
import { formatXaf } from '../../utils/orders'
import { Panel } from './LogisticsPanels'

const WIDTH = 560
const HEIGHT = 200
const MARGIN = { top: 18, right: 8, bottom: 26, left: 32 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const BASELINE = MARGIN.top + PLOT_HEIGHT
const BAR_WIDTH = 24
const GAP = 2
const Y_MAX = 80
const TICKS = [0, 20, 40, 60, 80]

function VolumeChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const band = PLOT_WIDTH / WEEKLY_VOLUME.length
  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const y = (value: number) => BASELINE - (value / Y_MAX) * PLOT_HEIGHT
  const active = activeIndex === null ? null : WEEKLY_VOLUME[activeIndex]

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label="Stacked bar chart of pickups and deliveries per day this week. Data table follows."
        >
          {TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? '#cbd5e1' : '#eef2f6'}
              />
              <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {tick}
              </text>
            </g>
          ))}
          {WEEKLY_VOLUME.map(({ day, pickups, deliveries }, index) => {
            const x = xCenter(index) - BAR_WIDTH / 2
            const top = y(pickups + deliveries)
            const split = y(pickups)
            return (
              <g key={day} opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}>
                <rect x={x} y={split} width={BAR_WIDTH} height={BASELINE - split} fill={TYPE_COLORS.pickup} />
                <path
                  d={`M${x},${split - GAP} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + BAR_WIDTH - 4} Q${x + BAR_WIDTH},${top} ${x + BAR_WIDTH},${top + 4} V${split - GAP} Z`}
                  fill={TYPE_COLORS.delivery}
                />
                <text x={xCenter(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                  {day}
                </text>
                <rect
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${day}: ${pickups} pickups, ${deliveries} deliveries`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  className="outline-none focus-visible:stroke-brand focus-visible:stroke-2"
                />
              </g>
            )
          })}
        </svg>
        {active && activeIndex !== null && (
          <div
            className={`pointer-events-none absolute z-10 w-max -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg ${
              activeIndex === WEEKLY_VOLUME.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{
              left: `${(xCenter(activeIndex) / WIDTH) * 100}%`,
              top: `${((y(active.pickups + active.deliveries) - 6) / HEIGHT) * 100}%`,
            }}
          >
            <span className="font-bold">{active.day}</span> · {active.pickups} pickups ·{' '}
            {active.deliveries} deliveries · {active.onTime}% on time
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS.pickup }} />
          Pickups
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS.delivery }} />
          Deliveries
        </li>
      </ul>
      <table className="sr-only">
        <caption>Pickups and deliveries per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Pickups</th>
            <th scope="col">Deliveries</th>
            <th scope="col">On time</th>
          </tr>
        </thead>
        <tbody>
          {WEEKLY_VOLUME.map(({ day, pickups, deliveries, onTime }) => (
            <tr key={day}>
              <th scope="row">{day}</th>
              <td>{pickups}</td>
              <td>{deliveries}</td>
              <td>{onTime}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Delivery Volume: pickups and deliveries per day (sample figures until the
// backend reports them)
export function DeliveryVolumePanel({ className }: { className?: string }) {
  const totalJobs = WEEKLY_VOLUME.reduce(
    (sum, { pickups, deliveries }) => sum + pickups + deliveries,
    0,
  )
  const onTime = Math.round(
    WEEKLY_VOLUME.reduce((sum, { onTime: rate }) => sum + rate, 0) / WEEKLY_VOLUME.length,
  )
  return (
    <Panel
      title="Delivery Volume"
      subtitle="Pickups and deliveries per day, this week (sample figures)"
      icon={ChartColumn}
      className={className}
    >
      <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['Jobs this week', totalJobs],
            ['On-time rate', `${onTime}%`],
            ['Avg distance', `${(COST_SUMMARY.kilometres / COST_SUMMARY.jobs).toFixed(1)} km`],
          ] as [string, string | number][]
        ).map(([label, value]) => (
          <div key={label} className="rounded-md bg-field px-2 py-1.5">
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="text-sm font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <VolumeChart />
    </Panel>
  )
}

export function DriverPerformancePanel({ jobs, drivers }: { jobs: DispatchJob[]; drivers: Driver[] }) {
  const perDriver = drivers
    .map((driver) => ({
      driver,
      completed: jobs.filter(
        (job) =>
          job.driverId === driver.id &&
          (job.status === 'done' || job.status === 'received'),
      ).length,
    }))
    .sort((a, b) => b.driver.score - a.driver.score)

  return (
    <Panel title="Driver Performance" subtitle="Score, and jobs completed today">
      <ul className="space-y-2.5">
        {perDriver.map(({ driver, completed }) => (
          <li key={driver.id} className="text-xs">
            <div className="flex justify-between gap-2">
              <span className="truncate font-semibold text-ink">{driver.name}</span>
              <span className="shrink-0 text-muted tabular-nums">
                {driver.score} · {completed} done
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${driver.score}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// Sample figures until the backend reports delivery costs
export function CostAnalysisPanel() {
  const cost = COST_SUMMARY.driverCost + COST_SUMMARY.fuelEstimate
  const profit = COST_SUMMARY.revenue - cost
  return (
    <Panel title="Cost Analysis" subtitle="This month (sample figures)">
      <dl className="space-y-1.5 text-xs">
        {(
          [
            ['Delivery revenue', formatXaf(COST_SUMMARY.revenue)],
            ['Driver cost', formatXaf(COST_SUMMARY.driverCost)],
            ['Fuel estimate', formatXaf(COST_SUMMARY.fuelEstimate)],
            ['Cost per delivery', formatXaf(cost / COST_SUMMARY.jobs)],
            ['Cost per kilometre', formatXaf(cost / COST_SUMMARY.kilometres)],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-line pt-1.5 text-sm font-bold">
          <dt>Delivery profit</dt>
          <dd className={profit >= 0 ? 'text-success' : 'text-danger'}>
            {formatXaf(profit)} ({Math.round((profit / COST_SUMMARY.revenue) * 100)}%)
          </dd>
        </div>
      </dl>
    </Panel>
  )
}
