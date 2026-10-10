import type { BadgeTone } from '../components/ui/Badge'
import type { OrderRole } from '../types/order'
import type { PayMethod, PaymentFilters, TxnStatus } from '../types/payment'

export const TXN_STATUSES: { id: TxnStatus; label: string; tone: BadgeTone }[] = [
  { id: 'completed', label: 'Completed', tone: 'success' },
  { id: 'pending', label: 'Pending', tone: 'warning' },
  { id: 'failed', label: 'Failed', tone: 'danger' },
  { id: 'refunded', label: 'Refunded', tone: 'neutral' },
  { id: 'partialRefund', label: 'Partially Refunded', tone: 'neutral' },
  { id: 'cancelled', label: 'Cancelled', tone: 'neutral' },
  { id: 'reversed', label: 'Reversed', tone: 'danger' },
]

// Method colors follow a colorblind-checked order; keep color tied to the method
export const PAY_METHODS: { id: PayMethod; color: string; digital: boolean }[] = [
  { id: 'Cash', color: '#2a78d6', digital: false },
  { id: 'Mobile Money', color: '#eb6834', digital: true },
  { id: 'Card', color: '#1baf7a', digital: true },
  { id: 'Bank Transfer', color: '#eda100', digital: true },
  { id: 'Account Credit', color: '#6250d6', digital: false },
]

// Providers are business configuration, not fixed in the interface.
// TODO: load from payment settings; these are this sample branch's providers.
export const PAYMENT_PROVIDERS: {
  name: string
  method: PayMethod
  status: 'Operational' | 'Service Degraded'
  responseMs: number
  successRate: number
  lastSyncMin: number
}[] = [
  { name: 'MTN MoMo', method: 'Mobile Money', status: 'Operational', responseMs: 1200, successRate: 99.4, lastSyncMin: 2 },
  { name: 'Orange Money', method: 'Mobile Money', status: 'Service Degraded', responseMs: 4100, successRate: 91.2, lastSyncMin: 14 },
  { name: 'Visa / Mastercard POS', method: 'Card', status: 'Operational', responseMs: 900, successRate: 98.9, lastSyncMin: 1 },
  { name: 'Bank Wire Sync', method: 'Bank Transfer', status: 'Operational', responseMs: 2600, successRate: 100, lastSyncMin: 35 },
]

export const REFUND_REASONS = [
  'Order cancelled',
  'Service issue',
  'Duplicate payment',
  'Customer request',
  'Overpayment',
  'Other',
]

export const VARIANCE_REASONS = [
  'Cash shortage',
  'Cash excess',
  'Duplicate transaction',
  'Missing transaction',
  'Provider delay',
  'Other',
]

export const REMINDER_CHANNELS = ['SMS', 'WhatsApp', 'Email']

// Sample trend series for the overview chart: [current period, previous period].
// Scaled to sit close to the sample transactions so the page tells one story.
export const OVERVIEW_SERIES = {
  today: {
    label: 'Today vs yesterday',
    points: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    revenue: [[4, 10, 15, 21, 31, 27, 23, 25, 30, 32, 34], [4, 8, 13, 19, 26, 24, 22, 23, 26, 28, 30]],
    transactions: [[1, 1, 2, 2, 3, 2, 2, 1, 2, 1, 1], [1, 1, 1, 2, 3, 2, 2, 1, 1, 1, 1]],
    refunds: [[0, 0, 5, 0, 0, 0, 7, 0, 0, 0, 0], [0, 2, 0, 0, 4, 0, 0, 3, 0, 0, 0]],
  },
  week: {
    label: 'Last 7 days vs the 7 before',
    points: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    revenue: [[198, 212, 231, 224, 262, 301, 255], [185, 201, 208, 217, 236, 270, 233]],
    transactions: [[14, 15, 17, 16, 19, 22, 18], [13, 14, 15, 15, 17, 19, 16]],
    refunds: [[5, 4, 8, 3, 9, 6, 12], [7, 3, 5, 6, 7, 4, 5]],
  },
  month: {
    label: 'Last 4 weeks vs the 4 before',
    points: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
    revenue: [[1480, 1555, 1640, 1683], [1390, 1440, 1530, 1585]],
    transactions: [[104, 110, 117, 121], [98, 102, 109, 113]],
    refunds: [[36, 31, 42, 47], [38, 33, 37, 39]],
  },
} as const

export type OverviewRange = keyof typeof OVERVIEW_SERIES
export type OverviewMetric = 'revenue' | 'transactions' | 'refunds'

// Sample figures for the other branches until reporting exists;
// the current branch's row is computed from live data
export const OTHER_BRANCH_FINANCIALS = [
  { branch: 'Akwa Branch', revenue: 186_400, transactions: 13, outstanding: 92_000, refunds: 4_000 },
  { branch: 'Bonapriso Branch', revenue: 131_250, transactions: 9, outstanding: 41_500, refunds: 0 },
]

export const EMPTY_PAYMENT_FILTERS: PaymentFilters = {
  query: '',
  status: '',
  method: '',
  cashier: '',
  minAmount: '',
  view: '',
}

export type PaymentPermissions = {
  // See the page at all
  view: boolean
  record: boolean
  // Complete refunds, approve requests, reverse payments
  approve: boolean
  // Cash adjustments, closing the register, reconciliation
  reconcile: boolean
}

export const PAYMENT_PERMISSIONS: Record<OrderRole, PaymentPermissions> = {
  admin: { view: true, record: true, approve: true, reconcile: true },
  manager: { view: true, record: true, approve: true, reconcile: true },
  receptionist: { view: true, record: true, approve: false, reconcile: false },
  staff: { view: false, record: false, approve: false, reconcile: false },
}
