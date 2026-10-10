import type { RefObject } from 'react'
import {
  Ban,
  ChevronDown,
  Download,
  Ellipsis,
  Eye,
  Phone,
  Search,
  UserCog,
  X,
} from 'lucide-react'
import {
  JOB_STATUSES,
  PRIORITIES,
  STATUS_LABELS,
  ZONES,
} from '../../constants/logistics'
import type {
  DispatchJob,
  Driver,
  JobPriority,
  LogisticsFilters,
} from '../../types/logistics'
import { formatXaf } from '../../utils/orders'
import { formatClock, isClosed } from '../../utils/logistics'
import { fieldClass, iconButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Menu, { MenuItem } from '../ui/Menu'
import { JobPriorityBadge, JobStatusBadge, JobTypeIcon } from './LogisticsBits'

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'
const bulkActionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

type LogisticsTableProps = {
  searchRef: RefObject<HTMLInputElement | null>
  jobs: DispatchJob[]
  totalCount: number
  drivers: Driver[]
  now: number
  filters: LogisticsFilters
  filtersActive: boolean
  onChange: (patch: Partial<LogisticsFilters>) => void
  onReset: () => void
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onClearSelection: () => void
  onOpenJob: (id: string) => void
  onAssign: (jobIds: string[]) => void
  onSetPriority: (jobIds: string[], priority: JobPriority) => void
  onCancel: (jobIds: string[]) => void
  onExport: (jobs: DispatchJob[]) => void
}

function LogisticsTable({
  searchRef,
  jobs,
  totalCount,
  drivers,
  now,
  filters,
  filtersActive,
  onChange,
  onReset,
  selectedIds,
  onToggle,
  onToggleAll,
  onClearSelection,
  onOpenJob,
  onAssign,
  onSetPriority,
  onCancel,
  onExport,
}: LogisticsTableProps) {
  const driverOf = (job: DispatchJob) => drivers.find(({ id }) => id === job.driverId)
  const selected = jobs.filter(({ id }) => selectedIds.includes(id))
  const allSelected = jobs.length > 0 && selected.length === jobs.length
  const select = `${fieldClass} w-auto!`

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Dispatch Register{' '}
            <span className="font-normal text-muted">
              ({jobs.length} of {totalCount})
            </span>
          </h2>
          <button type="button" onClick={() => onExport(jobs)} className={`${secondaryButton} h-8`}>
            <Download className="size-3.5 text-muted" aria-hidden="true" />
            Export
          </button>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search dispatch jobs"
            placeholder="Search by delivery ID, order, customer, phone, address or driver…"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className={`${fieldClass} h-10 pr-10 pl-9`}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
            /
          </kbd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pickup or delivery"
            value={filters.type}
            onChange={(event) =>
              onChange({ type: event.target.value as LogisticsFilters['type'] })
            }
            className={select}
          >
            <option value="">Pickups & deliveries</option>
            <option value="pickup">Pickups</option>
            <option value="delivery">Deliveries</option>
          </select>
          <select
            aria-label="Status"
            value={filters.status}
            onChange={(event) =>
              onChange({ status: event.target.value as LogisticsFilters['status'] })
            }
            className={select}
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.filter(({ id }) => id !== 'received').map(({ id }) => (
              <option key={id} value={id}>
                {STATUS_LABELS[id][filters.type || 'delivery']}
              </option>
            ))}
          </select>
          <select
            aria-label="Zone"
            value={filters.zone}
            onChange={(event) => onChange({ zone: event.target.value })}
            className={select}
          >
            <option value="">All zones</option>
            {ZONES.map(({ name }) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            aria-label="Priority"
            value={filters.priority}
            onChange={(event) =>
              onChange({ priority: event.target.value as LogisticsFilters['priority'] })
            }
            className={select}
          >
            <option value="">Any priority</option>
            {PRIORITIES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Driver"
            value={filters.driverId}
            onChange={(event) => onChange({ driverId: event.target.value })}
            className={select}
          >
            <option value="">All drivers</option>
            {drivers.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
        >
          <p className="mr-2 text-xs font-bold">Selected: {selected.length}</p>
          <button
            type="button"
            onClick={() => onAssign(selected.map(({ id }) => id))}
            className={bulkActionClass}
          >
            <UserCog className="size-3.5" aria-hidden="true" />
            Assign Driver
          </button>
          <Menu
            align="left"
            trigger={
              <>
                Change Priority
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            }
            triggerClassName={bulkActionClass}
          >
            {(close) =>
              PRIORITIES.map(({ id, label }) => (
                <MenuItem
                  key={id}
                  onSelect={() => {
                    close()
                    onSetPriority(selected.map((job) => job.id), id)
                  }}
                >
                  {label}
                </MenuItem>
              ))
            }
          </Menu>
          <button type="button" onClick={() => onExport(selected)} className={bulkActionClass}>
            <Download className="size-3.5" aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            onClick={() => onCancel(selected.map(({ id }) => id))}
            className={`${bulkActionClass} bg-danger/80 hover:bg-danger`}
          >
            <Ban className="size-3.5" aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Clear selection"
            className={`${bulkActionClass} ml-auto w-8 justify-center px-0`}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
          <p className="text-sm font-bold text-ink">No dispatch jobs match</p>
          <p className="mt-1 text-xs text-muted">Try clearing the filters above.</p>
          <button type="button" onClick={onReset} className={`${secondaryButton} mt-3`}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
            <table className="w-full min-w-[960px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className={`${headClass} w-8`}>
                    <input
                      type="checkbox"
                      aria-label="Select all jobs"
                      checked={allSelected}
                      onChange={(event) => onToggleAll(event.target.checked)}
                      className="size-4 accent-brand"
                    />
                  </th>
                  <th scope="col" className={headClass}>Dispatch ID</th>
                  <th scope="col" className={headClass}>Customer & location</th>
                  <th scope="col" className={headClass}>Driver</th>
                  <th scope="col" className={headClass}>Window / ETA</th>
                  <th scope="col" className={`${headClass} text-right`}>Distance</th>
                  <th scope="col" className={headClass}>Priority</th>
                  <th scope="col" className={headClass}>Payment</th>
                  <th scope="col" className={headClass}>Status</th>
                  <th scope="col" className={`${headClass} right-0 z-20`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const driver = driverOf(job)
                  const checked = selectedIds.includes(job.id)
                  return (
                    <tr
                      key={job.id}
                      className={`border-t border-line transition hover:bg-field/60 ${checked ? 'bg-brand/5' : ''} ${
                        job.status === 'failed'
                          ? 'shadow-[inset_3px_0_0_var(--color-danger)]'
                          : ''
                      }`}
                    >
                      <td className={cellClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${job.id}`}
                          checked={checked}
                          onChange={() => onToggle(job.id)}
                          className="size-4 accent-brand"
                        />
                      </td>
                      <td className={cellClass}>
                        <div className="flex items-start gap-2">
                          <JobTypeIcon job={job} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenJob(job.id)}
                              className="rounded-sm font-bold whitespace-nowrap text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            >
                              {job.id}
                            </button>
                            <span className="block font-mono text-[10px] text-muted">
                              {job.orderId}
                            </span>
                            <span className="block max-w-40 truncate text-[11px] text-muted">
                              {job.manifest}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={cellClass}>
                        <span className="block font-semibold whitespace-nowrap text-ink">
                          {job.customer}
                        </span>
                        <span className="block max-w-48 truncate text-[11px] text-muted">
                          {job.address}, {job.zone}
                        </span>
                      </td>
                      <td className={`${cellClass} whitespace-nowrap`}>
                        {driver ? (
                          <>
                            <span className="block font-semibold text-ink">{driver.name}</span>
                            <span className="block text-[11px] text-muted">
                              {driver.vehicle.split(' · ')[0]}
                            </span>
                          </>
                        ) : (
                          <Badge>Unassigned</Badge>
                        )}
                      </td>
                      <td className={`${cellClass} whitespace-nowrap`}>
                        <span className="block text-ink tabular-nums">
                          {formatClock(job.scheduledAt)}
                        </span>
                        {job.etaMin !== null && !isClosed(job) && (
                          <span className="block text-[11px] font-semibold text-brand">
                            ETA {job.etaMin} min
                          </span>
                        )}
                      </td>
                      <td className={`${cellClass} text-right whitespace-nowrap text-ink tabular-nums`}>
                        {job.distanceKm} km
                      </td>
                      <td className={cellClass}>
                        <JobPriorityBadge job={job} />
                      </td>
                      <td className={cellClass}>
                        <Badge tone={job.paymentTone}>{job.payment}</Badge>
                        {job.amount > 0 && (
                          <span className="mt-0.5 block text-[10px] text-muted tabular-nums">
                            {formatXaf(job.amount)}
                          </span>
                        )}
                      </td>
                      <td className={cellClass}>
                        <JobStatusBadge job={job} now={now} />
                      </td>
                      <td className={`${cellClass} sticky right-0 bg-white`}>
                        <Menu
                          label={`Actions for ${job.id}`}
                          trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                          triggerClassName={iconButton}
                        >
                          {(close) => (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onOpenJob(job.id)
                                }}
                              >
                                <Eye className="size-4 text-muted" aria-hidden="true" />
                                View & Track
                              </MenuItem>
                              {!isClosed(job) && (
                                <MenuItem
                                  onSelect={() => {
                                    close()
                                    onAssign([job.id])
                                  }}
                                >
                                  <UserCog className="size-4 text-muted" aria-hidden="true" />
                                  {driver ? 'Reassign Driver' : 'Assign Driver'}
                                </MenuItem>
                              )}
                              {driver && (
                                <a
                                  href={`tel:${driver.phone.replace(/[^\d+]/g, '')}`}
                                  onClick={close}
                                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field"
                                >
                                  <Phone className="size-4 text-muted" aria-hidden="true" />
                                  Contact Driver
                                </a>
                              )}
                            </>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per job */}
          <ul className="space-y-2 md:hidden">
            {jobs.map((job) => {
              const driver = driverOf(job)
              return (
                <li key={job.id} className="rounded-xl bg-white p-3 ring-1 ring-line">
                  <button
                    type="button"
                    onClick={() => onOpenJob(job.id)}
                    className="flex w-full items-start gap-2.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    <JobTypeIcon job={job} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-brand">{job.id}</span>
                      <span className="block truncate text-xs font-semibold text-ink">
                        {job.customer}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {job.address}, {job.zone}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {formatClock(job.scheduledAt)} · {driver?.name ?? 'Unassigned'} ·{' '}
                        {job.distanceKm} km
                      </span>
                    </span>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <JobStatusBadge job={job} now={now} />
                    {job.priority === 'express' && <JobPriorityBadge job={job} />}
                    {!isClosed(job) && (
                      <button
                        type="button"
                        onClick={() => onAssign([job.id])}
                        className={`${secondaryButton} ml-auto h-7 px-2.5 text-[11px]`}
                      >
                        {driver ? 'Reassign' : 'Assign'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

export default LogisticsTable
