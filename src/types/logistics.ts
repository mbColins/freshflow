import type { BadgeTone } from '../components/ui/Badge'

export type JobType = 'pickup' | 'delivery'
// Backend DispatchPriority: STANDARD, EXPRESS, SAME_DAY
export type JobPriority = 'standard' | 'express' | 'sameDay'
export type JobStatus =
  | 'requested'
  | 'scheduled'
  | 'assigned'
  | 'enRoute'
  | 'arrived'
  | 'done'
  | 'received'
  | 'failed'
  | 'cancelled'

export type DriverStatus = 'available' | 'onRoute' | 'break' | 'offline'

export type ProofOfDelivery = {
  recipient: string
  method: string
  at: string
}

export type DeliveryFailure = {
  reason: string
  notes: string
  nextAction: string
  at: string
}

export type DispatchJob = {
  id: string
  type: JobType
  orderId: string
  customer: string
  phone: string
  address: string
  zone: string
  instructions: string
  manifest: string
  packages: number
  amount: number
  payment: string
  paymentTone: BadgeTone
  priority: JobPriority
  status: JobStatus
  driverId: string | null
  scheduledAt: string
  // When a delivery became ready at the branch; drives the "waiting too long" warning
  readyAt: string | null
  etaMin: number | null
  distanceKm: number
  timeline: { at: string; text: string }[]
  proof?: ProofOfDelivery
  failure?: DeliveryFailure
  // Position on the illustrative map
  x: number
  y: number
  // From the API: the fee charged, the driver's name (the page's driver list
  // may not include them) and the branch the job's zone belongs to
  fee?: number
  driverName?: string
  branchId?: string
  // The delivery zone's uuid (`zone` is its name)
  zoneId?: string
  // Short reference shown to staff, e.g. PCK-00042; `id` is the API's uuid
  code?: string
}

export type Driver = {
  id: string
  name: string
  vehicle: string
  phone: string
  status: DriverStatus
  routeId: string
  location: string
  stopsDone: number
  stopsTotal: number
  etaMin: number | null
  score: number
  note: string
  x: number
  y: number
}

export type LogisticsFilters = {
  query: string
  type: JobType | ''
  status: JobStatus | ''
  zone: string
  priority: JobPriority | ''
  driverId: string
  // Quick views from the KPI cards
  view: '' | 'active' | 'delayed' | 'failed' | 'completed' | 'ready' | 'unassigned'
}
