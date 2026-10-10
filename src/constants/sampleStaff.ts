import type {
  LeaveRequest,
  OpenShift,
  SkillLevel,
  StaffMember,
  StaffStatus,
} from '../types/staff'
import { BRANCHES } from './orders'

// Sample workforce until the staff API exists
const DAY_MS = 86_400_000
const loadedAt = Date.now()
const days = (offset: number) => new Date(loadedAt + offset * DAY_MS).toISOString()
const minutes = (offset: number) => new Date(loadedAt + offset * 60_000).toISOString()

type Seed = {
  n: number
  name: string
  title: string
  dept: string
  template: string
  status: StaffStatus
  shift?: [string, string]
  clockIn?: string
  assignment?: string
  ref?: string
  tasks?: [assigned: number, done: number, overdue: number]
  capacity?: number
  attendance: number
  late?: number
  score: number
  skills: [string, SkillLevel][]
  cert?: [string, number]
  branch?: number
  salary: number
  breakMin?: number
}

const SEEDS: Seed[] = [
  { n: 24, name: 'Jean Mbarga', title: 'Lead Wash Operator', dept: 'Laundry Operations', template: 'Laundry Operator', status: 'working', shift: ['08:00', '17:00'], clockIn: '07:56', assignment: 'Washer #01 · running order', ref: 'ORD-10452', tasks: [14, 8, 0], capacity: 16, attendance: 98.4, score: 96, skills: [['Washing', 'Expert'], ['Drying', 'Advanced'], ['Stain Treatment', 'Advanced'], ['Folding', 'Intermediate']], salary: 185_000 },
  { n: 41, name: 'Sarah Mbarga', title: 'Senior Finisher & Press', dept: 'Finishing & Press', template: 'Laundry Operator', status: 'working', shift: ['08:30', '17:30'], clockIn: '08:28', assignment: 'Rotary Steam Press #01 · 14 bridal/suits queued', ref: 'ORD-10451', tasks: [15, 6, 1], capacity: 10, attendance: 99.1, score: 94, skills: [['Ironing', 'Expert'], ['Folding', 'Expert'], ['Packaging', 'Advanced']], salary: 170_000 },
  { n: 19, name: 'Elena Rostova', title: 'Bio-Safety & Wash Tech', dept: 'Laundry Operations', template: 'Laundry Operator', status: 'available', shift: ['07:00', '15:30'], clockIn: '06:55', assignment: 'Idle at Bay #02 (standby)', tasks: [5, 4, 0], capacity: 14, attendance: 100, score: 99, skills: [['Washing', 'Expert'], ['Stain Treatment', 'Expert'], ['Ironing', 'Advanced'], ['Quality Control', 'Intermediate']], salary: 180_000 },
  { n: 33, name: 'Carlos Mendez', title: 'Logistics Route Driver', dept: 'Delivery', template: 'Driver', status: 'working', shift: ['08:00', '17:00'], clockIn: '08:21', assignment: 'Van #1 · stop 8 of 12', ref: 'DLV-021', tasks: [12, 8, 1], capacity: 12, attendance: 95, late: 5, score: 88, skills: [['Driving', 'Expert'], ['Customer Service', 'Intermediate']], cert: ['Heavy vehicle licence', 12], salary: 150_000 },
  { n: 52, name: 'Priya Patel', title: 'QC & Packaging Inspector', dept: 'Quality Control', template: 'Quality Control', status: 'break', shift: ['08:00', '16:30'], clockIn: '08:04', assignment: 'QC Station #02 · resumes after break', tasks: [22, 18, 0], capacity: 28, attendance: 96.8, score: 97, skills: [['Quality Control', 'Expert'], ['Packaging', 'Expert'], ['Stain Treatment', 'Advanced']], breakMin: 22, salary: 165_000 },
  { n: 68, name: 'David Kim', title: 'Preventive Maintenance Tech', dept: 'Maintenance', template: 'Maintenance', status: 'working', shift: ['07:30', '16:00'], clockIn: '07:31', assignment: 'Washer #04 · drain valve repair', tasks: [4, 2, 0], capacity: 5, attendance: 99.5, score: 95, skills: [['Machine Maintenance', 'Expert'], ['Washing', 'Intermediate']], cert: ['Industrial boiler certificate', 18], salary: 210_000 },
  { n: 12, name: 'Aisha Tamba', title: 'Front Desk Receptionist', dept: 'Front Desk', template: 'Receptionist', status: 'working', shift: ['08:00', '16:00'], clockIn: '07:58', assignment: 'Intake counter', tasks: [18, 13, 0], capacity: 26, attendance: 97.2, score: 93, skills: [['Customer Service', 'Expert'], ['Packaging', 'Intermediate']], salary: 140_000 },
  { n: 15, name: 'Mary Ngono', title: 'Cashier', dept: 'Front Desk', template: 'Cashier', status: 'available', shift: ['09:00', '17:00'], clockIn: '09:12', assignment: 'Drawer #01 (no customer)', tasks: [9, 9, 0], capacity: 24, attendance: 93.5, late: 4, score: 86, skills: [['Customer Service', 'Advanced']], salary: 135_000 },
  { n: 57, name: 'Samuel Eto’o N.', title: 'Delivery Driver', dept: 'Delivery', template: 'Driver', status: 'available', shift: ['08:00', '17:00'], clockIn: '07:50', assignment: 'Van #2 · in depot', tasks: [3, 3, 0], capacity: 12, attendance: 98, score: 93, skills: [['Driving', 'Advanced'], ['Customer Service', 'Advanced']], cert: ['Driving licence', 240], salary: 145_000 },
  { n: 61, name: 'Patrice Alima', title: 'Motorbike Courier', dept: 'Delivery', template: 'Driver', status: 'break', shift: ['07:00', '15:00'], clockIn: '07:02', assignment: 'Bike MC-189 · on break', tasks: [9, 6, 0], capacity: 12, attendance: 96, score: 91, skills: [['Driving', 'Advanced']], breakMin: 14, salary: 120_000 },
  { n: 44, name: 'Paul Essomba', title: 'Wash Operator', dept: 'Laundry Operations', template: 'Laundry Operator', status: 'absent', shift: ['08:00', '17:00'], attendance: 88.4, late: 6, score: 78, skills: [['Washing', 'Intermediate'], ['Drying', 'Intermediate']], salary: 125_000 },
  { n: 47, name: 'Grace Ekane', title: 'Folding & Packaging Operator', dept: 'Finishing & Press', template: 'Laundry Operator', status: 'leave', attendance: 97, score: 90, skills: [['Folding', 'Advanced'], ['Packaging', 'Advanced']], salary: 120_000 },
  { n: 70, name: 'Aline Biya', title: 'Motorbike Courier', dept: 'Delivery', template: 'Driver', status: 'offline', shift: ['14:00', '21:00'], attendance: 95.5, score: 90, skills: [['Driving', 'Intermediate']], branch: 1, salary: 115_000 },
  { n: 3, name: 'Marcus Vance', title: 'Branch Manager', dept: 'Management', template: 'Manager', status: 'working', shift: ['08:00', '18:00'], clockIn: '07:45', assignment: 'Floor supervision', tasks: [6, 3, 0], capacity: 10, attendance: 99.8, score: 95, skills: [['Customer Service', 'Expert'], ['Quality Control', 'Advanced']], salary: 420_000 },
]

function buildMember(seed: Seed): StaffMember {
  const [assigned, done, overdue] = seed.tasks ?? [0, 0, 0]
  const slug = seed.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
  const onFloor = Boolean(seed.clockIn)
  return {
    id: `EMP-${String(seed.n).padStart(4, '0')}`,
    name: seed.name,
    jobTitle: seed.title,
    department: seed.dept,
    branch: BRANCHES[seed.branch ?? 0],
    phone: `+237 67${seed.n % 10} ${String(100 + seed.n * 7).slice(0, 3)} ${String(200 + seed.n * 3).slice(0, 3)}`,
    email: `${slug}@freshflow.example`,
    employment: seed.n % 11 === 0 ? 'Part-time' : 'Full-time',
    hiredAt: days(-(200 + seed.n * 19)),
    manager: seed.name === 'Marcus Vance' ? 'Owner' : 'Marcus Vance',
    template: seed.template,
    status: seed.status,
    shiftStart: seed.shift?.[0] ?? '',
    shiftEnd: seed.shift?.[1] ?? '',
    workingDays: 'Mon–Sat',
    clockIn: seed.clockIn ?? '',
    breakMinutes: seed.breakMin ?? 0,
    assignment: seed.assignment ?? '',
    assignmentRef: seed.ref ?? '',
    tasksAssigned: assigned,
    tasksDone: done,
    tasksOverdue: overdue,
    capacity: seed.capacity ?? 12,
    attendanceRate: seed.attendance,
    lateThisMonth: seed.late ?? 0,
    score: seed.score,
    onTime: Math.min(100, seed.score + 1),
    quality: Math.min(100, seed.score + 2),
    rating: Math.round((3.6 + (seed.score - 75) / 20) * 10) / 10,
    skills: seed.skills.map(([name, level]) => ({ name, level })),
    certification: seed.cert ? { name: seed.cert[0], expiresAt: days(seed.cert[1]) } : null,
    trainingDone: 6 + (seed.n % 5),
    trainingTotal: 10,
    emergencyContact: 'On file with HR',
    monthlySalary: seed.salary,
    leaveBalance: 6 + (seed.n % 12),
    twoFactor: ['Manager', 'Cashier', 'Receptionist'].includes(seed.template),
    loginAccess: true,
    lastLoginAt: onFloor ? minutes(-(30 + seed.n)) : days(-1 - (seed.n % 4)),
    activity: onFloor
      ? [
          ...(seed.assignment ? [{ at: minutes(-18 - (seed.n % 20)), text: `Started: ${seed.assignment}` }] : []),
          ...(done > 0 ? [{ at: minutes(-70 - (seed.n % 30)), text: `Completed ${done} tasks so far today` }] : []),
          { at: minutes(-420 + (seed.n % 40)), text: `Clocked in at ${seed.clockIn}` },
        ]
      : [{ at: days(-1), text: 'Last shift completed' }],
  }
}

export const SAMPLE_STAFF: StaffMember[] = SEEDS.map(buildMember)

export const SAMPLE_LEAVE: LeaveRequest[] = [
  { id: 'LV-031', staffId: 'EMP-0047', type: 'Annual', from: days(-1), to: days(3), reason: 'Family visit', status: 'Approved', approver: 'Marcus Vance' },
  { id: 'LV-032', staffId: 'EMP-0015', type: 'Personal', from: days(4), to: days(5), reason: 'Administrative appointment', status: 'Pending', approver: '' },
  { id: 'LV-033', staffId: 'EMP-0061', type: 'Sick', from: days(1), to: days(2), reason: 'Medical check-up', status: 'Pending', approver: '' },
]

export const SAMPLE_OPEN_SHIFTS: OpenShift[] = [
  { id: 'SH-1', title: 'Evening press operator', department: 'Finishing & Press', start: '14:00', end: '20:00', skill: 'Ironing' },
  { id: 'SH-2', title: 'Evening QC inspector', department: 'Quality Control', start: '16:30', end: '20:00', skill: 'Quality Control' },
]
