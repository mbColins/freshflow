import type {
  AppNotification,
  AutomationRule,
  MessageTemplate,
  NotificationCategory,
  NotificationChannel,
  NotificationLogEntry,
  NotificationPriority,
} from '../types/notification'

// Sample data is relative to page-load time so the inbox always looks current
const NOW = Date.now()
const MINUTE = 60_000
const ago = (minutes: number) => new Date(NOW - minutes * MINUTE).toISOString()

type Seed = {
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  // Minutes ago; negative for scheduled sends
  at: number
  channels: NotificationChannel[]
  to: string
  customer?: boolean
  branch?: string
  related?: [kind: string, label: string, to: string]
  read?: boolean
  resolved?: boolean
  failed?: [reason: string, attempts: number]
  queued?: boolean
}

const SEEDS: Seed[] = [
  { category: 'machines', priority: 'Critical', title: 'Washer #02 drainage failure', message: 'Vibration spike at the drain stage. The drum safety valve halted the cycle for order ORD-10428 with water still in the drum.', at: 2, channels: ['Push', 'In-App'], to: 'Thierry Abena, Marcus Vance', branch: 'BR-004', related: ['Machine', 'Washer #02 (WM-002)', '/machines/WM-002'] },
  { category: 'payments', priority: 'Critical', title: 'Mobile Money gateway timeout', message: 'Three MTN MoMo payments in a row expired without PIN confirmation. XAF 31,500 is unsettled.', at: 8, channels: ['SMS', 'In-App'], to: 'Marcus Vance, Mary Ngono', branch: 'BR-004', related: ['Payments', 'Unsettled transactions', '/payments'] },
  { category: 'inventory', priority: 'Critical', title: 'Dry-cleaning solvent out of stock', message: 'Perchloroethylene reached 0.0 L at Downtown. Three VIP suit orders are waiting in staging.', at: 14, channels: ['In-App', 'Email'], to: 'Inventory staff', branch: 'BR-004', related: ['Inventory', 'Dry Cleaning Solvent', '/inventory'], queued: true },
  { category: 'orders', priority: 'Low', title: 'Order ready', message: 'Your laundry order #ORD-10482 is ready for pickup at Downtown Hub #4.', at: 18, channels: ['WhatsApp', 'SMS'], to: 'Sarah Mbarga', customer: true, branch: 'BR-004', related: ['Order', '#ORD-10482', '/orders'], read: true },
  { category: 'delivery', priority: 'High', title: 'Route DLV-021 running 28 minutes late', message: 'Heavy traffic on Boulevard de la Liberté affects four scheduled drop-offs. Customers have been sent a new arrival time.', at: 25, channels: ['Push', 'In-App'], to: 'Samuel Eto’o N., Marcus Vance', branch: 'BR-004', related: ['Route', 'DLV-021', '/pickup-delivery'] },
  { category: 'staff', priority: 'Medium', title: 'Evening press shift is short by two operators', message: 'Steam Press #01 has 14 garments pending and one operator on break at 15:30.', at: 32, channels: ['In-App'], to: 'Marcus Vance', branch: 'BR-004', related: ['Staff', 'Today’s shift schedule', '/staff'] },
  { category: 'orders', priority: 'High', title: 'Express order close to its deadline', message: 'Order #ORD-10451 (express) is still in ironing and is due in 40 minutes.', at: 41, channels: ['In-App', 'Push'], to: 'Sarah Mbarga (Finisher)', branch: 'BR-004', related: ['Order', '#ORD-10451', '/orders'] },
  { category: 'payments', priority: 'High', title: 'Payment failed', message: 'We could not process your payment of XAF 12,000 for order #ORD-10476. Please try again or pay at the counter.', at: 47, channels: ['SMS'], to: 'Beatrice Eboa', customer: true, branch: 'BR-004', related: ['Order', '#ORD-10476', '/payments'], failed: ['Invalid phone number', 2] },
  { category: 'customers', priority: 'Medium', title: 'Customer complaint received', message: 'Joseph Tabi reported a missing shirt on order #ORD-10433 and asked to be called back.', at: 63, channels: ['In-App', 'Email'], to: 'Aisha Tamba', branch: 'BR-001', related: ['Customer', 'Joseph Tabi', '/customers'] },
  { category: 'operations', priority: 'High', title: 'Quality check failed', message: 'Two items on order #ORD-10440 failed QC for a remaining stain and were sent back for reprocessing.', at: 78, channels: ['In-App'], to: 'Priya Patel, Jean Mbarga', branch: 'BR-004', related: ['Order', '#ORD-10440', '/orders'], read: true },
  { category: 'delivery', priority: 'Low', title: 'Your driver is on the way', message: 'Jean is delivering order #ORD-10466 and should arrive between 14:00 and 14:30.', at: 95, channels: ['WhatsApp'], to: 'Amina Bello', customer: true, branch: 'BR-001', related: ['Delivery', 'DLV-018', '/pickup-delivery'], read: true },
  { category: 'orders', priority: 'Low', title: 'Order received', message: 'Thanks! We have received order #ORD-10490 (6 kg Wash & Fold). It will be ready tomorrow by 17:00.', at: 110, channels: ['SMS'], to: 'Nadia Fotso', customer: true, branch: 'BR-007', related: ['Order', '#ORD-10490', '/orders'], read: true },
  { category: 'inventory', priority: 'High', title: 'Low stock: liquid detergent', message: 'EcoClean Heavy-Duty Liquid Detergent is at 18 L, below the 40 L reorder level.', at: 135, channels: ['In-App', 'Email'], to: 'Inventory staff', branch: 'BR-008', related: ['Inventory', 'Liquid Detergent', '/inventory'], failed: ['Provider unavailable', 3] },
  { category: 'machines', priority: 'Medium', title: 'Maintenance overdue on Washer #03', message: 'Preventive maintenance was due three days ago.', at: 170, channels: ['In-App'], to: 'Eric Ndong', branch: 'BR-004', related: ['Machine', 'Washer #03 (WM-003)', '/machines/WM-003'], read: true },
  { category: 'payments', priority: 'Low', title: 'Payment received', message: 'We received XAF 24,500 for order #ORD-10458. Thank you!', at: 190, channels: ['SMS', 'Email'], to: 'Hôtel La Falaise', customer: true, branch: 'BR-004', related: ['Payment', 'PAY-20418', '/payments'], read: true },
  { category: 'system', priority: 'Medium', title: 'Email gateway is responding slowly', message: 'Email delivery is taking around 14 seconds per message. Four messages are queued.', at: 205, channels: ['In-App'], to: 'Administrators', related: ['Settings', 'Notification channels', '/notifications'] },
  { category: 'staff', priority: 'Low', title: 'Leave request submitted', message: 'Patrice Alima asked for sick leave on the 11th and 12th.', at: 260, channels: ['In-App'], to: 'Marcus Vance', branch: 'BR-004', related: ['Staff', 'Leave requests', '/staff'], read: true, resolved: true },
  { category: 'customers', priority: 'Low', title: 'Welcome to FreshFlow', message: 'Welcome, Claire! Use code FIRST1500 for XAF 1,500 off your first order.', at: 300, channels: ['WhatsApp'], to: 'Claire Ondoa', customer: true, branch: 'BR-005', related: ['Customer', 'Claire Ondoa', '/customers'], read: true },
  { category: 'delivery', priority: 'High', title: 'Delivery failed: customer unavailable', message: 'Nobody was home for order #ORD-10419. The driver will try again tomorrow morning.', at: 340, channels: ['WhatsApp', 'SMS'], to: 'Joseph Tabi', customer: true, branch: 'BR-002', related: ['Delivery', 'DLV-015', '/pickup-delivery'], failed: ['Recipient blocked', 1] },
  { category: 'operations', priority: 'Medium', title: 'Washing queue is building up', message: 'Eleven loads are waiting at Bonamoussadi with every washer running.', at: 390, channels: ['In-App', 'Push'], to: 'Jean-Paul Kamga', branch: 'BR-002', related: ['Machines', 'Bonamoussadi washers', '/machines'], read: true },
  { category: 'system', priority: 'Low', title: 'Nightly backup completed', message: 'All branch data was backed up at 02:00.', at: 780, channels: ['In-App'], to: 'Administrators', read: true, resolved: true },
  { category: 'payments', priority: 'Medium', title: 'Outstanding balance reminder', message: 'A balance of XAF 8,200 is still open on order #ORD-10397. Pay by Mobile Money or at the counter.', at: 1500, channels: ['SMS'], to: 'Résidence Bastos', customer: true, branch: 'BR-001', related: ['Order', '#ORD-10397', '/payments'], read: true },
  { category: 'inventory', priority: 'Low', title: 'Purchase order received', message: 'PO-0087 (hangers and garment bags) was received in full.', at: 1700, channels: ['In-App'], to: 'Inventory staff', branch: 'BR-004', related: ['Inventory', 'PO-0087', '/inventory'], read: true, resolved: true },
  // Scheduled
  { category: 'customers', priority: 'Low', title: 'Weekend Fresh reminder', message: 'This weekend: 20% off Wash & Fold with code WEEKEND20. Drop off Saturday or Sunday.', at: -180, channels: ['WhatsApp', 'SMS'], to: 'All customers', customer: true, related: ['Promotion', 'Weekend Fresh', '/promotions'], read: true },
  { category: 'delivery', priority: 'Low', title: 'Pickup reminder', message: 'Your pickup for order #ORD-10495 is scheduled for 16:00 today. Please have your items ready.', at: -95, channels: ['SMS'], to: 'Amina Bello', customer: true, branch: 'BR-001', related: ['Pickup', 'PKP-0093', '/pickup-delivery'], read: true },
  { category: 'staff', priority: 'Low', title: 'Shift reminder', message: 'Your shift at Downtown Hub #4 starts at 14:00.', at: -45, channels: ['Push'], to: 'Aline Biya', branch: 'BR-004', related: ['Staff', 'Shift schedule', '/staff'], read: true },
]

// TODO: replace with the notifications API
export const SAMPLE_NOTIFICATIONS: AppNotification[] = SEEDS.map((seed, index) => {
  const scheduled = seed.at < 0
  const createdAt = scheduled ? ago(600 + index) : ago(seed.at)
  return {
    id: `NTF-${84_920 - index}`,
    category: seed.category,
    priority: seed.priority,
    title: seed.title,
    message: seed.message,
    audience: seed.customer ? 'customer' : seed.category === 'system' ? 'system' : 'staff',
    recipient: seed.to,
    branchId: seed.branch ?? '',
    channels: seed.channels,
    delivery: scheduled ? 'scheduled' : seed.failed ? 'failed' : seed.queued ? 'queued' : 'delivered',
    createdAt,
    scheduledFor: scheduled ? ago(seed.at) : null,
    failure: seed.failed ? { reason: seed.failed[0], attempts: seed.failed[1], lastAttemptAt: ago(Math.max(1, seed.at - 6)) } : null,
    related: seed.related ? { kind: seed.related[0], label: seed.related[1], to: seed.related[2] } : null,
    read: seed.read ?? false,
    readAt: seed.read && !scheduled ? ago(Math.max(1, seed.at - 4)) : null,
    resolved: seed.resolved ?? false,
    archived: false,
    createdBy: seed.customer || seed.category === 'system' ? 'Automation' : 'System',
  }
})

export const SAMPLE_RULES: AutomationRule[] = [
  { id: 'RULE-01', name: 'Order ready', trigger: 'An order status changes', conditions: [{ field: 'Order status', value: 'Ready' }, { field: 'Pickup method', value: 'Customer pickup' }], logic: 'AND', channels: ['WhatsApp', 'SMS'], audience: 'Customer', active: true, successRate: 99.1, runs: 1284 },
  { id: 'RULE-02', name: 'Order received', trigger: 'An order is created', conditions: [], logic: 'AND', channels: ['SMS'], audience: 'Customer', active: true, successRate: 98.4, runs: 1410 },
  { id: 'RULE-03', name: 'Machine failure', trigger: 'A machine reports a fault', conditions: [{ field: 'Fault severity', value: 'Critical' }], logic: 'AND', channels: ['Push', 'In-App'], audience: 'Maintenance staff', active: true, successRate: 100, runs: 17 },
  { id: 'RULE-04', name: 'Outstanding balance', trigger: 'A payment stays unpaid for 24 hours', conditions: [], logic: 'AND', channels: ['SMS'], audience: 'Customer', active: true, successRate: 94.4, runs: 212 },
  { id: 'RULE-05', name: 'Inventory critical', trigger: 'Stock falls below its critical level', conditions: [], logic: 'AND', channels: ['In-App', 'Email'], audience: 'Inventory manager', active: true, successRate: 96.0, runs: 25 },
  { id: 'RULE-06', name: 'Pickup reminder', trigger: 'A pickup is 2 hours away', conditions: [], logic: 'AND', channels: ['SMS'], audience: 'Customer', active: true, successRate: 97.8, runs: 398 },
  { id: 'RULE-07', name: 'VIP express delay', trigger: 'An order passes its due time', conditions: [{ field: 'Order priority', value: 'Express' }, { field: 'Customer group', value: 'VIP' }], logic: 'OR', channels: ['Push', 'In-App'], audience: 'Operations manager', active: false, successRate: null, runs: 0 },
]

export const SAMPLE_TEMPLATES: MessageTemplate[] = [
  { id: 'TPL-01', name: 'Order ready', category: 'orders', channel: 'WhatsApp', language: 'English', active: true, updatedAt: ago(60 * 24 * 3), uses: 1284, subject: 'Your order is ready', body: 'Hi {{customerName}}, your order #{{orderNumber}} is ready for pickup at {{branchName}}. Collect it {{pickupDate}}.' },
  { id: 'TPL-02', name: 'Order received', category: 'orders', channel: 'SMS', language: 'English', active: true, updatedAt: ago(60 * 24 * 12), uses: 1410, subject: 'Order received', body: 'FreshFlow: we received order #{{orderNumber}}. Track it at {{trackingLink}}.' },
  { id: 'TPL-03', name: 'Commande prête', category: 'orders', channel: 'SMS', language: 'French', active: true, updatedAt: ago(60 * 24 * 12), uses: 402, subject: 'Votre commande est prête', body: 'Bonjour {{customerName}}, votre commande #{{orderNumber}} est prête à {{branchName}}.' },
  { id: 'TPL-04', name: 'Delivery reminder', category: 'delivery', channel: 'WhatsApp', language: 'English', active: true, updatedAt: ago(60 * 24 * 20), uses: 611, subject: 'Delivery on its way', body: 'Hi {{customerName}}, order #{{orderNumber}} will be delivered {{deliveryDate}}. Follow the driver: {{trackingLink}}' },
  { id: 'TPL-05', name: 'Payment failed', category: 'payments', channel: 'SMS', language: 'English', active: true, updatedAt: ago(60 * 24 * 8), uses: 96, subject: 'Payment failed', body: 'FreshFlow: your payment of {{amount}} for order #{{orderNumber}} did not go through. Please try again.' },
  { id: 'TPL-06', name: 'Payment confirmation', category: 'payments', channel: 'Email', language: 'English', active: true, updatedAt: ago(60 * 24 * 30), uses: 742, subject: 'Receipt for order #{{orderNumber}}', body: 'Dear {{customerName}},\n\nWe received {{amount}} for order #{{orderNumber}} at {{branchName}}. Thank you for choosing FreshFlow.' },
  { id: 'TPL-07', name: 'Welcome message', category: 'customers', channel: 'WhatsApp', language: 'English', active: false, updatedAt: ago(60 * 24 * 45), uses: 188, subject: 'Welcome to FreshFlow', body: 'Welcome {{customerName}}! Your nearest branch is {{branchName}}.' },
]

export const SAMPLE_NOTIFICATION_LOG: NotificationLogEntry[] = [
  { at: ago(47), user: 'System', action: 'Notification failed', entity: 'Payment failed → Beatrice Eboa (invalid phone number)' },
  { at: ago(205), user: 'System', action: 'Channel degraded', entity: 'Email gateway responding slowly' },
  { at: ago(60 * 26), user: 'Marcus Vance', action: 'Rule disabled', entity: 'VIP express delay' },
  { at: ago(60 * 24 * 3), user: 'Mary Ngono', action: 'Template modified', entity: 'Order ready (WhatsApp)' },
  { at: ago(60 * 24 * 5), user: 'Marcus Vance', action: 'Preference changed', entity: 'Quiet hours set to 22:00–07:00' },
]
