import {
  Archive,
  CircleCheck,
  CirclePause,
  Fan,
  Flame,
  Layers,
  Package,
  Play,
  PowerOff,
  Shirt,
  TriangleAlert,
  WashingMachine,
  Wind,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../components/ui/Badge'
import type {
  FaultSeverity,
  MachineFilters,
  MachineStatus,
  MachineType,
  MaintenanceState,
  UtilizationLevel,
  UtilizationRange,
} from '../types/machine'
import type { OrderRole } from '../types/order'

export const MACHINE_STATUSES: {
  value: MachineStatus
  label: string
  tone: BadgeTone
  icon: LucideIcon
  bar: string
}[] = [
  { value: 'running', label: 'Running', tone: 'success', icon: Play, bar: 'bg-success' },
  { value: 'available', label: 'Available', tone: 'brand', icon: CircleCheck, bar: 'bg-brand' },
  { value: 'idle', label: 'Idle', tone: 'neutral', icon: CirclePause, bar: 'bg-accent' },
  { value: 'maintenance', label: 'Maintenance', tone: 'warning', icon: Wrench, bar: 'bg-warning' },
  { value: 'fault', label: 'Fault', tone: 'danger', icon: TriangleAlert, bar: 'bg-danger' },
  { value: 'offline', label: 'Offline', tone: 'neutral', icon: PowerOff, bar: 'bg-muted/50' },
  { value: 'retired', label: 'Retired', tone: 'neutral', icon: Archive, bar: 'bg-ink/30' },
]

export const MACHINE_TYPES: {
  value: MachineType
  prefix: string
  icon: LucideIcon
  area: string
  // Whether the machine reports a working temperature
  heated: boolean
  capabilities: string[]
  // Services this type can take when assigning an order
  services: string[]
}[] = [
  { value: 'Washing Machine', prefix: 'WM', icon: WashingMachine, area: 'Washing Area', heated: true, capabilities: ['Wash', 'Heavy Wash', 'Delicate', 'Hot Water', 'Cold Water', 'Spin', 'Quick Cycle', 'Eco Mode'], services: ['Wash & Fold', 'Heavy Wash', 'Sanitize 60°C', 'Bedding & Duvet'] },
  { value: 'Dryer', prefix: 'DR', icon: Wind, area: 'Drying Area', heated: true, capabilities: ['Tumble Dry', 'Low Heat', 'High Heat', 'Cool Down', 'Moisture Sensor', 'Quick Cycle'], services: ['Tumble Dry', 'Low-Heat Dry'] },
  { value: 'Press', prefix: 'PR', icon: Layers, area: 'Finishing Line', heated: true, capabilities: ['Flatwork', 'Rotary Press', 'Steam', 'Shirts', 'Trousers'], services: ['Flatwork Press', 'Shirt Press'] },
  { value: 'Ironing Machine', prefix: 'IR', icon: Shirt, area: 'Finishing Line', heated: true, capabilities: ['Steam Iron', 'Vacuum Board', 'Collar & Cuff', 'Delicate'], services: ['Ironing Only'] },
  { value: 'Steam Machine', prefix: 'ST', icon: Flame, area: 'Boiler Room', heated: true, capabilities: ['Steam Supply', 'Pressure Control', 'Auto Blowdown'], services: ['Steam Finish'] },
  { value: 'Folding Machine', prefix: 'FM', icon: Fan, area: 'Finishing Line', heated: false, capabilities: ['Towels', 'Sheets', 'Garments', 'Auto Stack'], services: ['Folding'] },
  { value: 'Packaging Machine', prefix: 'PK', icon: Package, area: 'Dispatch', heated: false, capabilities: ['Bag Seal', 'Hanger Wrap', 'Label Print'], services: ['Packaging'] },
  { value: 'Other', prefix: 'EQ', icon: Wrench, area: 'Utility', heated: false, capabilities: ['General Use'], services: [] },
]

export const MAINTENANCE_TYPES = [
  'Routine Inspection',
  'Preventive Maintenance',
  'Cleaning',
  'Filter Replacement',
  'Parts Replacement',
  'Calibration',
  'Repair',
  'Emergency Maintenance',
]

export const FAULT_TYPES = [
  'Mechanical Failure',
  'Electrical Failure',
  'Water Pressure',
  'Drainage Blockage',
  'Overheating',
  'Sensor Error',
  'Operator Error',
  'No Power',
  'Other',
]

export const SEVERITIES: { value: FaultSeverity; tone: BadgeTone }[] = [
  { value: 'Low', tone: 'neutral' },
  { value: 'Medium', tone: 'brand' },
  { value: 'High', tone: 'warning' },
  { value: 'Critical', tone: 'danger' },
]

export const TECHNICIANS = ['David Kim', 'Eric Ndong', 'Patrice Alima', 'Thierry Abena']

export const MAINTENANCE_STATES: { value: MaintenanceState; label: string; tone: BadgeTone }[] = [
  { value: 'ok', label: 'Up to date', tone: 'success' },
  { value: 'dueSoon', label: 'Due soon', tone: 'warning' },
  { value: 'overdue', label: 'Overdue', tone: 'danger' },
]

// Lower bound of each band, highest first
export const UTILIZATION_LEVELS: { value: UtilizationLevel; label: string; min: number }[] = [
  { value: 'critical', label: 'Critical (95%+)', min: 95 },
  { value: 'high', label: 'High (80–94%)', min: 80 },
  { value: 'normal', label: 'Normal (40–79%)', min: 40 },
  { value: 'low', label: 'Low (under 40%)', min: 0 },
]

export const UTILIZATION_RANGES: { value: UtilizationRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Last 3 Months' },
]

// Validated categorical chart colours, always assigned in this order
export const TIME_SERIES = [
  { key: 'operating', label: 'Operating', color: '#2a78d6' },
  { key: 'idle', label: 'Idle', color: '#eb6834' },
  { key: 'maintenance', label: 'Maintenance', color: '#1baf7a' },
  { key: 'downtime', label: 'Downtime', color: '#eda100' },
] as const

export const MAINTENANCE_DUE_SOON_DAYS = 7
export const ENERGY_ALERT_PCT = 15
export const REPEAT_FAULT_COUNT = 3
// Rates used to turn consumption into cost until billing data is connected
export const ENERGY_RATE_XAF = 95
export const WATER_RATE_XAF = 0.45

export const MACHINE_WIZARD_STEPS = ['Basic Info', 'Location', 'Specifications', 'Capabilities', 'Review']

export const EMPTY_MACHINE_FILTERS: MachineFilters = {
  query: '',
  branch: '',
  type: '',
  status: '',
  manufacturer: '',
  maintenance: '',
  utilization: '',
}

export const MIN_COMPARE_MACHINES = 2
export const MAX_COMPARE_MACHINES = 4

export type MachinePermissions = {
  // Add, edit, assign jobs and change status
  manage: boolean
  // Transfer between branches and retire
  administer: boolean
  // Schedule and record maintenance, resolve faults
  maintain: boolean
  // See costs and return on investment
  financials: boolean
}

// Everyone can view machines and report a fault
export const MACHINE_PERMISSIONS: Record<OrderRole, MachinePermissions> = {
  admin: { manage: true, administer: true, maintain: true, financials: true },
  manager: { manage: true, administer: false, maintain: true, financials: true },
  receptionist: { manage: false, administer: false, maintain: false, financials: false },
  staff: { manage: false, administer: false, maintain: false, financials: false },
}
