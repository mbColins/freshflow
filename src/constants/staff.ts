import type { BadgeTone } from '../components/ui/Badge'
import type { OrderRole } from '../types/order'
import type { SkillLevel, StaffFilters, StaffStatus } from '../types/staff'
import type { Department, EmploymentType, SkillCode, SkillLevelCode, Weekday } from '../types/user'

export const STAFF_STATUSES: {
  id: StaffStatus
  label: string
  tone: BadgeTone
  color: string
}[] = [
  { id: 'working', label: 'Working', tone: 'success', color: '#16a34a' },
  { id: 'available', label: 'Available', tone: 'brand', color: '#2563eb' },
  { id: 'break', label: 'On Break', tone: 'warning', color: '#d97706' },
  { id: 'offline', label: 'Offline', tone: 'neutral', color: '#94a3b8' },
  { id: 'absent', label: 'Absent', tone: 'danger', color: '#dc2626' },
  { id: 'leave', label: 'On Leave', tone: 'neutral', color: '#6250d6' },
  { id: 'suspended', label: 'Suspended', tone: 'danger', color: '#7f1d1d' },
]

// On the floor right now, whether busy, free or on break
export const ON_DUTY: StaffStatus[] = ['working', 'available', 'break']

export const DEPARTMENTS = [
  'Laundry Operations',
  'Finishing & Press',
  'Quality Control',
  'Front Desk',
  'Delivery',
  'Maintenance',
  'Management',
]

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Temporary', 'Contract', 'Intern']

export const SKILLS = [
  'Washing',
  'Drying',
  'Ironing',
  'Folding',
  'Stain Treatment',
  'Quality Control',
  'Packaging',
  'Customer Service',
  'Driving',
  'Machine Maintenance',
]

export const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

// The labels above as the backend's enum values (UserRequest / UserResponse)
export const DEPARTMENT_CODES: Record<string, Department> = {
  'Laundry Operations': 'LAUNDRY_OPERATIONS',
  'Finishing & Press': 'FINISHING_PRESS',
  'Quality Control': 'QUALITY_CONTROL',
  'Front Desk': 'FRONT_DESK',
  Delivery: 'DELIVERY',
  Maintenance: 'MAINTENANCE',
  Management: 'MANAGEMENT',
}

export const EMPLOYMENT_CODES: Record<string, EmploymentType> = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Temporary: 'TEMPORARY',
  Contract: 'CONTRACT',
  Intern: 'INTERN',
}

export const SKILL_CODES: Record<string, SkillCode> = {
  Washing: 'WASHING',
  Drying: 'DRYING',
  Ironing: 'IRONING',
  Folding: 'FOLDING',
  'Stain Treatment': 'STAIN_TREATMENT',
  'Quality Control': 'QUALITY_CONTROL',
  Packaging: 'PACKAGING',
  'Customer Service': 'CUSTOMER_SERVICE',
  Driving: 'DRIVING',
  'Machine Maintenance': 'MACHINE_MAINTENANCE',
}

export const SKILL_LEVEL_CODES: Record<SkillLevel, SkillLevelCode> = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
  Expert: 'EXPERT',
}

// Monday first, as the backend's DayOfWeek
export const WEEKDAYS: { code: Weekday; short: string }[] = [
  { code: 'MONDAY', short: 'Mon' },
  { code: 'TUESDAY', short: 'Tue' },
  { code: 'WEDNESDAY', short: 'Wed' },
  { code: 'THURSDAY', short: 'Thu' },
  { code: 'FRIDAY', short: 'Fri' },
  { code: 'SATURDAY', short: 'Sat' },
  { code: 'SUNDAY', short: 'Sun' },
]

export const TASK_TYPES: { label: string; skill: string }[] = [
  { label: 'Laundry order (washing)', skill: 'Washing' },
  { label: 'Ironing / pressing', skill: 'Ironing' },
  { label: 'QC inspection', skill: 'Quality Control' },
  { label: 'Packaging', skill: 'Packaging' },
  { label: 'Pickup or delivery', skill: 'Driving' },
  { label: 'Maintenance task', skill: 'Machine Maintenance' },
  { label: 'Front desk / customer', skill: 'Customer Service' },
]

export const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Maternity/Paternity', 'Emergency', 'Other']

// Load above this share of capacity counts as overloaded
export const OVERLOAD_RATIO = 0.85
export const CERT_WARNING_DAYS = 30
// Lateness beyond this many times in a month is flagged
export const LATE_ALERT_COUNT = 4

export const PERMISSION_MODULES: Record<string, string[]> = {
  Orders: ['View', 'Create', 'Edit', 'Cancel'],
  Payments: ['View', 'Record', 'Refund', 'Reconcile'],
  Inventory: ['View', 'Add Stock', 'Adjust', 'Transfer'],
  Staff: ['View', 'Create', 'Edit', 'Manage Permissions'],
  Reports: ['View', 'Export'],
}

const ALL = Object.fromEntries(
  Object.entries(PERMISSION_MODULES).map(([module, actions]) => [module, actions]),
)

// Placeholder role templates until permissions are enforced by the backend
export const ROLE_TEMPLATES: Record<string, Record<string, string[]>> = {
  Administrator: ALL,
  Manager: { ...ALL, Staff: ['View', 'Create', 'Edit'] },
  Receptionist: { Orders: ['View', 'Create', 'Edit'], Payments: ['View', 'Record'], Inventory: ['View'], Staff: ['View'] },
  Cashier: { Orders: ['View'], Payments: ['View', 'Record'] },
  'Laundry Operator': { Orders: ['View', 'Edit'], Inventory: ['View'] },
  'Quality Control': { Orders: ['View', 'Edit'] },
  Driver: { Orders: ['View'] },
  'Inventory Staff': { Orders: ['View'], Inventory: ['View', 'Add Stock', 'Transfer'] },
  Maintenance: { Inventory: ['View'] },
}

export const EMPTY_STAFF_FILTERS: StaffFilters = {
  query: '',
  status: '',
  department: '',
  branch: '',
  view: '',
}

export type StaffPermissions = {
  // Add staff, assign work, attendance, schedules, leave decisions
  manage: boolean
  // See performance scores
  performance: boolean
  // See salaries
  payroll: boolean
}

export const STAFF_PERMISSIONS: Record<OrderRole, StaffPermissions> = {
  admin: { manage: true, performance: true, payroll: true },
  manager: { manage: true, performance: true, payroll: false },
  receptionist: { manage: false, performance: false, payroll: false },
  staff: { manage: false, performance: false, payroll: false },
}
