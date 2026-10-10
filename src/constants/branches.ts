import { Ban, CircleCheck, CirclePause, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../components/ui/Badge'
import type {
  BranchFilters,
  BranchPeriod,
  BranchStatus,
  BranchType,
  DayHours,
  PerformanceTier,
  RevenueGranularity,
} from '../types/branch'
import type { OrderRole } from '../types/order'

export const BRANCH_STATUSES: {
  value: BranchStatus
  label: string
  tone: BadgeTone
  icon: LucideIcon
  bar: string
}[] = [
  { value: 'active', label: 'Active', tone: 'success', icon: CircleCheck, bar: 'bg-success' },
  { value: 'maintenance', label: 'Maintenance', tone: 'warning', icon: Wrench, bar: 'bg-warning' },
  { value: 'closed', label: 'Temporarily Closed', tone: 'neutral', icon: CirclePause, bar: 'bg-muted/50' },
  { value: 'inactive', label: 'Inactive', tone: 'danger', icon: Ban, bar: 'bg-danger' },
]

export const BRANCH_TYPES: BranchType[] = [
  'Main Branch',
  'Standard Branch',
  'Pickup Point',
  'Processing Center',
]

export const BRANCH_PERIODS: { value: BranchPeriod; label: string; short: string }[] = [
  { value: 'today', label: 'Today', short: 'today' },
  { value: 'week', label: 'This Week', short: 'this week' },
  { value: 'month', label: 'This Month', short: 'this month' },
  { value: 'lastMonth', label: 'Last Month', short: 'last month' },
]

// Health score thresholds
export const PERFORMANCE_TIERS: { value: PerformanceTier; label: string; min: number }[] = [
  { value: 'high', label: 'High performing', min: 90 },
  { value: 'average', label: 'Average', min: 75 },
  { value: 'low', label: 'Low performing', min: 0 },
]

export const GRANULARITIES: { value: RevenueGranularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const DEFAULT_HOURS: DayHours[] = DAYS.map((day) => ({
  open: day === 'Saturday' ? '08:00' : '07:00',
  close: day === 'Saturday' ? '18:00' : '20:00',
  closed: day === 'Sunday',
}))

// Catalog price in XAF, shown as the default when a branch has no price of its own
export const BRANCH_SERVICES: { name: string; price: number; unit: string }[] = [
  { name: 'Wash & Fold', price: 1500, unit: 'kg' },
  { name: 'Dry Cleaning', price: 3500, unit: 'item' },
  { name: 'Ironing', price: 500, unit: 'item' },
  { name: 'Bedding', price: 4000, unit: 'item' },
  { name: 'Shoe Cleaning', price: 3000, unit: 'pair' },
  { name: 'Carpet Cleaning', price: 2500, unit: 'm²' },
  { name: 'Express Service', price: 2000, unit: 'order' },
  { name: 'Pickup & Delivery', price: 1000, unit: 'trip' },
]

export const PAYMENT_METHODS = ['Cash', 'MTN Mobile Money', 'Orange Money', 'Card']

export const SETUP_TASKS = [
  'Branch manager',
  'Staff',
  'Machines',
  'Inventory',
  'Pricing',
  'Payment methods',
]

// Region → cities, with the map centre used by the location picker
export const REGIONS: Record<string, string[]> = {
  Littoral: ['Douala'],
  Centre: ['Yaoundé'],
  Ouest: ['Bafoussam'],
  'Sud-Ouest': ['Buea', 'Limbe'],
}

export const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  Douala: { lat: 4.0511, lng: 9.7679 },
  Yaoundé: { lat: 3.848, lng: 11.5021 },
  Bafoussam: { lat: 5.4777, lng: 10.4176 },
  Buea: { lat: 4.1527, lng: 9.241 },
  Limbe: { lat: 4.0226, lng: 9.195 },
}

// Degrees of latitude / longitude the location picker covers around a city centre
export const MAP_SPAN = { lat: 0.12, lng: 0.16 }

export const WIZARD_STEPS = [
  'Basic Info',
  'Location',
  'Contact',
  'Hours',
  'Services',
  'Capacity',
  'Setup',
  'Review',
]

export const MACHINE_TYPES = ['Washer', 'Dryer', 'Steam Press', 'Ironing Machine', 'Boiler']
export const STAFF_ROLES = [
  'Receptionist',
  'Wash Operator',
  'Presser',
  'QC Inspector',
  'Driver',
  'Cashier',
]

export const MIN_COMPARE = 2
export const MAX_COMPARE = 5

export const EMPTY_BRANCH_FILTERS: BranchFilters = {
  query: '',
  status: '',
  city: '',
  performance: '',
  period: 'today',
}

export type BranchPermissions = { manage: boolean; financials: boolean }

export const BRANCH_PERMISSIONS: Record<OrderRole, BranchPermissions> = {
  admin: { manage: true, financials: true },
  manager: { manage: false, financials: true },
  receptionist: { manage: false, financials: false },
  staff: { manage: false, financials: false },
}
