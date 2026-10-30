import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react'
import {
  DEPARTMENT_CODES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  LEAVE_TYPES,
  PERMISSION_MODULES,
  ROLE_TEMPLATES,
  SKILL_CODES,
  SKILLS,
  SKILL_LEVELS,
  TASK_TYPES,
  WEEKDAYS,
} from '../../constants/staff'
import type {
  OpenShift,
  SkillLevel,
  StaffMember,
} from '../../types/staff'
import { USER_TYPES } from '../../constants/users'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import { useRecommendStaffQuery } from '../../services/staffTeamApi'
import type { ShiftBody } from '../../services/staffTeamApi'
import { useGetRoleDropdownQuery } from '../../services/userApi'
import type { UserType, Weekday } from '../../types/user'
import { toLocalInput } from '../../utils/dates'
import { formatXaf } from '../../utils/orders'
import { formatWorkingDays, recommendStaff } from '../../utils/staff'
import { USERNAME_PATTERN } from '../../utils/tenants'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Badge from '../ui/Badge'
import FormAlert from '../ui/FormAlert'
import Modal from '../ui/Modal'
import { StaffAvatar, StaffStatusBadge } from './StaffBits'
import FormField from '../ui/FormField'

const pickClass =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function nowClock() {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// ---------- Assign work ----------

export function AssignWorkDialog({
  staff,
  initialStaffId,
  onClose,
  onAssign,
}: {
  staff: StaffMember[]
  initialStaffId: string
  onClose: () => void
  onAssign: (staffId: string, task: string, reference: string) => void
}) {
  const [task, setTask] = useState(TASK_TYPES[0])
  const [reference, setReference] = useState('')
  const [staffId, setStaffId] = useState(initialStaffId)
  // The server ranks on duty first, then skill, then least loaded; until it
  // answers (or if it refuses), the page's own ranking stands in
  const server = useRecommendStaffQuery({ skill: SKILL_CODES[task.skill] })
  const local = recommendStaff(staff, task.skill)
  const ranked = server.data
    ? server.data.flatMap((candidate) => {
        const member = staff.find(({ id }) => id === candidate.id)
        return member
          ? [
              {
                member,
                // No score from the server: the order is the recommendation
                match: null as number | null,
                reasons: [
                  candidate.skillLevel ? `${task.skill}: ${candidate.skillLevel.toLowerCase()}` : `No ${task.skill} skill on record`,
                  candidate.onDuty ? 'On duty' : 'Not clocked in',
                  `${Math.round(candidate.load * 100)}% of today’s capacity`,
                ],
              },
            ]
          : []
      })
    : local.map((entry) => ({ ...entry, match: entry.match as number | null }))

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign Work"
      subtitle="Staff on the floor, ranked by skill, availability and current workload."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!staffId}
            onClick={() => onAssign(staffId, task.label, reference.trim())}
            className={primaryButton}
          >
            Assign
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Type of work" htmlFor="assign-task">
            <select
              id="assign-task"
              value={task.label}
              onChange={(event) =>
                setTask(TASK_TYPES.find(({ label }) => label === event.target.value)!)
              }
              className={fieldClass}
            >
              {TASK_TYPES.map(({ label }) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Order or job reference (optional)" htmlFor="assign-reference">
            <input
              id="assign-reference"
              placeholder="e.g. ORD-10521"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={fieldClass}
            />
          </FormField>
        </div>

        <fieldset>
          <legend className={sectionTitle}>Recommended staff (needs {task.skill})</legend>
          {ranked.length === 0 ? (
            <p className="mt-2 rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
              Nobody is on the floor right now.
            </p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {ranked.map(({ member, match, reasons }, index) => (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={staffId === member.id}
                    onClick={() => setStaffId(member.id)}
                    className={`${pickClass} ${
                      staffId === member.id
                        ? 'bg-brand/5 ring-2 ring-brand'
                        : 'bg-field hover:bg-brand/10'
                    }`}
                  >
                    <StaffAvatar member={member} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {member.name}
                        {index === 0 && <Badge tone="success">Best match</Badge>}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {reasons.join(' · ')}
                      </span>
                    </span>
                    {match !== null && (
                      <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                        {match}%
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </Modal>
  )
}

// ---------- Attendance ----------

const ATTENDANCE_ACTIONS = [
  'Clock in',
  'Clock out',
  'Start break',
  'End break',
  'Mark absent',
] as const

export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number]

export function AttendanceDialog({
  staff,
  initialStaffId,
  onClose,
  onSubmit,
}: {
  staff: StaffMember[]
  initialStaffId: string
  onClose: () => void
  onSubmit: (staffId: string, action: AttendanceAction, time: string) => void
}) {
  const [staffId, setStaffId] = useState(initialStaffId)
  const [action, setAction] = useState<AttendanceAction>('Clock in')
  const [time, setTime] = useState(nowClock)
  const member = staff.find(({ id }) => id === staffId)

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Record Attendance"
      subtitle="Manual entry; recorded in the staff member’s activity."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!member || !time}
            onClick={() => onSubmit(staffId, action, time)}
            className={primaryButton}
          >
            Record
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Staff member" htmlFor="attendance-staff">
          <select
            id="attendance-staff"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose staff…</option>
            {staff.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.id})
              </option>
            ))}
          </select>
        </FormField>
        {member && (
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <StaffStatusBadge status={member.status} />
            {member.shiftStart
              ? `Shift ${member.shiftStart}–${member.shiftEnd}`
              : 'Not scheduled today'}
            {member.clockIn && ` · clocked in ${member.clockIn}`}
          </p>
        )}
        <FormField label="Action" htmlFor="attendance-action">
          <select
            id="attendance-action"
            value={action}
            onChange={(event) => setAction(event.target.value as AttendanceAction)}
            className={fieldClass}
          >
            {ATTENDANCE_ACTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </FormField>
        {action !== 'Mark absent' && (
          <FormField label="Time" htmlFor="attendance-time">
            <input
              id="attendance-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={fieldClass}
            />
          </FormField>
        )}
      </div>
    </Modal>
  )
}

// ---------- Fill an open shift ----------

const overlaps = (member: StaffMember, shift: OpenShift) =>
  member.shiftStart !== '' && member.shiftStart < shift.end && shift.start < member.shiftEnd

export function FillShiftDialog({
  shift,
  staff,
  onClose,
  onFill,
}: {
  shift: OpenShift
  staff: StaffMember[]
  onClose: () => void
  onFill: (shiftId: string, staffId: string) => void
}) {
  const [staffId, setStaffId] = useState('')
  const candidates = staff
    .filter(({ status }) => !['absent', 'leave', 'suspended'].includes(status))
    .map((member) => ({
      member,
      level: member.skills.find(({ name }) => name === shift.skill)?.level,
      conflict: overlaps(member, shift),
    }))
    .sort(
      (a, b) =>
        Number(a.conflict) - Number(b.conflict) ||
        (b.level ? SKILL_LEVELS.indexOf(b.level) : -1) -
          (a.level ? SKILL_LEVELS.indexOf(a.level) : -1),
    )
  const chosen = candidates.find(({ member }) => member.id === staffId)

  return (
    <Modal
      open
      onClose={onClose}
      title="Fill Open Shift"
      subtitle={`${shift.title} · ${shift.start}–${shift.end} · ${shift.department}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!chosen}
            onClick={() => onFill(shift.id, staffId)}
            className={primaryButton}
          >
            {chosen?.conflict ? 'Override & Assign' : 'Assign Staff'}
          </button>
        </>
      }
    >
      <ul className="max-h-80 space-y-1.5 overflow-y-auto">
        {candidates.map(({ member, level, conflict }) => (
          <li key={member.id}>
            <button
              type="button"
              aria-pressed={staffId === member.id}
              onClick={() => setStaffId(member.id)}
              className={`${pickClass} ${
                staffId === member.id ? 'bg-brand/5 ring-2 ring-brand' : 'bg-field hover:bg-brand/10'
              }`}
            >
              <StaffAvatar member={member} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{member.name}</span>
                <span className="block truncate text-[11px] text-muted">
                  {level ? `${shift.skill}: ${level}` : `No ${shift.skill} skill on record`}
                  {member.shiftStart && ` · today ${member.shiftStart}–${member.shiftEnd}`}
                </span>
              </span>
              {conflict && (
                <Badge tone="warning">
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Overlaps
                </Badge>
              )}
            </button>
          </li>
        ))}
      </ul>
      {chosen?.conflict && (
        <p className="mt-3 rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
          Schedule conflict: {chosen.member.name} is already scheduled{' '}
          {chosen.member.shiftStart}–{chosen.member.shiftEnd}, which overlaps this shift.
          Assigning extends their day.
        </p>
      )}
    </Modal>
  )
}

// ---------- Leave request ----------

export type LeaveInput = {
  staffId: string
  type: string
  from: string
  to: string
  reason: string
}

export function LeaveDialog({
  staff,
  onClose,
  onSubmit,
}: {
  staff: StaffMember[]
  onClose: () => void
  onSubmit: (input: LeaveInput) => void
}) {
  const [staffId, setStaffId] = useState('')
  const [type, setType] = useState(LEAVE_TYPES[0])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const member = staff.find(({ id }) => id === staffId)
  const valid = member !== undefined && from !== '' && to !== '' && from <= to

  return (
    <Modal
      open
      onClose={onClose}
      title="Request Leave"
      footer={
        <>
          {member && (
            <p className="mr-auto text-xs text-muted">
              Available balance:{' '}
              <span className="font-bold text-ink">{member.leaveBalance} days</span>
            </p>
          )}
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                staffId,
                type,
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
                reason: reason.trim() || 'No reason given',
              })
            }
            className={primaryButton}
          >
            Submit Request
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Staff member" htmlFor="leave-staff">
          <select
            id="leave-staff"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose staff…</option>
            {staff.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Leave type" htmlFor="leave-type">
          <select
            id="leave-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={fieldClass}
          >
            {LEAVE_TYPES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Start date" htmlFor="leave-from">
          <input
            id="leave-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField label="End date" htmlFor="leave-to">
          <input
            id="leave-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField label="Reason" htmlFor="leave-reason" wide>
          <input
            id="leave-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
          />
        </FormField>
      </div>
    </Modal>
  )
}

// ---------- Add staff wizard ----------

const WIZARD_STEPS = ['Personal', 'Employment', 'Role & Access', 'Schedule', 'Skills', 'Review']

// The user types a staff account can have
const STAFF_USER_TYPES: UserType[] = [
  'STAFF_MEMBER',
  'WASHER',
  'DRY_CLEANER',
  'FRONT_DESK',
  'DELIVERY_AGENT',
  'STORE_MANAGER',
  'MANAGER',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// An optional amount: empty, or a number of 0 or more
const isAmount = (value: string) => value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)

// Account fields go to POST /users; the rest (job title, department,
// employment, schedule, skills…) is kept for this session only until the
// backend stores it
export type NewStaffInput = {
  username: string
  firstName: string
  lastName: string
  phone: string
  // Required: the backend emails the generated password here
  email: string
  city: string
  neighborhood: string
  userType: UserType
  // Branch uuid ('' = none) and its name for display
  branchUuid: string
  // Role id from GET /role/dropdown; null = none
  roleId: number | null
  emergencyContact: string
  jobTitle: string
  department: string
  branch: string
  employment: string
  template: string
  loginAccess: boolean
  twoFactor: boolean
  shiftStart: string
  shiftEnd: string
  workingDays: Weekday[]
  skills: { name: string; level: SkillLevel }[]
  // YYYY-MM-DD
  hiredAt: string
  // The manager's user uuid ('' = none)
  managerId: string
  // Typed as text so an empty field reads as "not set", not 0
  monthlySalary: string
  leaveBalance: string
  certificationName: string
  // YYYY-MM-DD, optional
  certificationExpiresAt: string
}

export function StaffWizard({
  saving = false,
  error,
  managers = [],
  onClose,
  onCreate,
}: {
  saving?: boolean
  // Who the new person can report to
  managers?: { id: string; name: string }[]
  // Server error from the last attempt, shown above the steps
  error?: string | null
  onClose: () => void
  onCreate: (input: NewStaffInput) => void
}) {
  const [step, setStep] = useState(0)
  const branches = useGetBranchDropdownQuery()
  const roles = useGetRoleDropdownQuery()
  // Lazy so today's date is read once, not on every render
  const [draft, setDraft] = useState<NewStaffInput>(() => ({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    neighborhood: '',
    userType: 'STAFF_MEMBER',
    branchUuid: '',
    roleId: null,
    emergencyContact: '',
    jobTitle: '',
    department: DEPARTMENTS[0],
    branch: 'No branch',
    employment: EMPLOYMENT_TYPES[0],
    template: '',
    loginAccess: true,
    twoFactor: false,
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    skills: [],
    hiredAt: toLocalInput(Date.now()).slice(0, 10),
    managerId: '',
    monthlySalary: '',
    leaveBalance: '',
    certificationName: '',
    certificationExpiresAt: '',
  }))
  const patch = (change: Partial<NewStaffInput>) => setDraft({ ...draft, ...change })
  const granted = ROLE_TEMPLATES[draft.template] ?? {}

  const problems = [
    !USERNAME_PATTERN.test(draft.username.trim().toLowerCase()) &&
      'Username needs 3–30 characters: letters, numbers, dots, dashes or underscores (Personal).',
    !draft.firstName.trim() && 'First name is required (Personal).',
    !draft.phone.trim() && 'Phone is required (Personal).',
    !EMAIL_PATTERN.test(draft.email.trim()) &&
      'A valid email is required: the sign-in details are sent there (Personal).',
    !draft.jobTitle.trim() && 'Job title is required (Employment).',
    draft.shiftStart >= draft.shiftEnd && 'Shift end must be after shift start (Schedule).',
    draft.workingDays.length === 0 && 'Pick at least one working day (Schedule).',
    !isAmount(draft.monthlySalary) && 'Monthly salary must be a number of 0 or more (Employment).',
    !isAmount(draft.leaveBalance) && 'Leave balance must be a number of 0 or more (Employment).',
    Boolean(draft.certificationExpiresAt) &&
      !draft.certificationName.trim() &&
      'Give the certification a name, or clear its expiry date (Skills).',
  ].filter((problem): problem is string => Boolean(problem))

  const text = (
    id: string,
    label: string,
    key:
      | 'username'
      | 'firstName'
      | 'lastName'
      | 'phone'
      | 'email'
      | 'city'
      | 'neighborhood'
      | 'emergencyContact'
      | 'jobTitle'
      | 'hiredAt'
      | 'monthlySalary'
      | 'leaveBalance'
      | 'certificationName'
      | 'certificationExpiresAt',
    options: { type?: string; wide?: boolean; placeholder?: string; hint?: string } = {},
  ) => (
    <FormField label={label} htmlFor={id} wide={options.wide} hint={options.hint}>
      <input
        id={id}
        type={options.type ?? 'text'}
        {...(options.type === 'number' ? { min: 0, inputMode: 'numeric' as const } : {})}
        autoComplete="off"
        placeholder={options.placeholder}
        value={draft[key]}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={fieldClass}
      />
    </FormField>
  )
  const choice = (
    id: string,
    label: string,
    key: 'department' | 'employment',
    options: string[],
  ) => (
    <FormField label={label} htmlFor={id}>
      <select
        id={id}
        value={draft[key]}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </FormField>
  )

  function setSkill(name: string, level: SkillLevel | '') {
    const others = draft.skills.filter((skill) => skill.name !== name)
    patch({ skills: level ? [...others, { name, level }] : others })
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Add Staff"
      subtitle={`Step ${step + 1} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`${secondaryButton} mr-auto`}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={problems.length > 0 || saving}
              onClick={() => onCreate(draft)}
              className={primaryButton}
            >
              <Check className="size-4" aria-hidden="true" />
              {saving ? 'Creating…' : 'Create Staff'}
            </button>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Wizard steps">
        {WIZARD_STEPS.map((label, index) => (
          <li key={label} className="min-w-16 flex-1">
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => setStep(index)}
              className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`} />
              <span
                className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}
              >
                {index + 1} {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('staff-first', 'First name', 'firstName')}
          {text('staff-last', 'Last name', 'lastName')}
          {text('staff-username', 'Username', 'username', { placeholder: 'e.g. jdoe' })}
          {text('staff-phone', 'Phone', 'phone', { type: 'tel', placeholder: '+237 6XX XXX XXX' })}
          {text('staff-email', 'Email (sign-in details are sent here)', 'email', { type: 'email', wide: true })}
          {text('staff-city', 'City', 'city')}
          {text('staff-neighborhood', 'Neighborhood', 'neighborhood')}
          {text('staff-emergency', 'Emergency contact (name, relationship, phone)', 'emergencyContact', { wide: true })}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('staff-title', 'Job title', 'jobTitle', { placeholder: 'e.g. Wash Operator' })}
          {choice('staff-department', 'Department', 'department', DEPARTMENTS)}
          <FormField label="User type" htmlFor="staff-user-type">
            <select
              id="staff-user-type"
              value={draft.userType}
              onChange={(event) => patch({ userType: event.target.value as UserType })}
              className={fieldClass}
            >
              {STAFF_USER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {USER_TYPES[type]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Branch"
            htmlFor="staff-branch"
            hint={branches.isError ? 'Couldn’t load the branches.' : undefined}
          >
            <select
              id="staff-branch"
              value={draft.branchUuid}
              onChange={(event) => {
                const branch = branches.data?.find(({ uuid }) => uuid === event.target.value)
                patch({ branchUuid: event.target.value, branch: branch?.name ?? 'No branch' })
              }}
              className={fieldClass}
            >
              <option value="">{branches.isLoading ? 'Loading branches…' : 'No branch'}</option>
              {branches.data?.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          {choice('staff-employment', 'Employment type', 'employment', EMPLOYMENT_TYPES)}
          {text('staff-hired', 'Hire date', 'hiredAt', { type: 'date' })}
          <FormField label="Reports to" htmlFor="staff-manager" hint="Optional">
            <select
              id="staff-manager"
              value={draft.managerId}
              onChange={(event) => patch({ managerId: event.target.value })}
              className={fieldClass}
            >
              <option value="">No manager</option>
              {managers.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          {text('staff-salary', 'Monthly salary (XAF)', 'monthlySalary', { type: 'number', hint: 'Optional' })}
          {text('staff-leave', 'Leave balance (days)', 'leaveBalance', { type: 'number', hint: 'Optional' })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Role"
              htmlFor="staff-role"
              hint={roles.isError ? 'Couldn’t load the roles.' : undefined}
            >
              <select
                id="staff-role"
                value={draft.roleId ?? ''}
                onChange={(event) => {
                  const role = roles.data?.find(({ id }) => String(id) === event.target.value)
                  patch({ roleId: role?.id ?? null, template: role?.name ?? '' })
                }}
                className={fieldClass}
              >
                <option value="">{roles.isLoading ? 'Loading roles…' : 'No role'}</option>
                {roles.data?.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {!ROLE_TEMPLATES[draft.template] && (
            <p className="text-[11px] text-muted">
              Permissions come from the role on the server and aren’t previewed here yet.
            </p>
          )}
          <ul className={`space-y-1 rounded-lg bg-field p-3 text-xs ${ROLE_TEMPLATES[draft.template] ? '' : 'hidden'}`}>
            {Object.keys(PERMISSION_MODULES).map((module) => (
              <li key={module} className="flex justify-between gap-3">
                <span className="font-semibold text-ink">{module}</span>
                <span className="text-right text-muted">
                  {granted[module]?.join(', ') ?? 'No access'}
                </span>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['loginAccess', 'Allow login (password emailed on creation)'],
                ['twoFactor', 'Require two-factor authentication'],
              ] as ['loginAccess' | 'twoFactor', string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink"
              >
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => patch({ [key]: event.target.checked })}
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Shift start" htmlFor="staff-start">
            <input
              id="staff-start"
              type="time"
              value={draft.shiftStart}
              onChange={(event) => patch({ shiftStart: event.target.value })}
              className={fieldClass}
            />
          </FormField>
          <FormField label="Shift end" htmlFor="staff-end">
            <input
              id="staff-end"
              type="time"
              value={draft.shiftEnd}
              onChange={(event) => patch({ shiftEnd: event.target.value })}
              className={fieldClass}
            />
          </FormField>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-[11px] font-semibold text-ink">Working days</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(({ code, short }) => {
                const on = draft.workingDays.includes(code)
                return (
                  <label
                    key={code}
                    className={`flex cursor-pointer items-center rounded-md px-3 py-1.5 text-xs font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                      on ? 'bg-brand text-white' : 'bg-field text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        patch({
                          workingDays: on
                            ? draft.workingDays.filter((day) => day !== code)
                            : WEEKDAYS.map((day) => day.code).filter(
                                (day) => day === code || draft.workingDays.includes(day),
                              ),
                        })
                      }
                      className="sr-only"
                    />
                    {short}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {SKILLS.map((skill) => (
            <li key={skill} className="flex items-center gap-2 rounded-lg bg-field px-3 py-2">
              <label htmlFor={`skill-${skill}`} className="flex-1 text-xs font-semibold text-ink">
                {skill}
              </label>
              <select
                id={`skill-${skill}`}
                value={draft.skills.find(({ name }) => name === skill)?.level ?? ''}
                onChange={(event) => setSkill(skill, event.target.value as SkillLevel | '')}
                className={`${fieldClass} h-8 w-36! bg-white`}
              >
                <option value="">Not a skill</option>
                {SKILL_LEVELS.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('staff-cert', 'Certification', 'certificationName', { placeholder: 'e.g. Chemical handling', hint: 'Optional' })}
          {text('staff-cert-expiry', 'Certification expires', 'certificationExpiresAt', { type: 'date', hint: 'Optional' })}
        </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-field p-3 text-xs sm:grid-cols-2">
            {(
              [
                ['Name', `${draft.firstName} ${draft.lastName}`.trim() || '—'],
                ['Username', draft.username || '—'],
                ['Email', draft.email || '—'],
                ['Phone', draft.phone || '—'],
                ['Location', [draft.neighborhood, draft.city].filter(Boolean).join(', ') || '—'],
                ['User type', USER_TYPES[draft.userType]],
                ['Job title', draft.jobTitle || '—'],
                ['Department', draft.department],
                ['Branch', draft.branch],
                ['Employment', draft.employment],
                ['Hired', draft.hiredAt || '—'],
                ['Reports to', managers.find(({ id }) => id === draft.managerId)?.name ?? 'No manager'],
                ['Monthly salary', draft.monthlySalary ? formatXaf(Number(draft.monthlySalary)) : 'Not set'],
                ['Leave balance', draft.leaveBalance ? `${draft.leaveBalance} days` : 'Not set'],
                ['Role', draft.template || 'None'],
                ['Shift', `${draft.shiftStart}–${draft.shiftEnd}, ${formatWorkingDays(draft.workingDays) || 'no days'}`],
                ['Skills', draft.skills.map(({ name, level }) => `${name} (${level})`).join(', ') || 'None'],
                [
                  'Certification',
                  draft.certificationName.trim()
                    ? `${draft.certificationName.trim()}${draft.certificationExpiresAt ? `, expires ${draft.certificationExpiresAt}` : ''}`
                    : 'None',
                ],
                ['Login', draft.loginAccess ? `Enabled${draft.twoFactor ? ', 2FA required' : ''}` : 'Disabled'],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] text-muted">{label}</dt>
                <dd className="font-semibold break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {problems.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-lg bg-danger/5 p-3 text-xs font-semibold text-danger ring-1 ring-danger/20"
            >
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

// ---------- New shift ----------

const todayIso = () => new Date().toISOString().slice(0, 10)

// An open shift, or one given to a person straight away
export function ShiftDialog({
  staff,
  onClose,
  onCreate,
}: {
  staff: StaffMember[]
  onClose: () => void
  onCreate: (shift: ShiftBody) => void
}) {
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const [shiftTitle, setShiftTitle] = useState('')
  const [department, setDepartment] = useState(Object.keys(DEPARTMENT_CODES)[0])
  const [skill, setSkill] = useState('Washing')
  const [workDate, setWorkDate] = useState(todayIso)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [userId, setUserId] = useState('')
  const [branch, setBranch] = useState('')
  const branchId = branch || (branches.length === 1 ? branches[0].uuid : '')
  const valid = shiftTitle.trim() !== '' && workDate !== '' && startTime < endTime && (branches.length <= 1 || branchId !== '')

  return (
    <Modal
      open
      onClose={onClose}
      title="New Shift"
      subtitle="Leave the person empty to publish it as an open shift."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onCreate({
                title: shiftTitle.trim(),
                department: DEPARTMENT_CODES[department],
                skill: SKILL_CODES[skill],
                workDate,
                startTime,
                endTime,
                ...(userId ? { user: userId } : {}),
                ...(branchId ? { branch: branchId } : {}),
              })
            }
            className={primaryButton}
          >
            Create Shift
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Title" htmlFor="shift-title" wide>
          <input
            id="shift-title"
            placeholder="e.g. Evening wash shift"
            value={shiftTitle}
            onChange={(event) => setShiftTitle(event.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField label="Department" htmlFor="shift-department">
          <select id="shift-department" value={department} onChange={(event) => setDepartment(event.target.value)} className={fieldClass}>
            {Object.keys(DEPARTMENT_CODES).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Skill needed" htmlFor="shift-skill">
          <select id="shift-skill" value={skill} onChange={(event) => setSkill(event.target.value)} className={fieldClass}>
            {Object.keys(SKILL_CODES).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Date" htmlFor="shift-date">
          <input id="shift-date" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className={fieldClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Starts" htmlFor="shift-start">
            <input id="shift-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={fieldClass} />
          </FormField>
          <FormField label="Ends" htmlFor="shift-end">
            <input id="shift-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={fieldClass} />
          </FormField>
        </div>
        {branches.length > 1 && (
          <FormField label="Branch" htmlFor="shift-branch">
            <select id="shift-branch" value={branch} onChange={(event) => setBranch(event.target.value)} className={fieldClass}>
              <option value="">Choose a branch…</option>
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Person (optional)" htmlFor="shift-user">
          <select id="shift-user" value={userId} onChange={(event) => setUserId(event.target.value)} className={fieldClass}>
            <option value="">Open shift</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </FormField>
        {startTime >= endTime && <p className="text-[11px] font-semibold text-danger sm:col-span-2">The shift must end after it starts.</p>}
      </div>
    </Modal>
  )
}
