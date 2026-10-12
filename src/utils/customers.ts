import {
  FREQUENT_MIN_ORDERS,
  HIGH_SPENDER_MIN,
  INACTIVE_AFTER_DAYS,
  LOYALTY_TIERS,
} from '../constants/customers'
import type {
  CrmCustomer,
  CustomerFilters,
  SegmentId,
} from '../types/customer'
import type { Customer, PaymentMethod } from '../types/order'
import { formatXaf } from './orders'
import { getSettings } from '../hooks/useSettings'
import { formatDateSetting } from './settings'

const DAY_MS = 86_400_000

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatDate(iso: string) {
  const chosen = formatDateSetting(new Date(iso), getSettings())
  if (chosen) return chosen
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function daysSince(iso: string | null, now: number) {
  if (!iso) return null
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS))
}

export function formatLastOrder(iso: string | null, now: number) {
  const days = daysSince(iso, now)
  if (days === null) return 'No orders yet'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso!)
}

export function getTier(points: number) {
  const index = LOYALTY_TIERS.findLastIndex(({ min }) => points >= min)
  const tier = LOYALTY_TIERS[index]
  const next = LOYALTY_TIERS[index + 1] ?? null
  return {
    tier,
    next,
    progress: next
      ? ((points - tier.min) / (next.min - tier.min)) * 100
      : 100,
  }
}

export type Health = {
  level: 'active' | 'risk' | 'inactive'
  label: string
  detail: string
}

export function getHealth(customer: CrmCustomer, now: number): Health {
  const days = daysSince(customer.lastOrderAt, now)
  if (days === null) {
    return {
      level: 'active',
      label: 'Onboarding',
      detail: 'New customer with no completed orders yet.',
    }
  }
  if (days >= INACTIVE_AFTER_DAYS) {
    return {
      level: 'inactive',
      label: 'Inactive',
      detail: `Customer has not ordered for ${days} days.`,
    }
  }
  if (days > customer.cadenceDays * 2) {
    return {
      level: 'risk',
      label: 'At Risk',
      detail: `Customer normally orders every ${customer.cadenceDays} days but has not ordered for ${days} days.`,
    }
  }
  return {
    level: 'active',
    label: 'Active',
    detail: `Orders about every ${customer.cadenceDays} days; last order ${days === 0 ? 'today' : `${days} days ago`}.`,
  }
}

export function getAverageOrder(customer: CrmCustomer) {
  return customer.orders === 0 ? 0 : customer.spent / customer.orders
}

export function getInsights(
  customer: CrmCustomer,
  now: number,
  showFinancials: boolean,
) {
  const insights: string[] = []
  const [previous, current] = customer.monthlyOrders.slice(-2)
  const [previousSpend, currentSpend] = customer.monthlySpend.slice(-2)
  const days = daysSince(customer.lastOrderAt, now)

  if (current > 0) {
    insights.push(
      `Customer placed ${current} ${current === 1 ? 'order' : 'orders'} this month.`,
    )
  }
  if (showFinancials && previousSpend > 0 && currentSpend > 0) {
    const change = Math.round(
      ((currentSpend - previousSpend) / previousSpend) * 100,
    )
    if (change !== 0) {
      insights.push(
        `Spending ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change)}% compared with last month.`,
      )
    }
  }
  if (days !== null && days > customer.cadenceDays * 2) {
    insights.push(`Customer has not ordered for ${days} days.`)
  }
  if (customer.orders > 0) {
    insights.push(`Customer most often uses ${customer.preferredService}.`)
  }
  if (current === 0 && previous > 0) {
    insights.push('No orders yet this month after an active month before.')
  }
  if (showFinancials && customer.outstanding > 0) {
    insights.push(
      `${formatXaf(customer.outstanding)} is outstanding across ${customer.outstandingOrders} ${customer.outstandingOrders === 1 ? 'order' : 'orders'}.`,
    )
  }
  return insights
}

export function inSegment(customer: CrmCustomer, segment: SegmentId) {
  switch (segment) {
    case 'new':
      return customer.status === 'new'
    case 'active':
      return customer.status === 'active' || customer.status === 'vip'
    case 'returning':
      return customer.orders >= 2
    case 'frequent':
      return customer.orders >= FREQUENT_MIN_ORDERS
    case 'vip':
      return customer.status === 'vip'
    case 'inactive':
      return customer.status === 'inactive'
    case 'highSpenders':
      return customer.spent >= HIGH_SPENDER_MIN
    case 'delivery':
      return customer.delivery.method === 'delivery'
    case 'corporate':
      return customer.kind === 'corporate'
    case 'balance':
      return customer.outstanding > 0
  }
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

// Matches name, email, customer ID, tags and order IDs; phone numbers match on any digit run
export function matchesQuery(
  customer: CrmCustomer,
  query: string,
  orderIds: string[],
) {
  const needle = query.trim().toLowerCase().replace(/^#/, '')
  if (!needle) return true
  const needleDigits = digitsOnly(needle)
  if (
    needleDigits.length >= 3 &&
    needleDigits.length === needle.replace(/[\s+-]/g, '').length &&
    digitsOnly(customer.phone).includes(needleDigits)
  ) {
    return true
  }
  return [customer.name, customer.email, customer.id, ...customer.tags, ...orderIds].some(
    (field) => field.toLowerCase().includes(needle),
  )
}

export function matchesCustomerFilters(
  customer: CrmCustomer,
  filters: CustomerFilters,
  now: number,
  orderIds: string[],
) {
  if (!matchesQuery(customer, filters.query, orderIds)) return false
  if (filters.segment && !inSegment(customer, filters.segment)) return false
  if (filters.status && customer.status !== filters.status) return false
  if (filters.kind && customer.kind !== filters.kind) return false
  if (filters.branch && customer.branch !== filters.branch) return false
  if (filters.tier && getTier(customer.points).tier.id !== filters.tier) {
    return false
  }
  if (filters.service && customer.preferredService !== filters.service) {
    return false
  }
  if (filters.method && customer.delivery.method !== filters.method) return false
  if (filters.tag && !customer.tags.includes(filters.tag)) return false
  if (filters.minOrders && customer.orders < Number(filters.minOrders)) {
    return false
  }
  if (filters.minSpent && customer.spent < Number(filters.minSpent)) return false
  if (filters.balance === 'yes' && customer.outstanding <= 0) return false
  if (filters.balance === 'no' && customer.outstanding > 0) return false

  if (filters.lastOrder) {
    const days = daysSince(customer.lastOrderAt, now)
    if (days === null) return false
    if (filters.lastOrder === '30' && days > 30) return false
    if (filters.lastOrder === '90' && days > 90) return false
    if (filters.lastOrder === 'older' && days <= 90) return false
  }
  if (filters.registered) {
    const days = daysSince(customer.registeredAt, now) ?? 0
    if (filters.registered === '30' && days > 30) return false
    if (filters.registered === '365' && days > 365) return false
    if (filters.registered === 'older' && days <= 365) return false
  }
  return true
}

export function countCustomerFilters(filters: CustomerFilters) {
  return Object.values(filters).filter((value) => value !== '').length
}

export type CustomerSortKey =
  | 'name'
  | 'orders'
  | 'spent'
  | 'lastOrder'
  | 'outstanding'
  | 'points'

export function compareCustomers(
  a: CrmCustomer,
  b: CrmCustomer,
  key: CustomerSortKey,
) {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'lastOrder':
      return (
        new Date(a.lastOrderAt ?? 0).getTime() -
        new Date(b.lastOrderAt ?? 0).getTime()
      )
    default:
      return a[key] - b[key]
  }
}

export function customersToCsv(
  customers: CrmCustomer[],
  includeFinancials: boolean,
) {
  const columns: [string, (customer: CrmCustomer) => string | number][] = [
    ['Customer ID', (customer) => customer.id],
    ['Name', (customer) => customer.name],
    ['Type', (customer) => customer.kind],
    ['Phone', (customer) => customer.phone],
    ['Email', (customer) => customer.email],
    ['Status', (customer) => customer.status],
    ['Loyalty tier', (customer) => getTier(customer.points).tier.label],
    ['Points', (customer) => customer.points],
    ['Orders', (customer) => customer.orders],
    ['Last order', (customer) => (customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '')],
    ['Preferred service', (customer) => customer.preferredService],
    ['Branch', (customer) => customer.branch],
    ['Tags', (customer) => customer.tags.join('; ')],
  ]
  if (includeFinancials) {
    columns.push(
      ['Total spent (XAF)', (customer) => customer.spent],
      ['Outstanding (XAF)', (customer) => customer.outstanding],
    )
  }
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map(([header]) => escape(header)).join(','),
    ...customers.map((customer) =>
      columns.map(([, read]) => escape(read(customer))).join(','),
    ),
  ].join('\r\n')
}

// Minimal CSV reader: handles quoted fields, escaped quotes and CRLF
export function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',' || char === ';') {
      row.push(field.trim())
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field.trim())
  if (row.some((cell) => cell !== '')) rows.push(row)
  return rows
}

export function applyPayment(
  customer: CrmCustomer,
  amount: number,
  method: PaymentMethod,
  reference: string,
  by: string,
): CrmCustomer {
  const at = new Date().toISOString()
  const outstanding = Math.max(0, customer.outstanding - amount)
  return {
    ...customer,
    outstanding,
    outstandingOrders: outstanding === 0 ? 0 : customer.outstandingOrders,
    spent: customer.spent + amount,
    payments: [
      {
        id: `PAY-${String(Date.now()).slice(-6)}`,
        at,
        order: '—',
        amount,
        method,
        reference,
        status: 'Successful',
        by,
      },
      ...customer.payments,
    ],
    activity: [
      { at, text: `Payment of ${formatXaf(amount)} received` },
      ...customer.activity,
    ],
  }
}

// A bare profile for imported customers; everything else starts empty
export function createCustomer(
  id: string,
  fields: { name: string; phone: string; email: string; street: string },
  branch: string,
  service: string,
): CrmCustomer {
  const now = new Date().toISOString()
  return {
    id,
    name: fields.name,
    kind: 'individual',
    phone: fields.phone,
    email: fields.email,
    status: 'new',
    points: 0,
    branch,
    registeredAt: now,
    lastOrderAt: null,
    orders: 0,
    spent: 0,
    outstanding: 0,
    outstandingOrders: 0,
    preferredService: service,
    cadenceDays: 30,
    tags: ['New'],
    addresses: fields.street
      ? [
          {
            id: 'address-1',
            label: 'Home',
            street: fields.street,
            city: '',
            region: '',
            landmark: '',
            instructions: '',
            isDefault: true,
          },
        ]
      : [],
    laundry: {
      detergent: 'Regular',
      softener: 'None',
      folding: 'Standard',
      packaging: 'Standard',
      ironing: false,
      instructions: '',
    },
    delivery: { method: 'pickup', window: '', instructions: '' },
    notes: [],
    communications: [],
    payments: [],
    activity: [{ at: now, text: 'Customer imported' }],
    monthlyOrders: Array<number>(12).fill(0),
    monthlySpend: Array<number>(12).fill(0),
    consent: { sms: true, email: false, whatsapp: true, marketing: false },
    archived: false,
  }
}

// The order wizard works with the lighter customer shape used on orders
export function toOrderCustomer(customer: CrmCustomer): Customer {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    type:
      customer.kind === 'corporate'
        ? 'corporate'
        : customer.orders === 0
          ? 'new'
          : 'returning',
    since: new Date(customer.registeredAt).toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    }),
    orders: customer.orders,
    spent: customer.spent,
  }
}
