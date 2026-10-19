import {
  AUDIENCES,
  CATEGORIES,
  CHANNEL_STATS,
  PRIORITIES,
  TEMPLATE_VARIABLES,
} from '../constants/notifications'
import type {
  AppNotification,
  AutomationRule,
  ComposeInput,
  NotificationCategory,
  NotificationFilters,
  NotificationPriority,
  NotificationTab,
} from '../types/notification'
import { csvCell } from './csv'
import { formatDate } from './customers'
import { formatTime } from './orders'

const MINUTE = 60_000
const DAY = 86_400_000

export function getCategory(category: NotificationCategory) {
  return CATEGORIES.find(({ value }) => value === category)!
}

export function getPriority(priority: NotificationPriority) {
  return PRIORITIES.find(({ value }) => value === priority)!
}

// "5 minutes ago", "in 2 hours", or the date once it is more than a day away
export function formatRelative(iso: string, now: number) {
  const diff = now - new Date(iso).getTime()
  const minutes = Math.round(Math.abs(diff) / MINUTE)
  const amount =
    minutes < 1 ? 'a moment' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.round(minutes / 60)} h` : ''
  if (!amount) return `${formatDate(iso)}, ${formatTime(iso)}`
  if (minutes < 1) return 'just now'
  return diff >= 0 ? `${amount} ago` : `in ${amount}`
}

export function formatStamp(iso: string | null) {
  return iso ? `${formatDate(iso)}, ${formatTime(iso)}` : '—'
}

// Needs someone to act: open, and either urgent or undelivered
export function needsAttention(notification: AppNotification) {
  return !notification.resolved && (notification.priority === 'Critical' || notification.delivery === 'failed')
}

export function matchesTab(notification: AppNotification, tab: NotificationTab) {
  switch (tab) {
    case 'all':
      return true
    case 'unread':
      return !notification.read
    case 'critical':
      return notification.priority === 'Critical' && !notification.resolved
    case 'customers':
      return notification.audience === 'customer'
    case 'staff':
      return notification.audience === 'staff'
    case 'operations':
      return notification.category === 'operations' || notification.category === 'machines' || notification.category === 'orders'
    case 'payments':
      return notification.category === 'payments'
    case 'inventory':
      return notification.category === 'inventory'
    case 'delivery':
      return notification.category === 'delivery'
    case 'system':
      return notification.category === 'system'
    case 'scheduled':
      return notification.delivery === 'scheduled'
    case 'failed':
      return notification.delivery === 'failed'
  }
}

export function matchesNotificationFilters(notification: AppNotification, filters: NotificationFilters, now: number) {
  if (!matchesTab(notification, filters.tab)) return false
  if (filters.priority && notification.priority !== filters.priority) return false
  if (filters.channel && !notification.channels.includes(filters.channel)) return false
  if (filters.branch && notification.branchId !== filters.branch) return false
  if (filters.date) {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const created = new Date(notification.createdAt).getTime()
    const from = filters.date === 'today' ? start.getTime() : filters.date === 'yesterday' ? start.getTime() - DAY : start.getTime() - 6 * DAY
    const to = filters.date === 'yesterday' ? start.getTime() : Number.POSITIVE_INFINITY
    if (created < from || created >= to) return false
  }
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  return [notification.title, notification.message, notification.id, notification.recipient, notification.related?.label ?? '']
    .some((value) => value.toLowerCase().includes(query))
}

// Open urgent items first, then newest
export function compareNotifications(a: AppNotification, b: AppNotification) {
  const urgent = Number(needsAttention(b) && b.priority === 'Critical') - Number(needsAttention(a) && a.priority === 'Critical')
  if (urgent) return urgent
  // Two scheduled sends: the one going out soonest comes first
  if (a.scheduledFor && b.scheduledFor) return a.scheduledFor.localeCompare(b.scheduledFor)
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

// The steps a notification has been through, in order
export function getTimeline(notification: AppNotification) {
  const steps: { label: string; at: string | null; state: 'done' | 'pending' | 'failed' }[] = [
    { label: 'Created', at: notification.createdAt, state: 'done' },
  ]
  if (notification.delivery === 'scheduled') {
    steps.push({ label: 'Scheduled to send', at: notification.scheduledFor, state: 'pending' })
    return steps
  }
  steps.push({ label: 'Queued', at: notification.createdAt, state: 'done' })
  if (notification.delivery === 'queued') {
    steps.push({ label: 'Waiting on the provider', at: null, state: 'pending' })
    return steps
  }
  if (notification.failure) {
    steps.push({ label: `Failed: ${notification.failure.reason}`, at: notification.failure.lastAttemptAt, state: 'failed' })
    return steps
  }
  steps.push({ label: 'Delivered', at: notification.createdAt, state: 'done' })
  steps.push({ label: 'Read', at: notification.readAt, state: notification.read ? 'done' : 'pending' })
  if (notification.resolved) steps.push({ label: 'Resolved', at: null, state: 'done' })
  return steps
}

export function getDeliveryRate() {
  const sent = CHANNEL_STATS.reduce((sum, stats) => sum + stats.sent, 0)
  const delivered = CHANNEL_STATS.reduce((sum, stats) => sum + stats.delivered, 0)
  return { sent, delivered, failed: sent - delivered, rate: sent ? (delivered / sent) * 100 : 0 }
}

// ---------- Rules and templates ----------

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

// "When an order status changes, if order status is Ready, notify the customer by WhatsApp and SMS."
export function describeRule(rule: Pick<AutomationRule, 'trigger' | 'conditions' | 'logic' | 'channels' | 'audience'>) {
  const trigger = rule.trigger.charAt(0).toLowerCase() + rule.trigger.slice(1)
  const conditions = rule.conditions
    .filter(({ field, value }) => field && value)
    .map(({ field, value }) => `${field.toLowerCase()} is ${value}`)
    .join(rule.logic === 'AND' ? ' and ' : ' or ')
  const channels = rule.channels.length > 0 ? `by ${list(rule.channels)}` : '(no channel chosen yet)'
  return `When ${trigger}${conditions ? `, if ${conditions}` : ''}, notify the ${rule.audience.toLowerCase()} ${channels}.`
}

// Fills {{variables}} with sample values for the preview
export function renderTemplate(body: string) {
  return body.replace(/\{\{(\w+)\}\}/g, (match, name: string) => TEMPLATE_VARIABLES[name] ?? match)
}

export function getUnknownVariables(body: string) {
  return [...body.matchAll(/\{\{(\w+)\}\}/g)].map(([, name]) => name).filter((name) => !(name in TEMPLATE_VARIABLES))
}

// ---------- Creating ----------

export function getRecipientCount(audience: string) {
  return AUDIENCES.find(({ value }) => value === audience)?.recipients ?? 0
}

export function composeNotification(input: ComposeInput, id: string, by: string): AppNotification {
  const audience = AUDIENCES.find(({ value }) => value === input.audience)
  const at = new Date().toISOString()
  return {
    id,
    category: audience?.kind === 'customer' ? 'customers' : 'staff',
    priority: 'Low',
    title: input.title,
    message: input.message,
    audience: audience?.kind ?? 'staff',
    recipient: `${input.audience} (${getRecipientCount(input.audience).toLocaleString('en-US')})`,
    branchId: input.branchId,
    channels: input.channels,
    delivery: input.scheduledFor ? 'scheduled' : 'delivered',
    createdAt: at,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
    failure: null,
    related: null,
    read: true,
    readAt: input.scheduledFor ? null : at,
    resolved: false,
    archived: false,
    createdBy: by,
  }
}

export function notificationsToCsv(notifications: AppNotification[]) {
  const header = ['ID', 'Created', 'Category', 'Priority', 'Title', 'Message', 'Recipient', 'Branch', 'Channels', 'Delivery', 'Failure reason', 'Read', 'Resolved']
  const rows = notifications.map((notification) => [
    notification.id, notification.createdAt, getCategory(notification.category).label, notification.priority,
    notification.title, notification.message, notification.recipient, notification.branchId,
    notification.channels.join(' + '), notification.delivery, notification.failure?.reason ?? '',
    notification.read ? 'yes' : 'no', notification.resolved ? 'yes' : 'no',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
