import type { BadgeTone } from '../components/ui/Badge'
import type {
  DriverStatus,
  JobPriority,
  JobStatus,
  LogisticsFilters,
} from '../types/logistics'

export const JOB_STATUSES: { id: JobStatus; tone: BadgeTone }[] = [
  { id: 'requested', tone: 'neutral' },
  { id: 'scheduled', tone: 'brand' },
  { id: 'assigned', tone: 'brand' },
  { id: 'enRoute', tone: 'brand' },
  { id: 'arrived', tone: 'brand' },
  { id: 'done', tone: 'success' },
  { id: 'received', tone: 'success' },
  { id: 'failed', tone: 'danger' },
  { id: 'cancelled', tone: 'neutral' },
]

// The same status reads differently for a pickup and a delivery
export const STATUS_LABELS: Record<JobStatus, { pickup: string; delivery: string }> = {
  requested: { pickup: 'Requested', delivery: 'Ready in Staging' },
  scheduled: { pickup: 'Scheduled', delivery: 'Scheduled' },
  assigned: { pickup: 'Driver Assigned', delivery: 'Assigned' },
  enRoute: { pickup: 'En Route', delivery: 'Out for Delivery' },
  arrived: { pickup: 'Arrived', delivery: 'Arrived' },
  done: { pickup: 'Picked Up', delivery: 'Delivered' },
  received: { pickup: 'Received at Branch', delivery: 'Delivered' },
  failed: { pickup: 'Failed', delivery: 'Failed' },
  cancelled: { pickup: 'Cancelled', delivery: 'Cancelled' },
}

export const PICKUP_FLOW: JobStatus[] = [
  'requested',
  'scheduled',
  'assigned',
  'enRoute',
  'done',
  'received',
]
export const DELIVERY_FLOW: JobStatus[] = [
  'requested',
  'scheduled',
  'assigned',
  'enRoute',
  'done',
]

export const CLOSED_STATUSES: JobStatus[] = ['done', 'received', 'failed', 'cancelled']

export const PRIORITIES: { id: JobPriority; label: string; tone: BadgeTone }[] = [
  { id: 'express', label: 'Express', tone: 'danger' },
  { id: 'standard', label: 'Standard', tone: 'neutral' },
  { id: 'flexible', label: 'Flexible', tone: 'neutral' },
]

export const DRIVER_STATUSES: { id: DriverStatus; label: string; tone: BadgeTone }[] = [
  { id: 'available', label: 'Available', tone: 'success' },
  { id: 'onRoute', label: 'On Route', tone: 'brand' },
  { id: 'break', label: 'On Break', tone: 'warning' },
  { id: 'offline', label: 'Offline', tone: 'neutral' },
]

// Marker colors; shape (arrow up / arrow down) carries the same meaning
export const TYPE_COLORS = { pickup: '#2a78d6', delivery: '#1baf7a' }

// A job counts as delayed once it is this far past its scheduled time
export const DELAY_GRACE_MIN = 15
// A finished order waiting at the branch longer than this gets a warning
export const READY_TOO_LONG_MIN = 240

// Placeholder zones, fees and figures until logistics settings and reporting exist
export const ZONES = [
  { name: 'Bonapriso', x: 170, y: 270, fee: 1_000, avgMin: 18, avgKm: 3.1, deliveries: 86, failed: 2, drivers: 2 },
  { name: 'Bonanjo', x: 215, y: 150, fee: 1_000, avgMin: 16, avgKm: 2.6, deliveries: 74, failed: 1, drivers: 2 },
  { name: 'Akwa', x: 340, y: 100, fee: 1_500, avgMin: 22, avgKm: 4.4, deliveries: 112, failed: 4, drivers: 3 },
  { name: 'Deido', x: 410, y: 300, fee: 1_500, avgMin: 27, avgKm: 5.8, deliveries: 58, failed: 5, drivers: 1 },
  { name: 'Makepe', x: 505, y: 205, fee: 2_000, avgMin: 34, avgKm: 8.2, deliveries: 41, failed: 2, drivers: 1 },
  { name: 'Bonamoussadi', x: 490, y: 75, fee: 2_500, avgMin: 39, avgKm: 9.6, deliveries: 37, failed: 3, drivers: 1 },
]

export const DEPOT = { name: 'Downtown Hub #4', x: 300, y: 205 }

export const DELIVERY_PRICING = {
  expressSurcharge: 1_000,
  sameDaySurcharge: 500,
  pickupFee: 500,
  freeDeliveryThreshold: 25_000,
  perKmBeyondZone: 150,
}

export const FAILURE_REASONS = [
  'Customer unavailable',
  'Incorrect address',
  'Customer refused',
  'Unable to contact customer',
  'Payment issue',
  'Access problem',
  'Vehicle problem',
  'Other',
]

export const FAILURE_NEXT_ACTIONS = [
  'Reschedule',
  'Return to Branch',
  'Contact Customer',
  'Cancel Delivery',
]

export const PROOF_METHODS = [
  'OTP Verified',
  'Customer signature',
  'Delivery PIN',
  'Photo confirmation',
]

export const DELIVERY_TEMPLATES = [
  'Your laundry is on the way. Estimated arrival: 15 minutes.',
  'Your pickup is scheduled for 2:00 PM today.',
  'Your delivery has been rescheduled.',
]

// Sample week for the analytics panel
export const WEEKLY_VOLUME = [
  { day: 'Mon', pickups: 22, deliveries: 27, onTime: 93 },
  { day: 'Tue', pickups: 25, deliveries: 30, onTime: 91 },
  { day: 'Wed', pickups: 24, deliveries: 33, onTime: 94 },
  { day: 'Thu', pickups: 29, deliveries: 31, onTime: 89 },
  { day: 'Fri', pickups: 31, deliveries: 38, onTime: 90 },
  { day: 'Sat', pickups: 36, deliveries: 42, onTime: 87 },
  { day: 'Sun', pickups: 28, deliveries: 34, onTime: 92 },
]

export const COST_SUMMARY = {
  revenue: 412_000,
  driverCost: 186_000,
  fuelEstimate: 74_000,
  kilometres: 1_240,
  jobs: 430,
}

export const EMPTY_LOGISTICS_FILTERS: LogisticsFilters = {
  query: '',
  type: '',
  status: '',
  zone: '',
  priority: '',
  driverId: '',
  view: '',
}
