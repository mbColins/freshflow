import type { BadgeTone } from '../components/ui/Badge'
import type {
  InventoryFilters,
  MovementType,
  StockStatus,
} from '../types/inventory'
import type { OrderRole } from '../types/order'

// Ordered from most to least urgent; an item takes the first status that applies
export const STOCK_STATUSES: {
  id: StockStatus
  label: string
  tone: BadgeTone
  // Bar color in the health overview
  color: string
}[] = [
  { id: 'out', label: 'Out of Stock', tone: 'danger', color: '#dc2626' },
  { id: 'expired', label: 'Expired', tone: 'danger', color: '#7f1d1d' },
  { id: 'critical', label: 'Critical', tone: 'danger', color: '#ea580c' },
  { id: 'low', label: 'Low Stock', tone: 'warning', color: '#d97706' },
  { id: 'expiring', label: 'Expiring Soon', tone: 'warning', color: '#6250d6' },
  { id: 'overstocked', label: 'Overstocked', tone: 'brand', color: '#2563eb' },
  { id: 'healthy', label: 'Healthy', tone: 'success', color: '#16a34a' },
]

export const EXPIRY_WARNING_DAYS = 30
// No movement for this long counts as slow / dead stock
export const DEAD_STOCK_DAYS = 60

export const INVENTORY_CATEGORIES = [
  { name: 'Laundry Chemicals', help: 'Detergents, bleach, softener, stain remover' },
  { name: 'Packaging', help: 'Bags, hangers, labels, wrapping' },
  { name: 'Cleaning Supplies', help: 'Gloves, brushes, disinfectants' },
  { name: 'Spare Parts', help: 'Machine components and maintenance materials' },
  { name: 'Consumables', help: 'General operational consumables' },
]

export const UNITS = ['Piece', 'Bottle', 'L', 'kg', 'g', 'Box', 'Pack', 'Roll', 'Meter', 'Bag']

export const CONSUMPTION_REASONS: { label: string; type: MovementType }[] = [
  { label: 'Laundry processing', type: 'Consumption' },
  { label: 'Cleaning', type: 'Consumption' },
  { label: 'Maintenance', type: 'Consumption' },
  { label: 'Damaged', type: 'Damage' },
  { label: 'Expired', type: 'Expiry' },
  { label: 'Lost', type: 'Loss' },
]

export const ADJUSTMENT_REASONS = [
  'Stock count correction',
  'Damage',
  'Loss',
  'Theft',
  'Expiry',
  'Data correction',
  'Other',
]

// An adjustment bigger than this share of the system quantity needs a manager
export const ADJUSTMENT_APPROVAL_RATIO = 0.1

// Sample figures until service recipes and metering feed this
export const CONSUMPTION_VARIANCE = [
  { service: 'Wash & Fold', recipe: '20 ml / kg heavy liquid detergent · 62 loads', expected: 7.4, actual: 7.4, unit: 'L' },
  { service: 'Delicates & Silk Enzyme Wash', recipe: '15 ml / kg enzyme surfactant · 14 batches', expected: 1.8, actual: 2.1, unit: 'L' },
  { service: 'Hospital Linens (Sanitize 60°C)', recipe: '35 ml / kg chlorine blend · 22 sets', expected: 11.0, actual: 11.2, unit: 'L' },
]
// A variance past this is flagged as abnormal
export const VARIANCE_ALERT_PCT = 10

export const WEEKLY_CONSUMPTION = [
  { day: 'Mon', units: 128 },
  { day: 'Tue', units: 134 },
  { day: 'Wed', units: 141 },
  { day: 'Thu', units: 126 },
  { day: 'Fri', units: 150 },
  { day: 'Sat', units: 163 },
  { day: 'Sun', units: 142 },
]

export const EMPTY_INVENTORY_FILTERS: InventoryFilters = {
  query: '',
  category: '',
  status: '',
  supplier: '',
  view: '',
}

export type InventoryPermissions = {
  // Unit costs and stock value
  costs: boolean
  // Record consumption
  consume: boolean
  // Add stock, items, purchase orders, transfers, adjustments
  manage: boolean
}

export const INVENTORY_PERMISSIONS: Record<OrderRole, InventoryPermissions> = {
  admin: { costs: true, consume: true, manage: true },
  manager: { costs: true, consume: true, manage: true },
  receptionist: { costs: false, consume: false, manage: false },
  staff: { costs: false, consume: true, manage: false },
}
