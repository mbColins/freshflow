import type { RefObject } from 'react'
import {
  Ban,
  ClipboardList,
  Download,
  Ellipsis,
  Eye,
  MessageSquare,
  Phone,
  Search,
  X,
} from 'lucide-react'
import { BRANCHES } from '../../constants/orders'
import { DEPARTMENTS, STAFF_STATUSES } from '../../constants/staff'
import type { StaffPermissions } from '../../constants/staff'
import type { StaffFilters, StaffMember, StaffStatus } from '../../types/staff'
import { getLateMinutes } from '../../utils/staff'
import { fieldClass, iconButton, secondaryButton } from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import SegmentedControl from '../ui/SegmentedControl'
import { StaffAvatar, StaffStatusBadge, WorkloadBar } from './StaffBits'

export type StaffView = 'table' | 'cards'

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'cards', label: 'Cards' },
] as const

const QUICK_VIEWS: { value: StaffFilters['view']; label: string }[] = [
  { value: 'overloaded', label: 'Overloaded' },
  { value: 'late', label: 'Late today' },
  { value: 'certExpiring', label: 'Cert expiring' },
]

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'
const bulkActionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

type StaffDirectoryProps = {
  searchRef: RefObject<HTMLInputElement | null>
  staff: StaffMember[]
  totalCount: number
  filters: StaffFilters
  filtersActive: boolean
  onChange: (patch: Partial<StaffFilters>) => void
  onReset: () => void
  view: StaffView
  onViewChange: (view: StaffView) => void
  permissions: StaffPermissions
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onClearSelection: () => void
  onOpen: (id: string) => void
  onAssign: (id: string) => void
  onSuspend: (ids: string[]) => void
  onMessage: (count: number) => void
  onExport: (staff: StaffMember[]) => void
}

function ShiftCell({ member }: { member: StaffMember }) {
  const late = getLateMinutes(member)
  if (!member.shiftStart) return <span className="text-[11px] text-muted">Not scheduled</span>
  return (
    <>
      <span className="block whitespace-nowrap text-ink tabular-nums">
        {member.shiftStart} – {member.shiftEnd}
      </span>
      <span
        className={`block text-[11px] whitespace-nowrap ${late > 0 ? 'font-bold text-warning' : 'text-muted'}`}
      >
        {member.clockIn
          ? `In ${member.clockIn}${late > 0 ? ` · ${late} min late` : ' · on time'}`
          : 'Not clocked in'}
      </span>
    </>
  )
}

function StaffDirectory({
  searchRef,
  staff,
  totalCount,
  filters,
  filtersActive,
  onChange,
  onReset,
  view,
  onViewChange,
  permissions,
  selectedIds,
  onToggle,
  onToggleAll,
  onClearSelection,
  onOpen,
  onAssign,
  onSuspend,
  onMessage,
  onExport,
}: StaffDirectoryProps) {
  const selected = staff.filter(({ id }) => selectedIds.includes(id))
  const allSelected = staff.length > 0 && selected.length === staff.length
  const select = `${fieldClass} w-auto!`

  const cards = (className: string) => (
    <ul className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {staff.map((member) => (
        <li
          key={member.id}
          className="flex min-w-0 flex-col rounded-xl bg-white p-4 ring-1 ring-line"
        >
          <div className="flex items-start gap-3">
            <StaffAvatar member={member} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(member.id)}
                className="block max-w-full truncate rounded-sm text-sm font-bold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {member.name}
              </button>
              <p className="truncate text-[11px] text-muted">
                {member.jobTitle} · {member.branch}
              </p>
            </div>
            <StaffStatusBadge status={member.status} />
          </div>
          <p className="mt-2 flex-1 text-[11px] text-muted">
            <span className="font-semibold text-ink">Current:</span>{' '}
            {member.assignment || 'No active assignment'}
          </p>
          <div className="mt-2 text-xs">
            <ShiftCell member={member} />
          </div>
          <div className="mt-2">
            <WorkloadBar member={member} />
          </div>
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => onOpen(member.id)}
              className={`${secondaryButton} h-8 flex-1`}
            >
              View
            </button>
            {permissions.manage && (
              <button
                type="button"
                onClick={() => onAssign(member.id)}
                className={`${secondaryButton} h-8 flex-1`}
              >
                Assign Work
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Staff Directory{' '}
            <span className="font-normal text-muted">
              ({staff.length} of {totalCount})
            </span>
          </h2>
          <div className="max-md:hidden">
            <SegmentedControl
              label="View"
              options={VIEW_OPTIONS}
              value={view}
              onChange={onViewChange}
            />
          </div>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search staff"
            placeholder="Search staff, employee ID, phone, role, skill…"
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
            aria-label="Status"
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as StaffStatus | '' })}
            className={select}
          >
            <option value="">All statuses</option>
            {STAFF_STATUSES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Department"
            value={filters.department}
            onChange={(event) => onChange({ department: event.target.value })}
            className={select}
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
          <select
            aria-label="Branch"
            value={filters.branch}
            onChange={(event) => onChange({ branch: event.target.value })}
            className={select}
          >
            <option value="">All branches</option>
            {BRANCHES.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </select>
          {QUICK_VIEWS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.view === value}
              onClick={() => onChange({ view: filters.view === value ? '' : value })}
              className={`h-7 rounded-full px-3 text-[11px] font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                filters.view === value
                  ? 'bg-brand text-white'
                  : 'bg-field text-ink hover:bg-brand/10'
              }`}
            >
              {label}
            </button>
          ))}
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

      {selected.length > 0 && view === 'table' && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
        >
          <p className="mr-2 text-xs font-bold">Selected: {selected.length} staff</p>
          <button
            type="button"
            onClick={() => onMessage(selected.length)}
            className={bulkActionClass}
          >
            <MessageSquare className="size-3.5" aria-hidden="true" />
            Send Message
          </button>
          <button type="button" onClick={() => onExport(selected)} className={bulkActionClass}>
            <Download className="size-3.5" aria-hidden="true" />
            Export
          </button>
          {permissions.manage && (
            <button
              type="button"
              onClick={() => onSuspend(selected.map(({ id }) => id))}
              className={`${bulkActionClass} bg-danger/80 hover:bg-danger`}
            >
              <Ban className="size-3.5" aria-hidden="true" />
              Suspend
            </button>
          )}
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

      {staff.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
          <p className="text-sm font-bold text-ink">No staff match</p>
          <p className="mt-1 text-xs text-muted">Try clearing the filters above.</p>
          <button type="button" onClick={onReset} className={`${secondaryButton} mt-3`}>
            Clear Filters
          </button>
        </div>
      ) : view === 'cards' ? (
        cards('')
      ) : (
        <>
          <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className={`${headClass} w-8`}>
                    <input
                      type="checkbox"
                      aria-label="Select all staff"
                      checked={allSelected}
                      onChange={(event) => onToggleAll(event.target.checked)}
                      className="size-4 accent-brand"
                    />
                  </th>
                  <th scope="col" className={headClass}>Staff & ID</th>
                  <th scope="col" className={headClass}>Role & department</th>
                  <th scope="col" className={headClass}>Status</th>
                  <th scope="col" className={headClass}>Shift & attendance</th>
                  <th scope="col" className={headClass}>Current assignment</th>
                  <th scope="col" className={headClass}>Workload</th>
                  {permissions.performance && (
                    <th scope="col" className={`${headClass} text-right`}>Performance</th>
                  )}
                  <th scope="col" className={`${headClass} right-0 z-20`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => {
                  const checked = selectedIds.includes(member.id)
                  return (
                    <tr
                      key={member.id}
                      className={`border-t border-line transition hover:bg-field/60 ${checked ? 'bg-brand/5' : ''}`}
                    >
                      <td className={cellClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${member.name}`}
                          checked={checked}
                          onChange={() => onToggle(member.id)}
                          className="size-4 accent-brand"
                        />
                      </td>
                      <td className={cellClass}>
                        <div className="flex items-center gap-2.5">
                          <StaffAvatar member={member} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpen(member.id)}
                              className="rounded-sm font-semibold whitespace-nowrap text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            >
                              {member.name}
                            </button>
                            <span className="block font-mono text-[10px] text-muted">
                              {member.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={cellClass}>
                        <span className="block max-w-40 font-semibold text-ink">
                          {member.jobTitle}
                        </span>
                        <span className="block text-[11px] text-muted">{member.department}</span>
                      </td>
                      <td className={cellClass}>
                        <StaffStatusBadge status={member.status} />
                      </td>
                      <td className={cellClass}>
                        <ShiftCell member={member} />
                      </td>
                      <td className={`${cellClass} max-w-48`}>
                        <span className="block text-ink">
                          {member.assignment || 'No active assignment'}
                        </span>
                        {member.assignmentRef && (
                          <span className="block font-mono text-[10px] text-brand">
                            {member.assignmentRef}
                          </span>
                        )}
                      </td>
                      <td className={cellClass}>
                        <WorkloadBar member={member} />
                      </td>
                      {permissions.performance && (
                        <td className={`${cellClass} text-right whitespace-nowrap tabular-nums`}>
                          <span className="block text-sm font-bold text-ink">{member.score}%</span>
                          <span className="block text-[10px] text-muted">
                            Attendance {member.attendanceRate}%
                          </span>
                        </td>
                      )}
                      <td className={`${cellClass} sticky right-0 bg-white`}>
                        <Menu
                          label={`Actions for ${member.name}`}
                          trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                          triggerClassName={iconButton}
                        >
                          {(close) => (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onOpen(member.id)
                                }}
                              >
                                <Eye className="size-4 text-muted" aria-hidden="true" />
                                View Profile
                              </MenuItem>
                              {permissions.manage && (
                                <MenuItem
                                  onSelect={() => {
                                    close()
                                    onAssign(member.id)
                                  }}
                                >
                                  <ClipboardList className="size-4 text-muted" aria-hidden="true" />
                                  Assign Work
                                </MenuItem>
                              )}
                              <a
                                href={telHref(member.phone)}
                                onClick={close}
                                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field"
                              >
                                <Phone className="size-4 text-muted" aria-hidden="true" />
                                Call
                              </a>
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
          {/* Mobile: cards instead of the wide table */}
          {cards('md:hidden')}
        </>
      )}
    </section>
  )
}

export default StaffDirectory
