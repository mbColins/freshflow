import type { MachineType } from '../types/machine'
import type { OpsFilters, StageId } from '../types/operations'

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

// How much a branch can process in a day
export const DAILY_CAPACITY_KG = 500
// A staff member is fully loaded at this many jobs in hand
export const STAFF_JOB_CAPACITY = 6
// A stage is flagged when this many jobs are waiting in it
export const BOTTLENECK_WAITING = 3
// A job is "running long" past this share of the stage's expected time
export const OVERRUN_RATIO = 1.25

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

// A supply is flagged when this share of its maximum is left
export const SUPPLY_LOW_PCT = 20
export const SUPPLY_WARN_PCT = 35
