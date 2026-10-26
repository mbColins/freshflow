import { useState } from 'react'
import { Link } from 'react-router'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Cpu,
  Gauge,
  History,
  Package,
  ScanLine,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react'
import { DAILY_CAPACITY_KG, SERIES_COLORS, STAGES, SUPPLY_LOW_PCT, SUPPLY_WARN_PCT } from '../../constants/operations'
import useStaff from '../../hooks/useStaff'
import { useListInventoryItemsQuery } from '../../services/inventoryApi'
import type { OpsSummary } from '../../services/operationsApi'
import { MACHINE_TYPES } from '../../constants/machines'
import type { Branch } from '../../types/branch'
import type { Machine } from '../../types/machine'
import type { JobEvent, OpsJob, StageId } from '../../types/operations'
import { getMaintenance, getOpenFault } from '../../utils/machines'
import {
  formatMinutes,
  getBottlenecks,
  getCapacity,
  getDueMinutes,
  getHealth,
  getStage,
  getStaffLoad,
  isDelayed,
} from '../../utils/operations'
import { formatTime } from '../../utils/orders'
import { MachineStatusBadge } from '../machines/MachineBits'
import { primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'
import { ActionButton, DueLabel, StageState } from './OpsQueue'
import type { OpsActions } from './OpsQueue'

const HEALTH_TONES: Record<string, { tone: BadgeTone; text: string }> = {
  Good: { tone: 'success', text: 'text-success' },
  Warning: { tone: 'warning', text: 'text-warning' },
  Critical: { tone: 'danger', text: 'text-danger' },
}

// ---------- Capacity and health ----------

export function CapacityPanel({ jobs, machines, now }: { jobs: OpsJob[]; machines: Machine[]; now: number }) {
  const capacity = getCapacity(jobs)
  const down = machines.filter(({ status }) => status === 'fault' || status === 'maintenance' || status === 'offline').length
  const health = getHealth(jobs, down, now)
  const tones = HEALTH_TONES[health.level]
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <Panel
          title="Today’s Processing Capacity"
          icon={Gauge}
          badge={<Badge tone={capacity.percent >= 90 ? 'danger' : capacity.percent >= 75 ? 'warning' : 'brand'}>{capacity.percent.toFixed(1)}% used</Badge>}
        >
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink tabular-nums">{capacity.workload} kg</span>
            <span className="text-xs text-muted">of {DAILY_CAPACITY_KG} kg daily capacity</span>
          </p>
          <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-field" role="progressbar" aria-label="Capacity used" aria-valuenow={Math.round(capacity.percent)} aria-valuemin={0} aria-valuemax={100}>
            <span className="bg-success" style={{ width: `${(capacity.finished / DAILY_CAPACITY_KG) * 100}%` }} />
            <span className="bg-brand" style={{ width: `${(capacity.inProcess / DAILY_CAPACITY_KG) * 100}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ['Finished today', `${capacity.finished} kg`, 'bg-success'],
                ['In process', `${capacity.inProcess} kg`, 'bg-brand'],
                ['Remaining capacity', `${capacity.remaining} kg`, 'bg-field ring-1 ring-line'],
              ] as const
            ).map(([label, value, dot]) => (
              <div key={label} className="min-w-0 rounded-lg bg-field px-3 py-2">
                <dt className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-muted">
                  <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <Panel title="Operational Health" icon={Activity}>
        <p className={`text-2xl font-extrabold ${tones.text}`}>{health.level}</p>
        <p className="text-xs text-muted">{health.onSchedule}% of open orders are on schedule.</p>
        {health.reasons.length === 0 ? (
          <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Nothing is holding the floor back right now.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {health.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-xs text-ink">
                <TriangleAlert className={`mt-px size-3.5 shrink-0 ${tones.text}`} aria-hidden="true" />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ---------- My work (floor staff) ----------

export function MyWork({ jobs, name, onScan, ...actions }: { jobs: OpsJob[]; name: string; onScan: () => void } & OpsActions) {
  const { now, onOpen } = actions
  const mine = jobs.filter((job) => job.staff === name && job.stage !== 'ready')
  const current = mine.filter(({ active }) => active)
  const next = mine.filter(({ active }) => !active)
  return (
    <Panel
      title="My Work"
      subtitle={`${name} · ${current.length} in progress · ${next.length} up next`}
      action={
        <button type="button" onClick={onScan} className={`${primaryButton} h-11 px-4`}>
          <ScanLine className="size-5" aria-hidden="true" />
          Scan Order
        </button>
      }
    >
      {mine.length === 0 ? (
        <PanelEmpty>Nothing is assigned to you. Scan an order or pick one from the queue.</PanelEmpty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {[...current, ...next].map((job) => (
            <li key={job.id} className={`space-y-2 rounded-xl p-3 ring-1 ${job.active ? 'bg-brand/5 ring-brand/40' : 'bg-field ring-line'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button type="button" onClick={() => onOpen(job.id)} className="rounded-sm font-mono text-sm font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    #{job.id}
                  </button>
                  <p className="truncate text-xs font-semibold text-ink">{job.customer}</p>
                  <p className="text-[11px] text-muted">{job.items} items · {job.service} · {job.weightKg} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted uppercase">{job.active ? 'Current' : 'Next'}</p>
                  <p className="text-sm font-extrabold text-ink uppercase">{getStage(job.stage).verb}</p>
                </div>
              </div>
              <StageState job={job} now={now} />
              {job.instructions.length > 0 && (
                <ul className="space-y-0.5 rounded-lg bg-warning/15 px-3 py-2 text-xs font-semibold text-ink">
                  {job.instructions.map((line) => (
                    <li key={line} className="flex items-start gap-1.5">
                      <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px]"><DueLabel job={job} now={now} /></p>
              <ActionButton job={job} {...actions} className="h-11! w-full text-sm" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Machines ----------

const typeOrder = (machine: Machine) => MACHINE_TYPES.findIndex(({ value }) => value === machine.type)

export function MachineStrip({ machines, now }: { machines: Machine[]; now: number }) {
  const shown = [...machines]
    // Faults first, then in floor order: washers, dryers, finishing
    .sort((a, b) => Number(b.status === 'fault') - Number(a.status === 'fault') || typeOrder(a) - typeOrder(b) || a.id.localeCompare(b.id))
    .slice(0, 8)
  return (
    <Panel
      title="Machine Status"
      subtitle={`${machines.filter(({ status }) => status === 'running').length} running · ${machines.filter(({ status }) => status === 'available').length} available · ${machines.filter(({ status }) => status === 'fault' || status === 'maintenance').length} out of service`}
      icon={Cpu}
      action={
        <Link to="/machines" className={secondaryButton}>
          View Machines
          <ArrowUpRight className="size-3.5 text-muted" aria-hidden="true" />
        </Link>
      }
    >
      {shown.length === 0 ? (
        <PanelEmpty>No machines are registered for this branch.</PanelEmpty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((machine) => {
            const fault = getOpenFault(machine)
            return (
              <li key={machine.id} className={`min-w-0 space-y-1.5 rounded-lg p-3 ${machine.status === 'fault' ? 'bg-danger/10' : 'bg-field'}`}>
                <p className="flex items-center justify-between gap-2">
                  <Link to={`/machines/${machine.id}`} className="truncate rounded-sm text-xs font-bold text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    {machine.name}
                  </Link>
                  <MachineStatusBadge status={machine.status} />
                </p>
                {machine.job ? (
                  <>
                    <p className="truncate text-[11px] text-muted">
                      <span className="font-mono font-semibold text-brand">#{machine.job.orderId}</span> · {machine.job.loadKg} / {machine.specs.capacityKg} kg
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${machine.name} cycle progress`} aria-valuenow={machine.job.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-success" style={{ width: `${machine.job.progress}%` }} />
                    </div>
                    <p className="text-[11px] text-muted tabular-nums">{machine.job.progress}% · {machine.job.remainingMin} min left</p>
                  </>
                ) : (
                  <p className="line-clamp-2 text-[11px] text-muted">
                    {fault ? `${fault.type}: ${fault.description}` : machine.status === 'maintenance' ? machine.statusNote || 'Being serviced' : `Ready · ${machine.specs.capacityKg} kg capacity`}
                  </p>
                )}
                <p className="flex items-center justify-between gap-2 text-[10px] text-muted">
                  <span>Utilization {machine.utilization}%</span>
                  <span>{getMaintenance(machine, now).label}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )}
      {machines.length > shown.length && <p className="mt-2 text-[11px] text-muted">Showing {shown.length} of {machines.length} machines at this branch.</p>}
    </Panel>
  )
}

// ---------- Staff and bottlenecks ----------

export function StaffWorkload({ jobs, selected, onSelect }: { jobs: OpsJob[]; selected: string; onSelect: (name: string) => void }) {
  const staff = getStaffLoad(jobs, useStaff().map(({ name }) => name))
  return (
    <Panel title="Staff Workload" subtitle="Click a name to show their jobs" icon={Users}>
      <ul className="space-y-2">
        {staff.map(({ name, activeJobs, completed, stage, load }) => (
          <li key={name}>
            <button
              type="button"
              aria-pressed={selected === name}
              onClick={() => onSelect(selected === name ? '' : name)}
              className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${selected === name ? 'bg-brand/10 ring-1 ring-brand' : 'bg-field hover:bg-line'}`}
            >
              <span className="min-w-0">
                <span className="font-bold text-ink">{name}</span>
                <span className="ml-2 text-[11px] text-muted">{activeJobs} active · {completed} done · {stage}</span>
              </span>
              <Badge tone={load >= 85 ? 'danger' : load === 0 ? 'neutral' : 'success'}>{load >= 85 ? 'Busy' : load === 0 ? 'Available' : 'Active'}</Badge>
              <span className="col-span-2 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                  <span className={`block h-full rounded-full ${load >= 85 ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${load}%` }} />
                </span>
                <span className="w-8 text-right text-[11px] font-semibold text-ink tabular-nums">{load}%</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function BottleneckPanel({ jobs, now, onStage }: { jobs: OpsJob[]; now: number; onStage: (stage: StageId) => void }) {
  const bottlenecks = getBottlenecks(jobs, now)
  return (
    <Panel title="Operational Bottlenecks" subtitle="Stages where loads are waiting for a free machine or person" icon={TriangleAlert}>
      {bottlenecks.length === 0 ? (
        <PanelEmpty>No stage is backing up. Work is flowing.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {bottlenecks.map((stage, index) => (
            <li key={stage.id} className={`rounded-lg p-3 text-xs ${index === 0 ? 'bg-warning/15 ring-1 ring-warning/40' : 'bg-field'}`}>
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">{stage.label}</span>
                <Badge tone={index === 0 ? 'warning' : 'neutral'}>{index === 0 ? 'Biggest bottleneck' : 'Attention'}</Badge>
              </p>
              <p className="mt-1 text-muted">
                {stage.waiting} loads waiting · average wait {formatMinutes(stage.averageWait)} · {stage.active} running
              </p>
              <p className="mt-1 text-ink">
                <span className="font-semibold">Next:</span>{' '}
                {stage.machineType ? `start the waiting loads as ${stage.machineType.toLowerCase()}s come free, or bring another one into service.` : 'assign another person to this station.'}
              </p>
              <button type="button" onClick={() => onStage(stage.id)} className={`${secondaryButton} mt-2 h-7`}>
                Show {stage.label} queue
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Delayed and express ----------

export function AttentionPanel({ jobs, ...actions }: { jobs: OpsJob[] } & OpsActions) {
  const { now, permissions, onOpen, onAssign } = actions
  const delayed = jobs.filter((job) => isDelayed(job, now)).sort((a, b) => getDueMinutes(a, now) - getDueMinutes(b, now))
  const express = jobs
    .filter((job) => job.priority === 'Express' && job.stage !== 'ready' && !isDelayed(job, now))
    .sort((a, b) => getDueMinutes(a, now) - getDueMinutes(b, now))
    .slice(0, 5)
  const row = (job: OpsJob) => (
    <li key={job.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs">
      <button type="button" onClick={() => onOpen(job.id)} className="rounded-sm font-mono font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
        #{job.id}
      </button>
      <span className="min-w-0 flex-1 text-muted">
        <span className="font-semibold text-ink">{getStage(job.stage).label}</span> · {job.staff || 'Unassigned'}
      </span>
      <span className="text-[11px]"><DueLabel job={job} now={now} /></span>
      {permissions.manage && (
        <button type="button" onClick={() => onAssign(job.id)} className={`${secondaryButton} h-7`}>
          Reassign
        </button>
      )}
    </li>
  )
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Delayed Jobs" badge={delayed.length > 0 && <Badge tone="danger">{delayed.length}</Badge>} subtitle="Past the time promised to the customer, most overdue first">
        {delayed.length === 0 ? <PanelEmpty>Every open order is still on time.</PanelEmpty> : <ul className="space-y-1.5">{delayed.map(row)}</ul>}
      </Panel>
      <Panel title="Express Queue" icon={Zap} badge={express.length > 0 && <Badge tone="warning">{express.length}</Badge>} subtitle="Express orders still on time, soonest due first">
        {express.length === 0 ? <PanelEmpty>No express orders are in progress.</PanelEmpty> : <ul className="space-y-1.5">{express.map(row)}</ul>}
      </Panel>
    </div>
  )
}

// ---------- Supplies and maintenance ----------

// Stock levels the floor works from: the items closest to running out
const SUPPLY_ITEMS = { page: 0, size: 200 }

export function SuppliesPanel({ machines, now }: { machines: Machine[]; now: number }) {
  const { data: stock = [] } = useListInventoryItemsQuery(SUPPLY_ITEMS)
  const SUPPLIES = stock
    .filter(({ max }) => max > 0)
    .map(({ id, name, stock: held, reserved, max, unit }) => ({
      name,
      key: id,
      remaining: Math.max(0, Math.min(100, Math.round(((held - reserved) / max) * 100))),
      note: `${Math.max(0, held - reserved)} ${unit} available`,
    }))
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 5)
  const due = machines
    .map((machine) => ({ machine, ...getMaintenance(machine, now) }))
    .filter(({ days, machine }) => machine.status !== 'retired' && (days <= 7 || machine.status === 'maintenance'))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Operational Supplies"
        icon={Package}
        action={
          <Link to="/inventory" className={secondaryButton}>
            View Inventory
          </Link>
        }
      >
        <ul className="space-y-3">
          {SUPPLIES.length === 0 && <li className="text-xs text-muted">No stock is tracked yet.</li>}
          {SUPPLIES.map(({ name, key, remaining, note }) => {
            const low = remaining <= SUPPLY_LOW_PCT
            const warn = remaining <= SUPPLY_WARN_PCT
            return (
              <li key={key}>
                <p className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">{name}</span>
                  <span className={`font-bold tabular-nums ${low ? 'text-danger' : warn ? 'text-warning' : 'text-ink'}`}>
                    {remaining}% {(low || warn) && <span className="font-semibold">· {note}</span>}
                  </span>
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
                  <div className={`h-full rounded-full ${low ? 'bg-danger' : warn ? 'bg-warning' : 'bg-success'}`} style={{ width: `${remaining}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[10px] text-muted">Available stock against each item’s maximum, from Inventory.</p>
      </Panel>
      <Panel
        title="Maintenance"
        subtitle="In progress, overdue and due within 7 days"
        action={
          <Link to="/machines" className={secondaryButton}>
            View Maintenance
          </Link>
        }
      >
        {due.length === 0 ? (
          <PanelEmpty>All machines are operating normally.</PanelEmpty>
        ) : (
          <ul className="space-y-1.5">
            {due.map(({ machine, state, label }) => (
              <li key={machine.id} className="flex items-center justify-between gap-3 rounded-lg bg-field px-3 py-2 text-xs">
                <Link to={`/machines/${machine.id}?tab=maintenance`} className="rounded-sm font-semibold text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  {machine.name}
                </Link>
                <Badge tone={machine.status === 'maintenance' ? 'warning' : state === 'overdue' ? 'danger' : 'warning'}>{label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ---------- Analytics ----------

export function OpsAnalytics({ jobs, summary }: { jobs: OpsJob[]; summary: OpsSummary | undefined }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  // Averages of the stage logs closed in the last 7 days, and today's kilograms in two-hour blocks
  const ACTUAL_STAGE_MINUTES: Partial<Record<string, number>> = Object.fromEntries(
    (summary?.stages ?? []).flatMap(({ stage, avgMinutes }) => (avgMinutes === null ? [] : [[stage, avgMinutes]])),
  )
  const HOURLY_PRODUCTION: [string, number][] = (summary?.kgByBlock ?? []).map(({ from, to, kg }) => [`${from.slice(0, 2)}–${to.slice(0, 2)}`, kg])
  const stages = STAGES.filter(({ id }) => ACTUAL_STAGE_MINUTES[id] !== undefined && STAGES.find((stage) => stage.id === id)!.expectedMin > 0)
  const top = Math.max(1, ...stages.map(({ id, expectedMin }) => Math.max(expectedMin, ACTUAL_STAGE_MINUTES[id]!)))
  const topKg = Math.max(1, ...HOURLY_PRODUCTION.map(([, kg]) => kg))
  const inspected = jobs.filter(({ stage }) => stage === 'packaging' || stage === 'ready').length
  const failures = jobs.reduce((sum, job) => sum + job.qcFailures, 0)
  const metrics: [string, string][] = [
    ['Quality pass rate', inspected + failures ? `${((inspected / (inspected + failures)) * 100).toFixed(1)}%` : '—'],
    ['Reprocessed today', String(failures)],
    ['Kg finished today', `${HOURLY_PRODUCTION.reduce((sum, [, kg]) => sum + kg, 0)} kg`],
    ['Slowest stage vs plan', (() => {
      const worst = [...stages].sort((a, b) => ACTUAL_STAGE_MINUTES[b.id]! / b.expectedMin - ACTUAL_STAGE_MINUTES[a.id]! / a.expectedMin)[0]
      return worst ? `${worst.label} ${ACTUAL_STAGE_MINUTES[worst.id]! >= worst.expectedMin ? '+' : '−'}${Math.abs(ACTUAL_STAGE_MINUTES[worst.id]! - worst.expectedMin)} min` : '—'
    })()],
  ]
  return (
    <section className="rounded-xl bg-white ring-1 ring-line">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-bold text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <BarChart3 className="size-4 text-brand" aria-hidden="true" />
          Performance Analytics
          <span className="text-[11px] font-normal text-muted">Processing times and daily production</span>
          <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <div className="space-y-4 border-t border-line p-4">
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-field px-3 py-2">
                <dt className="truncate text-[10px] font-semibold text-muted">{label}</dt>
                <dd className="truncate text-sm font-bold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="relative">
              <figcaption className="text-xs font-bold text-ink">Expected vs actual time per stage (minutes, last 7 days)</figcaption>
              <ul className="mt-3 space-y-3">
                {stages.map(({ id, label, expectedMin }) => {
                  const actual = ACTUAL_STAGE_MINUTES[id]!
                  return (
                    <li key={id} className="relative grid grid-cols-[7rem_1fr] items-center gap-2 text-xs" onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover(null)}>
                      <span className="truncate text-muted">{label}</span>
                      <span className="space-y-0.5">
                        {(
                          [
                            [expectedMin, SERIES_COLORS.expected],
                            [actual, SERIES_COLORS.actual],
                          ] as const
                        ).map(([value, color]) => (
                          <span key={color} className="flex items-center gap-2">
                            <span className="h-2.5 rounded-r" style={{ width: `${(value / top) * 85}%`, background: color }} />
                            <span className="text-[11px] font-semibold text-ink tabular-nums">{value}</span>
                          </span>
                        ))}
                      </span>
                      {hover === id && (
                        <span className="pointer-events-none absolute -top-2 right-0 z-10 rounded-md bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lg">
                          {label}: expected {expectedMin} min, actual {actual} min ({actual >= expectedMin ? '+' : '−'}{Math.abs(actual - expectedMin)})
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 flex gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_COLORS.expected }} aria-hidden="true" />Expected</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_COLORS.actual }} aria-hidden="true" />Actual</span>
              </p>
            </figure>
            <figure>
              <figcaption className="text-xs font-bold text-ink">Laundry finished today (kg per two hours)</figcaption>
              <ul className="mt-3 space-y-2">
                {HOURLY_PRODUCTION.map(([hour, kg]) => (
                  <li key={hour} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-xs" title={`${hour}: ${kg} kg`}>
                    <span className="text-muted tabular-nums">{hour}</span>
                    <span className="h-4 rounded-sm bg-field">
                      <span className="block h-full rounded-r" style={{ width: `${(kg / topKg) * 100}%`, background: SERIES_COLORS.expected }} />
                    </span>
                    <span className="text-right font-bold text-ink tabular-nums">{kg} kg</span>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
          <p className="text-[10px] text-muted">Stage averages cover the last 7 days. Production counts jobs that reached Ready today.</p>
        </div>
      )}
    </section>
  )
}

// ---------- Timeline and branches ----------

export function FloorTimeline({ events }: { events: JobEvent[] }) {
  return (
    <Panel title="Today’s Timeline" subtitle="Latest floor activity, newest first" icon={History}>
      {events.length === 0 ? (
        <PanelEmpty>No activity recorded yet today.</PanelEmpty>
      ) : (
        <ol className="max-h-72 space-y-3 overflow-y-auto border-l border-line pl-4">
          {events.map((event, index) => (
            <li key={`${event.at}-${index}`} className="relative text-xs">
              <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden="true" />
              <p className="font-semibold text-ink">
                <span className="mr-2 font-normal text-muted tabular-nums">{formatTime(event.at)}</span>
                {event.text}
              </p>
              <p className="text-[11px] text-muted">{event.by}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function BranchWorkload({ branches, currentId }: { branches: Branch[]; currentId: string }) {
  const rows = branches
    .filter(({ status }) => status === 'active' || status === 'maintenance')
    .map((branch) => ({
      branch,
      load: branch.capacity.dailyOrders > 0 ? Math.round((branch.stats.ordersToday / branch.capacity.dailyOrders) * 100) : 0,
    }))
    .sort((a, b) => b.load - a.load)
  return (
    <Panel title="Branch Workload" subtitle="Orders today against each branch’s daily order capacity">
      <ul className="space-y-2.5">
        {rows.map(({ branch, load }) => (
          <li key={branch.id}>
            <p className="flex items-baseline justify-between gap-2 text-xs">
              <Link to={`/branches/${branch.id}`} className="rounded-sm font-semibold text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                {branch.name}
                {branch.id === currentId && <span className="ml-1.5 font-normal text-muted">(this page)</span>}
              </Link>
              <span className="tabular-nums">
                <span className="text-muted">{branch.stats.ordersToday} / {branch.capacity.dailyOrders} orders · {branch.stats.overdue} overdue · </span>
                <span className={`font-bold ${load >= 90 ? 'text-danger' : load >= 75 ? 'text-warning' : 'text-ink'}`}>{load}%</span>
              </span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
              <div className={`h-full rounded-full ${load >= 90 ? 'bg-danger' : load >= 75 ? 'bg-warning' : 'bg-brand'}`} style={{ width: `${Math.min(load, 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
