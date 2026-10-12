import type { MachineType } from '../types/machine'
import type { OpsFilters, StageId } from '../types/operations'
import type { OrderRole } from '../types/order'

export const STAGES: {
  id: StageId
  label: string
  // Verb used on buttons: "Start Washing", "Complete Washing"
  verb: string
  // Minutes a job normally spends being worked on in this stage
  expectedMin: number
  machineType: MachineType | null
  dot: string
}[] = [
  { id: 'received', label: 'Received', verb: 'Intake', expectedMin: 15, machineType: null, dot: 'bg-muted/60' },
  { id: 'sorting', label: 'Sorting', verb: 'Sorting', expectedMin: 15, machineType: null, dot: 'bg-accent' },
  { id: 'washing', label: 'Washing', verb: 'Washing', expectedMin: 45, machineType: 'Washing Machine', dot: 'bg-brand' },
  { id: 'drying', label: 'Drying', verb: 'Drying', expectedMin: 40, machineType: 'Dryer', dot: 'bg-warning' },
  { id: 'ironing', label: 'Ironing / Folding', verb: 'Ironing', expectedMin: 30, machineType: null, dot: 'bg-brand-dark' },
  { id: 'qc', label: 'Quality Control', verb: 'Inspection', expectedMin: 10, machineType: null, dot: 'bg-accent' },
  { id: 'packaging', label: 'Packaging', verb: 'Packaging', expectedMin: 10, machineType: null, dot: 'bg-muted' },
  { id: 'ready', label: 'Ready', verb: 'Ready', expectedMin: 0, machineType: null, dot: 'bg-success' },
]

export const QC_CHECKLIST = [
  'Cleanliness',
  'Stain removal',
  'Dryness',
  'Ironing',
  'Folding',
  'Item count',
]

// Processing branch this page runs for, and how much it can handle in a day
export const OPS_BRANCH_ID = 'BR-004'
export const DAILY_CAPACITY_KG = 500
// A staff member is fully loaded at this many jobs in hand
export const STAFF_JOB_CAPACITY = 6
// A stage is flagged when this many jobs are waiting in it
export const BOTTLENECK_WAITING = 3
// A job is "running long" past this share of the stage's expected time
export const OVERRUN_RATIO = 1.25

export const OPS_STAFF = [
  'Jean Mbarga',
  'Sarah Mbarga',
  'Elena Rostova',
  'Priya Patel',
  'Aline Biya',
  'Patrice Alima',
]

// Average minutes actually spent per stage over the last 7 days. TODO: compute from job history.
export const ACTUAL_STAGE_MINUTES: Partial<Record<StageId, number>> = {
  sorting: 14,
  washing: 52,
  drying: 47,
  ironing: 33,
  qc: 9,
  packaging: 11,
}

// Kilograms finished by each two-hour block today. TODO: compute from completed jobs.
export const HOURLY_PRODUCTION: [hour: string, kg: number][] = [
  ['06–08', 18],
  ['08–10', 46],
  ['10–12', 71],
  ['12–14', 64],
  ['14–16', 58],
  ['16–18', 39],
]

export const SUPPLIES: { name: string; remaining: number; note: string }[] = [
  { name: 'Liquid detergent', remaining: 72, note: '140 L in the tank' },
  { name: 'Fabric softener', remaining: 31, note: 'Reorder soon' },
  { name: 'Packaging bags', remaining: 12, note: 'Low stock' },
]

export const SUPPLY_LOW_PCT = 20
export const SUPPLY_WARN_PCT = 35

// Validated categorical chart colours, in fixed order
export const SERIES_COLORS = { expected: '#2a78d6', actual: '#eb6834' }

export const EMPTY_OPS_FILTERS: OpsFilters = {
  query: '',
  stage: '',
  staff: '',
  service: '',
  view: '',
  method: '',
}

export type OpsPermissions = {
  // Move jobs through the stages and run quality checks
  process: boolean
  // Assign staff, move jobs between any stages, override
  manage: boolean
  // Capacity, analytics and cross-branch figures
  analytics: boolean
}

export const OPS_PERMISSIONS: Record<OrderRole, OpsPermissions> = {
  admin: { process: true, manage: true, analytics: true },
  manager: { process: true, manage: true, analytics: true },
  receptionist: { process: false, manage: false, analytics: false },
  staff: { process: true, manage: false, analytics: false },
}
