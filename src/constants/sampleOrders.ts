import type {
  Customer,
  FulfilmentMethod,
  Order,
  OrderStatus,
  PaymentMethod,
  Priority,
  TimelineEntry,
} from '../types/order'
import {
  BRANCHES,
  DELIVERY_FEE,
  EXPRESS_SURCHARGE_RATE,
  ITEM_PRICES,
  PIPELINE_STATUSES,
  QC_CHECKS,
  SERVICE_MULTIPLIERS,
  TAX_RATE,
} from './orders'

// Sample orders until the orders API exists. Times are relative to page load so
// due dates and overdue states stay meaningful whenever the app is opened.
const HOUR_MS = 3_600_000
const loadedAt = Date.now()
const at = (hours: number) => new Date(loadedAt + hours * HOUR_MS).toISOString()

const customer = (
  name: string,
  phone: string,
  type: Customer['type'],
  orders: number,
  spent: number,
  since: string,
): Customer => ({
  name,
  phone,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
  type,
  orders,
  spent,
  since,
})

const john = customer('John Doe', '+237 671 892 104', 'returning', 14, 186_000, 'Mar 2024')
const sarah = customer('Sarah K.', '+237 694 112 883', 'returning', 6, 98_500, 'Sep 2024')
const hotel = customer('Grand Palace Hotel', '+237 699 120 441', 'corporate', 52, 4_820_000, 'Jan 2023')
const aris = customer('Dr. Aris', '+237 655 332 901', 'returning', 9, 142_000, 'Jun 2024')
const emmanuel = customer('Emmanuel M.', '+237 670 221 504', 'new', 0, 0, 'Oct 2026')
const clinic = customer('St. Jude Clinic', '+237 677 440 912', 'corporate', 31, 2_150_000, 'Nov 2023')
const marc = customer('Marc Belle', '+237 655 001 928', 'returning', 3, 41_000, 'May 2026')
const kamdem = customer('Sarah Kamdem', '+237 690 334 118', 'new', 0, 0, 'Oct 2026')
const grace = customer('Grace Ndi', '+237 652 778 340', 'returning', 11, 77_400, 'Feb 2025')
const paul = customer('Paul Etoa', '+237 698 214 667', 'returning', 4, 36_200, 'Jul 2026')
const linda = customer('Linda Fotso', '+237 675 903 221', 'returning', 7, 88_900, 'Dec 2024')
const ibrahim = customer('Ibrahim Sali', '+237 691 556 030', 'new', 0, 0, 'Oct 2026')
const fatima = customer('Fatima Bello', '+237 653 119 874', 'returning', 5, 52_300, 'Apr 2026')

type Seed = {
  n: number
  customer: Customer
  // [item, quantity, service, condition]
  items: [string, number, string, string?][]
  status: OrderStatus
  priority?: Priority
  created: number
  due: number
  assignedTo: string
  method?: FulfilmentMethod
  paid?: 'full' | 'half'
  payMethod?: PaymentMethod
  branch?: string
  customerNotes?: string
  handling?: string
}

const SEEDS: Seed[] = [
  { n: 10452, customer: john, items: [['Shirt', 4, 'Wash & Fold', 'Light starch on collar'], ['Trousers', 2, 'Wash & Fold'], ['Bedsheet', 2, 'Wash & Fold', 'Stain']], status: 'washing', created: -3, due: 4, assignedTo: 'Elena Rostova', paid: 'full', payMethod: 'Mobile Money', customerNotes: 'Hypoallergenic detergent please.' },
  { n: 10451, customer: sarah, items: [['Suit', 3, 'Dry Cleaning', 'Pre-spot cuff hem'], ['Dress', 2, 'Dry Cleaning', 'Silk']], status: 'ironing', priority: 'express', created: -4, due: 1.5, assignedTo: 'David Kim', paid: 'full', payMethod: 'Mobile Money', handling: 'Hand-press silk only.' },
  { n: 10450, customer: hotel, items: [['Bedsheet', 40, 'Wash & Fold'], ['Duvet Cover', 12, 'Wash & Fold']], status: 'drying', priority: 'high', created: -5, due: 6, assignedTo: 'Elena Rostova', method: 'delivery', customerNotes: 'Deliver to concierge desk #1. Billed on account (Net 30).' },
  { n: 10449, customer: aris, items: [['Lab Coat', 18, 'Sanitize 60°C']], status: 'ready', created: -7, due: -0.5, assignedTo: 'Mary Ngono', paid: 'full', payMethod: 'Cash' },
  { n: 10448, customer: emmanuel, items: [['Sneakers', 2, 'Wash & Fold', 'Suede / leather']], status: 'received', created: -0.7, due: 26, assignedTo: 'Aisha Tamba', handling: 'Suede: no machine wash.' },
  { n: 10428, customer: clinic, items: [['Bedsheet', 30, 'Sanitize 60°C'], ['Lab Coat', 10, 'Sanitize 60°C']], status: 'ironing', priority: 'high', created: -28, due: -2.58, assignedTo: 'David Kim', method: 'delivery', paid: 'half', payMethod: 'Bank Transfer', customerNotes: 'Hospital linen, scheduled for morning delivery.' },
  { n: 10447, customer: marc, items: [['Sneakers', 2, 'Wash & Fold']], status: 'qa', created: -6, due: 2, assignedTo: 'Mary Ngono', paid: 'full', payMethod: 'Card' },
  { n: 10446, customer: kamdem, items: [['Dress', 3, 'Dry Cleaning', 'Silk'], ['Suit', 1, 'Dry Cleaning']], status: 'washing', priority: 'express', created: -2, due: 3, assignedTo: 'Elena Rostova', method: 'delivery', handling: 'Hand-press delicate only.', branch: BRANCHES[1] },
  { n: 10445, customer: grace, items: [['Shirt', 6, 'Ironing Only']], status: 'handover', created: -26, due: -3, assignedTo: 'Mary Ngono', paid: 'full', payMethod: 'Cash' },
  { n: 10444, customer: paul, items: [['Trousers', 4, 'Wash & Fold'], ['Shirt', 4, 'Wash & Fold']], status: 'handover', created: -9, due: 1, assignedTo: 'David Kim', method: 'delivery', paid: 'full', payMethod: 'Mobile Money', branch: BRANCHES[2] },
  { n: 10443, customer: linda, items: [['Duvet Cover', 2, 'Wash & Fold']], status: 'completed', created: -30, due: -6, assignedTo: 'Elena Rostova', paid: 'full', payMethod: 'Mobile Money' },
  { n: 10442, customer: hotel, items: [['Shirt', 20, 'Dry Cleaning']], status: 'completed', created: -50, due: -24, assignedTo: 'David Kim', method: 'delivery', paid: 'full', payMethod: 'Bank Transfer' },
  { n: 10441, customer: john, items: [['Dress', 2, 'Dry Cleaning']], status: 'received', priority: 'high', created: -0.3, due: 20, assignedTo: 'Aisha Tamba' },
  { n: 10440, customer: ibrahim, items: [['Suit', 2, 'Dry Cleaning']], status: 'drying', created: -5, due: -1.2, assignedTo: 'Mary Ngono', paid: 'half', payMethod: 'Cash', branch: BRANCHES[1] },
  { n: 10439, customer: grace, items: [['Bedsheet', 4, 'Wash & Fold']], status: 'cancelled', created: -20, due: -2, assignedTo: 'Elena Rostova' },
  { n: 10438, customer: fatima, items: [['Shirt', 8, 'Wash & Fold'], ['Trousers', 3, 'Wash & Fold']], status: 'qa', priority: 'express', created: -4.5, due: 0.7, assignedTo: 'Elena Rostova', paid: 'full', payMethod: 'Mobile Money' },
]

function buildTimeline(seed: Seed, endHours: number): TimelineEntry[] {
  const stageIndex = PIPELINE_STATUSES.findIndex(({ id }) => id === seed.status)
  const reached = seed.status === 'cancelled' ? 0 : stageIndex
  const step = (endHours - seed.created) / (reached + 2)
  const entries: TimelineEntry[] = [
    { at: at(seed.created), action: 'Order created', by: 'Aisha Tamba' },
    {
      at: at(seed.created + step * 0.5),
      action: 'Items received & tagged',
      by: 'Aisha Tamba',
    },
  ]
  for (let index = 1; index <= reached; index += 1) {
    entries.push({
      at: at(seed.created + step * (index + 0.5)),
      action: `Moved to ${PIPELINE_STATUSES[index].label}`,
      by: seed.assignedTo,
    })
  }
  if (seed.status === 'cancelled') {
    entries.push({
      at: at(endHours),
      action: 'Order cancelled',
      by: 'Marcus Vance',
      note: 'Customer request',
    })
  }
  return entries
}

function buildOrder(seed: Seed): Order {
  const method = seed.method ?? 'pickup'
  const priority = seed.priority ?? 'normal'
  const items = seed.items.map(([name, qty, service, condition], index) => ({
    name,
    qty,
    service,
    unitPrice: Math.round(ITEM_PRICES[name] * SERVICE_MULTIPLIERS[service]),
    tag: `T-${seed.n}-${index + 1}`,
    condition: condition ?? 'Normal',
  }))
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const surcharge =
    priority === 'express' ? Math.round(subtotal * EXPRESS_SURCHARGE_RATE) : 0
  const tax = Math.round((subtotal + surcharge) * TAX_RATE)
  const deliveryFee = method === 'delivery' ? DELIVERY_FEE : 0
  const total = subtotal + surcharge + tax + deliveryFee

  const finished = seed.status === 'completed' || seed.status === 'cancelled'
  const endHours = finished ? Math.min(seed.due - 0.5, -0.5) : -0.2
  const qcDone =
    PIPELINE_STATUSES.findIndex(({ id }) => id === seed.status) > 4

  return {
    id: `ORD-${seed.n}`,
    invoice: `INV-${seed.n}`,
    customer: seed.customer,
    items,
    status: seed.status,
    priority,
    createdAt: at(seed.created),
    dueAt: at(seed.due),
    completedAt: seed.status === 'completed' ? at(endHours) : undefined,
    branch: seed.branch ?? BRANCHES[0],
    createdBy: 'Aisha Tamba',
    assignedTo: seed.assignedTo,
    assignedToId: '',
    method,
    address: method === 'delivery' ? 'Rue Joss, Bonanjo, Douala' : undefined,
    driver: method === 'delivery' ? 'Carlos Mendez' : undefined,
    surcharge,
    discount: 0,
    tax,
    deliveryFee,
    payments: seed.paid
      ? [
          {
            at: at(seed.created + 0.1),
            amount: seed.paid === 'full' ? total : Math.round(total / 2),
            method: seed.payMethod ?? 'Cash',
            reference: `PAY-${seed.n}`,
            by: 'Aisha Tamba',
          },
        ]
      : [],
    customerNotes: seed.customerNotes ?? '',
    staffNotes: '',
    handling: seed.handling ?? '',
    cancelReason: '',
    refundDue: 0,
    qc: {
      checks: Object.fromEntries(QC_CHECKS.map((check) => [check, qcDone])),
      result: qcDone ? 'passed' : 'pending',
    },
    timeline: buildTimeline(seed, endHours),
  }
}

export const SAMPLE_ORDERS: Order[] = SEEDS.map(buildOrder)

// The sample orders placed by a phone number
// TODO: replace with the orders API
export function getSampleOrders(phone: string) {
  return SAMPLE_ORDERS.filter((order) => order.customer.phone === phone)
}
