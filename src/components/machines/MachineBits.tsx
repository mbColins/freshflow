import { Thermometer, UserRound } from 'lucide-react'
import { MAINTENANCE_STATES, SEVERITIES } from '../../constants/machines'
import type { FaultSeverity, Machine, MachineJob, MachineStatus } from '../../types/machine'
import { getMachineStatus, getMachineType, getMaintenance } from '../../utils/machines'
import Badge from '../ui/Badge'

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  const { label, tone, icon: Icon } = getMachineStatus(status)
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: FaultSeverity }) {
  return <Badge tone={SEVERITIES.find(({ value }) => value === severity)!.tone}>{severity}</Badge>
}

const GLYPH_TONES: Partial<Record<MachineStatus, string>> = {
  fault: 'bg-danger/10 text-danger',
  maintenance: 'bg-warning/10 text-warning',
  offline: 'bg-field text-muted',
  retired: 'bg-field text-muted',
}

// Small equipment illustration; the operational data stays the focus
export function MachineGlyph({ machine, large = false }: { machine: Pick<Machine, 'type' | 'status'>; large?: boolean }) {
  const { icon: Icon } = getMachineType(machine.type)
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg ${large ? 'size-12' : 'size-9'} ${GLYPH_TONES[machine.status] ?? 'bg-brand/10 text-brand'}`}
    >
      <Icon className={large ? 'size-6' : 'size-5'} strokeWidth={1.75} />
    </span>
  )
}

export function MaintenanceBadge({ machine, now }: { machine: Machine; now: number }) {
  const { state, label } = getMaintenance(machine, now)
  if (machine.status === 'maintenance') return <Badge tone="warning">{label}</Badge>
  return <Badge tone={MAINTENANCE_STATES.find(({ value }) => value === state)!.tone}>{label}</Badge>
}

export function JobProgress({ job, compact = false }: { job: MachineJob; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-muted">{job.paused ? 'Paused' : job.cycle}</span>
        <span className="font-semibold whitespace-nowrap text-ink tabular-nums">
          {job.progress}% · {job.remainingMin} min left
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${job.orderId} progress`}
        aria-valuenow={job.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`mt-1 overflow-hidden rounded-full bg-field ${compact ? 'h-1.5' : 'h-2'}`}
      >
        <div className={`h-full rounded-full ${job.paused ? 'bg-warning' : 'bg-success'}`} style={{ width: `${job.progress}%` }} />
      </div>
    </div>
  )
}

export function JobFacts({ job }: { job: MachineJob }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
      {job.temperature !== null && (
        <span className="flex items-center gap-1">
          <Thermometer className="size-3" aria-hidden="true" />
          {job.temperature}°C
        </span>
      )}
      <span className="flex items-center gap-1">
        <UserRound className="size-3" aria-hidden="true" />
        {job.operator}
      </span>
    </p>
  )
}

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-field px-3 py-2">
      <p className="truncate text-[10px] font-semibold text-muted">{label}</p>
      <p className="truncate text-sm font-bold text-ink tabular-nums">{value}</p>
      {note && <p className="truncate text-[10px] text-muted">{note}</p>}
    </div>
  )
}

// Labelled 0–100 bar
export function Gauge({ label, value, display, tone = 'bg-brand' }: { label: string; value: number; display?: string; tone?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-bold text-ink tabular-nums">{display ?? `${value}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  )
}
