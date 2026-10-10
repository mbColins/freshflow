import {
  OVERDUE_STATUSES,
  PRIORITIES,
  PROCESSING_STATUSES,
  STATUSES,
} from '../constants/orders'
import type {
  Order,
  OrderFilters,
  OrderStatus,
  PaymentStatus,
} from '../types/order'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export function formatXaf(value: number) {
  return `XAF ${Math.round(value).toLocaleString('en-US')}`
}

export function getStatus(id: OrderStatus) {
  return STATUSES.find((status) => status.id === id)!
}

export function getStatusLabel(order: Order) {
  if (order.status !== 'handover') return getStatus(order.status).label
  return order.method === 'delivery' ? 'Out for Delivery' : 'Awaiting Pickup'
}

export function getItemCount(order: Order) {
  return order.items.reduce((sum, { qty }) => sum + qty, 0)
}

export function getItemsPreview(order: Order) {
  return order.items.map(({ name, qty }) => `${name} × ${qty}`).join(', ')
}

export function getPrimaryService(order: Order) {
  return order.items[0]?.service ?? '—'
}

export function getSubtotal(order: Order) {
  return order.items.reduce(
    (sum, { qty, unitPrice }) => sum + qty * unitPrice,
    0,
  )
}

export function getTotal(order: Order) {
  return (
    getSubtotal(order) +
    order.surcharge -
    order.discount +
    order.tax +
    order.deliveryFee
  )
}

export function getPaid(order: Order) {
  return order.payments.reduce((sum, { amount }) => sum + amount, 0)
}

export function getBalance(order: Order) {
  return Math.max(0, getTotal(order) - getPaid(order))
}

export function getPaymentStatus(order: Order): PaymentStatus {
  const paid = getPaid(order)
  if (paid <= 0) return 'unpaid'
  return paid >= getTotal(order) ? 'paid' : 'partial'
}

export function isOverdue(order: Order, now: number) {
  return (
    OVERDUE_STATUSES.includes(order.status) &&
    new Date(order.dueAt).getTime() < now
  )
}

export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
  return `${rest}m`
}

function startOfDay(time: number) {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function getDayOffset(iso: string, now: number) {
  return Math.round(
    (startOfDay(new Date(iso).getTime()) - startOfDay(now)) / DAY_MS,
  )
}

function formatDay(iso: string, now: number) {
  const offset = getDayOffset(iso, now)
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatWhen(iso: string, now: number) {
  return `${formatDay(iso, now)}, ${formatTime(iso)}`
}

export function getDueInfo(order: Order, now: number) {
  const due = new Date(order.dueAt).getTime()
  const label = formatWhen(order.dueAt, now)

  if (order.status === 'cancelled') {
    return { label, relative: 'Cancelled', overdue: false }
  }
  if (order.status === 'completed') {
    const day = formatDay(order.completedAt ?? order.dueAt, now).toLowerCase()
    return { label, relative: `Completed ${day}`, overdue: false }
  }
  if (isOverdue(order, now)) {
    return {
      label,
      relative: `${formatDuration(now - due)} overdue`,
      overdue: true,
    }
  }
  if (due > now) {
    return {
      label,
      relative: `Due in ${formatDuration(due - now)}`,
      overdue: false,
    }
  }
  return { label, relative: 'Awaiting handover', overdue: false }
}

export function matchesFilters(
  order: Order,
  filters: OrderFilters,
  now: number,
) {
  const paymentStatus = getPaymentStatus(order)
  const total = getTotal(order)
  const needle = filters.query.trim().toLowerCase().replace(/^#/, '')

  if (
    needle &&
    ![order.id, order.invoice, order.customer.name, order.customer.phone].some(
      (field) => field.toLowerCase().includes(needle),
    )
  ) {
    return false
  }
  if (filters.status && order.status !== filters.status) return false
  if (
    filters.group === 'processing' &&
    !PROCESSING_STATUSES.includes(order.status)
  ) {
    return false
  }
  if (
    filters.group === 'awaitingPickup' &&
    !(order.status === 'handover' && order.method === 'pickup')
  ) {
    return false
  }
  if (filters.group === 'overdue' && !isOverdue(order, now)) return false
  if (
    filters.group === 'unpaid' &&
    (paymentStatus === 'paid' || order.status === 'cancelled')
  ) {
    return false
  }
  if (filters.payment && paymentStatus !== filters.payment) return false
  if (
    filters.service &&
    !order.items.some(({ service }) => service === filters.service)
  ) {
    return false
  }
  if (filters.staff && order.assignedTo !== filters.staff) return false
  if (filters.branch && order.branch !== filters.branch) return false
  if (filters.method && order.method !== filters.method) return false
  if (filters.priority && order.priority !== filters.priority) return false
  if (filters.customerType && order.customer.type !== filters.customerType) {
    return false
  }
  if (filters.minAmount && total < Number(filters.minAmount)) return false
  if (filters.maxAmount && total > Number(filters.maxAmount)) return false

  if (filters.due) {
    const offset = getDayOffset(order.dueAt, now)
    if (filters.due === 'overdue' && !isOverdue(order, now)) return false
    if (filters.due === 'today' && offset !== 0) return false
    if (filters.due === 'tomorrow' && offset !== 1) return false
    if (filters.due === 'week' && (offset < 0 || offset > 6)) return false
  }
  return true
}

export function countActiveFilters(filters: OrderFilters) {
  return Object.values(filters).filter((value) => value !== '').length
}

export type SortKey = 'id' | 'customer' | 'amount' | 'due' | 'priority' | 'status'

export function compareOrders(a: Order, b: Order, key: SortKey) {
  switch (key) {
    case 'id':
      return a.id.localeCompare(b.id)
    case 'customer':
      return a.customer.name.localeCompare(b.customer.name)
    case 'amount':
      return getTotal(a) - getTotal(b)
    case 'due':
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    case 'priority': {
      const rank = (order: Order) =>
        PRIORITIES.find(({ id }) => id === order.priority)!.rank
      return rank(a) - rank(b)
    }
    case 'status': {
      const index = (order: Order) =>
        STATUSES.findIndex(({ id }) => id === order.status)
      return index(a) - index(b)
    }
  }
}

export function ordersToCsv(
  orders: Order[],
  now: number,
  includeFinancials: boolean,
) {
  const columns: [string, (order: Order) => string | number][] = [
    ['Order', (order) => order.id],
    ['Invoice', (order) => order.invoice],
    ['Customer', (order) => order.customer.name],
    ['Phone', (order) => order.customer.phone],
    ['Items', getItemsPreview],
    ['Service', getPrimaryService],
    ['Stage', getStatusLabel],
    ['Due', (order) => formatWhen(order.dueAt, now)],
    ['Method', (order) => order.method],
    ['Priority', (order) => order.priority],
    ['Assigned to', (order) => order.assignedTo],
    ['Branch', (order) => order.branch],
  ]
  if (includeFinancials) {
    columns.push(
      ['Total (XAF)', (order) => Math.round(getTotal(order))],
      ['Paid (XAF)', (order) => Math.round(getPaid(order))],
      ['Payment', getPaymentStatus],
    )
  }
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map(([header]) => escape(header)).join(','),
    ...orders.map((order) =>
      columns.map(([, read]) => escape(read(order))).join(','),
    ),
  ].join('\r\n')
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function findOrderByCode(orders: Order[], code: string) {
  const digits = code.replace(/\D/g, '')
  if (!digits) return undefined
  return orders.find((order) => order.id.replace(/\D/g, '') === digits)
}
