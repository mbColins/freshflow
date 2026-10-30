import { useState } from 'react'
import { Link } from 'react-router'
import { Check, ClipboardList, Clock, Minus, Phone, ShieldCheck } from 'lucide-react'
import { PERMISSION_MODULES, ROLE_TEMPLATES } from '../../constants/staff'
import type { StaffPermissions } from '../../constants/staff'
import type { StaffMember } from '../../types/staff'
import { formatDate } from '../../utils/customers'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import {
  formatHours,
  getActiveTasks,
  getCertDays,
  getHoursWorked,
  getLateMinutes,
} from '../../utils/staff'
import { primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { StaffStatusBadge, WorkloadBar } from './StaffBits'
import { AttendanceHistorySection, TasksSection, TrainingSection } from './StaffDrawerData'
import { DetailBox } from '../ui/Details'

type Tab = 'overview' | 'work' | 'performance' | 'skills' | 'permissions' | 'activity' | 'pay'

type StaffDrawerProps = {
  member: StaffMember | null
  now: number
  permissions: StaffPermissions
  onClose: () => void
  onAssign: (id: string) => void
  onAttendance: (id: string) => void
  onToggleSuspended: (id: string) => void
  // Deletes the user account on the server
  onDelete: (id: string) => void
}

function StaffDrawer({
  member,
  now,
  permissions,
  onClose,
  onAssign,
  onAttendance,
  onToggleSuspended,
  onDelete,
}: StaffDrawerProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'work', label: 'Work' },
    ...(permissions.performance
      ? ([{ id: 'performance', label: 'Performance' }] as { id: Tab; label: string }[])
      : []),
    { id: 'skills', label: 'Skills' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'activity', label: 'Activity' },
    ...(permissions.payroll ? ([{ id: 'pay', label: 'Pay' }] as { id: Tab; label: string }[]) : []),
  ]
  const active = tabs.some(({ id }) => id === tab) ? tab : 'overview'
  const certDays = member ? getCertDays(member, now) : null
  const granted = member ? (ROLE_TEMPLATES[member.template] ?? {}) : {}

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      variant="drawer"
      title={member?.name ?? ''}
      subtitle={
        member && (
          <span className="flex flex-wrap items-center gap-2">
            <StaffStatusBadge status={member.status} />
            <span>{member.jobTitle}</span>
            <span className="font-mono">{member.username ? `@${member.username}` : member.id}</span>
            <span>{member.branch}</span>
          </span>
        )
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      {member && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {permissions.manage && member.status !== 'suspended' && (
              <>
                <button type="button" onClick={() => onAssign(member.id)} className={primaryButton}>
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Assign Work
                </button>
                <button
                  type="button"
                  onClick={() => onAttendance(member.id)}
                  className={secondaryButton}
                >
                  <Clock className="size-4 text-muted" aria-hidden="true" />
                  Attendance
                </button>
              </>
            )}
            <a
              href={`tel:${member.phone.replace(/[^\d+]/g, '')}`}
              className={secondaryButton}
            >
              <Phone className="size-4 text-muted" aria-hidden="true" />
              Call
            </a>
            {permissions.manage && (
              <button
                type="button"
                onClick={() => onToggleSuspended(member.id)}
                className={secondaryButton}
              >
                {member.status === 'suspended' ? 'Enable Account' : 'Disable Account'}
              </button>
            )}
            {permissions.manage && (
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className={`${secondaryButton} text-danger`}
              >
                Delete Account
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Today’s tasks', String(member.tasksAssigned)],
                ['Completed', String(member.tasksDone)],
                ['Attendance', `${member.attendanceRate}%`],
                permissions.performance
                  ? ['Performance', `${member.score}%`]
                  : ['Open tasks', String(getActiveTasks(member))],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-field px-3 py-2">
                <dt className="text-[10px] font-semibold text-muted">{label}</dt>
                <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div
            role="tablist"
            aria-label="Staff profile sections"
            className="flex gap-1 overflow-x-auto rounded-lg bg-field p-1"
          >
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === active}
                onClick={() => setTab(id)}
                className={`h-7 shrink-0 rounded-md px-2.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  id === active ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {active === 'overview' && (
            <div className="space-y-4">
              <section>
                <h3 className={sectionTitle}>Employment</h3>
                <div className="mt-2">
                  <DetailBox
                    rows={[
                      ['Department', member.department],
                      ['Employment type', member.employment],
                      ['Hire date', member.hiredAt ? formatDate(member.hiredAt) : 'Not recorded'],
                      ['Manager', member.manager],
                      ['Working days', member.workingDays],
                      ['System role', member.template],
                    ]}
                  />
                </div>
              </section>
              <section>
                <h3 className={sectionTitle}>Contact</h3>
                <div className="mt-2">
                  <DetailBox
                    rows={[
                      ['Phone', member.phone],
                      ['Email', member.email],
                      ['Emergency contact', member.emergencyContact],
                      ['Leave balance', `${member.leaveBalance} days`],
                    ]}
                  />
                </div>
              </section>
            </div>
          )}

          {active === 'work' && (
            <div className="space-y-4">
              <section>
                <h3 className={sectionTitle}>Current work</h3>
                <div className="mt-2 rounded-lg bg-field p-3 text-xs">
                  <p className="font-semibold text-ink">
                    {member.assignment || 'No work assigned.'}
                  </p>
                  {member.assignmentRef.startsWith('ORD-') && (
                    <Link
                      to={`/orders?order=${member.assignmentRef}`}
                      className="mt-1 inline-block rounded-sm font-semibold text-brand hover:underline"
                    >
                      View Order {member.assignmentRef}
                    </Link>
                  )}
                </div>
              </section>
              <section>
                <h3 className={sectionTitle}>Today’s workload</h3>
                <div className="mt-2 rounded-lg bg-white p-3 ring-1 ring-line">
                  <WorkloadBar member={member} />
                  <p className="mt-2 text-[11px] text-muted">
                    Assigned {member.tasksAssigned} · completed {member.tasksDone} · active{' '}
                    {getActiveTasks(member)} · overdue{' '}
                    <span className={member.tasksOverdue > 0 ? 'font-bold text-danger' : ''}>
                      {member.tasksOverdue}
                    </span>
                  </p>
                </div>
              </section>
              <section>
                <h3 className={sectionTitle}>Shift & attendance today</h3>
                <div className="mt-2">
                  <DetailBox
                    rows={[
                      ['Shift', member.shiftStart ? `${member.shiftStart} – ${member.shiftEnd}` : 'Not scheduled'],
                      ['Clock-in', member.clockIn || 'Not clocked in'],
                      ['Late', getLateMinutes(member) > 0 ? `${getLateMinutes(member)} min` : 'No'],
                      ['Break taken', `${member.breakMinutes} min`],
                      ['Hours so far', member.clockIn ? formatHours(getHoursWorked(member, now)) : '—'],
                      ['Late this month', `${member.lateThisMonth} times`],
                    ]}
                  />
                </div>
              </section>
              <TasksSection userId={member.id} canManage={permissions.manage} />
              <AttendanceHistorySection userId={member.id} />
            </div>
          )}

          {active === 'performance' && (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-ink tabular-nums">{member.score}%</p>
              <ul className="space-y-2.5">
                {(
                  [
                    ['On-time completion', member.onTime],
                    ['QC pass rate', member.quality],
                    ['Attendance', member.attendanceRate],
                    ['Training completed', (member.trainingDone / member.trainingTotal) * 100],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <li key={label} className="text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">{label}</span>
                      <span className="font-bold text-ink tabular-nums">{value.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Customer rating:{' '}
                <span className="font-bold text-ink">{member.rating} / 5</span> · tasks completed
                today: <span className="font-bold text-ink">{member.tasksDone}</span>
              </p>
            </div>
          )}

          {active === 'skills' && (
            <div className="space-y-4">
              <ul className="space-y-1.5">
                {member.skills.map(({ name, level }) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-lg bg-field px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-ink">{name}</span>
                    <Badge tone={level === 'Expert' ? 'success' : level === 'Advanced' ? 'brand' : 'neutral'}>
                      {level}
                    </Badge>
                  </li>
                ))}
              </ul>
              <section>
                <h3 className={sectionTitle}>Certification & training</h3>
                <div className="mt-2">
                  <DetailBox
                    rows={[
                      ['Certification', member.certification?.name ?? 'None on file'],
                      [
                        'Expires',
                        member.certification && certDays !== null ? (
                          <span className={certDays <= 30 ? 'text-warning' : ''}>
                            {formatDate(member.certification.expiresAt)} ({certDays} days)
                          </span>
                        ) : (
                          '—'
                        ),
                      ],
                      ['Training modules', `${member.trainingDone} / ${member.trainingTotal} completed`],
                    ]}
                  />
                </div>
              </section>
              <TrainingSection userId={member.id} canManage={permissions.manage} />
            </div>
          )}

          {active === 'permissions' && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
                Role template:{' '}
                <span className="font-semibold text-ink">{member.template}</span>
              </p>
              {!ROLE_TEMPLATES[member.template] && (
                <p className="rounded-lg bg-field px-3 py-2 text-[11px] text-muted">
                  This role’s permissions are set on the server and aren’t shown here yet.
                </p>
              )}
              <div className={`relative overflow-x-auto rounded-lg ring-1 ring-line ${ROLE_TEMPLATES[member.template] ? '' : 'hidden'}`}>
                <table className="w-full min-w-[420px] text-left text-xs">
                  <tbody>
                    {Object.entries(PERMISSION_MODULES).map(([module, actions]) => (
                      <tr key={module} className="border-t border-line first:border-0">
                        <th scope="row" className="bg-field px-3 py-2 font-semibold text-ink">
                          {module}
                        </th>
                        <td className="px-3 py-2">
                          <ul className="flex flex-wrap gap-x-3 gap-y-1">
                            {actions.map((action) => {
                              const allowed = granted[module]?.includes(action) ?? false
                              return (
                                <li
                                  key={action}
                                  className={`flex items-center gap-1 ${allowed ? 'font-semibold text-ink' : 'text-muted/60'}`}
                                >
                                  {allowed ? (
                                    <Check className="size-3 text-success" aria-hidden="true" />
                                  ) : (
                                    <Minus className="size-3" aria-hidden="true" />
                                  )}
                                  {action}
                                  <span className="sr-only">
                                    {allowed ? '(allowed)' : '(not allowed)'}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DetailBox
                rows={[
                  ['Login access', member.loginAccess ? 'Enabled' : 'Disabled'],
                  ['Two-factor authentication', member.twoFactor ? 'On' : 'Off'],
                  [
                    'Last login',
                    member.lastLoginAt ? `${formatDate(member.lastLoginAt)}, ${formatClock(member.lastLoginAt)}` : 'Never',
                  ],
                  ['Account status', member.status === 'suspended' ? 'Disabled' : 'Active'],
                ]}
              />
            </div>
          )}

          {active === 'activity' && (
            <ol className="space-y-3 border-l border-line pl-4">
              {member.activity.map((entry, index) => (
                <li key={entry.at + index} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
                  <time className="block text-[10px] text-muted">
                    {formatDate(entry.at)} · {formatClock(entry.at)}
                  </time>
                  <p className="font-semibold text-ink">{entry.text}</p>
                </li>
              ))}
            </ol>
          )}

          {active === 'pay' && (
            <div className="space-y-2">
              <DetailBox
                rows={[
                  ['Base salary', `${formatXaf(member.monthlySalary)} / month`],
                  ['Employment type', member.employment],
                ]}
              />
              <p className="text-[10px] text-muted">
                Visible to administrators only. Overtime, bonuses and deductions are not
                tracked yet.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default StaffDrawer
