export type StageId =
  | 'received'
  | 'sorting'
  | 'washing'
  | 'drying'
  | 'ironing'
  | 'qc'
  | 'packaging'
  | 'ready'

export type JobEvent = { at: string; text: string; by: string }

export type OpsJob = {
  // The order number, e.g. ORD-10452
  id: string
  customer: string
  service: string
  items: number
  // Items counted at intake; differs from `items` when something is missing
  itemsFound: number
  weightKg: number
  // Weight recorded after washing, when the service is priced by weight
  postWashKg: number | null
  stage: StageId
  // Being worked on right now, as opposed to waiting in the stage's queue
  active: boolean
  staff: string
  // Their uuids, empty when nobody / no machine is on the job
  staffId: string
  machine: string
  machineId: string
  // The branch the order is processed at
  branch: string
  // When the job entered its current stage, or started being worked on
  stageSince: string
  dueAt: string
  priority: 'Normal' | 'Express'
  method: 'Pickup' | 'Delivery'
  instructions: string[]
  qcFailures: number
  customerNotified: boolean
  history: JobEvent[]
}

export type OpsFilters = {
  query: string
  stage: StageId | ''
  staff: string
  service: string
  // Quick views that cut across stages
  view: '' | 'delayed' | 'express' | 'waiting' | 'special'
  method: '' | 'Pickup' | 'Delivery'
}

export type QcResult =
  | { passed: true }
  | { passed: false; reason: string; sendTo: 'washing' | 'ironing' }

export type OpsHealth = 'Good' | 'Warning' | 'Critical'
