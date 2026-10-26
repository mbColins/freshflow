import {
  CERT_WARNING_DAYS,
  DEPARTMENT_CODES,
  EMPLOYMENT_CODES,
  LATE_ALERT_COUNT,
  ON_DUTY,
  OVERLOAD_RATIO,
  SKILL_CODES,
  SKILL_LEVEL_CODES,
  SKILL_LEVELS,
  STAFF_STATUSES,
  WEEKDAYS,
  DAILY_STATUS,
} from '../constants/staff'
import { USER_TYPES } from '../constants/users'
import type { SkillLevel, StaffFilters, StaffMember, StaffStatus } from '../types/staff'
import type { AppUser, UserType, Weekday } from '../types/user'
import { toCsv } from './csv'

const DAY_MS = 86_400_000

export function getStaffStatus(id: StaffStatus) {
  return STAFF_STATUSES.find((status) => status.id === id)!
}

export function isOnDuty(member: StaffMember) {
  return ON_DUTY.includes(member.status)
}

function toMinutes(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number)
  return hours * 60 + minutes
}

// Minutes late at clock-in; 0 when on time or not clocked in
export function getLateMinutes(member: StaffMember) {
  if (!member.clockIn || !member.shiftStart) return 0
  return Math.max(0, toMinutes(member.clockIn) - toMinutes(member.shiftStart))
}

export function getActiveTasks(member: StaffMember) {
  return Math.max(0, member.tasksAssigned - member.tasksDone)
}

// Share of a person's capacity taken by tasks still open
export function getLoad(member: StaffMember) {
  if (member.capacity <= 0) return 0
  return getActiveTasks(member) / member.capacity
}

export function isOverloaded(member: StaffMember) {
  return isOnDuty(member) && getLoad(member) >= OVERLOAD_RATIO
}

export function getCertDays(member: StaffMember, now: number) {
  if (!member.certification) return null
  return Math.ceil((new Date(member.certification.expiresAt).getTime() - now) / DAY_MS)
}

export function isCertExpiring(member: StaffMember, now: number) {
  const days = getCertDays(member, now)
  return days !== null && days <= CERT_WARNING_DAYS
}

// Hours on the clock so far today, capped at the shift end
export function getHoursWorked(member: StaffMember, now: number) {
  if (!member.clockIn) return 0
  const date = new Date(now)
  const nowMinutes = date.getHours() * 60 + date.getMinutes()
  const end = member.shiftEnd ? toMinutes(member.shiftEnd) : nowMinutes
  const worked = Math.min(nowMinutes, end) - toMinutes(member.clockIn) - member.breakMinutes
  return Math.max(0, worked) / 60
}

export function formatHours(hours: number) {
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  return `${whole}h ${String(minutes).padStart(2, '0')}m`
}

// Position of a HH:MM time on a day axis, as a percentage
export function toAxisPercent(clock: string, axisStart: number, axisEnd: number) {
  const value = (toMinutes(clock) / 60 - axisStart) / (axisEnd - axisStart)
  return Math.min(100, Math.max(0, value * 100))
}

export function matchesStaffFilters(
  member: StaffMember,
  filters: StaffFilters,
  now: number,
) {
  const needle = filters.query.trim().toLowerCase()
  if (
    needle &&
    ![
      member.name,
      member.id,
      member.phone,
      member.email,
      member.jobTitle,
      member.department,
      member.branch,
      ...member.skills.map(({ name }) => name),
    ].some((field) => field.toLowerCase().includes(needle))
  ) {
    return false
  }
  if (filters.status && member.status !== filters.status) return false
  if (filters.department && member.department !== filters.department) return false
  if (filters.branch && member.branch !== filters.branch) return false
  switch (filters.view) {
    case 'onDuty':
      return isOnDuty(member)
    case 'overloaded':
      return isOverloaded(member)
    case 'late':
      return getLateMinutes(member) > 0
    case 'certExpiring':
      return isCertExpiring(member, now)
    default:
      return true
  }
}

export type Recommendation = {
  member: StaffMember
  match: number
  reasons: string[]
}

// Ranks on-duty staff for a task: skill level first, then free capacity
export function recommendStaff(staff: StaffMember[], skill: string): Recommendation[] {
  return staff
    .filter((member) => member.status === 'working' || member.status === 'available')
    .map((member) => {
      const level = member.skills.find(({ name }) => name === skill)?.level
      const skillScore = level ? (SKILL_LEVELS.indexOf(level) + 1) * 15 : 0
      const load = getLoad(member)
      const match = Math.round(
        skillScore + (1 - Math.min(1, load)) * 30 + (member.status === 'available' ? 10 : 0),
      )
      return {
        member,
        match,
        reasons: [
          level ? `${skill}: ${level}` : `No ${skill} skill on record`,
          member.status === 'available' ? 'Available now' : 'Currently working',
          load >= OVERLOAD_RATIO ? 'High workload' : load >= 0.5 ? 'Moderate workload' : 'Low workload',
        ],
      }
    })
    .sort((a, b) => b.match - a.match)
}

export type StaffAlert = { member: StaffMember; title: string; body: string }

export function getStaffAlerts(staff: StaffMember[], now: number): StaffAlert[] {
  return staff.flatMap((member) => {
    const alerts: StaffAlert[] = []
    const certDays = getCertDays(member, now)
    if (isOverloaded(member)) {
      alerts.push({
        member,
        title: 'High workload',
        body: `${member.name} has ${getActiveTasks(member)} open tasks against a capacity of ${member.capacity}.`,
      })
    }
    if (member.lateThisMonth >= LATE_ALERT_COUNT) {
      alerts.push({
        member,
        title: 'Late attendance',
        body: `${member.name} has been late ${member.lateThisMonth} times this month.`,
      })
    }
    if (member.status === 'absent') {
      alerts.push({
        member,
        title: 'Unexcused absence',
        body: `${member.name} was scheduled ${member.shiftStart}–${member.shiftEnd} and has not clocked in.`,
      })
    }
    if (certDays !== null && certDays <= CERT_WARNING_DAYS) {
      alerts.push({
        member,
        title: 'Certification expiring',
        body: `${member.certification!.name} expires in ${certDays} days.`,
      })
    }
    return alerts
  })
}

export function staffToCsv(staff: StaffMember[], includePerformance: boolean) {
  const columns: [string, (member: StaffMember) => string | number][] = [
    ['Employee ID', (member) => member.id],
    ['Name', (member) => member.name],
    ['Job title', (member) => member.jobTitle],
    ['Department', (member) => member.department],
    ['Branch', (member) => member.branch],
    ['Status', (member) => getStaffStatus(member.status).label],
    ['Shift', (member) => (member.shiftStart ? `${member.shiftStart}-${member.shiftEnd}` : '')],
    ['Clock-in', (member) => member.clockIn],
    ['Current assignment', (member) => member.assignment],
    ['Phone', (member) => member.phone],
    ['Attendance %', (member) => member.attendanceRate],
  ]
  if (includePerformance) columns.push(['Performance %', (member) => member.score])
  return toCsv(columns, staff)
}

// The department the Staff page groups each backend user type under
const TYPE_DEPARTMENTS: Partial<Record<UserType, string>> = {
  WASHER: 'Laundry Operations',
  DRY_CLEANER: 'Laundry Operations',
  STAFF_MEMBER: 'Laundry Operations',
  FRONT_DESK: 'Front Desk',
  DELIVERY_AGENT: 'Delivery',
  MANAGER: 'Management',
  STORE_MANAGER: 'Management',
  OWNER: 'Management',
  TENANT: 'Management',
  SYSTEM_ADMIN: 'Management',
}

// The label for a backend code from one of the CODES maps in constants/staff
export function labelFor<T extends string>(codes: Record<string, T>, code: T | null | undefined) {
  return Object.keys(codes).find((label) => codes[label] === code) ?? ''
}

// ["MONDAY", ..., "SATURDAY"] -> "Mon–Sat"; gaps are listed: "Mon, Wed, Fri"
export function formatWorkingDays(days: Weekday[]) {
  const picked = WEEKDAYS.filter(({ code }) => days.includes(code))
  if (picked.length === 0) return ''
  if (picked.length === 7) return 'Every day'
  const indexes = picked.map(({ code }) => WEEKDAYS.findIndex((day) => day.code === code))
  const runs: number[][] = []
  for (const index of indexes) {
    const last = runs.at(-1)
    if (last && index === last.at(-1)! + 1) last.push(index)
    else runs.push([index])
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${WEEKDAYS[run[0]].short}–${WEEKDAYS[run.at(-1)!].short}`
        : run.map((index) => WEEKDAYS[index].short).join(', '),
    )
    .join(', ')
}

// A user from the users API as a staff record. The employment details come
// from the user; the API has no attendance, tasks or scores yet, so those
// start with the same defaults as a new hire (no absences, nothing assigned)
export function memberFromUser(user: AppUser): StaffMember {
  const typeLabel = user.userType ? USER_TYPES[user.userType] : ''
  const details = user.staff
  const suspended = !user.active || details.accountStatus === 'SUSPENDED'
  const daily = user.daily
  return {
    id: user.uuid,
    username: user.username,
    name: `${user.firstName} ${user.lastName}`.trim() || user.username,
    jobTitle: details.jobTitle || user.role || typeLabel || 'Staff',
    department:
      labelFor(DEPARTMENT_CODES, details.department) ||
      (user.userType && TYPE_DEPARTMENTS[user.userType]) ||
      'Laundry Operations',
    branch: user.branch || 'No branch',
    phone: user.phone,
    email: user.email,
    employment: labelFor(EMPLOYMENT_CODES, details.employmentType) || 'Not recorded',
    hiredAt: details.hiredAt || user.createdAt,
    manager: details.managerName || 'Not recorded',
    // The server role; the permission preview only knows the local templates
    template: user.role || typeLabel,
    status: suspended ? 'suspended' : ((daily && DAILY_STATUS[daily.status]) || 'offline') as StaffMember['status'],
    shiftStart: details.shiftStart,
    shiftEnd: details.shiftEnd,
    workingDays: formatWorkingDays(details.workingDays),
    clockIn: daily?.clockIn ?? '',
    breakMinutes: daily?.breakMinutes ?? 0,
    assignment: daily?.assignment ?? '',
    assignmentRef: daily?.assignmentRef ?? '',
    tasksAssigned: daily?.workload.assigned ?? 0,
    tasksDone: daily?.workload.done ?? 0,
    tasksOverdue: daily?.workload.overdue ?? 0,
    capacity: daily?.workload.capacity ?? 12,
    attendanceRate: daily?.performance?.attendanceRate ?? 100,
    lateThisMonth: daily?.performance?.lateThisMonth ?? 0,
    // Null until there are enough finished tasks to judge
    score: daily?.performance?.score ?? 0,
    onTime: daily?.performance?.onTime ?? 0,
    quality: daily?.performance?.quality ?? 0,
    rating: daily?.performance?.rating ?? 0,
    skills: details.skills.flatMap(({ skill, level }) => {
      const name = labelFor(SKILL_CODES, skill)
      const levelLabel = labelFor(SKILL_LEVEL_CODES, level) as SkillLevel | ''
      return name && levelLabel ? [{ name, level: levelLabel }] : []
    }),
    certification: details.certification,
    trainingDone: daily?.training.done ?? 0,
    trainingTotal: daily?.training.total ?? 0,
    emergencyContact: details.emergencyContact || 'Not provided',
    monthlySalary: details.monthlySalary,
    leaveBalance: details.leaveBalance,
    twoFactor: details.twoFactorRequired,
    loginAccess: user.active && details.loginAccess,
    lastLoginAt: user.lastLoginTime,
    activity: [
      ...(suspended && details.statusReason
        ? [{ at: user.updatedAt || user.createdAt, text: `Account suspended: ${details.statusReason}` }]
        : []),
      ...(user.createdAt
        ? [{ at: user.createdAt, text: user.createdBy ? `Account created by ${user.createdBy}` : 'Account created' }]
        : []),
    ],
  }
}
