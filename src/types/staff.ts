export type StaffStatus =
  | 'working'
  | 'available'
  | 'break'
  | 'offline'
  | 'absent'
  | 'leave'
  | 'suspended'

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected'

export type StaffSkill = { name: string; level: SkillLevel }

export type StaffMember = {
  // Employee ID, e.g. EMP-0024; the user's uuid for staff from the users API
  id: string
  // Sign-in name, for staff from the users API (shown instead of the uuid)
  username?: string
  name: string
  jobTitle: string
  department: string
  branch: string
  phone: string
  email: string
  employment: string
  hiredAt: string
  manager: string
  // Permission template, see ROLE_TEMPLATES
  template: string
  status: StaffStatus
  // Today's shift as HH:MM; empty when not scheduled today
  shiftStart: string
  shiftEnd: string
  workingDays: string
  // HH:MM, or empty when not clocked in
  clockIn: string
  breakMinutes: number
  assignment: string
  // Order or job reference for the current assignment
  assignmentRef: string
  tasksAssigned: number
  tasksDone: number
  tasksOverdue: number
  // Tasks this person can reasonably carry in a shift
  capacity: number
  attendanceRate: number
  lateThisMonth: number
  score: number
  onTime: number
  quality: number
  rating: number
  skills: StaffSkill[]
  certification: { name: string; expiresAt: string } | null
  trainingDone: number
  trainingTotal: number
  emergencyContact: string
  monthlySalary: number
  leaveBalance: number
  twoFactor: boolean
  loginAccess: boolean
  lastLoginAt: string
  activity: { at: string; text: string }[]
}

export type LeaveRequest = {
  id: string
  staffId: string
  type: string
  from: string
  to: string
  reason: string
  status: LeaveStatus
  approver: string
}

export type OpenShift = {
  id: string
  title: string
  department: string
  start: string
  end: string
  skill: string
}

export type StaffFilters = {
  query: string
  status: StaffStatus | ''
  department: string
  branch: string
  // Quick views
  view: '' | 'onDuty' | 'overloaded' | 'late' | 'certExpiring'
}
