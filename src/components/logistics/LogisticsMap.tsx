import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Minus, Phone, Plus, Route, UserCog, X } from 'lucide-react'
import { DEPOT, TYPE_COLORS, ZONES } from '../../constants/logistics'
import type { DispatchJob, Driver } from '../../types/logistics'
import { getInitials } from '../../utils/customers'
import { getDelayMinutes, isClosed } from '../../utils/logistics'
import { primaryButton, secondaryButton } from '../orders/styles'
import { DriverStatusBadge } from './LogisticsBits'

const LAYERS = [
  { id: 'all', label: 'All' },
  { id: 'pickup', label: 'Pickups' },
  { id: 'delivery', label: 'Deliveries' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'delayed', label: 'Delayed' },
  { id: 'express', label: 'Priority' },
] as const

type Layer = (typeof LAYERS)[number]['id']

const WIDTH = 600
const HEIGHT = 380
const DANGER = '#dc2626'
const WARNING = '#b45309'

type LogisticsMapProps = {
  jobs: DispatchJob[]
  drivers: Driver[]
  now: number
  onOpenJob: (id: string) => void
  onShowDriverJobs: (driverId: string) => void
  onAssignToDriver: (driverId: string) => void
}

function activate(action: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        action()
      }
    },
  }
}

function LogisticsMap({
  jobs,
  drivers,
  now,
  onOpenJob,
  onShowDriverJobs,
  onAssignToDriver,
}: LogisticsMapProps) {
  const [layer, setLayer] = useState<Layer>('all')
  const [zoom, setZoom] = useState(1)
  const [driverId, setDriverId] = useState<string | null>(null)

  const onMap = drivers.filter(({ status }) => status !== 'offline')
  const selectedDriver = onMap.find(({ id }) => id === driverId)
  const visibleJobs = jobs.filter((job) => {
    if (job.status === 'cancelled') return false
    if (layer === 'pickup' || layer === 'delivery') return job.type === layer
    if (layer === 'delayed') return getDelayMinutes(job, now) > 0 || job.status === 'failed'
    if (layer === 'express') return job.priority === 'express' && !isClosed(job)
    return layer === 'all'
  })
  const showDrivers = layer === 'all' || layer === 'drivers'

  return (
    <section className="flex min-w-0 flex-col rounded-xl bg-white p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Map layers" className="flex flex-wrap gap-1">
          {LAYERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={layer === id}
              onClick={() => setLayer(id)}
              className={`h-7 rounded-full px-3 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                layer === id ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-brand/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted">
          Illustrative map: positions are approximate, not GPS
        </p>
      </div>

      <div className="relative mt-3 flex-1 overflow-hidden rounded-lg bg-[#eef2f7]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full min-h-72 w-full"
          role="group"
          aria-label="Logistics map of branch, drivers, pickups and deliveries"
        >
          <g
            transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}
          >
            <path d="M0,330 C120,300 180,360 300,345 S480,360 600,380 L0,380 Z" fill="#dbeafe" />
            <g stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round">
              <path d="M-10,150 L610,215" />
              <path d="M150,-10 L240,390" />
              <path d="M430,-10 L380,390" />
              <path d="M-10,60 L610,20" />
              <path d="M-10,290 L610,250" />
            </g>

            {ZONES.map(({ name, x, y }) => (
              <text
                key={name}
                x={x}
                y={y - 40}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                letterSpacing="1"
                fill="#94a3b8"
              >
                {name.toUpperCase()}
              </text>
            ))}

            {showDrivers &&
              onMap
                .filter(({ status }) => status === 'onRoute')
                .map((driver) => {
                  const stops = jobs.filter(
                    (job) => job.driverId === driver.id && !isClosed(job),
                  )
                  return (
                    <polyline
                      key={driver.id}
                      points={[driver, ...stops].map(({ x, y }) => `${x},${y}`).join(' ')}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={driverId && driverId !== driver.id ? 0.15 : 0.55}
                    />
                  )
                })}

            <g>
              <rect x={DEPOT.x - 11} y={DEPOT.y - 11} width="22" height="22" rx="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
              <text x={DEPOT.x} y={DEPOT.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                H
              </text>
              <title>{DEPOT.name} (branch)</title>
            </g>

            {visibleJobs.map((job) => {
              const failed = job.status === 'failed'
              const delayed = getDelayMinutes(job, now) > 0
              const closed = job.status === 'done' || job.status === 'received'
              const label = `${job.type === 'pickup' ? 'Pickup' : 'Delivery'} ${job.id} for ${job.customer}${failed ? ', failed' : delayed ? ', delayed' : ''}`
              return (
                <g
                  key={job.id}
                  {...activate(() => onOpenJob(job.id))}
                  aria-label={label}
                  opacity={closed ? 0.45 : 1}
                  className="cursor-pointer outline-none focus-visible:[&>circle:first-of-type]:stroke-brand"
                >
                  {(failed || delayed) && (
                    <circle cx={job.x} cy={job.y} r="13" fill="none" stroke={failed ? DANGER : WARNING} strokeWidth="2" />
                  )}
                  <circle
                    cx={job.x}
                    cy={job.y}
                    r="8"
                    fill={failed ? DANGER : TYPE_COLORS[job.type]}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Arrow up = pickup, arrow down = delivery, cross = failed */}
                  <path
                    d={
                      failed
                        ? `M${job.x - 3},${job.y - 3} l6,6 M${job.x + 3},${job.y - 3} l-6,6`
                        : job.type === 'pickup'
                          ? `M${job.x},${job.y + 3.5} v-7 M${job.x - 3},${job.y - 0.5} l3,-3 l3,3`
                          : `M${job.x},${job.y - 3.5} v7 M${job.x - 3},${job.y + 0.5} l3,3 l3,-3`
                    }
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {job.priority === 'express' && !closed && (
                    <circle cx={job.x + 7} cy={job.y - 7} r="3.5" fill={DANGER} stroke="#fff" strokeWidth="1.5" />
                  )}
                  <title>{label}</title>
                </g>
              )
            })}

            {showDrivers &&
              onMap.map((driver) => (
                <g
                  key={driver.id}
                  {...activate(() => setDriverId(driver.id))}
                  aria-label={`Driver ${driver.name}`}
                  className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-brand"
                >
                  <circle
                    cx={driver.x}
                    cy={driver.y}
                    r="12"
                    fill="#0f172a"
                    stroke={driverId === driver.id ? '#2563eb' : '#fff'}
                    strokeWidth={driverId === driver.id ? 3 : 2}
                  />
                  <text
                    x={driver.x}
                    y={driver.y + 3.5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="800"
                    fill="#fff"
                  >
                    {getInitials(driver.name)}
                  </text>
                  <title>{driver.name}</title>
                </g>
              ))}
          </g>
        </svg>

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom(Math.min(2.2, zoom + 0.3))}
            aria-label="Zoom in"
            className={`${secondaryButton} size-8 px-0`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(Math.max(1, zoom - 0.3))}
            disabled={zoom === 1}
            aria-label="Zoom out"
            className={`${secondaryButton} size-8 px-0`}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        </div>

        {selectedDriver && (
          <div className="absolute inset-x-2 top-2 rounded-lg bg-white p-3 shadow-lg ring-1 ring-line max-sm:right-12 sm:right-auto sm:w-80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink">{selectedDriver.name}</p>
                <p className="text-[11px] text-muted">{selectedDriver.vehicle}</p>
              </div>
              <div className="flex items-center gap-1">
                <DriverStatusBadge status={selectedDriver.status} />
                <button
                  type="button"
                  onClick={() => setDriverId(null)}
                  aria-label="Close driver card"
                  className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-field hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {selectedDriver.routeId
                ? `Route #${selectedDriver.routeId} · ${selectedDriver.stopsDone} / ${selectedDriver.stopsTotal} stops done`
                : selectedDriver.note}
              {selectedDriver.etaMin !== null && ` · ETA ${selectedDriver.etaMin} min`}
            </p>
            {selectedDriver.stopsTotal > 0 && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand/15">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${(selectedDriver.stopsDone / selectedDriver.stopsTotal) * 100}%`,
                  }}
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onShowDriverJobs(selectedDriver.id)}
                className={`${secondaryButton} h-8`}
              >
                <Route className="size-3.5 text-muted" aria-hidden="true" />
                View Route
              </button>
              <a
                href={`tel:${selectedDriver.phone.replace(/[^\d+]/g, '')}`}
                className={`${secondaryButton} h-8`}
              >
                <Phone className="size-3.5 text-muted" aria-hidden="true" />
                Call
              </a>
              <button
                type="button"
                onClick={() => onAssignToDriver(selectedDriver.id)}
                className={`${primaryButton} h-8`}
              >
                <UserCog className="size-3.5" aria-hidden="true" />
                Assign Jobs
              </button>
            </div>
          </div>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS.pickup }} />
          Pickup (arrow up)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS.delivery }} />
          Delivery (arrow down)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink" />
          Driver
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand" />
          Branch
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full ring-2 ring-warning" />
          Delayed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-danger" />
          Failed / express dot
        </li>
      </ul>
    </section>
  )
}

export default LogisticsMap
