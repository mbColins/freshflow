import type {
  FulfilmentMethod,
  Order,
  OrderStatus,
  PaymentMethod,
  Priority,
} from '../types/order'

// ---------- Request ----------

// One article line of POST /order. The server prices a line as
// unitPrice × weightKg, or × quantity when there is no weight
export type OrderLineRequest = {
  // An ArticleType constant such as SHIRT or T_SHIRT
  articleType: string
  // The service's uuid
  service: string
  quantity: number
  // Required for services priced per kg, otherwise null
  weightKg: number | null
  unitPrice: number
  condition: 'NORMAL' | 'STAINED' | 'DAMAGED' | 'WORN'
  notes?: string
}

export type ApiPaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER'

// What the New Order form sends to POST /order (the backend's OrderRequest).
// The order number, tags and totals are computed by the server; a new customer
// is created first and its id sent here
export type OrderRequest = {
  customerId: string
  branchId: string
  priority: 'NORMAL' | 'HIGH' | 'EXPRESS'
  // Staff uuid
  assignedTo?: string
  // Local date-time without a zone: 2026-10-26T17:00:00
  promisedDate: string
  deliveryOptions: 'PICKUP' | 'DELIVERY'
  // Required for DELIVERY
  deliveryAddress?: string
  deliveryFee: number
  discountAmount: number
  surchargeAmount: number
  taxAmount: number
  customerNotes: string
  handlingInstructions: string
  articleLines: OrderLineRequest[]
  // Recorded as a real payment in the same transaction. Cash needs an open
  // register; digital methods need a provider and a reference
  initialPayment?: {
    amount: number
    method: ApiPaymentMethod
    provider?: string
    reference?: string
    cashReceived?: number
  }
}

const PAYMENT_METHODS: Record<PaymentMethod, ApiPaymentMethod> = {
  Cash: 'CASH',
  'Mobile Money': 'MOBILE_MONEY',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
}

export const toApiPaymentMethod = (method: PaymentMethod) => PAYMENT_METHODS[method]

export const toApiPriority = (priority: Priority) => priority.toUpperCase() as OrderRequest['priority']

export const toApiMethod = (method: FulfilmentMethod) => method.toUpperCase() as OrderRequest['deliveryOptions']

export const toApiStatus = (status: OrderStatus) => status.toUpperCase()

// ---------- Response ----------

type PersonRef = { uuid?: string | null; name?: string | null; phone?: string | null } | null

// OrderResponse as the backend sends it. Nearly everything can be null. Dates
// are local date-times without a time zone.
export type OrderResponse = {
  id?: number | null
  uuid?: string | null
  orderNumber?: string | null
  customerId?: string | null
  customerName?: string | null
  customer?: PersonRef
  branchId?: string | null
  branchName?: string | null
  promisedDate?: string | null
  // PICKUP | DROP_OFF | DELIVERY | HOME_DELIVERY
  deliveryOptions?: string | null
  deliveryFee?: number | string | null
  totalPrice?: number | string | null
  // A cache of the payments recorded on the order
  amountPaid?: number | string | null
  paymentStatus?: string | null
  paymentMethod?: string | null
  status?: string | null
  notes?: string | null
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  completedAt?: string | null
  priority?: string | null
  assignedTo?: PersonRef
  deliveryAddress?: string | null
  discountAmount?: number | string | null
  surchargeAmount?: number | string | null
  taxAmount?: number | string | null
  customerNotes?: string | null
  staffNotes?: string | null
  handlingInstructions?: string | null
  cancelReason?: string | null
  // What was paid and now waits for a refund, on a cancel
  refundDue?: number | string | null
  // PENDING | PASSED | FAILED
  qcResult?: string | null
  qcFailureReason?: string | null
  qcChecks?: Record<string, boolean> | null
  // Newest first, only on the single-order read
  timeline?: { at?: string | null; action?: string | null; by?: string | null; note?: string | null }[] | null
  articleLines?:
    | {
        id?: number | null
        // An ArticleType name such as SHIRT or T_SHIRT
        articleType?: string | null
        service?: string | null
        quantity?: number | null
        weightKg?: number | null
        unitPrice?: number | string | null
        lineTotal?: number | string | null
        condition?: string | null
        tag?: string | null
        notes?: string | null
      }[]
    | null
}

// BigDecimal may arrive as a number or a string
const amount = (value: unknown) => {
  const number = typeof value === 'string' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? Math.round(number) : 0
}

const STATUSES: OrderStatus[] = ['received', 'washing', 'drying', 'ironing', 'qa', 'ready', 'handover', 'completed', 'cancelled']
const PRIORITIES: Priority[] = ['normal', 'high', 'express']
const APP_METHODS: Record<string, PaymentMethod> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
}

// "T_SHIRT" -> "T Shirt"
const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

// The server sends microseconds ("...16:13:23.259221"); browsers only read milliseconds reliably
const dateTime = (value: string | null | undefined) => (value ? value.replace(/(\.\d{3})\d+/, '$1') : undefined)

// An order from the API in the shape the Orders pages use, or null without an
// order number. `id` is the order number shown to people and also what the API
// addresses the order by (PATCH /order/{orderNumber}), so `uuid` carries the
// same value.
export function orderFromApi(raw: OrderResponse | null | undefined): Order | null {
  const number = raw?.orderNumber ?? raw?.uuid ?? (raw?.id !== undefined && raw?.id !== null ? String(raw.id) : '')
  if (!raw || !number) return null
  const createdAt = dateTime(raw.createdAt) ?? new Date().toISOString()
  const completed = raw.status?.toUpperCase() === 'COMPLETED'
  const items = (raw.articleLines ?? []).map((line, index) => ({
    name: line.articleType ? titleCase(line.articleType) : 'Item',
    // A line priced by weight counts its kilos
    qty: line.weightKg ?? line.quantity ?? 1,
    service: line.service ?? '',
    unitPrice: amount(line.unitPrice),
    tag: line.tag || `T-${number}-${index + 1}`,
    condition: titleCase(line.condition ?? 'NORMAL'),
    notes: line.notes ?? undefined,
  }))
  const paid = amount(raw.amountPaid)
  const checks = raw.qcChecks ?? {}
  const qcResult = raw.qcResult?.toLowerCase()
  return {
    id: number,
    uuid: number,
    invoice: number,
    customer: {
      uuid: raw.customer?.uuid ?? raw.customerId ?? undefined,
      name: (raw.customer?.name ?? raw.customerName)?.trim() || 'Unknown customer',
      phone: raw.customer?.phone ?? '',
      email: '',
      type: 'returning',
      since: '',
      orders: 0,
      spent: 0,
    },
    items,
    // PENDING and anything else the order pipeline doesn't know starts at Received
    status: STATUSES.find((status) => status === raw.status?.toLowerCase()) ?? 'received',
    priority: PRIORITIES.find((priority) => priority === raw.priority?.toLowerCase()) ?? 'normal',
    createdAt,
    dueAt: dateTime(raw.promisedDate) ?? createdAt,
    completedAt: completed ? (dateTime(raw.completedAt) ?? dateTime(raw.updatedAt) ?? createdAt) : undefined,
    branch: raw.branchName ?? '',
    branchId: raw.branchId ?? '',
    createdBy: raw.createdBy ?? '',
    assignedTo: raw.assignedTo?.name ?? '',
    assignedToId: raw.assignedTo?.uuid ?? '',
    method: ['DELIVERY', 'HOME_DELIVERY'].includes(raw.deliveryOptions?.toUpperCase() ?? '') ? 'delivery' : 'pickup',
    address: raw.deliveryAddress ?? undefined,
    surcharge: amount(raw.surchargeAmount),
    discount: amount(raw.discountAmount),
    tax: amount(raw.taxAmount),
    deliveryFee: amount(raw.deliveryFee),
    // The payments themselves are on the Payments page; the order keeps their total
    payments:
      paid > 0
        ? [
            {
              at: dateTime(raw.updatedAt) ?? createdAt,
              amount: paid,
              method: APP_METHODS[raw.paymentMethod ?? ''] ?? 'Cash',
              reference: '',
              by: '',
            },
          ]
        : [],
    customerNotes: raw.customerNotes ?? raw.notes ?? '',
    staffNotes: raw.staffNotes ?? '',
    handling: raw.handlingInstructions ?? '',
    cancelReason: raw.cancelReason ?? '',
    refundDue: amount(raw.refundDue),
    qc: {
      checks,
      result: qcResult === 'passed' ? 'passed' : qcResult === 'failed' ? 'failed' : 'pending',
      reason: raw.qcFailureReason ?? undefined,
    },
    // Newest first from the server; the pages show it oldest first
    timeline: raw.timeline
      ? [...raw.timeline]
          .reverse()
          .map((entry) => ({
            at: dateTime(entry.at) ?? createdAt,
            action: entry.action ?? '',
            by: entry.by ?? '',
            note: entry.note ?? undefined,
          }))
      : [{ at: createdAt, action: 'Order created', by: raw.createdBy ?? '' }],
  }
}
