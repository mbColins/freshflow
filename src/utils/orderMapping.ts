import type {
  FulfilmentMethod,
  Order,
  OrderStatus,
  PaymentMethod,
  Priority,
  QualityCheck,
} from '../types/order'

// ---------- Request ----------

// What the New Order form sends to POST /order. Prices, totals, numbers, tags
// and createdBy are computed by the backend, so they aren't part of it.
export type OrderItemRequest = {
  serviceId: string
  itemType: string
  quantity: number
  // Required for services priced per kg, otherwise null
  weightKg: number | null
  condition: 'NORMAL' | 'STAINED' | 'DAMAGED' | 'WORN'
  notes: string
}

export type OrderRequest = {
  branchId: string
  // Exactly one of customerId / newCustomer
  customerId: string | null
  newCustomer: { firstname: string; lastname: string; phoneNumber: string; email: string } | null
  items: OrderItemRequest[]
  priority: 'NORMAL' | 'HIGH' | 'EXPRESS'
  fulfilmentMethod: 'PICKUP' | 'DELIVERY'
  deliveryAddress: string | null
  // ISO-8601
  dueAt: string
  discount: number
  customerNotes: string
  handlingInstructions: string
  assignedToId: string | null
  initialPayment: { amount: number; method: ApiPaymentMethod; reference: string } | null
}

export type ApiPaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER'

const PAYMENT_METHODS: Record<PaymentMethod, ApiPaymentMethod> = {
  Cash: 'CASH',
  'Mobile Money': 'MOBILE_MONEY',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
}

export const toApiPaymentMethod = (method: PaymentMethod) => PAYMENT_METHODS[method]

export const toApiPriority = (priority: Priority) => priority.toUpperCase() as OrderRequest['priority']

export const toApiMethod = (method: FulfilmentMethod) => method.toUpperCase() as OrderRequest['fulfilmentMethod']

export const toApiStatus = (status: OrderStatus) => status.toUpperCase()

// ---------- Response ----------

// OrderResponse as the backend contract describes it; everything optional so a
// different shape degrades to defaults instead of breaking the pages
// TODO: confirm the response shape with the backend
export type OrderResponse = {
  id?: string | number
  uuid?: string
  orderNumber?: string
  invoiceNumber?: string
  status?: string
  priority?: string
  fulfilmentMethod?: string
  deliveryAddress?: string | null
  branch?: { id?: string | number; uuid?: string; code?: string; name?: string } | null
  customer?: {
    id?: string | number
    uuid?: string
    firstname?: string
    lastname?: string
    phoneNumber?: string
    email?: string | null
  } | null
  items?: {
    serviceName?: string
    itemType?: string
    quantity?: number
    weightKg?: number | null
    unitPrice?: number | string
    tagNumber?: string
    condition?: string
    notes?: string | null
  }[]
  subtotal?: number | string
  expressSurcharge?: number | string
  discount?: number | string
  tax?: number | string
  deliveryFee?: number | string
  payments?: { amount?: number | string; method?: string; reference?: string | null; by?: string; at?: string }[]
  dueAt?: string
  createdAt?: string
  completedAt?: string | null
  createdBy?: string
  assignedTo?: { id?: string | number; name?: string } | null
  customerNotes?: string | null
  handlingInstructions?: string | null
  staffNotes?: string | null
  qc?: { checks?: Record<string, boolean>; result?: string; reason?: string | null } | null
  timeline?: { action?: string; by?: string; at?: string; note?: string | null }[]
}

// BigDecimal may arrive as a number or a string
const amount = (value: unknown) => {
  const number = typeof value === 'string' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? Math.round(number) : 0
}

const STATUSES: OrderStatus[] = ['received', 'washing', 'drying', 'ironing', 'qa', 'ready', 'handover', 'completed', 'cancelled']
const PRIORITIES: Priority[] = ['normal', 'high', 'express']
const METHOD_LABELS: Record<ApiPaymentMethod, PaymentMethod> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
}

const pick = <T extends string>(values: T[], raw: string | undefined, fallback: T) =>
  values.find((value) => value === raw?.toLowerCase()) ?? fallback

const capitalised = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Normal'

// An order from the API in the shape the Orders pages use, or null without an id.
// `id` is the order number shown to people (ORD-10421); `uuid` is what the API
// addresses the order by.
export function orderFromApi(raw: OrderResponse | null | undefined): Order | null {
  const uuid = raw?.uuid ?? (raw?.id !== undefined && raw?.id !== null ? String(raw.id) : '')
  if (!raw || !uuid) return null
  const number = raw.orderNumber ?? uuid
  const customer = raw.customer ?? {}
  const qc: QualityCheck = {
    checks: raw.qc?.checks ?? {},
    result: raw.qc?.result?.toLowerCase() === 'passed' ? 'passed' : raw.qc?.result?.toLowerCase() === 'failed' ? 'failed' : 'pending',
    reason: raw.qc?.reason ?? undefined,
  }
  const createdAt = raw.createdAt ?? new Date().toISOString()
  return {
    id: number,
    uuid,
    invoice: raw.invoiceNumber ?? number,
    customer: {
      name: `${customer.firstname ?? ''} ${customer.lastname ?? ''}`.trim() || 'Unknown customer',
      phone: customer.phoneNumber ?? '',
      email: customer.email ?? '',
      // The order response doesn't carry the customer's history
      type: 'returning',
      since: '',
      orders: 0,
      spent: 0,
    },
    items: (raw.items ?? []).map((item) => ({
      name: item.itemType ?? '',
      qty: item.weightKg ?? item.quantity ?? 1,
      service: item.serviceName ?? '',
      unitPrice: amount(item.unitPrice),
      tag: item.tagNumber ?? '',
      condition: capitalised(item.condition),
      notes: item.notes ?? undefined,
    })),
    status: pick(STATUSES, raw.status, 'received'),
    priority: pick(PRIORITIES, raw.priority, 'normal'),
    createdAt,
    dueAt: raw.dueAt ?? createdAt,
    completedAt: raw.completedAt ?? undefined,
    branch: raw.branch?.name ?? '',
    createdBy: raw.createdBy ?? '',
    assignedTo: raw.assignedTo?.name ?? '',
    method: raw.fulfilmentMethod?.toUpperCase() === 'DELIVERY' ? 'delivery' : 'pickup',
    address: raw.deliveryAddress ?? undefined,
    surcharge: amount(raw.expressSurcharge),
    discount: amount(raw.discount),
    tax: amount(raw.tax),
    deliveryFee: amount(raw.deliveryFee),
    payments: (raw.payments ?? []).map((payment) => ({
      at: payment.at ?? createdAt,
      amount: amount(payment.amount),
      method: METHOD_LABELS[(payment.method?.toUpperCase() ?? '') as ApiPaymentMethod] ?? 'Cash',
      reference: payment.reference ?? '',
      by: payment.by ?? '',
    })),
    customerNotes: raw.customerNotes ?? '',
    staffNotes: raw.staffNotes ?? '',
    handling: raw.handlingInstructions ?? '',
    qc,
    timeline: (raw.timeline ?? []).map((entry) => ({
      at: entry.at ?? createdAt,
      action: entry.action ?? '',
      by: entry.by ?? '',
      note: entry.note ?? undefined,
    })),
  }
}
