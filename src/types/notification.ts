export type NotificationCategory =
  | 'orders'
  | 'customers'
  | 'operations'
  | 'delivery'
  | 'payments'
  | 'inventory'
  | 'staff'
  | 'machines'
  | 'system'

export type NotificationPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type NotificationChannel = 'In-App' | 'Email' | 'SMS' | 'Push' | 'WhatsApp'
export type NotificationAudience = 'customer' | 'staff' | 'system'
export type DeliveryState = 'delivered' | 'queued' | 'scheduled' | 'failed'

export type NotificationFailure = {
  reason: string
  attempts: number
  lastAttemptAt: string
}

export type AppNotification = {
  id: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  audience: NotificationAudience
  recipient: string
  // Branch code, or empty for business-wide notifications
  branchId: string
  channels: NotificationChannel[]
  delivery: DeliveryState
  createdAt: string
  // Set for scheduled notifications
  scheduledFor: string | null
  failure: NotificationFailure | null
  related: { kind: string; label: string; to: string } | null
  read: boolean
  readAt: string | null
  resolved: boolean
  archived: boolean
  createdBy: string
}

export type NotificationTab =
  | 'all'
  | 'unread'
  | 'critical'
  | 'customers'
  | 'staff'
  | 'operations'
  | 'payments'
  | 'inventory'
  | 'delivery'
  | 'system'
  | 'scheduled'
  | 'failed'

export type NotificationFilters = {
  query: string
  tab: NotificationTab
  priority: NotificationPriority | ''
  channel: NotificationChannel | ''
  branch: string
  date: '' | 'today' | 'yesterday' | 'week'
}

export type RuleCondition = { field: string; value: string }

export type AutomationRule = {
  id: string
  name: string
  trigger: string
  conditions: RuleCondition[]
  // How the conditions combine
  logic: 'AND' | 'OR'
  channels: NotificationChannel[]
  audience: string
  active: boolean
  // Percent delivered over the last 30 days; null before the rule has run
  successRate: number | null
  runs: number
}

export type MessageTemplate = {
  id: string
  name: string
  category: NotificationCategory
  channel: NotificationChannel
  language: 'English' | 'French'
  active: boolean
  updatedAt: string
  uses: number
  subject: string
  body: string
}

export type NotificationLogEntry = {
  at: string
  user: string
  action: string
  entity: string
}

export type ChannelStats = {
  channel: NotificationChannel
  status: 'Operational' | 'Degraded' | 'Down'
  note: string
  sent: number
  delivered: number
  failed: number
  // Opened or read; null when the channel can't report it
  read: number | null
  avgSeconds: number
}

export type NotificationPreferences = {
  // role → categories that role is alerted about
  roles: Record<string, NotificationCategory[]>
  quietHours: { enabled: boolean; from: string; to: string }
}

export type ComposeInput = {
  audience: string
  channels: NotificationChannel[]
  title: string
  message: string
  branchId: string
  // Empty sends straight away
  scheduledFor: string
}
