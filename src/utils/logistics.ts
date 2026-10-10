import {
  CLOSED_STATUSES,
  DELAY_GRACE_MIN,
  DELIVERY_PRICING,
  DEPOT,
  JOB_STATUSES,
  READY_TOO_LONG_MIN,
  STATUS_LABELS,
  ZONES,
} from '../constants/logistics'
import type {
  DispatchJob,
  JobPriority,
  JobStatus,
  JobType,
  LogisticsFilters,
} from '../types/logistics'

const MINUTE_MS = 60_000

export function getJobStatusLabel(job: Pick<DispatchJob, 'status' | 'type'>) {
  return STATUS_LABELS[job.status][job.type]
}

export function getStatusTone(status: JobStatus) {
  return JOB_STATUSES.find(({ id }) => id === status)!.tone
}

export function isClosed(job: DispatchJob) {
  return CLOSED_STATUSES.includes(job.status)
}

// Minutes past the scheduled time, or 0 when the job is on time or already closed
export function getDelayMinutes(job: DispatchJob, now: number) {
  if (isClosed(job)) return 0
  const late = Math.floor((now - new Date(job.scheduledAt).getTime()) / MINUTE_MS)
  return late > DELAY_GRACE_MIN ? late : 0
}

// Minutes a finished order has been waiting at the branch without a driver on the way
export function getReadyMinutes(job: DispatchJob, now: number) {
  if (job.type !== 'delivery' || !job.readyAt) return 0
  if (!['requested', 'scheduled', 'assigned'].includes(job.status)) return 0
  return Math.max(0, Math.floor((now - new Date(job.readyAt).getTime()) / MINUTE_MS))
}

export function isWaitingTooLong(job: DispatchJob, now: number) {
  return getReadyMinutes(job, now) >= READY_TOO_LONG_MIN
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = Math.abs(minutes % 60)
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function matchesLogisticsFilters(
  job: DispatchJob,
  filters: LogisticsFilters,
  now: number,
  driverName: string,
) {
  const needle = filters.query.trim().toLowerCase().replace(/^#/, '')
  if (
    needle &&
    ![job.id, job.orderId, job.customer, job.phone, job.address, job.zone, driverName].some(
      (field) => field.toLowerCase().includes(needle),
    )
  ) {
    return false
  }
  if (filters.type && job.type !== filters.type) return false
  if (filters.status && job.status !== filters.status) return false
  if (filters.zone && job.zone !== filters.zone) return false
  if (filters.priority && job.priority !== filters.priority) return false
  if (filters.driverId && job.driverId !== filters.driverId) return false

  switch (filters.view) {
    case 'active':
      return job.status === 'enRoute' || job.status === 'arrived'
    case 'delayed':
      return getDelayMinutes(job, now) > 0
    case 'failed':
      return job.status === 'failed'
    case 'completed':
      return job.status === 'done' || job.status === 'received'
    case 'ready':
      return job.type === 'delivery' && job.status === 'requested'
    case 'unassigned':
      return !isClosed(job) && job.driverId === null
    default:
      return true
  }
}

export function estimateFee(zone: string, type: JobType, priority: JobPriority) {
  const base =
    type === 'pickup'
      ? DELIVERY_PRICING.pickupFee
      : (ZONES.find(({ name }) => name === zone)?.fee ?? 0)
  return base + (priority === 'express' ? DELIVERY_PRICING.expressSurcharge : 0)
}

type Point = { x: number; y: number }
// The illustrative map is not to scale; this turns its units into rough kilometres
const KM_PER_UNIT = 0.035
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// Express stops first, then nearest-neighbour from the depot
export function optimizeStops(stops: DispatchJob[]) {
  const ordered: DispatchJob[] = []
  for (const group of [
    stops.filter(({ priority }) => priority === 'express'),
    stops.filter(({ priority }) => priority !== 'express'),
  ]) {
    const remaining = [...group]
    while (remaining.length > 0) {
      const from: Point = ordered[ordered.length - 1] ?? DEPOT
      remaining.sort((a, b) => distance(from, a) - distance(from, b))
      ordered.push(remaining.shift()!)
    }
  }
  return ordered
}

export function getRouteSummary(stops: DispatchJob[]) {
  const points: Point[] = [DEPOT, ...stops, DEPOT]
  const units = points
    .slice(1)
    .reduce((sum, point, index) => sum + distance(points[index], point), 0)
  const km = stops.length === 0 ? 0 : units * KM_PER_UNIT
  return {
    km: Math.round(km * 10) / 10,
    // 22 km/h city average plus six minutes per stop
    minutes: Math.round((km / 22) * 60 + stops.length * 6),
    express: stops.filter(({ priority }) => priority === 'express').length,
  }
}

export function jobsToCsv(
  jobs: DispatchJob[],
  driverName: (id: string | null) => string,
) {
  const columns: [string, (job: DispatchJob) => string | number][] = [
    ['Dispatch ID', (job) => job.id],
    ['Type', (job) => job.type],
    ['Order', (job) => job.orderId],
    ['Customer', (job) => job.customer],
    ['Phone', (job) => job.phone],
    ['Address', (job) => `${job.address}, ${job.zone}`],
    ['Driver', (job) => driverName(job.driverId)],
    ['Scheduled', (job) => new Date(job.scheduledAt).toLocaleString('en-GB')],
    ['Distance (km)', (job) => job.distanceKm],
    ['Priority', (job) => job.priority],
    ['Payment', (job) => job.payment],
    ['Status', getJobStatusLabel],
  ]
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map(([header]) => escape(header)).join(','),
    ...jobs.map((job) => columns.map(([, read]) => escape(read(job))).join(',')),
  ].join('\r\n')
}
