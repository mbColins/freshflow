import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react'
import { BRANCHES } from '../../constants/orders'
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  LEAVE_TYPES,
  PERMISSION_MODULES,
  ROLE_TEMPLATES,
  SKILLS,
  SKILL_LEVELS,
  TASK_TYPES,
} from '../../constants/staff'
import type {
  OpenShift,
  SkillLevel,
  StaffMember,
} from '../../types/staff'
import { recommendStaff } from '../../utils/staff'
import {
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { StaffAvatar, StaffStatusBadge } from './StaffBits'

function Field({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}

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
  const ranked = recommendStaff(staff, task.skill)

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
          <Field label="Type of work" htmlFor="assign-task">
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
          </Field>
          <Field label="Order or job reference (optional)" htmlFor="assign-reference">
            <input
              id="assign-reference"
              placeholder="e.g. ORD-10521"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={fieldClass}
            />
          </Field>
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
                    <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                      {match}%
                    </span>
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
        <Field label="Staff member" htmlFor="attendance-staff">
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
        </Field>
        {member && (
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <StaffStatusBadge status={member.status} />
            {member.shiftStart
              ? `Shift ${member.shiftStart}–${member.shiftEnd}`
              : 'Not scheduled today'}
            {member.clockIn && ` · clocked in ${member.clockIn}`}
          </p>
        )}
        <Field label="Action" htmlFor="attendance-action">
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
        </Field>
        {action !== 'Mark absent' && (
          <Field label="Time" htmlFor="attendance-time">
            <input
              id="attendance-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={fieldClass}
            />
          </Field>
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
        <Field label="Staff member" htmlFor="leave-staff">
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
        </Field>
        <Field label="Leave type" htmlFor="leave-type">
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
        </Field>
        <Field label="Start date" htmlFor="leave-from">
          <input
            id="leave-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="End date" htmlFor="leave-to">
          <input
            id="leave-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Reason" htmlFor="leave-reason" wide>
          <input
            id="leave-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>
    </Modal>
  )
}

// ---------- Add staff wizard ----------

const WIZARD_STEPS = ['Personal', 'Employment', 'Role & Access', 'Schedule', 'Skills', 'Review']

export type NewStaffInput = {
  firstName: string
  lastName: string
  phone: string
  email: string
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
  workingDays: string
  skills: { name: string; level: SkillLevel }[]
}

export function StaffWizard({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: NewStaffInput) => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<NewStaffInput>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    emergencyContact: '',
    jobTitle: '',
    department: DEPARTMENTS[0],
    branch: BRANCHES[0],
    employment: EMPLOYMENT_TYPES[0],
    template: 'Laundry Operator',
    loginAccess: true,
    twoFactor: false,
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workingDays: 'Mon–Sat',
    skills: [],
  })
  const patch = (change: Partial<NewStaffInput>) => setDraft({ ...draft, ...change })
  const granted = ROLE_TEMPLATES[draft.template] ?? {}

  const problems = [
    !draft.firstName.trim() && 'First name is required (Personal).',
    !draft.phone.trim() && 'Phone is required (Personal).',
    !draft.jobTitle.trim() && 'Job title is required (Employment).',
    draft.shiftStart >= draft.shiftEnd && 'Shift end must be after shift start (Schedule).',
  ].filter((problem): problem is string => Boolean(problem))

  const text = (
    id: string,
    label: string,
    key: 'firstName' | 'lastName' | 'phone' | 'email' | 'emergencyContact' | 'jobTitle' | 'workingDays',
    options: { type?: string; wide?: boolean; placeholder?: string } = {},
  ) => (
    <Field label={label} htmlFor={id} wide={options.wide}>
      <input
        id={id}
        type={options.type ?? 'text'}
        autoComplete="off"
        placeholder={options.placeholder}
        value={draft[key]}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={fieldClass}
      />
    </Field>
  )
  const choice = (
    id: string,
    label: string,
    key: 'department' | 'branch' | 'employment' | 'template',
    options: string[],
  ) => (
    <Field label={label} htmlFor={id}>
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
    </Field>
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
              disabled={problems.length > 0}
              onClick={() => onCreate(draft)}
              className={primaryButton}
            >
              <Check className="size-4" aria-hidden="true" />
              Create Staff
            </button>
          )}
        </>
      }
    >
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
          {text('staff-phone', 'Phone', 'phone', { type: 'tel', placeholder: '+237 6XX XXX XXX' })}
          {text('staff-email', 'Email (optional)', 'email', { type: 'email' })}
          {text('staff-emergency', 'Emergency contact (name, relationship, phone)', 'emergencyContact', { wide: true })}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('staff-title', 'Job title', 'jobTitle', { placeholder: 'e.g. Wash Operator' })}
          {choice('staff-department', 'Department', 'department', DEPARTMENTS)}
          {choice('staff-branch', 'Branch', 'branch', BRANCHES)}
          {choice('staff-employment', 'Employment type', 'employment', EMPLOYMENT_TYPES)}
          <p className="text-[11px] text-muted sm:col-span-2">
            The employee ID is generated when the profile is created.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {choice('staff-template', 'System role', 'template', Object.keys(ROLE_TEMPLATES))}
          </div>
          <ul className="space-y-1 rounded-lg bg-field p-3 text-xs">
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
                ['loginAccess', 'Allow login (invitation sent on creation)'],
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Shift start" htmlFor="staff-start">
            <input
              id="staff-start"
              type="time"
              value={draft.shiftStart}
              onChange={(event) => patch({ shiftStart: event.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Shift end" htmlFor="staff-end">
            <input
              id="staff-end"
              type="time"
              value={draft.shiftEnd}
              onChange={(event) => patch({ shiftEnd: event.target.value })}
              className={fieldClass}
            />
          </Field>
          {text('staff-days', 'Working days', 'workingDays')}
        </div>
      )}

      {step === 4 && (
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
      )}

      {step === 5 && (
        <div className="space-y-3">
          <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-field p-3 text-xs sm:grid-cols-2">
            {(
              [
                ['Name', `${draft.firstName} ${draft.lastName}`.trim() || '—'],
                ['Phone', draft.phone || '—'],
                ['Job title', draft.jobTitle || '—'],
                ['Department', draft.department],
                ['Branch', draft.branch],
                ['Employment', draft.employment],
                ['System role', draft.template],
                ['Shift', `${draft.shiftStart}–${draft.shiftEnd}, ${draft.workingDays}`],
                ['Skills', draft.skills.map(({ name, level }) => `${name} (${level})`).join(', ') || 'None'],
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
