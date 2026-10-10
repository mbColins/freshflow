import type { BadgeTone } from '../components/ui/Badge'
import type {
  CustomerFilters,
  CustomerStatus,
  LoyaltyTier,
  SegmentId,
} from '../types/customer'
import type { OrderRole } from '../types/order'

export const CUSTOMER_STATUSES: {
  id: CustomerStatus
  label: string
  tone: BadgeTone
}[] = [
  { id: 'active', label: 'Active', tone: 'success' },
  { id: 'new', label: 'New', tone: 'brand' },
  { id: 'vip', label: 'VIP', tone: 'warning' },
  { id: 'inactive', label: 'Inactive', tone: 'neutral' },
  { id: 'suspended', label: 'Suspended', tone: 'danger' },
]

// Placeholder thresholds until loyalty settings are configurable by administrators
export const LOYALTY_TIERS: { id: LoyaltyTier; label: string; min: number }[] = [
  { id: 'bronze', label: 'Bronze', min: 0 },
  { id: 'silver', label: 'Silver', min: 1_000 },
  { id: 'gold', label: 'Gold', min: 5_000 },
  { id: 'platinum', label: 'Platinum', min: 10_000 },
]

export const REWARDS = [
  { name: '10% Discount', cost: 500 },
  { name: 'Free Ironing', cost: 1_000 },
  { name: 'Free Delivery', cost: 1_500 },
  { name: 'Free Duvet Wash & Sanitize', cost: 5_000 },
]

export const CUSTOMER_TAGS = [
  'VIP',
  'Regular',
  'Corporate',
  'Student',
  'Hotel',
  'High Value',
  'Frequent',
  'New',
  'Inactive',
  'Delivery Customer',
]

export const HIGH_SPENDER_MIN = 250_000
export const FREQUENT_MIN_ORDERS = 10
// No order for this long counts as inactive in the retention indicator
export const INACTIVE_AFTER_DAYS = 60

export const SEGMENTS: { id: SegmentId; label: string; financial?: boolean }[] = [
  { id: 'new', label: 'New Customers' },
  { id: 'frequent', label: 'Frequent Customers' },
  { id: 'vip', label: 'VIP Customers' },
  { id: 'inactive', label: 'Inactive Customers' },
  { id: 'highSpenders', label: 'High Spenders (> 250k)', financial: true },
  { id: 'delivery', label: 'Delivery Customers' },
  { id: 'corporate', label: 'Corporate Customers' },
  { id: 'balance', label: 'Has Unpaid Balance', financial: true },
]

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = {
  query: '',
  segment: '',
  status: '',
  kind: '',
  branch: '',
  tier: '',
  lastOrder: '',
  registered: '',
  minOrders: '',
  minSpent: '',
  balance: '',
  service: '',
  method: '',
  tag: '',
}

export const CUSTOMER_COLUMNS = [
  { key: 'contact', label: 'Contact', financial: false },
  { key: 'orders', label: 'Orders', financial: false },
  { key: 'spent', label: 'Total Spent', financial: true },
  { key: 'lastOrder', label: 'Last Order', financial: false },
  { key: 'outstanding', label: 'Outstanding', financial: true },
  { key: 'loyalty', label: 'Loyalty', financial: false },
  { key: 'service', label: 'Preferred Service', financial: false },
  { key: 'status', label: 'Status', financial: false },
]

export const CAMPAIGN_TEMPLATES = [
  'Your loyalty points expire soon.',
  '20% discount this weekend.',
  'Your last order was 30 days ago. We miss you!',
  'Special offer for Gold customers.',
]

export const LAUNDRY_OPTIONS = {
  detergent: ['Regular', 'Hypoallergenic', 'Unscented', 'Eco'],
  softener: ['None', 'Lavender', 'Fresh Linen', 'Unscented'],
  folding: ['Standard', 'Folded individually', 'On hangers'],
  packaging: ['Standard', 'Premium', 'Garment bag'],
}

export type CustomerPermissions = {
  // Spending, balances, payments and lifetime value
  financials: boolean
  // Add and edit customers, addresses, notes, preferences
  edit: boolean
  // Suspend, archive, adjust points, import, campaigns
  manage: boolean
}

export const CUSTOMER_PERMISSIONS: Record<OrderRole, CustomerPermissions> = {
  admin: { financials: true, edit: true, manage: true },
  manager: { financials: true, edit: true, manage: true },
  receptionist: { financials: true, edit: true, manage: false },
  staff: { financials: false, edit: false, manage: false },
}
