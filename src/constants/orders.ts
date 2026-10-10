import type {
  OrderFilters,
  OrderRole,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  SavedView,
} from '../types/order'
import type { BadgeTone } from '../components/ui/Badge'

// Stage colors follow the same colorblind-validated order as the dashboard pipeline
export const STATUSES: { id: OrderStatus; label: string; color: string }[] = [
  { id: 'received', label: 'Received', color: '#2a78d6' },
  { id: 'washing', label: 'Washing', color: '#eb6834' },
  { id: 'drying', label: 'Drying', color: '#1baf7a' },
  { id: 'ironing', label: 'Ironing', color: '#eda100' },
  { id: 'qa', label: 'Quality Check', color: '#6250d6' },
  { id: 'ready', label: 'Ready', color: '#008300' },
  { id: 'handover', label: 'Pickup / Delivery', color: '#e87ba4' },
  { id: 'completed', label: 'Completed', color: '#64748b' },
  { id: 'cancelled', label: 'Cancelled', color: '#94a3b8' },
]

export const PIPELINE_STATUSES = STATUSES.filter(
  ({ id }) => id !== 'cancelled',
)

export const PROCESSING_STATUSES: OrderStatus[] = [
  'washing',
  'drying',
  'ironing',
  'qa',
]

// An order can only be overdue while the plant is still working on it
export const OVERDUE_STATUSES: OrderStatus[] = ['received', ...PROCESSING_STATUSES]

export const PRIORITIES: { id: Priority; label: string; rank: number }[] = [
  { id: 'normal', label: 'Normal', rank: 0 },
  { id: 'high', label: 'High Priority', rank: 1 },
  { id: 'express', label: 'Express', rank: 2 },
]

export const PAYMENT_STATUSES: {
  id: PaymentStatus
  label: string
  tone: BadgeTone
}[] = [
  { id: 'paid', label: 'Paid', tone: 'success' },
  { id: 'partial', label: 'Partially Paid', tone: 'warning' },
  { id: 'unpaid', label: 'Unpaid', tone: 'danger' },
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Mobile Money',
  'Card',
  'Bank Transfer',
]

export const SERVICES = [
  'Wash & Fold',
  'Dry Cleaning',
  'Ironing Only',
  'Sanitize 60°C',
]

// Placeholder price list and fees until pricing comes from the Services/Pricing pages
export const ITEM_PRICES: Record<string, number> = {
  Shirt: 1_000,
  Trousers: 1_200,
  Dress: 2_500,
  Suit: 4_000,
  Bedsheet: 1_500,
  'Duvet Cover': 5_000,
  'Lab Coat': 1_000,
  Sneakers: 7_500,
}
export const SERVICE_MULTIPLIERS: Record<string, number> = {
  'Wash & Fold': 1,
  'Dry Cleaning': 2,
  'Ironing Only': 0.6,
  'Sanitize 60°C': 1.5,
}
export const EXPRESS_SURCHARGE_RATE = 0.25
export const TAX_RATE = 0.1925
export const DELIVERY_FEE = 1_500

export const STAFF = [
  'Elena Rostova',
  'David Kim',
  'Mary Ngono',
  'Aisha Tamba',
]
export const DRIVERS = ['Carlos Mendez', 'Paul Essomba']
export const BRANCHES = ['Downtown Hub #4', 'Akwa Branch', 'Bonapriso Branch']

export const CURRENT_USER = 'Marcus Vance'
// Whose assignments the Laundry Staff perspective shows
export const STAFF_PERSPECTIVE_USER = 'Elena Rostova'

export const QC_CHECKS = [
  'Cleanliness',
  'Dryness',
  'Ironing quality',
  'Stain removal',
  'Packaging',
]

export const MESSAGE_TEMPLATES = [
  'Your laundry order is ready.',
  'Your order is currently being processed.',
  'Your delivery is on the way.',
]

export const NOTIFICATION_EVENTS = [
  'Order created',
  'Payment received',
  'Order delayed',
  'Order ready',
  'Pickup scheduled',
  'Delivery assigned',
  'Delivery completed',
]

export const ORDER_ROLES: { value: OrderRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'staff', label: 'Laundry Staff' },
]

export type Permissions = {
  create: boolean
  updateStatus: boolean
  assign: boolean
  payments: boolean
  cancel: boolean
  financials: boolean
  configure: boolean
  assignedOnly: boolean
}

const FULL_ACCESS: Permissions = {
  create: true,
  updateStatus: true,
  assign: true,
  payments: true,
  cancel: true,
  financials: true,
  configure: true,
  assignedOnly: false,
}

export const PERMISSIONS: Record<OrderRole, Permissions> = {
  admin: FULL_ACCESS,
  manager: FULL_ACCESS,
  receptionist: {
    ...FULL_ACCESS,
    updateStatus: false,
    assign: false,
    cancel: false,
    configure: false,
  },
  staff: {
    create: false,
    updateStatus: true,
    assign: false,
    payments: false,
    cancel: false,
    financials: false,
    configure: false,
    assignedOnly: true,
  },
}

// Table columns the user can hide; Order, Customer and Stage always show
export const OPTIONAL_COLUMNS = [
  { key: 'items', label: 'Items', financial: false },
  { key: 'service', label: 'Service', financial: false },
  { key: 'amount', label: 'Amount', financial: true },
  { key: 'payment', label: 'Payment', financial: true },
  { key: 'due', label: 'Due', financial: false },
  { key: 'method', label: 'Pickup / Delivery', financial: false },
  { key: 'priority', label: 'Priority', financial: false },
  { key: 'assigned', label: 'Assigned To', financial: false },
]

// Lets the loading, empty and error screens be previewed before there is an API
export const PREVIEW_STATES = [
  { value: 'normal', label: 'Normal' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'error', label: 'Error' },
] as const

export type PreviewState = (typeof PREVIEW_STATES)[number]['value']

export const EMPTY_FILTERS: OrderFilters = {
  query: '',
  status: '',
  group: '',
  payment: '',
  service: '',
  staff: '',
  branch: '',
  method: '',
  priority: '',
  due: '',
  customerType: '',
  minAmount: '',
  maxAmount: '',
}

export const PRESET_VIEWS: SavedView[] = [
  {
    name: 'Today’s Unpaid Orders',
    filters: { ...EMPTY_FILTERS, group: 'unpaid', due: 'today' },
  },
  { name: 'Overdue Orders', filters: { ...EMPTY_FILTERS, group: 'overdue' } },
  {
    name: 'Ready for Pickup',
    filters: { ...EMPTY_FILTERS, status: 'ready', method: 'pickup' },
  },
  { name: 'Express Orders', filters: { ...EMPTY_FILTERS, priority: 'express' } },
  {
    name: 'Delivery Today',
    filters: { ...EMPTY_FILTERS, method: 'delivery', due: 'today' },
  },
  {
    name: 'Awaiting Quality Check',
    filters: { ...EMPTY_FILTERS, status: 'qa' },
  },
]
