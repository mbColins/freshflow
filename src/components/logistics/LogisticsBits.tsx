import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Zap,
} from 'lucide-react'
import { DRIVER_STATUSES, PRIORITIES, TYPE_COLORS } from '../../constants/logistics'
import type {
  DispatchJob,
  Driver,
  DriverStatus,
} from '../../types/logistics'
import { getInitials } from '../../utils/customers'
import {
  formatMinutes,
  getDelayMinutes,
  getJobStatusLabel,
  getStatusTone,
} from '../../utils/logistics'
import Badge from '../ui/Badge'

export function JobTypeIcon({ job }: { job: Pick<DispatchJob, 'type'> }) {
  const Icon = job.type === 'pickup' ? ArrowUpFromLine : ArrowDownToLine
  return (
    <span
      title={job.type === 'pickup' ? 'Pickup' : 'Delivery'}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
      style={{ backgroundColor: TYPE_COLORS[job.type] }}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{job.type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
    </span>
  )
}

export function JobStatusBadge({ job, now }: { job: DispatchJob; now: number }) {
  const delay = getDelayMinutes(job, now)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={getStatusTone(job.status)}>{getJobStatusLabel(job)}</Badge>
      {delay > 0 && (
        <Badge tone="warning">
          <Clock className="size-3" aria-hidden="true" />
          {formatMinutes(delay)} late
        </Badge>
      )}
    </span>
  )
}

export function JobPriorityBadge({ job }: { job: DispatchJob }) {
  const { label, tone } = PRIORITIES.find(({ id }) => id === job.priority)!
  if (job.priority !== 'express') {
    return <span className="text-[11px] text-muted">{label}</span>
  }
  return (
    <Badge tone={tone}>
      <Zap className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

const DRIVER_DOT: Record<DriverStatus, string> = {
  available: 'bg-success',
  onRoute: 'bg-brand',
  break: 'bg-warning',
  offline: 'bg-muted/50',
}

export function DriverAvatar({ driver }: { driver: Driver }) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
      {getInitials(driver.name)}
      <span
        className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white ${DRIVER_DOT[driver.status]}`}
      />
    </span>
  )
}

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const { label, tone } = DRIVER_STATUSES.find(({ id }) => id === status)!
  return <Badge tone={tone}>{label}</Badge>
}
