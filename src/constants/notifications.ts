import {
  Banknote,
  ClipboardList,
  Cpu,
  Package,
  ServerCog,
  Truck,
  UserCog,
  Users,
  WashingMachine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../components/ui/Badge'
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationFilters,
  NotificationPreferences,
  NotificationPriority,
  NotificationTab,
} from '../types/notification'

export const CATEGORIES: { value: NotificationCategory; label: string; icon: LucideIcon }[] = [
  { value: 'orders', label: 'Orders', icon: ClipboardList },
  { value: 'customers', label: 'Customers', icon: Users },
  { value: 'operations', label: 'Laundry Operations', icon: WashingMachine },
  { value: 'delivery', label: 'Pickup & Delivery', icon: Truck },
  { value: 'payments', label: 'Payments', icon: Banknote },
  { value: 'inventory', label: 'Inventory', icon: Package },
  { value: 'staff', label: 'Staff', icon: UserCog },
  { value: 'machines', label: 'Machines', icon: Cpu },
  { value: 'system', label: 'System', icon: ServerCog },
]

export const PRIORITIES: { value: NotificationPriority; tone: BadgeTone; dot: string; help: string }[] = [
  { value: 'Critical', tone: 'danger', dot: 'bg-danger', help: 'Requires immediate attention' },
  { value: 'High', tone: 'warning', dot: 'bg-warning', help: 'Requires action soon' },
  { value: 'Medium', tone: 'brand', dot: 'bg-brand', help: 'Needs attention, not urgent' },
  { value: 'Low', tone: 'neutral', dot: 'bg-muted/50', help: 'Informational' },
]

export const CHANNELS: NotificationChannel[] = ['In-App', 'Push', 'SMS', 'WhatsApp', 'Email']

export const TABS: { value: NotificationTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'critical', label: 'Critical' },
  { value: 'customers', label: 'Customers' },
  { value: 'staff', label: 'Staff' },
  { value: 'operations', label: 'Operations' },
  { value: 'payments', label: 'Payments' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'delivery', label: 'Pickup & Delivery' },
  { value: 'system', label: 'System' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
]

export const FAILURE_REASONS = [
  'Invalid phone number',
  'Invalid email',
  'Provider unavailable',
  'Network error',
  'Rate limit',
  'Recipient blocked',
]

// Totals for the last 30 days. TODO: read these from the messaging providers.

// Who a new message can be sent to: the audiences POST /notification-center/messages takes
export const COMPOSE_AUDIENCES: { value: string; label: string; kind: 'customer' | 'staff'; help: string }[] = [
  { value: 'CUSTOMERS', label: 'All customers', kind: 'customer', help: 'Those who chose a channel and have an address; promotional messages also need their consent' },
  { value: 'STAFF_ALL', label: 'All staff', kind: 'staff', help: 'Every active staff member' },
  { value: 'BRANCH_MANAGERS', label: 'Branch managers', kind: 'staff', help: 'The managers of the branch' },
  { value: 'OWNER', label: 'Business owner', kind: 'staff', help: 'The account owner' },
]

// Who an automation rule can notify, with a headcount estimate
export const AUDIENCES: { value: string; kind: 'customer' | 'staff'; recipients: number }[] = [
  { value: 'All customers', kind: 'customer', recipients: 5788 },
  { value: 'VIP customers', kind: 'customer', recipients: 312 },
  { value: 'Customers with an open order', kind: 'customer', recipients: 141 },
  { value: 'All staff', kind: 'staff', recipients: 59 },
  { value: 'Managers', kind: 'staff', recipients: 8 },
  { value: 'Drivers', kind: 'staff', recipients: 9 },
  { value: 'Laundry operators', kind: 'staff', recipients: 27 },
  { value: 'Inventory staff', kind: 'staff', recipients: 5 },
]

export const RULE_TRIGGERS = [
  'An order is created',
  'An order status changes',
  'An order passes its due time',
  'A pickup is 2 hours away',
  'A delivery goes out',
  'A payment fails',
  'A payment stays unpaid for 24 hours',
  'Stock falls below its critical level',
  'A machine reports a fault',
  'A shift starts in 1 hour',
]

export const RULE_FIELDS: Record<string, string[]> = {
  'Order status': ['Received', 'Washing', 'Ready', 'Out for delivery', 'Completed'],
  'Pickup method': ['Customer pickup', 'Home delivery'],
  'Order priority': ['Normal', 'Express'],
  'Customer group': ['Standard', 'VIP', 'Corporate'],
  'Fault severity': ['High', 'Critical'],
}

export const RULE_RECIPIENTS = [
  'Customer',
  'Branch manager',
  'Operations manager',
  'Inventory manager',
  'Maintenance staff',
  'Assigned driver',
  'Staff on the shift',
]

export const TEMPLATE_VARIABLES: Record<string, string> = {
  customerName: 'Sarah Mbarga',
  orderNumber: 'ORD-10482',
  orderStatus: 'Ready',
  amount: 'XAF 12,500',
  branchName: 'Downtown Hub #4',
  pickupDate: 'today before 19:00',
  deliveryDate: 'tomorrow, 10:00–12:00',
  trackingLink: 'freshflow.cm/t/10482',
}

// Until the server answers: no role is restricted and quiet hours are off
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  roles: {},
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
}

export const EMPTY_NOTIFICATION_FILTERS: NotificationFilters = {
  query: '',
  tab: 'all',
  priority: '',
  channel: '',
  branch: '',
  date: '',
}

// Validated chart colour for single-series bars
export const CHART_COLOR = '#2a78d6'
