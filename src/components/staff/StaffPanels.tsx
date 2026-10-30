import type { LucideIcon } from 'lucide-react'
import {
  CalendarClock,
  CalendarOff,
  Clock,
  Coffee,
  Lightbulb,
  Trophy,
  TriangleAlert,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react'
import { BRANCHES } from '../../constants/orders'
import { DEPARTMENTS, STAFF_STATUSES } from '../../constants/staff'
import type {
  LeaveRequest,
  OpenShift,
  StaffFilters,
  StaffMember,
  StaffStatus,
} from '../../types/staff'
import { formatDate } from '../../utils/customers'
import {
  formatHours,
  getHoursWorked,
  getLateMinutes,
  getLoad,
  getStaffAlerts,
  isOnDuty,
  isOverloaded,
  toAxisPercent,
} from '../../utils/staff'
import { secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'
import { StaffAvatar, StaffStatusBadge } from './StaffBits'

const smallButton = `${secondaryButton} h-7 px-2.5 text-[11px]`
const thClass =
  'py-1.5 pr-3 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase'

type Shared = { staff: StaffMember[]; now: number }

// ---------- KPI cards ----------

type KpiPatch = Pick<StaffFilters, 'status' | 'view'>

export function StaffKpis({
  staff,
  openShifts,
  filters,
  onSelect,
}: {
  staff: StaffMember[]
  openShifts: OpenShift[]
  filters: StaffFilters
  onSelect: (patch: KpiPatch) => void
}) {
  const count = (status: StaffStatus) =>
    staff.filter((member) => member.status === status).length
  const onDuty = staff.filter(isOnDuty).length
  const late = staff.filter((member) => getLateMinutes(member) > 0).length
  const none: KpiPatch = { status: '', view: '' }

  const cards: {
    label: string
    icon: LucideIcon
    value: number
    note: string
    patch?: KpiPatch
    tone?: 'warning' | 'danger'
  }[] = [
    { label: 'Total Staff', icon: Users, value: staff.length, note: `${new Set(staff.map(({ department }) => department)).size} departments`, patch: none },
    { label: 'On Duty', icon: UserCheck, value: onDuty, note: `${count('working')} working · ${staff.length === 0 ? 0 : Math.round((onDuty / staff.length) * 100)}% of workforce`, patch: { status: '', view: 'onDuty' } },
    { label: 'Available', icon: UserCheck, value: count('available'), note: 'Ready for assignment', patch: { status: 'available', view: '' } },
    { label: 'On Break', icon: Coffee, value: count('break'), note: 'Currently on break', patch: { status: 'break', view: '' } },
    { label: 'Absent', icon: UserX, value: count('absent'), note: 'Scheduled, not clocked in', patch: { status: 'absent', view: '' }, tone: 'danger' },
    { label: 'On Leave', icon: CalendarOff, value: count('leave'), note: 'Approved leave', patch: { status: 'leave', view: '' } },
    { label: 'Late', icon: Clock, value: late, note: 'Clocked in after shift start', patch: { status: '', view: 'late' }, tone: 'warning' },
    { label: 'Open Shifts', icon: UserMinus, value: openShifts.length, note: 'Need staff assignment', tone: 'warning' },
  ]
  const toneClass = { warning: 'text-warning', danger: 'text-danger' }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, icon: Icon, value, note, patch, tone }) => {
        const selected =
          patch !== undefined &&
          patch !== none &&
          filters.status === patch.status &&
          filters.view === patch.view
        const flagged = tone && value > 0 ? toneClass[tone] : ''
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-3.5 shrink-0 ${flagged}`} aria-hidden="true" />
            </span>
            <span className={`mt-1 block text-xl font-bold tabular-nums ${flagged || 'text-ink'}`}>
              {value}
            </span>
            <span className="block truncate text-[10px] text-muted">{note}</span>
          </>
        )
        const base = 'min-w-0 rounded-xl bg-white p-3 text-left'
        return patch ? (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? none : patch)}
            className={`${base} transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              selected ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            {body}
          </button>
        ) : (
          <div key={label} className={`${base} ring-1 ring-line`}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Today's workforce ----------

export function WorkforceOverview({
  staff,
  selected,
  onSelect,
}: {
  staff: StaffMember[]
  selected: StaffStatus | ''
  onSelect: (status: StaffStatus | '') => void
}) {
  const segments = STAFF_STATUSES.map((status) => ({
    ...status,
    count: staff.filter((member) => member.status === status.id).length,
  })).filter(({ count }) => count > 0)
  const share = (count: number) => (staff.length === 0 ? 0 : (count / staff.length) * 100)

  return (
    <Panel title="Today’s Workforce" subtitle={`${staff.length} staff; click a status to filter`}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {segments.map(({ id, color, count }) => (
          <span key={id} style={{ width: `${share(count)}%`, backgroundColor: color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(({ id, label, color, count }) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={selected === id}
              onClick={() => onSelect(selected === id ? '' : id)}
              className={`flex items-center gap-1.5 rounded-sm text-[11px] hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                selected === id ? 'font-bold text-ink underline' : 'text-muted'
              }`}
            >
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {label}
              <span className="font-bold text-ink tabular-nums">
                {count} ({Math.round(share(count))}%)
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ---------- Departments ----------

export function DepartmentCards({
  staff,
  selected,
  onSelect,
}: {
  staff: StaffMember[]
  selected: string
  onSelect: (department: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {DEPARTMENTS.map((department) => {
        const members = staff.filter((member) => member.department === department)
        const active = selected === department
        return (
          <button
            key={department}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? '' : department)}
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            <span className="block truncate text-xs font-bold text-ink">{department}</span>
            <span className="block text-[11px] text-muted">
              {members.length} staff · {members.filter(isOnDuty).length} on duty
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Insights & alerts ----------

export function WorkforceInsights({
  staff,
  openShifts,
  onAssignWork,
  onFillShift,
}: {
  staff: StaffMember[]
  openShifts: OpenShift[]
  onAssignWork: () => void
  onFillShift: (shiftId: string) => void
}) {
  const working = staff.filter(({ status }) => status === 'working')
  const available = staff.filter(({ status }) => status === 'available')
  const overloaded = staff.filter(isOverloaded)
  const averageLoad =
    working.length === 0
      ? 0
      : working.reduce((sum, member) => sum + getLoad(member), 0) / working.length
  const heaviest = [...working].sort((a, b) => getLoad(b) - getLoad(a))[0]
  const insights: { text: string; action?: { label: string; run: () => void } }[] = []

  if (overloaded.length > 0 && available.length > 0) {
    insights.push({
      text: `${overloaded.length} staff ${overloaded.length === 1 ? 'is' : 'are'} overloaded while ${available.length} ${available.length === 1 ? 'is' : 'are'} available. Rebalance open tasks.`,
      action: { label: 'Assign Staff', run: onAssignWork },
    })
  }
  if (heaviest && averageLoad > 0 && getLoad(heaviest) > averageLoad * 1.3) {
    insights.push({
      text: `${heaviest.name} is carrying ${Math.round((getLoad(heaviest) / averageLoad - 1) * 100)}% more workload than the team average.`,
    })
  }
  insights.push({
    text: `Staff on the floor are operating at ${Math.round(averageLoad * 100)}% of capacity on average.`,
  })
  for (const shift of openShifts) {
    insights.push({
      text: `Open shift: ${shift.title}, ${shift.start}–${shift.end} (${shift.department}).`,
      action: { label: 'Fill Shift', run: () => onFillShift(shift.id) },
    })
  }

  return (
    <Panel title="Workforce Insights" icon={Lightbulb} subtitle="Computed from current status and workload">
      <ul className="space-y-2">
        {insights.map(({ text, action }) => (
          <li
            key={text}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-field px-3 py-2 text-xs text-ink"
          >
            <span className="min-w-40 flex-1">{text}</span>
            {action && (
              <button type="button" onClick={action.run} className={`${smallButton} font-bold`}>
                {action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function StaffAlerts({
  staff,
  now,
  onOpen,
}: Shared & { onOpen: (id: string) => void }) {
  const alerts = getStaffAlerts(staff, now)
  return (
    <Panel
      title="Needs Attention"
      icon={TriangleAlert}
      badge={alerts.length > 0 && <Badge tone="danger">{alerts.length}</Badge>}
    >
      {alerts.length === 0 ? (
        <PanelEmpty>No attendance, workload or certification issues.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {alerts.map(({ member, title, body }) => (
            <li
              key={member.id + title}
              className="flex flex-wrap items-start gap-3 rounded-lg bg-warning/5 p-3 ring-1 ring-warning/20"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-40 flex-1 text-xs">
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-[11px] text-muted">{body}</p>
              </div>
              <button type="button" onClick={() => onOpen(member.id)} className={smallButton}>
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Shift roster ----------

const AXIS_START = 6
const AXIS_END = 21
const AXIS_TICKS = [6, 9, 12, 15, 18, 21]

export function ShiftRoster({
  staff,
  openShifts,
  now,
  canManage,
  onOpen,
  onFillShift,
  onCancelShift,
  onNewShift,
}: Shared & {
  openShifts: OpenShift[]
  canManage: boolean
  onOpen: (id: string) => void
  onFillShift: (shiftId: string) => void
  onCancelShift: (shiftId: string) => void
  onNewShift: () => void
}) {
  const scheduled = staff
    .filter(({ shiftStart }) => shiftStart)
    .sort((a, b) => a.shiftStart.localeCompare(b.shiftStart))
  const date = new Date(now)
  const nowPercent =
    ((date.getHours() + date.getMinutes() / 60 - AXIS_START) / (AXIS_END - AXIS_START)) * 100
  const barStyle = (start: string, end: string) => {
    const left = toAxisPercent(start, AXIS_START, AXIS_END)
    return { left: `${left}%`, width: `${toAxisPercent(end, AXIS_START, AXIS_END) - left}%` }
  }

  return (
    <Panel
      title="Today’s Shift Schedule"
      subtitle={`${scheduled.length} scheduled · ${openShifts.length} open ${openShifts.length === 1 ? 'shift' : 'shifts'}`}
      icon={CalendarClock}
      action={
        canManage && (
          <button type="button" onClick={onNewShift} className={`${smallButton} font-bold`}>
            + New Shift
          </button>
        )
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="ml-36 flex justify-between text-[10px] text-muted tabular-nums">
            {AXIS_TICKS.map((hour) => (
              <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
            ))}
          </div>
          <ul className="relative mt-1 space-y-1.5">
            {scheduled.map((member) => (
              <li key={member.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(member.id)}
                  className="w-34 shrink-0 truncate rounded-sm text-left text-[11px] font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {member.name}
                </button>
                <div className="relative h-6 flex-1 rounded-md bg-field">
                  <div
                    className={`absolute inset-y-0.5 flex items-center rounded px-2 text-[10px] font-semibold whitespace-nowrap text-white ${
                      member.status === 'absent'
                        ? 'bg-danger'
                        : isOnDuty(member)
                          ? 'bg-brand'
                          : 'bg-muted/60'
                    }`}
                    style={barStyle(member.shiftStart, member.shiftEnd)}
                    title={`${member.shiftStart}–${member.shiftEnd}`}
                  >
                    {member.shiftStart}–{member.shiftEnd}
                    {member.status === 'absent' && ' · absent'}
                  </div>
                </div>
              </li>
            ))}
            {openShifts.map((shift) => (
              <li key={shift.id} className="flex items-center gap-2">
                <span className="w-34 shrink-0 truncate text-[11px] font-semibold text-warning">
                  Open: {shift.title}
                </span>
                <div className="relative h-6 flex-1 rounded-md bg-field">
                  <div
                    className="absolute inset-y-0.5 flex items-center justify-between gap-2 rounded border border-dashed border-warning bg-warning/10 px-2 text-[10px] font-semibold whitespace-nowrap text-warning"
                    style={barStyle(shift.start, shift.end)}
                  >
                    {shift.start}–{shift.end}
                    {canManage && (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onFillShift(shift.id)}
                          className="rounded-sm font-bold underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          Fill
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelShift(shift.id)}
                          className="rounded-sm font-bold underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {nowPercent >= 0 && nowPercent <= 100 && (
              <li
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 left-36"
              >
                <span
                  className="absolute inset-y-0 w-px bg-ink"
                  style={{ left: `${nowPercent}%` }}
                />
              </li>
            )}
          </ul>
          <p className="mt-2 text-[10px] text-muted">
            Blue = on the floor, grey = not yet started, red = absent, dashed = unfilled.
            The vertical line is the current time.
          </p>
        </div>
      </div>
    </Panel>
  )
}

// ---------- Attendance ----------

export function AttendancePanel({ staff, now }: Shared) {
  const scheduled = staff.filter(({ shiftStart }) => shiftStart)
  const present = scheduled.filter(({ clockIn }) => clockIn)
  const hours = present.map((member) => getHoursWorked(member, now))
  const facts: [string, string][] = [
    ['Attendance today', `${scheduled.length === 0 ? 0 : Math.round((present.length / scheduled.length) * 100)}%`],
    ['Late today', String(staff.filter((member) => getLateMinutes(member) > 0).length)],
    ['Absent today', String(staff.filter(({ status }) => status === 'absent').length)],
    ['Avg hours so far', hours.length === 0 ? '—' : formatHours(hours.reduce((a, b) => a + b, 0) / hours.length)],
  ]

  return (
    <Panel title="Attendance" icon={Clock}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-md bg-field px-3 py-2">
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="relative mt-3 max-h-72 overflow-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Staff</th>
              <th scope="col" className={thClass}>Scheduled</th>
              <th scope="col" className={thClass}>Clock-in</th>
              <th scope="col" className={thClass}>Break</th>
              <th scope="col" className={thClass}>Hours so far</th>
              <th scope="col" className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map((member) => {
              const late = getLateMinutes(member)
              return (
                <tr key={member.id} className="border-t border-line tabular-nums">
                  <td className="py-2 pr-3 font-semibold whitespace-nowrap text-ink">
                    {member.name}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {member.shiftStart}–{member.shiftEnd}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {member.clockIn || '—'}
                    {late > 0 && (
                      <span className="ml-1.5 font-bold text-warning">+{late} min late</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {member.breakMinutes > 0 ? `${member.breakMinutes} min` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {member.clockIn ? formatHours(getHoursWorked(member, now)) : '—'}
                  </td>
                  <td className="py-2">
                    {member.clockIn ? (
                      <Badge tone={late > 0 ? 'warning' : 'success'}>
                        {late > 0 ? 'Late' : 'Present'}
                      </Badge>
                    ) : (
                      <StaffStatusBadge status={member.status} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// ---------- Leaderboard, leave, branches ----------

export function Leaderboard({
  staff,
  onOpen,
}: {
  staff: StaffMember[]
  onOpen: (id: string) => void
}) {
  const ranked = [...staff]
    .filter(({ status }) => status !== 'suspended')
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  return (
    <Panel
      title="Performance Insights"
      subtitle="Overall score from on-time work, quality and attendance"
      icon={Trophy}
    >
      <ol className="space-y-2">
        {ranked.map((member, index) => (
          <li key={member.id} className="flex items-center gap-3 text-xs">
            <span className="w-4 text-center font-bold text-muted tabular-nums">{index + 1}</span>
            <StaffAvatar member={member} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(member.id)}
                className="block truncate rounded-sm font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {member.name}
              </button>
              <span className="block truncate text-[11px] text-muted">
                {member.jobTitle} · on-time {member.onTime}% · quality {member.quality}%
              </span>
            </div>
            <span className="text-sm font-bold text-ink tabular-nums">{member.score}%</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

const LEAVE_TONES = { Pending: 'warning', Approved: 'success', Rejected: 'danger' } as const

export function LeavePanel({
  requests,
  staff,
  canManage,
  onDecide,
  onCancel,
  onRequest,
}: {
  requests: LeaveRequest[]
  staff: StaffMember[]
  canManage: boolean
  onDecide: (id: string, approve: boolean) => void
  onCancel: (id: string) => void
  onRequest: () => void
}) {
  return (
    <Panel
      title="Leave"
      icon={CalendarOff}
      action={
        <button type="button" onClick={onRequest} className={`${smallButton} font-bold`}>
          Request Leave
        </button>
      }
    >
      {requests.length === 0 ? (
        <PanelEmpty>No leave requests.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => {
            const member = staff.find(({ id }) => id === request.staffId)
            return (
              <li key={request.id} className="rounded-lg bg-field p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {member?.name ?? request.staffId}
                    <span className="font-normal text-muted"> · {request.type} leave</span>
                  </p>
                  <Badge tone={LEAVE_TONES[request.status]}>{request.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {formatDate(request.from)} to {formatDate(request.to)} · {request.reason}
                  {request.approver && ` · decided by ${request.approver}`}
                </p>
                {request.status === 'Pending' && (
                  <div className="mt-2 flex gap-1.5">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => onDecide(request.id, true)}
                          className={`${smallButton} font-bold`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onDecide(request.id, false)}
                          className={smallButton}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => onCancel(request.id)} className={`${smallButton} text-danger`}>
                      Withdraw
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function BranchStaffTable({
  staff,
  onSelect,
}: {
  staff: StaffMember[]
  onSelect: (branch: string) => void
}) {
  return (
    <Panel title="Staff by Branch">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Branch</th>
              <th scope="col" className={`${thClass} text-right`}>Staff</th>
              <th scope="col" className={`${thClass} text-right`}>On duty</th>
              <th scope="col" className={`${thClass} text-right`}>Available</th>
              <th scope="col" className={`${thClass} text-right`}>Absent</th>
            </tr>
          </thead>
          <tbody>
            {BRANCHES.map((branch) => {
              const members = staff.filter((member) => member.branch === branch)
              const count = (status: StaffStatus) =>
                members.filter((member) => member.status === status).length
              return (
                <tr key={branch} className="border-t border-line tabular-nums">
                  <th scope="row" className="py-2 pr-3 text-left">
                    <button
                      type="button"
                      onClick={() => onSelect(branch)}
                      className="rounded-sm font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    >
                      {branch}
                    </button>
                  </th>
                  <td className="py-2 pr-3 text-right">{members.length}</td>
                  <td className="py-2 pr-3 text-right">{members.filter(isOnDuty).length}</td>
                  <td className="py-2 pr-3 text-right">{count('available')}</td>
                  <td className="py-2 text-right">{count('absent')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
