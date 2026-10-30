import {
  FREQUENT_MIN_ORDERS,
  HIGH_SPENDER_MIN,
  INACTIVE_AFTER_DAYS,
  LOYALTY_TIERS,
} from '../constants/customers'
import type {
  Channel,
  Consent,
  CrmCustomer,
  CustomerFilters,
  CustomerStatus,
  SegmentId,
} from '../types/customer'
import type { Customer, PaymentMethod } from '../types/order'
import type { CustomerRequest, CustomerResponse } from '../services/customerApi'
import { toCsv } from './csv'
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
  return toCsv(columns, customers)
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
    branchId: '',
    referralSource: '',
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
    // The API id, so a new order can reference the customer
    uuid: customer.id,
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

// ---------- API ----------

const text = (value: string | null | undefined) => value?.trim() ?? ''
const amount = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0
}

export function splitCustomerName(name: string) {
  const [first = '', ...rest] = name.trim().split(/\s+/)
  return { firstname: first, lastname: rest.join(' ') }
}

const STATUSES: CustomerStatus[] = ['active', 'inactive', 'new', 'vip', 'suspended']

const COMMUNICATION_CHANNELS: Record<string, Channel> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', EMAIL: 'Email', CALL: 'Call' }

const PAYMENT_METHODS: Record<string, PaymentMethod> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
}

// The one channel the backend keeps per customer, shown as the matching consent
function consentFromApi(raw: CustomerResponse['consent']): Consent {
  const channel = raw?.channel?.toUpperCase()
  return {
    sms: channel === 'SMS',
    whatsapp: channel === 'WHATSAPP',
    email: channel === 'EMAIL',
    marketing: !!raw?.marketing,
  }
}

// A customer from the API. The response is shaped like CrmCustomer; anything
// missing falls back to a sensible default. `branch` may be empty when the
// response only has the branch uuid; the customers hook fills the name in from
// the branch dropdown. Null without an id.
export function customerFromApi(raw: CustomerResponse | null | undefined): CrmCustomer | null {
  const id = raw?.uuid ?? raw?.id
  if (!raw || id === undefined || id === null || id === '') return null
  const branch = typeof raw.branch === 'object' && raw.branch ? raw.branch : null
  const branchId = raw.branchId ?? branch?.uuid ?? branch?.id
  const phone = text(raw.phone) || text(raw.phoneNumber)
  const name = text(raw.name) || `${text(raw.firstname)} ${text(raw.lastname)}`.trim() || text(raw.companyName) || phone
  const customer = createCustomer(
    String(id),
    { name, phone, email: text(raw.email), street: text(raw.homeAddress) },
    text(raw.branchName) || text(branch?.name) || (typeof raw.branch === 'string' ? raw.branch : ''),
    text(raw.preferredService),
  )
  const status = raw.status?.toLowerCase() as CustomerStatus | undefined
  const addresses = raw.addresses
    ? raw.addresses.map((address, index) => ({
        id: address.id ?? `address-${index + 1}`,
        label: text(address.label),
        street: text(address.street),
        city: text(address.city),
        region: text(address.region),
        landmark: text(address.landmark),
        instructions: text(address.instructions),
        isDefault: !!(address.isDefault ?? address.default),
      }))
    : // Older responses only had homeAddress and neighbourhood
      raw.homeAddress || raw.neighbourhood
      ? [
          {
            id: 'address-1',
            label: 'Home',
            street: text(raw.homeAddress),
            city: '',
            region: '',
            landmark: text(raw.neighbourhood),
            instructions: '',
            isDefault: true,
          },
        ]
      : []

  return {
    ...customer,
    kind: raw.kind?.toLowerCase() === 'corporate' ? 'corporate' : 'individual',
    status: status && STATUSES.includes(status) ? status : 'active',
    points: raw.points ?? raw.loyaltyPoints ?? 0,
    branchId: branchId === undefined || branchId === null ? '' : String(branchId),
    referralSource: text(raw.referralSource),
    registeredAt: raw.registeredAt ?? raw.createdAt ?? customer.registeredAt,
    lastOrderAt: raw.lastOrderAt ?? null,
    orders: raw.orders ?? 0,
    spent: amount(raw.spent),
    outstanding: amount(raw.outstanding),
    outstandingOrders: raw.outstandingOrders ?? 0,
    cadenceDays: raw.cadenceDays || customer.cadenceDays,
    tags: raw.tags ?? [],
    addresses,
    laundry: raw.laundry
      ? {
          detergent: text(raw.laundry.detergent) || customer.laundry.detergent,
          softener: text(raw.laundry.softener) || customer.laundry.softener,
          folding: text(raw.laundry.folding) || customer.laundry.folding,
          packaging: text(raw.laundry.packaging) || customer.laundry.packaging,
          ironing: !!raw.laundry.ironing,
          instructions: text(raw.laundry.instructions),
        }
      : customer.laundry,
    delivery: raw.delivery
      ? {
          method: raw.delivery.method?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup',
          window: text(raw.delivery.window),
          instructions: text(raw.delivery.instructions),
        }
      : customer.delivery,
    notes: (raw.notes ?? []).map((note, index) => ({
      id: note.id ?? `note-${index}`,
      text: text(note.text),
      by: text(note.by),
      at: note.at ?? '',
    })),
    communications: (raw.communications ?? []).map((entry) => ({
      at: entry.at ?? '',
      channel: COMMUNICATION_CHANNELS[entry.channel?.toUpperCase() ?? ''] ?? 'SMS',
      message: text(entry.message),
      status: text(entry.status),
    })),
    payments: (raw.payments ?? []).map((payment, index) => ({
      id: payment.id ?? `payment-${index}`,
      at: payment.at ?? '',
      order: text(payment.order),
      amount: amount(payment.amount),
      method: PAYMENT_METHODS[payment.method?.toUpperCase() ?? ''] ?? 'Cash',
      reference: text(payment.reference),
      status: text(payment.status),
      by: text(payment.by),
    })),
    activity: (raw.activity ?? []).map((entry) => ({ at: entry.at ?? '', text: text(entry.text) })),
    monthlyOrders: raw.monthlyOrders?.length ? raw.monthlyOrders : customer.monthlyOrders,
    monthlySpend: raw.monthlySpend?.length ? raw.monthlySpend.map(amount) : customer.monthlySpend,
    consent: raw.consent ? consentFromApi(raw.consent) : customer.consent,
    corporate: raw.corporate
      ? {
          contact: text(raw.corporate.contact),
          taxId: text(raw.corporate.taxId),
          billingAddress: text(raw.corporate.billingAddress),
          terms: text(raw.corporate.terms),
          creditLimit: amount(raw.corporate.creditLimit),
          contract: text(raw.corporate.contract),
        }
      : undefined,
    archived: !!raw.archived,
  }
}

// The CustomerRequest body for a customer; `branchId` is the branch's uuid.
// Notes and loyalty points are left out: they have their own endpoints
export function customerRequest(customer: CrmCustomer, branchId: string): CustomerRequest {
  const address = customer.addresses.find(({ isDefault }) => isDefault) ?? customer.addresses[0]
  const corporate = customer.kind === 'corporate'
  // The backend keeps one channel per customer: the first one consented to
  const channel = customer.consent.sms ? 'SMS' : customer.consent.whatsapp ? 'WHATSAPP' : 'EMAIL'
  return {
    kind: customer.kind,
    ...(corporate ? { companyName: customer.name } : splitCustomerName(customer.name)),
    phone: customer.phone,
    email: customer.email,
    status: customer.status,
    homeAddress: address?.street ?? '',
    neighbourhood: address?.landmark ?? '',
    referralSource: customer.referralSource,
    preferredService: customer.preferredService,
    archived: customer.archived,
    branchId,
    tags: customer.tags,
    addresses: customer.addresses,
    laundry: customer.laundry,
    delivery: customer.delivery,
    consent: { channel, marketing: customer.consent.marketing },
    ...(corporate && customer.corporate ? { corporate: customer.corporate } : {}),
  }
}

// The body for a new customer: the opening points go in, and a status left at
// 'new' is not sent, so the nightly rules keep it up to date
export function newCustomerRequest(customer: CrmCustomer, branchId: string): CustomerRequest {
  const { status, ...request } = customerRequest(customer, branchId)
  return { ...request, ...(status && status !== 'new' ? { status } : {}), loyaltyPoints: customer.points }
}

// The CustomerRequest fields that differ between two versions, for a PATCH
export function changedCustomerFields(before: CustomerRequest, after: CustomerRequest): Partial<CustomerRequest> {
  const changes: Partial<CustomerRequest> = {}
  for (const key of Object.keys(after) as (keyof CustomerRequest)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) Object.assign(changes, { [key]: after[key] })
  }
  return changes
}
