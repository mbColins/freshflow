import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, CircleStop, Copy, Pause, Play, Plus, TriangleAlert, X } from 'lucide-react'
import { TIME_SERIES, UTILIZATION_RANGES } from '../../constants/machines'
import type { MachinePermissions } from '../../constants/machines'
import { CURRENT_USER } from '../../constants/orders'
import type { Machine, MaintenanceStatus, UtilizationRange } from '../../types/machine'
import { formatDate } from '../../utils/customers'
import {
  completeMaintenance,
  formatRuntime,
  getCostSummary,
  getEnergyDelta,
  getMaintenance,
  getUtilizationSeries,
  isOperational,
  resolveFault,
  withActivity,
} from '../../utils/machines'
import { formatTime, formatXaf } from '../../utils/orders'
import { formatDay } from '../../utils/promotions'
import { formatCompactXaf } from '../../utils/services'
import type { ConfirmRequest } from '../orders/OrderDialogs'
import { fieldClass, iconButton, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'
import SegmentedControl from '../ui/SegmentedControl'
import StatTile from '../ui/StatTile'
import { Gauge, JobProgress, MaintenanceBadge, SeverityBadge } from './MachineBits'
import { DowntimePanel } from './MachinesListParts'
import type { MachineDialogName } from './MachinesListParts'

export type MachineTabProps = {
  machine: Machine
  machines: Machine[]
  now: number
  permissions: MachinePermissions
  branchName: (id: string) => string
  // Applies a change to the machine and shows the message as a toast
  onChange: (change: (machine: Machine) => Machine, message: string) => void
  onDialog: (name: MachineDialogName) => void
  onConfirm: (request: ConfirmRequest) => void
}

const headClass = 'text-[10px] font-bold tracking-wider text-muted uppercase'
const when = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`

// ---------- Utilization chart ----------

function UtilizationChart({ machine, now }: { machine: Machine; now: number }) {
  const [range, setRange] = useState<UtilizationRange>('week')
  const [hover, setHover] = useState<number | null>(null)
  const rows = getUtilizationSeries(machine, range, now)
  return (
    <Panel
      title="Machine Utilization"
      subtitle="Share of time operating, idle, in maintenance and down"
      action={<SegmentedControl label="Utilization period" options={UTILIZATION_RANGES} value={range} onChange={setRange} />}
    >
      <figure className="relative">
        <div className="flex h-44 items-stretch gap-2 pl-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex h-44 w-7 flex-col justify-between text-right text-[10px] text-muted tabular-nums" aria-hidden="true">
            <span>100%</span>
            <span>50%</span>
            <span>0</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.label}
              className="relative flex min-w-0 flex-1 flex-col-reverse gap-0.5"
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
            >
              {TIME_SERIES.map(({ key, color }) =>
                row[key] > 0 ? <span key={key} className="rounded-sm" style={{ flexGrow: row[key], flexBasis: 0, background: color }} /> : null,
              )}
              {hover === index && (
                <div className={`pointer-events-none absolute top-0 z-10 rounded-md bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lg ${index > rows.length / 2 ? 'right-full mr-1' : 'left-full ml-1'}`}>
                  <p className="font-semibold">{row.label}</p>
                  {TIME_SERIES.map(({ key, label, color }) => (
                    <p key={key} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
                      {label}: <span className="font-bold tabular-nums">{row[key]}%</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 pl-8 text-center text-[10px] text-muted" aria-hidden="true">
          {rows.map(({ label }) => (
            <span key={label} className="min-w-0 flex-1 truncate">{label.replace('Week to ', '')}</span>
          ))}
        </div>
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-8 text-[11px] text-muted">
          {TIME_SERIES.map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
              {label}
            </span>
          ))}
        </figcaption>
        <table className="sr-only">
          <caption>Utilization by period, percent of time</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {TIME_SERIES.map(({ key, label }) => (
                <th key={key} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {TIME_SERIES.map(({ key }) => (
                  <td key={key}>{row[key]}%</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </Panel>
  )
}

// ---------- Overview ----------

export function OverviewTab({ machine, now, permissions, onChange, onDialog, onConfirm }: MachineTabProps) {
  const { job, queue } = machine
  const planned = machine.cyclesToday + (job ? 1 : 0) + queue.length
  const move = (index: number, offset: number) =>
    onChange((current) => {
      const next = [...current.queue]
      const [item] = next.splice(index, 1)
      next.splice(index + offset, 0, item)
      return { ...current, queue: next }
    }, 'Queue reordered')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current Job" badge={job && <Badge tone={job.paused ? 'warning' : 'success'}>{job.paused ? 'Paused' : 'In progress'}</Badge>}>
          {!job ? (
            <div className="space-y-3">
              <PanelEmpty>
                {machine.status === 'available' || machine.status === 'idle' ? 'No job running. The machine is ready for the next load.' : machine.statusNote || 'No job running.'}
              </PanelEmpty>
              {permissions.manage && isOperational(machine) && (
                <button type="button" onClick={() => onDialog('assign')} className={primaryButton}>
                  <Plus className="size-4" aria-hidden="true" />
                  Assign Job
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                {(
                  [
                    ['Order', `#${job.orderId}`],
                    ['Customer', job.customer],
                    ['Service', job.service],
                    ['Load', `${job.loadKg} kg of ${machine.specs.capacityKg} kg`],
                    ['Cycle', job.cycle],
                    ['Assigned staff', job.operator],
                    ...(job.temperature !== null ? [['Temperature', `${job.temperature}°C`]] : []),
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[10px] text-muted">{label}</dt>
                    <dd className="truncate font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <JobProgress job={job} />
              <Link to="/orders" className={`${secondaryButton} w-fit`}>
                Open Orders
              </Link>
              {permissions.manage && (
                <div className="rounded-lg p-3 ring-1 ring-warning/40">
                  <p className={sectionTitle}>Machine controls</p>
                  <p className="mt-1 text-[11px] text-muted">These act on the machine itself. Each asks for confirmation.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: job.paused ? `Resume ${machine.name}?` : `Pause ${machine.name}?`,
                          body: job.paused ? `The cycle for order #${job.orderId} continues from ${job.progress}%.` : `The cycle for order #${job.orderId} holds at ${job.progress}%. The load stays in the machine.`,
                          confirmLabel: job.paused ? 'Resume' : 'Pause',
                          onConfirm: () =>
                            onChange(
                              (current) => withActivity({ ...current, job: current.job && { ...current.job, paused: !current.job.paused } }, CURRENT_USER, job.paused ? 'Cycle resumed' : 'Cycle paused', job.orderId),
                              job.paused ? `${machine.name} resumed` : `${machine.name} paused`,
                            ),
                        })
                      }
                      className={secondaryButton}
                    >
                      {job.paused ? <Play className="size-4 text-success" aria-hidden="true" /> : <Pause className="size-4 text-muted" aria-hidden="true" />}
                      {job.paused ? 'Resume Machine' : 'Pause Machine'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: `Stop ${machine.name}?`,
                          body: `This ends the cycle for order #${job.orderId} at ${job.progress}%. The load is not finished and the order must be restarted or moved to another machine.`,
                          confirmLabel: 'Stop Machine',
                          destructive: true,
                          onConfirm: () =>
                            onChange(
                              (current) => withActivity({ ...current, job: null, status: 'available' }, CURRENT_USER, `Cycle stopped at ${job.progress}%`, job.orderId),
                              `${machine.name} stopped. Order #${job.orderId} needs reassigning`,
                            ),
                        })
                      }
                      className={`${secondaryButton} text-danger ring-danger/40 hover:bg-danger/10`}
                    >
                      <CircleStop className="size-4" aria-hidden="true" />
                      Stop Machine
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Today’s Workload" subtitle={`${planned} cycles planned`}>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-field" aria-hidden="true">
              {machine.cyclesToday > 0 && <span className="rounded-full bg-success" style={{ flexGrow: machine.cyclesToday }} />}
              {job && <span className="rounded-full bg-brand" style={{ flexGrow: 1 }} />}
              {queue.length > 0 && <span className="rounded-full bg-muted/40" style={{ flexGrow: queue.length }} />}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Completed', machine.cyclesToday, 'bg-success'],
                  ['Active', job ? 1 : 0, 'bg-brand'],
                  ['Queued', queue.length, 'bg-muted/40'],
                ] as const
              ).map(([label, value, dot]) => (
                <div key={label} className="rounded-lg bg-field px-2 py-2">
                  <dd className="text-lg font-bold text-ink tabular-nums">{value}</dd>
                  <dt className="flex items-center justify-center gap-1.5 text-[10px] text-muted">
                    <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
                    {label}
                  </dt>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Upcoming Jobs" badge={queue.length > 0 && <Badge tone="brand">{queue.length}</Badge>}>
            {queue.length === 0 ? (
              <PanelEmpty>No jobs are queued on this machine.</PanelEmpty>
            ) : (
              <ol className="space-y-1.5">
                {queue.map((item, index) => (
                  <li key={`${item.orderId}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs">
                    <span className="font-bold text-muted tabular-nums">#{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono font-semibold text-brand">{item.orderId}</span>
                      <span className="ml-2 text-muted">{item.service} · {item.loadKg} kg · {item.durationMin} min</span>
                    </span>
                    <Badge tone={item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge>
                    {permissions.manage && (
                      <span className="flex gap-0.5">
                        <button type="button" aria-label={`Move ${item.orderId} up`} disabled={index === 0} onClick={() => move(index, -1)} className={`${iconButton} size-7 disabled:opacity-30`}>
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={`Move ${item.orderId} down`} disabled={index === queue.length - 1} onClick={() => move(index, 1)} className={`${iconButton} size-7 disabled:opacity-30`}>
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${item.orderId} from the queue`}
                          onClick={() => onChange((current) => ({ ...current, queue: current.queue.filter((_, position) => position !== index) }), `${item.orderId} removed from the queue`)}
                          className={`${iconButton} size-7`}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UtilizationChart machine={machine} now={now} />
        <Panel title="Performance">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Gauge label="Utilization rate" value={machine.utilization} />
            <Gauge label="Availability" value={machine.availability} />
            <Gauge label="Efficiency" value={machine.efficiency} />
            <Gauge label="Downtime" value={machine.downtimePct} display={`${machine.downtimePct}%`} tone="bg-warning" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label="Average cycle" value={`${machine.avgCycleMin} min`} note={`Rated ${machine.specs.cycleMin} min`} />
            <StatTile label="Energy this month" value={`${machine.energyKwh.toLocaleString('en-US')} kWh`} />
            <StatTile label="Water this month" value={`${machine.waterUsedL.toLocaleString('en-US')} L`} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ---------- Maintenance ----------

const MAINTENANCE_TONES: Record<MaintenanceStatus, BadgeTone> = {
  Scheduled: 'brand',
  'In Progress': 'warning',
  Completed: 'success',
  Overdue: 'danger',
  Cancelled: 'neutral',
}

export function MaintenanceTab({ machine, now, permissions, onChange, onDialog }: MachineTabProps) {
  const log = [...machine.maintenanceLog].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-4">
      <Panel
        title="Maintenance"
        action={
          permissions.maintain &&
          machine.status !== 'retired' && (
            <button type="button" onClick={() => onDialog('maintenance')} className={primaryButton}>
              <Plus className="size-4" aria-hidden="true" />
              Schedule Maintenance
            </button>
          )
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatTile label="Last maintenance" value={machine.lastMaintenanceAt ? formatDay(machine.lastMaintenanceAt, true) : 'None yet'} />
          <StatTile label="Next maintenance" value={formatDay(machine.nextMaintenanceAt, true)} note={getMaintenance(machine, now).label} />
          <div className="rounded-lg bg-field px-3 py-2">
            <p className="text-[10px] font-semibold text-muted">Status</p>
            <div className="mt-1"><MaintenanceBadge machine={machine} now={now} /></div>
          </div>
          <StatTile label="Frequency" value={`Every ${machine.maintenanceEveryDays} days`} />
          <StatTile label="Technician" value={machine.technician || 'Not assigned'} />
        </div>
      </Panel>

      <Panel title="Schedule & History" subtitle="Planned work first, then completed work">
        {log.length === 0 ? (
          <PanelEmpty>No maintenance scheduled.</PanelEmpty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className={headClass}>
                <tr>
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Type</th>
                  <th scope="col" className="py-2 pr-3">Technician</th>
                  <th scope="col" className="py-2 pr-3 text-right">Duration</th>
                  <th scope="col" className="py-2 pr-3 text-right">Cost</th>
                  <th scope="col" className="py-2 pr-3">Description</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  {permissions.maintain && <th scope="col" className="py-2 text-right"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {log.map((entry) => {
                  const open = entry.status === 'Scheduled' || entry.status === 'Overdue' || entry.status === 'In Progress'
                  return (
                    <tr key={entry.id}>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatDay(entry.date, true)}</td>
                      <th scope="row" className="py-2 pr-3 font-semibold text-ink">{entry.type}</th>
                      <td className="py-2 pr-3 text-muted">{entry.technician}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatRuntime(entry.durationMin)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatXaf(entry.cost)}</td>
                      <td className="py-2 pr-3 text-muted">{entry.description}</td>
                      <td className="py-2 pr-3"><Badge tone={MAINTENANCE_TONES[entry.status]}>{entry.status}</Badge></td>
                      {permissions.maintain && (
                        <td className="py-2 text-right whitespace-nowrap">
                          {open && (
                            <span className="inline-flex gap-1.5">
                              <button type="button" onClick={() => onChange((current) => completeMaintenance(current, entry.id, CURRENT_USER, now), `${entry.type} marked completed`)} className={`${secondaryButton} h-7`}>
                                Mark completed
                              </button>
                              {entry.status !== 'In Progress' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChange(
                                      (current) => withActivity({ ...current, maintenanceLog: current.maintenanceLog.map((item) => (item.id === entry.id ? { ...item, status: 'Cancelled' } : item)) }, CURRENT_USER, `${entry.type} cancelled`),
                                      `${entry.type} cancelled`,
                                    )
                                  }
                                  className={`${secondaryButton} h-7 text-danger`}
                                >
                                  Cancel
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ---------- Faults ----------

function ResolveFaultForm({ onSave, onCancel }: { onSave: (text: string) => void; onCancel: () => void }) {
  const { register, handleSubmit, control } = useForm<{ text: string }>({ defaultValues: { text: '' } })
  const text = useWatch({ control, name: 'text' })
  return (
    <form className="mt-2 flex flex-wrap gap-2" onSubmit={handleSubmit((values) => onSave(values.text.trim()))}>
      <input autoFocus aria-label="What fixed it" placeholder="What fixed it?" {...register('text', { validate: (value) => value.trim() !== '' })} className={`${fieldClass} min-w-40 flex-1 bg-white`} />
      <button type="submit" disabled={!text.trim()} className={primaryButton}>Save resolution</button>
      <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
    </form>
  )
}

export function FaultsTab({ machine, permissions, onChange, onDialog }: MachineTabProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  return (
    <Panel
      title="Fault History"
      subtitle={`${machine.faults.filter(({ status }) => status !== 'Resolved').length} open · ${machine.faults.length} on record`}
      action={
        machine.status !== 'retired' && (
          <button type="button" onClick={() => onDialog('fault')} className={`${secondaryButton} text-danger`}>
            <TriangleAlert className="size-4" aria-hidden="true" />
            Report Fault
          </button>
        )
      }
    >
      {machine.faults.length === 0 ? (
        <PanelEmpty>No faults recorded for this machine.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {machine.faults.map((fault) => {
            const open = fault.status !== 'Resolved'
            return (
              <li key={fault.id} className={`rounded-lg p-3 text-xs ${open ? 'bg-danger/10' : 'bg-field'}`}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{fault.type}</span>
                  <SeverityBadge severity={fault.severity} />
                  <Badge tone={open ? 'warning' : 'success'}>{fault.status}</Badge>
                  <span className="ml-auto text-[11px] text-muted">{when(fault.reportedAt)}</span>
                </p>
                <p className="mt-1 text-ink">{fault.description}</p>
                <p className="mt-1 text-[11px] text-muted">
                  Reported by {fault.reportedBy} · {fault.technician ? `Technician: ${fault.technician}` : 'No technician assigned'} · {open ? 'Estimated downtime' : 'Downtime'} {formatRuntime(fault.downtimeMin)}
                </p>
                {fault.resolution && <p className="mt-1 text-[11px] text-ink"><span className="font-semibold">Resolution:</span> {fault.resolution}</p>}
                {open && permissions.maintain && (
                  resolvingId === fault.id ? (
                    <ResolveFaultForm
                      onCancel={() => setResolvingId(null)}
                      onSave={(text) => {
                        onChange((current) => resolveFault(current, fault.id, text, CURRENT_USER), `${fault.type} resolved`)
                        setResolvingId(null)
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => setResolvingId(fault.id)} className={`${secondaryButton} mt-2 h-8`}>
                      Mark resolved
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Analytics ----------

export function AnalyticsTab({ machine, machines, permissions }: MachineTabProps) {
  const costs = getCostSummary(machine)
  const energyDelta = getEnergyDelta(machine, machines)
  const costRows: [string, number][] = [
    ['Purchase', machine.purchaseCost],
    ['Maintenance', machine.costs.maintenance],
    ['Repairs', machine.costs.repairs],
    ['Operating', machine.costs.operating],
    ['Energy', machine.costs.energy],
  ]
  const topCost = Math.max(...costRows.map(([, value]) => value), 1)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Energy & Resources" subtitle="Per cycle, against other machines of the same type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="Energy per cycle" value={`${machine.energyPerCycle} kWh`} note={`${energyDelta >= 0 ? '+' : '−'}${Math.abs(energyDelta).toFixed(0)}% vs similar`} />
            <StatTile label="Water per cycle" value={`${machine.specs.waterL} L`} />
            <StatTile label="Utilities per cycle" value={formatXaf(costs.energyCostPerCycle + costs.waterCostPerCycle)} note="Energy + water" />
            <StatTile label="Energy this month" value={`${machine.energyKwh.toLocaleString('en-US')} kWh`} />
            <StatTile label="Water this month" value={`${machine.waterUsedL.toLocaleString('en-US')} L`} />
            <StatTile label="Total cycles" value={machine.totalCycles.toLocaleString('en-US')} />
          </div>
          {energyDelta >= 15 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink">
              <TriangleAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden="true" />
              This machine uses {energyDelta.toFixed(0)}% more energy per cycle than similar machines. Check filters, seals and heating elements.
            </p>
          )}
          <p className="mt-2 text-[10px] text-muted">Gas and detergent consumption are not tracked yet. Costs use placeholder utility rates.</p>
        </Panel>

        {permissions.financials && (
          <Panel title="Cost & Return" subtitle="Since the machine was purchased">
            <ul className="space-y-2">
              {costRows.map(([label, value]) => (
                <li key={label} className="grid grid-cols-[6rem_1fr_5.5rem] items-center gap-2 text-xs" title={`${label}: ${formatXaf(value)}`}>
                  <span className="text-muted">{label}</span>
                  <span className="h-4 rounded-sm bg-field">
                    <span className="block h-full rounded-r" style={{ width: `${(value / topCost) * 100}%`, background: TIME_SERIES[0].color }} />
                  </span>
                  <span className="text-right font-bold whitespace-nowrap text-ink tabular-nums">{formatCompactXaf(value).replace('XAF ', '')}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Total cost" value={formatCompactXaf(costs.total)} />
              <StatTile label="Revenue generated" value={formatCompactXaf(machine.revenue)} />
              <StatTile label="Contribution" value={formatCompactXaf(Math.max(0, costs.contribution))} note="Revenue − running costs" />
              <StatTile label="Return on investment" value={`${costs.roi.toFixed(0)}%`} note={`${formatXaf(costs.costPerCycle)} / cycle`} />
            </dl>
          </Panel>
        )}
      </div>
      <DowntimePanel machines={[machine]} subtitle="Recorded faults and maintenance for this machine" />
    </div>
  )
}

// ---------- Activity ----------

export function ActivityTab({ machine, branchName }: MachineTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <Panel title="Activity History">
          {machine.activity.length === 0 ? (
            <PanelEmpty>No machine activity recorded.</PanelEmpty>
          ) : (
            <ol className="space-y-3 border-l border-line pl-4">
              {machine.activity.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden="true" />
                  <p className="font-semibold text-ink">
                    {event.text}
                    {event.orderId && <span className="ml-2 font-mono font-normal text-brand">#{event.orderId}</span>}
                  </p>
                  <p className="text-[11px] text-muted">{event.by} · {when(event.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Panel title="Transfer History">
        {machine.transfers.length === 0 ? (
          <PanelEmpty>This machine has never been moved between branches.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {machine.transfers.map((transfer) => (
              <li key={transfer.at} className="rounded-lg bg-field px-3 py-2 text-xs">
                <p className="font-semibold text-ink">{branchName(transfer.from)} → {branchName(transfer.to)}</p>
                <p className="text-[11px] text-muted">{formatDate(transfer.at)} · {transfer.by} · {transfer.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ---------- Details ----------

export function DetailsTab({ machine, branchName }: MachineTabProps) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/machines/${machine.id}`
  const rows = (items: [string, string][]) => (
    <dl className="space-y-1.5 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-3">
          <dt className="w-32 shrink-0 text-muted">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Identification">
        {rows([
          ['Machine ID', machine.id],
          ['Type', machine.type],
          ['Manufacturer', machine.manufacturer],
          ['Model', machine.model],
          ['Serial number', machine.serial],
          ['Year purchased', String(machine.yearPurchased)],
          ['Description', machine.description],
        ])}
      </Panel>
      <Panel title="Location">
        {rows([
          ['Branch', branchName(machine.branchId)],
          ['Area', machine.area],
          ['Zone / position', machine.zone],
        ])}
        <div className="mt-3 border-t border-line pt-3">
          <p className={sectionTitle}>Machine link</p>
          <p className="mt-1 text-[11px] text-muted">Opens this machine on a phone for status, fault reporting and history. Print it as a label for the machine.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly aria-label="Machine link" value={link} onFocus={(event) => event.target.select()} className={`${fieldClass} font-mono text-[11px]`} />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  setCopied(true)
                } catch {
                  setCopied(false)
                }
              }}
              className={secondaryButton}
            >
              <Copy className="size-3.5 text-muted" aria-hidden="true" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </Panel>
      <Panel title="Specifications">
        {rows([
          ['Capacity', `${machine.specs.capacityKg} kg`],
          ['Power consumption', `${machine.specs.powerKw} kW`],
          ['Water consumption', machine.specs.waterL ? `${machine.specs.waterL} L / cycle` : 'None'],
          ['Voltage', `${machine.specs.voltage} V`],
          ['Maximum temperature', machine.specs.maxTemp ? `${machine.specs.maxTemp}°C` : 'Not heated'],
          ['Cycle duration', `${machine.specs.cycleMin} min`],
          ['Warranty', machine.specs.warrantyEnd ? `Until ${formatDay(machine.specs.warrantyEnd, true)}` : 'None recorded'],
        ])}
      </Panel>
      <Panel title="Capabilities">
        {machine.capabilities.length === 0 ? (
          <PanelEmpty>No capabilities recorded.</PanelEmpty>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {machine.capabilities.map((capability) => (
              <li key={capability}><Badge tone="brand">{capability}</Badge></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
