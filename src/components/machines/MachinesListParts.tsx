import type { RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  CalendarClock,
  ChevronsUpDown,
  CircleCheck,
  Cpu,
  Ellipsis,
  Gauge as GaugeIcon,
  Play,
  RotateCcw,
  Search,
  Timer,
  TriangleAlert,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  MACHINE_STATUSES,
  MACHINE_TYPES,
  MAINTENANCE_STATES,
  UTILIZATION_LEVELS,
} from '../../constants/machines'
import type { MachinePermissions } from '../../constants/machines'
import type { Machine, MachineFilters, MachineStatus } from '../../types/machine'
import {
  formatRuntime,
  getDowntimeCauses,
  getMaintenance,
  getOpenFault,
  isOperational,
} from '../../utils/machines'
import type { MachineAlert, MachineSortKey } from '../../utils/machines'
import { formatDay } from '../../utils/promotions'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Menu, { MenuItem } from '../ui/Menu'
import Panel, { PanelEmpty } from '../ui/Panel'
import {
  JobFacts,
  JobProgress,
  MachineGlyph,
  MachineStatusBadge,
  MaintenanceBadge,
  SeverityBadge,
} from './MachineBits'

export type MachineDialogName = 'fault' | 'maintenance' | 'assign' | 'transfer' | 'retire' | 'edit'

export type MachineActions = {
  permissions: MachinePermissions
  now: number
  branchName: (id: string) => string
  onDialog: (name: MachineDialogName, machineId: string) => void
  onToggleOffline: (machineId: string) => void
}

// Validated chart colour for single-series bars
const BAR_COLOR = '#2a78d6'

// ---------- KPI cards ----------

export function MachineKpis({
  machines,
  selected,
  onStatus,
}: {
  machines: Machine[]
  selected: MachineStatus | ''
  onStatus: (status: MachineStatus | '') => void
}) {
  const count = (status: MachineStatus) => machines.filter((machine) => machine.status === status).length
  const active = machines.filter(isOperational)
  const utilization = active.length ? Math.round(active.reduce((sum, machine) => sum + machine.utilization, 0) / active.length) : 0
  const share = (value: number) => (machines.length ? `${Math.round((value / machines.length) * 100)}% of the fleet` : 'No machines')
  const critical = machines.filter((machine) => getOpenFault(machine)?.severity === 'Critical').length
  const cards: { label: string; icon: LucideIcon; value: string; note: string; tone: string; status?: MachineStatus | '' }[] = [
    { label: 'Total Machines', icon: Cpu, value: String(machines.length), note: `${new Set(machines.map(({ branchId }) => branchId)).size} branches`, tone: 'text-brand', status: '' },
    { label: 'Running', icon: Play, value: String(count('running')), note: share(count('running')), tone: 'text-success', status: 'running' },
    { label: 'Available', icon: CircleCheck, value: String(count('available')), note: 'Ready for jobs', tone: 'text-brand', status: 'available' },
    { label: 'Maintenance', icon: Wrench, value: String(count('maintenance')), note: 'Being serviced now', tone: 'text-warning', status: 'maintenance' },
    { label: 'Fault / Error', icon: TriangleAlert, value: String(count('fault')), note: critical ? `${critical} critical` : 'None critical', tone: 'text-danger', status: 'fault' },
    { label: 'Overall Utilization', icon: GaugeIcon, value: `${utilization}%`, note: 'Average of machines in service', tone: 'text-brand' },
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, icon: Icon, value, note, tone, status }) => {
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
            </span>
            <span className="mt-1 block truncate text-xl font-bold text-ink tabular-nums">{value}</span>
            <span className="block truncate text-[11px] text-muted">{note}</span>
          </>
        )
        const pressed = status !== undefined && status !== '' && selected === status
        return (
          <li key={label} className="min-w-0">
            {status === undefined ? (
              <div className="h-full rounded-xl bg-white p-3 ring-1 ring-line">{body}</div>
            ) : (
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => onStatus(pressed ? '' : status)}
                className={`block h-full w-full rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  pressed ? 'ring-2 ring-brand' : 'ring-line'
                }`}
              >
                {body}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Status distribution ----------

export function StatusOverview({
  machines,
  selected,
  onSelect,
}: {
  machines: Machine[]
  selected: MachineStatus | ''
  onSelect: (status: MachineStatus | '') => void
}) {
  const groups = MACHINE_STATUSES.map((status) => ({
    ...status,
    count: machines.filter((machine) => machine.status === status.value).length,
  }))
  const energy = machines.reduce((sum, machine) => sum + machine.energyKwh, 0)
  const water = machines.reduce((sum, machine) => sum + machine.waterUsedL, 0)
  const cycles = machines.reduce((sum, machine) => sum + machine.cyclesToday, 0)
  return (
    <Panel title="Machine Status" subtitle="Click a status to filter the list">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {groups
          .filter(({ count }) => count > 0)
          .map(({ value, bar, count }) => (
            <span key={value} className={`${bar} rounded-full`} style={{ flexGrow: count }} />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {groups.map(({ value, label, icon: Icon, bar, count }) => (
          <li key={value}>
            <button
              type="button"
              aria-pressed={selected === value}
              onClick={() => onSelect(selected === value ? '' : value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                selected === value ? 'bg-brand/10 text-brand ring-1 ring-brand' : 'bg-field text-ink hover:bg-line'
              }`}
            >
              <span className={`size-2 rounded-full ${bar}`} aria-hidden="true" />
              <Icon className="size-3.5 text-muted" aria-hidden="true" />
              {label}
              <span className="tabular-nums">— {count}</span>
            </button>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <Timer className="size-3.5" aria-hidden="true" />
          <dt>Cycles today</dt>
          <dd className="font-bold text-ink tabular-nums">{cycles.toLocaleString('en-US')}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="size-3.5" aria-hidden="true" />
          <dt>Energy this month</dt>
          <dd className="font-bold text-ink tabular-nums">{energy.toLocaleString('en-US')} kWh</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>Water this month</dt>
          <dd className="font-bold text-ink tabular-nums">{water.toLocaleString('en-US')} L</dd>
        </div>
      </dl>
    </Panel>
  )
}

// ---------- Search and filters ----------

export function MachineToolbar({
  searchRef,
  filters,
  branches,
  manufacturers,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: MachineFilters
  branches: { id: string; name: string }[]
  manufacturers: string[]
  filtersActive: boolean
  onChange: (patch: Partial<MachineFilters>) => void
  onReset: () => void
}) {
  const select = `${fieldClass} w-auto! max-sm:flex-1`
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search machines"
          placeholder="Search machine name, ID, serial number..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className={`${fieldClass} h-10 pl-9`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Branch" value={filters.branch} onChange={(event) => onChange({ branch: event.target.value })} className={select}>
          <option value="">All branches</option>
          {branches.map(({ id, name }) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select aria-label="Machine type" value={filters.type} onChange={(event) => onChange({ type: event.target.value as MachineFilters['type'] })} className={select}>
          <option value="">All types</option>
          {MACHINE_TYPES.map(({ value }) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select aria-label="Status" value={filters.status} onChange={(event) => onChange({ status: event.target.value as MachineFilters['status'] })} className={select}>
          <option value="">All statuses</option>
          {MACHINE_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Manufacturer" value={filters.manufacturer} onChange={(event) => onChange({ manufacturer: event.target.value })} className={select}>
          <option value="">All manufacturers</option>
          {manufacturers.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select aria-label="Maintenance" value={filters.maintenance} onChange={(event) => onChange({ maintenance: event.target.value as MachineFilters['maintenance'] })} className={select}>
          <option value="">Any maintenance</option>
          {MAINTENANCE_STATES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Utilization" value={filters.utilization} onChange={(event) => onChange({ utilization: event.target.value as MachineFilters['utilization'] })} className={select}>
          <option value="">Any utilization</option>
          {UTILIZATION_LEVELS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {filtersActive && (
          <button type="button" onClick={onReset} className={secondaryButton}>
            <RotateCcw className="size-3.5 text-muted" aria-hidden="true" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Shared ----------

function MachineMenu({ machine, permissions, onDialog, onToggleOffline }: { machine: Machine } & MachineActions) {
  const navigate = useNavigate()
  const retired = machine.status === 'retired'
  return (
    <Menu
      label={`More actions for ${machine.name}`}
      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
      triggerClassName={`${iconButton} ring-1 ring-line`}
    >
      {(close) => {
        const run = (action: () => void) => () => {
          close()
          action()
        }
        return (
          <>
            {permissions.manage && !retired && <MenuItem onSelect={run(() => onDialog('edit', machine.id))}>Edit</MenuItem>}
            {permissions.manage && (machine.status === 'available' || machine.status === 'idle' || machine.status === 'offline') && (
              <MenuItem onSelect={run(() => onToggleOffline(machine.id))}>
                {machine.status === 'offline' ? 'Mark available' : 'Mark unavailable'}
              </MenuItem>
            )}
            {!retired && <MenuItem onSelect={run(() => onDialog('fault', machine.id))}>Report fault</MenuItem>}
            <MenuItem onSelect={() => navigate(`/machines/${machine.id}?tab=activity`)}>View history</MenuItem>
            {permissions.administer && !retired && (
              <>
                <MenuItem onSelect={run(() => onDialog('transfer', machine.id))}>Transfer to another branch</MenuItem>
                <MenuItem destructive onSelect={run(() => onDialog('retire', machine.id))}>Retire machine</MenuItem>
              </>
            )}
          </>
        )
      }}
    </Menu>
  )
}

// What the machine is doing right now, or why it isn't working
function Activity({ machine, compact = false }: { machine: Machine; compact?: boolean }) {
  const fault = getOpenFault(machine)
  if (machine.job) {
    return (
      <div className="space-y-1.5 rounded-lg bg-field p-2.5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
          <span className="font-mono font-bold text-brand">#{machine.job.orderId}</span>
          <span className="text-muted">
            {machine.job.service} · {machine.job.loadKg} kg
          </span>
        </p>
        <JobProgress job={machine.job} compact={compact} />
        <JobFacts job={machine.job} />
      </div>
    )
  }
  if (machine.status === 'fault' && fault) {
    return (
      <div className="rounded-lg bg-danger/10 p-2.5 text-[11px]">
        <p className="flex items-center gap-1.5 font-bold text-danger">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          {fault.type}
          <SeverityBadge severity={fault.severity} />
        </p>
        {!compact && <p className="mt-1 line-clamp-2 text-ink">{fault.description}</p>}
        <p className="mt-1 text-muted">{fault.technician ? `Technician: ${fault.technician}` : 'No technician assigned'}</p>
      </div>
    )
  }
  const text =
    machine.status === 'maintenance'
      ? machine.statusNote || 'Being serviced'
      : machine.status === 'offline'
        ? machine.statusNote || 'Marked unavailable'
        : machine.status === 'retired'
          ? machine.statusNote || 'Retired from service'
          : machine.queue.length > 0
            ? `Ready. ${machine.queue.length} ${machine.queue.length === 1 ? 'job' : 'jobs'} queued`
            : 'Ready for the next load'
  return (
    <p className={`rounded-lg px-2.5 py-2.5 text-[11px] ${machine.status === 'maintenance' ? 'bg-warning/10 text-ink' : 'bg-field text-muted'}`}>
      {text}
      {machine.status === 'maintenance' && machine.technician && <span className="block text-muted">Technician: {machine.technician}</span>}
    </p>
  )
}

// ---------- Grid ----------

function MachineCard({ machine, ...actions }: { machine: Machine } & MachineActions) {
  const { permissions, now, branchName, onDialog } = actions
  const metrics: [string, string][] = [
    ['Utilization', `${machine.utilization}%`],
    ['Runtime today', formatRuntime(machine.runtimeTodayMin)],
    ['Cycles today', String(machine.cyclesToday)],
    ['Capacity', `${machine.specs.capacityKg} kg`],
  ]
  return (
    <li className={`flex min-w-0 flex-col gap-3 rounded-xl bg-white p-4 ring-1 ${machine.status === 'fault' ? 'ring-danger/40' : 'ring-line'}`}>
      <div className="flex items-start gap-3">
        <MachineGlyph machine={machine} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-ink">
            <Link to={`/machines/${machine.id}`} className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              {machine.name}
            </Link>
            <span className="ml-1.5 font-mono text-[10px] font-normal text-muted">{machine.id}</span>
          </h3>
          <p className="truncate text-[11px] text-muted">
            {machine.manufacturer} {machine.model} · {branchName(machine.branchId)}
          </p>
        </div>
        <MachineStatusBadge status={machine.status} />
      </div>

      <Activity machine={machine} />

      <dl className="grid grid-cols-4 gap-1 text-center">
        {metrics.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-[9px] text-muted" title={label}>{label}</dt>
            <dd className="truncate text-xs font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>Next maintenance: <span className="font-semibold text-ink">{formatDay(machine.nextMaintenanceAt, true)}</span></span>
        <MaintenanceBadge machine={machine} now={now} />
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link to={`/machines/${machine.id}`} className={`${secondaryButton} flex-1`}>
          View Details
        </Link>
        {permissions.manage && isOperational(machine) && (
          <button type="button" onClick={() => onDialog('assign', machine.id)} className={`${primaryButton} flex-1 whitespace-nowrap`}>
            Assign Job
          </button>
        )}
        {permissions.maintain && machine.status !== 'retired' && (
          <button
            type="button"
            aria-label={`Schedule maintenance for ${machine.name}`}
            title="Schedule maintenance"
            onClick={() => onDialog('maintenance', machine.id)}
            className={`${iconButton} ring-1 ring-line`}
          >
            <Wrench className="size-4" aria-hidden="true" />
          </button>
        )}
        <MachineMenu machine={machine} {...actions} />
      </div>
    </li>
  )
}

export function MachineGrid({ machines, ...actions }: { machines: Machine[] } & MachineActions) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {machines.map((machine) => (
        <MachineCard key={machine.id} machine={machine} {...actions} />
      ))}
    </ul>
  )
}

// ---------- Operational view ----------

const TILE_RINGS: Partial<Record<MachineStatus, string>> = {
  running: 'ring-success/40',
  fault: 'ring-danger/60',
  maintenance: 'ring-warning/50',
}

export function OperationalView({ machines, branchName, onDialog }: { machines: Machine[] } & Pick<MachineActions, 'branchName' | 'onDialog'>) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {machines.map((machine) => {
        const { label, icon: Icon, tone } = MACHINE_STATUSES.find(({ value }) => value === machine.status)!
        const text = { success: 'text-success', brand: 'text-brand', warning: 'text-warning', danger: 'text-danger', neutral: 'text-muted' }[tone]
        return (
          <li key={machine.id} className={`flex min-w-0 flex-col gap-2 rounded-xl bg-white p-3 ring-2 ${TILE_RINGS[machine.status] ?? 'ring-line'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink">
                  <Link to={`/machines/${machine.id}`} className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    {machine.name}
                  </Link>
                </h3>
                <p className="truncate text-[10px] text-muted">
                  {machine.id} · {branchName(machine.branchId)}
                </p>
              </div>
              <p className={`flex items-center gap-1 text-xs font-extrabold tracking-wide uppercase ${text}`}>
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </p>
            </div>
            <Activity machine={machine} compact />
            <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted">
              <span className="tabular-nums">
                {machine.job ? `${machine.job.loadKg} / ` : ''}{machine.specs.capacityKg} kg
                {machine.queue.length > 0 && ` · ${machine.queue.length} queued`}
              </span>
              {machine.status !== 'retired' && (
                <button
                  type="button"
                  onClick={() => onDialog('fault', machine.id)}
                  className="rounded-md px-2 py-1 font-semibold text-danger hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                >
                  Report Fault
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Table ----------

export type MachineSort = { key: MachineSortKey; descending: boolean }

export function MachineTable({
  machines,
  sort,
  onSort,
  ...actions
}: {
  machines: Machine[]
  sort: MachineSort
  onSort: (key: MachineSortKey) => void
} & MachineActions) {
  const navigate = useNavigate()
  const { now, branchName } = actions
  const columns: { label: string; key?: MachineSortKey; right?: boolean }[] = [
    { label: 'Machine', key: 'name' },
    { label: 'Type' },
    { label: 'Branch' },
    { label: 'Status', key: 'status' },
    { label: 'Current job' },
    { label: 'Utilization', key: 'utilization', right: true },
    { label: 'Runtime', key: 'runtime', right: true },
    { label: 'Maintenance', key: 'maintenance' },
  ]
  return (
    <div className="relative overflow-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[1020px] text-left text-xs">
        <thead className="bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
          <tr>
            {columns.map(({ label, key, right }) => (
              <th
                key={label}
                scope="col"
                aria-sort={key && sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined}
                className={`px-3 py-2.5 whitespace-nowrap ${right ? 'text-right' : ''}`}
              >
                {key ? (
                  <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 rounded-sm tracking-wider uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    {label}
                    {sort.key !== key ? (
                      <ChevronsUpDown className="size-3" aria-hidden="true" />
                    ) : sort.descending ? (
                      <ArrowDown className="size-3 text-brand" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-3 text-brand" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
            <th scope="col" className="sticky right-0 bg-field px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {machines.map((machine) => (
            <tr key={machine.id} onClick={() => navigate(`/machines/${machine.id}`)} className="group cursor-pointer transition hover:bg-field/60">
              <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                <Link
                  to={`/machines/${machine.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {machine.name}
                </Link>
                <span className="block font-mono text-[10px] font-normal text-muted">{machine.id}</span>
              </th>
              <td className="px-3 py-2.5 text-muted">{machine.type}</td>
              <td className="px-3 py-2.5 text-muted">{branchName(machine.branchId)}</td>
              <td className="px-3 py-2.5"><MachineStatusBadge status={machine.status} /></td>
              <td className="px-3 py-2.5">
                {machine.job ? (
                  <>
                    <span className="font-mono text-[11px] font-semibold text-brand">{machine.job.orderId}</span>
                    <span className="block text-[10px] text-muted tabular-nums">{machine.job.progress}% · {machine.job.remainingMin} min left</span>
                  </>
                ) : (
                  <span className="text-muted">{getOpenFault(machine)?.type ?? '—'}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{machine.utilization}%</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatRuntime(machine.runtimeTodayMin)}</td>
              <td className="px-3 py-2.5"><MaintenanceBadge machine={machine} now={now} /></td>
              <td className="sticky right-0 bg-white px-3 py-2.5 group-hover:bg-field" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5">
                  <Link to={`/machines/${machine.id}`} className={`${secondaryButton} h-8`}>
                    View
                  </Link>
                  <MachineMenu machine={machine} {...actions} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Alerts, maintenance and downtime ----------

export function AlertsPanel({ alerts }: { alerts: MachineAlert[] }) {
  const shown = alerts.slice(0, 7)
  return (
    <Panel title="Machine Alerts" icon={BellRing} badge={alerts.length > 0 && <Badge tone="danger">{alerts.length}</Badge>} subtitle="Faults, maintenance, load and energy, most severe first">
      {alerts.length === 0 ? (
        <PanelEmpty>No active faults or warnings.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {shown.map((alert) => (
            <li key={`${alert.machineId}-${alert.title}`} className={`rounded-lg p-3 text-xs ${alert.severity === 'Critical' ? 'bg-danger/10' : 'bg-field'}`}>
              <p className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={alert.severity} />
                <span className="font-bold text-ink">{alert.title}</span>
                <Link to={`/machines/${alert.machineId}`} className="ml-auto rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  View
                </Link>
              </p>
              <p className="mt-1 text-muted">{alert.text}</p>
              <p className="mt-0.5 text-ink"><span className="font-semibold">Recommended:</span> {alert.action}</p>
            </li>
          ))}
          {alerts.length > shown.length && <li className="text-[11px] text-muted">+ {alerts.length - shown.length} more; filter the list to find them.</li>}
        </ul>
      )}
    </Panel>
  )
}

export function UpcomingMaintenancePanel({ machines, ...actions }: { machines: Machine[] } & MachineActions) {
  const { permissions, now, branchName, onDialog } = actions
  const due = machines
    .filter(({ status }) => status !== 'retired')
    .map((machine) => ({ machine, ...getMaintenance(machine, now) }))
    .filter(({ days, machine }) => days <= 14 || machine.status === 'maintenance')
    .sort((a, b) => a.days - b.days)
    .slice(0, 7)
  return (
    <Panel title="Maintenance Schedule" icon={CalendarClock} subtitle="In progress, overdue and due within 14 days">
      {due.length === 0 ? (
        <PanelEmpty>No maintenance scheduled in the next 14 days.</PanelEmpty>
      ) : (
        <ul className="space-y-1.5">
          {due.map(({ machine }) => (
            <li key={machine.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <Link to={`/machines/${machine.id}?tab=maintenance`} className="rounded-sm font-semibold text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  {machine.name}
                </Link>
                <p className="truncate text-[11px] text-muted">
                  {formatDay(machine.nextMaintenanceAt, true)} · {branchName(machine.branchId)} · {machine.technician || 'No technician'}
                </p>
              </div>
              <MaintenanceBadge machine={machine} now={now} />
              {permissions.maintain && machine.status !== 'maintenance' && (
                <button type="button" onClick={() => onDialog('maintenance', machine.id)} className={`${secondaryButton} h-7`}>
                  Schedule
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function DowntimePanel({ machines, subtitle = 'Recorded faults and maintenance for the machines in the current filters' }: { machines: Machine[]; subtitle?: string }) {
  const { causes, total, incidents, longest, averageRepair } = getDowntimeCauses(machines)
  const top = Math.max(...causes.map(({ minutes }) => minutes), 1)
  const facts: [string, string][] = [
    ['Total downtime', formatRuntime(total)],
    ['Fault incidents', String(incidents)],
    ['Longest outage', formatRuntime(longest)],
    ['Mean time to repair', formatRuntime(averageRepair)],
  ]
  return (
    <Panel title="Downtime Analysis" subtitle={subtitle}>
      {causes.length === 0 ? (
        <PanelEmpty>No downtime recorded.</PanelEmpty>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-field px-3 py-2">
                <dt className="truncate text-[10px] font-semibold text-muted">{label}</dt>
                <dd className="truncate text-sm font-bold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-2">
            {causes.map(({ cause, minutes, share }) => (
              <li key={cause} className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-2 text-xs" title={`${cause}: ${formatRuntime(minutes)} (${share.toFixed(0)}%)`}>
                <span className="truncate text-muted">{cause}</span>
                <span className="h-4 rounded-sm bg-field">
                  <span className="block h-full rounded-r" style={{ width: `${(minutes / top) * 100}%`, background: BAR_COLOR }} />
                </span>
                <span className="text-right font-bold whitespace-nowrap text-ink tabular-nums">
                  {formatRuntime(minutes)} <span className="font-normal text-muted">{share.toFixed(0)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
