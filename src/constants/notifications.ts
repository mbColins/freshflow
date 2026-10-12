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
  ChannelStats,
  NotificationCategory,
  NotificationChannel,
  NotificationFilters,
  NotificationPreferences,
  NotificationPriority,
  NotificationTab,
} from '../types/notification'
import type { OrderRole } from '../types/order'

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
export const CHANNEL_STATS: ChannelStats[] = [
  { channel: 'In-App', status: 'Operational', note: '', sent: 1860, delivered: 1860, failed: 0, read: 1420, avgSeconds: 0.1 },
  { channel: 'Push', status: 'Operational', note: '', sent: 3310, delivered: 3280, failed: 30, read: 2150, avgSeconds: 0.4 },
  { channel: 'SMS', status: 'Operational', note: '', sent: 4120, delivered: 4046, failed: 74, read: null, avgSeconds: 1.2 },
  { channel: 'WhatsApp', status: 'Operational', note: '', sent: 5210, delivered: 5168, failed: 42, read: 4410, avgSeconds: 0.9 },
  { channel: 'Email', status: 'Degraded', note: 'The mail gateway is slow. Messages are queued and sent late; other channels are unaffected.', sent: 980, delivered: 942, failed: 38, read: 510, avgSeconds: 14 },
]

// Who a new notification or an automation rule can be sent to, with a headcount estimate
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

export const NOTIFICATION_ROLES = ['Administrator', 'Manager', 'Receptionist', 'Laundry Staff', 'Driver']

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  roles: {
    Administrator: ['orders', 'customers', 'operations', 'delivery', 'payments', 'inventory', 'staff', 'machines', 'system'],
    Manager: ['orders', 'operations', 'delivery', 'payments', 'inventory', 'staff', 'machines'],
    Receptionist: ['orders', 'customers', 'payments'],
    'Laundry Staff': ['orders', 'operations', 'machines'],
    Driver: ['delivery'],
  },
  quietHours: { enabled: true, from: '22:00', to: '07:00' },
}

export const EMPTY_NOTIFICATION_FILTERS: NotificationFilters = {
  query: '',
  tab: 'all',
  priority: '',
  channel: '',
  branch: '',
  date: '',
}

export type NotificationPermissions = {
  // Create notifications, edit rules, templates and preferences
  manage: boolean
  // null means every category
  categories: NotificationCategory[] | null
}

export const NOTIFICATION_PERMISSIONS: Record<OrderRole, NotificationPermissions> = {
  admin: { manage: true, categories: null },
  manager: { manage: true, categories: null },
  receptionist: { manage: false, categories: ['orders', 'customers', 'payments'] },
  staff: { manage: false, categories: ['orders', 'operations', 'machines'] },
}

// Validated chart colour for single-series bars
export const CHART_COLOR = '#2a78d6'
