import { useState } from 'react'
import type { DragEvent, RefObject } from 'react'
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Hourglass,
  PackageCheck,
  RotateCcw,
  Search,
  Timer,
  TriangleAlert,
  UserPlus,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { STAGES } from '../../constants/operations'
import useStaff from '../../hooks/useStaff'
import type { OpsPermissions } from '../../constants/operations'
import type { OpsFilters, OpsJob, StageId } from '../../types/operations'
import {
  formatMinutes,
  getDueMinutes,
  getNextAction,
  getProgress,
  getStage,
  getStageMinutes,
  getStageStats,
  hasCountMismatch,
  isDelayed,
  isRunningLong,
} from '../../utils/operations'
import { formatTime } from '../../utils/orders'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Panel from '../ui/Panel'

export type OpsActions = {
  now: number
  permissions: OpsPermissions
  onOpen: (id: string) => void
  // Runs the job's next step, asking for a machine or an inspection where needed
  onAction: (id: string) => void
  onAssign: (id: string) => void
}

// ---------- Small pieces ----------

export function DueLabel({ job, now }: { job: OpsJob; now: number }) {
  const minutes = getDueMinutes(job, now)
  if (job.stage === 'ready') return <span className="text-muted">Due {formatTime(job.dueAt)}</span>
  if (minutes < 0) return <span className="font-bold text-danger">{formatMinutes(minutes)} late</span>
  return (
    <span className={minutes <= 60 ? 'font-semibold text-warning' : 'text-muted'}>
      {formatTime(job.dueAt)} · in {formatMinutes(minutes)}
    </span>
  )
}

export function JobFlags({ job, now }: { job: OpsJob; now: number }) {
  return (
    <>
      {job.priority === 'Express' && (
        <Badge tone="warning">
          <Zap className="size-3" aria-hidden="true" />
          Express
        </Badge>
      )}
      {isDelayed(job, now) && <Badge tone="danger">Delayed</Badge>}
      {job.instructions.length > 0 && (
        <Badge tone="brand">
          <TriangleAlert className="size-3" aria-hidden="true" />
          Special handling
        </Badge>
      )}
      {hasCountMismatch(job) && <Badge tone="danger">Count mismatch</Badge>}
      {job.qcFailures > 0 && <Badge tone="neutral">Reprocessed</Badge>}
    </>
  )
}

export function StageState({ job, now }: { job: OpsJob; now: number }) {
  const progress = getProgress(job, now)
  const stage = getStage(job.stage)
  if (job.stage === 'ready') {
    return <span className="text-[11px] text-muted">Ready for {job.method.toLowerCase()} · {formatMinutes(getStageMinutes(job, now))}</span>
  }
  if (!progress) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <Hourglass className="size-3" aria-hidden="true" />
        Waiting {formatMinutes(getStageMinutes(job, now))}
      </span>
    )
  }
  const long = isRunningLong(job, now)
  return (
    <div className="min-w-28">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-muted">{job.machine || stage.verb}</span>
        <span className={`font-semibold tabular-nums ${long ? 'text-danger' : 'text-ink'}`}>
          {progress.over > 0 ? `${progress.over} min over` : `${progress.remaining} min left`}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field" role="progressbar" aria-label={`${job.id} ${stage.label} progress`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${long ? 'bg-danger' : 'bg-success'}`} style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  )
}

export function ActionButton({ job, permissions, onAction, className = '' }: { job: OpsJob; className?: string } & Pick<OpsActions, 'permissions' | 'onAction'>) {
  const action = getNextAction(job)
  if (action.kind === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        {action.label}
      </span>
    )
  }
  if (!permissions.process) return null
  return (
    <button type="button" onClick={() => onAction(job.id)} className={`${action.kind === 'complete' || action.kind === 'inspect' ? primaryButton : secondaryButton} h-8 whitespace-nowrap ${className}`}>
      {action.label}
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </button>
  )
}

// ---------- KPI cards ----------

export function OpsKpis({
  jobs,
  now,
  filters,
  onFilter,
}: {
  jobs: OpsJob[]
  now: number
  filters: OpsFilters
  onFilter: (patch: Pick<OpsFilters, 'stage' | 'view'>) => void
}) {
  const inStage = (stage: StageId) => jobs.filter((job) => job.stage === stage).length
  const open = jobs.filter(({ stage }) => stage !== 'ready')
  const cards: { label: string; value: number; note: string; icon: LucideIcon; tone: string; patch: Pick<OpsFilters, 'stage' | 'view'> }[] = [
    { label: 'Active Orders', value: open.length, note: 'Being processed', icon: Timer, tone: 'text-brand', patch: { stage: '', view: '' } },
    { label: 'Waiting', value: open.filter(({ active }) => !active).length, note: 'Awaiting a next step', icon: Hourglass, tone: 'text-muted', patch: { stage: '', view: 'waiting' } },
    { label: 'Washing', value: inStage('washing'), note: 'Running and queued', icon: Timer, tone: 'text-brand', patch: { stage: 'washing', view: '' } },
    { label: 'Drying', value: inStage('drying'), note: 'Running and queued', icon: Timer, tone: 'text-warning', patch: { stage: 'drying', view: '' } },
    { label: 'Ironing / Folding', value: inStage('ironing'), note: 'On the finishing line', icon: Timer, tone: 'text-brand', patch: { stage: 'ironing', view: '' } },
    { label: 'Quality Control', value: inStage('qc'), note: 'Waiting for inspection', icon: CircleCheck, tone: 'text-brand', patch: { stage: 'qc', view: '' } },
    { label: 'Ready', value: inStage('ready'), note: 'For pickup or delivery', icon: PackageCheck, tone: 'text-success', patch: { stage: 'ready', view: '' } },
    { label: 'Delayed', value: jobs.filter((job) => isDelayed(job, now)).length, note: 'Past their due time', icon: Clock, tone: 'text-danger', patch: { stage: '', view: 'delayed' } },
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, value, note, icon: Icon, tone, patch }) => {
        const selected = filters.stage === patch.stage && filters.view === patch.view && (patch.stage !== '' || patch.view !== '')
        return (
          <li key={label} className="min-w-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onFilter(selected ? { stage: '', view: '' } : patch)}
              className={`block h-full w-full rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${selected ? 'ring-2 ring-brand' : 'ring-line'}`}
            >
              <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
                <span className="truncate">{label}</span>
                <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
              </span>
              <span className={`mt-1 block text-xl font-bold tabular-nums ${label === 'Delayed' && value > 0 ? 'text-danger' : 'text-ink'}`}>{value}</span>
              <span className="block truncate text-[11px] text-muted">{note}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Pipeline ----------

export function Pipeline({ jobs, now, selected, onSelect }: { jobs: OpsJob[]; now: number; selected: StageId | ''; onSelect: (stage: StageId | '') => void }) {
  const stats = getStageStats(jobs, now)
  return (
    <Panel title="Processing Pipeline" subtitle="Click a stage to show its jobs. Each stage shows what is running and what is waiting.">
      <div className="relative overflow-x-auto pb-1">
        <ol className="flex min-w-max items-stretch gap-1">
          {stats.map((stage, index) => {
            const active = selected === stage.id
            const stuck = stage.id !== 'received' && stage.id !== 'ready' && stage.waiting >= 3
            return (
              <li key={stage.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? '' : stage.id)}
                  className={`w-36 rounded-lg p-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                    active ? 'bg-brand/10 ring-2 ring-brand' : stuck ? 'bg-warning/10 ring-1 ring-warning/40 hover:ring-warning' : 'bg-field hover:bg-line'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted tabular-nums">
                      <span className={`size-2 rounded-full ${stage.dot}`} aria-hidden="true" />
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-lg leading-none font-extrabold text-ink tabular-nums">{stage.jobs}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-ink">{stage.label}</span>
                  <span className="block text-[10px] text-muted tabular-nums">
                    {stage.items} items · {stage.kg} kg
                  </span>
                  <span className={`mt-1 block text-[10px] font-semibold ${stuck ? 'text-warning' : 'text-muted'}`}>
                    {stage.id === 'received'
                      ? `${stage.waiting} to sort`
                      : stage.id === 'ready'
                        ? `${stage.jobs} to hand over`
                        : `${stage.active} running · ${stage.waiting} waiting`}
                  </span>
                  <span className="block text-[10px] text-muted">
                    {stage.waiting > 0 ? `Longest wait ${formatMinutes(stage.longestWait)}` : stage.expectedMin ? `About ${stage.expectedMin} min each` : 'No queue'}
                  </span>
                </button>
                {index < stats.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      </div>
    </Panel>
  )
}

// ---------- Filters ----------

export function OpsToolbar({
  searchRef,
  filters,
  services,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: OpsFilters
  services: string[]
  filtersActive: boolean
  onChange: (patch: Partial<OpsFilters>) => void
  onReset: () => void
}) {
  const staffNames = useStaff().map(({ name }) => name)
  const select = `${fieldClass} w-auto! max-sm:flex-1`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input ref={searchRef} type="search" aria-label="Search jobs" placeholder="Search order, customer, staff, machine..." value={filters.query} onChange={(event) => onChange({ query: event.target.value })} className={`${fieldClass} pl-9`} />
      </div>
      <select aria-label="Stage" value={filters.stage} onChange={(event) => onChange({ stage: event.target.value as OpsFilters['stage'] })} className={select}>
        <option value="">All stages</option>
        {STAGES.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
      <select aria-label="Quick view" value={filters.view} onChange={(event) => onChange({ view: event.target.value as OpsFilters['view'] })} className={select}>
        <option value="">All jobs</option>
        <option value="delayed">Delayed</option>
        <option value="express">Express</option>
        <option value="waiting">Waiting</option>
        <option value="special">Special handling</option>
      </select>
      <select aria-label="Staff" value={filters.staff} onChange={(event) => onChange({ staff: event.target.value })} className={select}>
        <option value="">All staff</option>
        {staffNames.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <select aria-label="Service" value={filters.service} onChange={(event) => onChange({ service: event.target.value })} className={select}>
        <option value="">All services</option>
        {services.map((service) => (
          <option key={service}>{service}</option>
        ))}
      </select>
      <select aria-label="Hand-over" value={filters.method} onChange={(event) => onChange({ method: event.target.value as OpsFilters['method'] })} className={select}>
        <option value="">Pickup and delivery</option>
        <option value="Pickup">Customer pickup</option>
        <option value="Delivery">Delivery</option>
      </select>
      {filtersActive && (
        <button type="button" onClick={onReset} className={secondaryButton}>
          <RotateCcw className="size-3.5 text-muted" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  )
}

// ---------- Table ----------

export function QueueTable({ jobs, ...actions }: { jobs: OpsJob[] } & OpsActions) {
  const { now, permissions, onOpen, onAssign } = actions
  return (
    <div className="relative overflow-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[1040px] text-left text-xs">
        <thead className="bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
          <tr>
            <th scope="col" className="px-3 py-2.5">Order</th>
            <th scope="col" className="px-3 py-2.5">Customer & service</th>
            <th scope="col" className="px-3 py-2.5 text-right">Load</th>
            <th scope="col" className="px-3 py-2.5">Stage</th>
            <th scope="col" className="px-3 py-2.5">Progress</th>
            <th scope="col" className="px-3 py-2.5">Staff</th>
            <th scope="col" className="px-3 py-2.5">Due</th>
            <th scope="col" className="sticky right-0 bg-field px-3 py-2.5 text-right">Next step</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {jobs.map((job) => {
            const late = isDelayed(job, now)
            return (
              <tr key={job.id} className={`group ${late ? 'bg-danger/5' : ''}`}>
                <th scope="row" className="px-3 py-2.5 align-top">
                  <button type="button" onClick={() => onOpen(job.id)} className="rounded-sm font-mono font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    #{job.id}
                  </button>
                  <span className="mt-1 flex flex-wrap gap-1"><JobFlags job={job} now={now} /></span>
                </th>
                <td className="px-3 py-2.5 align-top">
                  <span className="font-semibold text-ink">{job.customer}</span>
                  <span className="block text-[11px] text-muted">{job.service} · {job.items} items</span>
                </td>
                <td className="px-3 py-2.5 text-right align-top whitespace-nowrap tabular-nums">{job.weightKg} kg</td>
                <td className="px-3 py-2.5 align-top">
                  <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap text-ink">
                    <span className={`size-2 rounded-full ${getStage(job.stage).dot}`} aria-hidden="true" />
                    {getStage(job.stage).label}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top"><StageState job={job} now={now} /></td>
                <td className="px-3 py-2.5 align-top whitespace-nowrap">
                  {job.staff || <span className="text-muted">Unassigned</span>}
                  {permissions.manage && job.stage !== 'ready' && (
                    <button type="button" aria-label={`Assign staff to ${job.id}`} title="Assign staff" onClick={() => onAssign(job.id)} className={`${iconButton} ml-1 inline-flex size-6 align-middle`}>
                      <UserPlus className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top text-[11px] whitespace-nowrap"><DueLabel job={job} now={now} /></td>
                <td className="sticky right-0 bg-white px-3 py-2.5 text-right align-top">
                  <ActionButton job={job} {...actions} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Kanban ----------

export function Kanban({ jobs, onMove, ...actions }: { jobs: OpsJob[]; onMove: (id: string, stage: StageId) => void } & OpsActions) {
  const { now, permissions, onOpen } = actions
  const [over, setOver] = useState<StageId | null>(null)
  const drop = (event: DragEvent, stage: StageId) => {
    event.preventDefault()
    setOver(null)
    const id = event.dataTransfer.getData('text/plain')
    if (id) onMove(id, stage)
  }
  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {STAGES.map((stage) => {
          const inStage = jobs.filter((job) => job.stage === stage.id)
          return (
            <section
              key={stage.id}
              aria-label={`${stage.label}, ${inStage.length} jobs`}
              onDragOver={permissions.manage ? (event) => { event.preventDefault(); setOver(stage.id) } : undefined}
              onDragLeave={() => setOver(null)}
              onDrop={permissions.manage ? (event) => drop(event, stage.id) : undefined}
              className={`flex w-60 shrink-0 flex-col rounded-xl p-2 ring-1 ${over === stage.id ? 'bg-brand/10 ring-brand' : 'bg-field ring-line'}`}
            >
              <h3 className="flex items-center justify-between gap-2 px-1 pb-2 text-xs font-bold text-ink">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${stage.dot}`} aria-hidden="true" />
                  {stage.label}
                </span>
                <span className="rounded-full bg-white px-1.5 text-[10px] text-muted tabular-nums ring-1 ring-line">{inStage.length}</span>
              </h3>
              <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
                {inStage.length === 0 && <li className="px-1 py-6 text-center text-[11px] text-muted">Nothing here.</li>}
                {inStage.map((job) => (
                  <li
                    key={job.id}
                    draggable={permissions.manage}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', job.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    className={`space-y-1.5 rounded-lg bg-white p-2.5 text-xs ring-1 ${isDelayed(job, now) ? 'ring-danger/50' : 'ring-line'} ${permissions.manage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onOpen(job.id)} className="rounded-sm font-mono font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                        #{job.id}
                      </button>
                      <span className="text-[10px] whitespace-nowrap"><DueLabel job={job} now={now} /></span>
                    </div>
                    <p className="truncate font-semibold text-ink">{job.customer}</p>
                    <p className="truncate text-[11px] text-muted">{job.service} · {job.items} items · {job.weightKg} kg</p>
                    <div className="flex flex-wrap gap-1"><JobFlags job={job} now={now} /></div>
                    <StageState job={job} now={now} />
                    <p className="truncate text-[11px] text-muted">{job.staff || 'Unassigned'}</p>
                    <ActionButton job={job} {...actions} className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {permissions.manage && <p className="mt-2 text-[11px] text-muted">Drag a card to another stage to move it. Moving a job backwards or to Ready asks for confirmation.</p>}
    </div>
  )
}
