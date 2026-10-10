import type {
  ActivityEntry,
  CorporateProfile,
  CrmCustomer,
  CustomerKind,
  CustomerPayment,
  CustomerStatus,
} from '../types/customer'
import type { FulfilmentMethod } from '../types/order'
import { BRANCHES } from './orders'
import { SAMPLE_ORDERS } from './sampleOrders'

// Sample customers until the customers API exists. Phone numbers line up with the
// sample orders, so each profile can show that customer's real sample orders.
const DAY_MS = 86_400_000
const loadedAt = Date.now()
const daysAgo = (days: number) => new Date(loadedAt - days * DAY_MS).toISOString()

type Seed = {
  n: number
  name: string
  kind?: CustomerKind
  phone: string
  status: CustomerStatus
  points: number
  orders: number
  spent: number
  outstanding?: [amount: number, orders: number]
  lastDays: number | null
  cadence: number
  service: string
  method?: FulfilmentMethod
  tags: string[]
  branch?: number
  months: number
  instructions?: string
  note?: string
  corporate?: CorporateProfile
}

const SEEDS: Seed[] = [
  { n: 1284, name: 'John Doe', phone: '+237 671 892 104', status: 'vip', points: 7_500, orders: 24, spent: 420_000, outstanding: [12_500, 1], lastDays: 0, cadence: 5, service: 'Wash & Fold', tags: ['VIP', 'Frequent'], months: 20, instructions: 'No chlorine bleach on collars. Double cold rinse on all loads.', note: 'Sensitive skin: avoid scented detergent.' },
  { n: 842, name: 'Grand Palace Hotel', kind: 'corporate', phone: '+237 699 120 441', status: 'vip', points: 12_400, orders: 186, spent: 8_420_000, outstanding: [185_000, 1], lastDays: 0, cadence: 2, service: 'Wash & Fold', method: 'delivery', tags: ['Corporate', 'Hotel', 'High Value'], months: 33, note: 'Deliver to concierge desk #1 before 18:30.', corporate: { contact: 'Mireille Abena (Housekeeping)', taxId: 'M0123456789012A', billingAddress: 'Boulevard de la Liberté, Bonanjo, Douala', terms: 'Net 30', creditLimit: 500_000, contract: 'Bulk bedding & linens, renewed Jan 2026' } },
  { n: 105, name: 'Dr. Aris', phone: '+237 655 332 901', status: 'active', points: 4_200, orders: 42, spent: 950_000, lastDays: 0, cadence: 14, service: 'Sanitize 60°C', tags: ['Regular', 'High Value'], months: 28, instructions: 'Bio-safe protocol: wash at 60°C minimum.' },
  { n: 1429, name: 'Sarah Kamdem', phone: '+237 690 334 118', status: 'new', points: 320, orders: 1, spent: 35_784, outstanding: [35_784, 1], lastDays: 0, cadence: 30, service: 'Dry Cleaning', method: 'delivery', tags: ['New', 'Delivery Customer'], branch: 1, months: 0, instructions: 'Hand-press delicate items only.' },
  { n: 1550, name: 'Marc Belle', phone: '+237 655 001 928', status: 'active', points: 450, orders: 3, spent: 41_000, lastDays: 0, cadence: 30, service: 'Wash & Fold', tags: [], months: 5 },
  { n: 611, name: 'Sarah K.', phone: '+237 694 112 883', status: 'active', points: 2_100, orders: 6, spent: 98_500, lastDays: 0, cadence: 21, service: 'Dry Cleaning', tags: ['Regular'], months: 13, instructions: 'Hand-press silk only.' },
  { n: 1561, name: 'Emmanuel M.', phone: '+237 670 221 504', status: 'new', points: 0, orders: 1, spent: 0, outstanding: [17_888, 1], lastDays: 0, cadence: 30, service: 'Wash & Fold', tags: ['New'], months: 0 },
  { n: 377, name: 'St. Jude Clinic', kind: 'corporate', phone: '+237 677 440 912', status: 'active', points: 6_100, orders: 31, spent: 2_150_000, outstanding: [49_941, 1], lastDays: 1, cadence: 7, service: 'Sanitize 60°C', method: 'delivery', tags: ['Corporate', 'High Value'], months: 23, corporate: { contact: 'Dr. Paul Nkeng (Administration)', taxId: 'M0987654321098B', billingAddress: 'Rue de la Joie, Deido, Douala', terms: 'Net 15', creditLimit: 200_000, contract: 'Hospital linen, weekly morning delivery' } },
  { n: 903, name: 'Grace Ndi', phone: '+237 652 778 340', status: 'active', points: 1_650, orders: 11, spent: 77_400, lastDays: 1, cadence: 14, service: 'Ironing Only', tags: ['Frequent', 'Student'], months: 20 },
  { n: 1502, name: 'Paul Etoa', phone: '+237 698 214 667', status: 'active', points: 600, orders: 4, spent: 36_200, lastDays: 0, cadence: 25, service: 'Wash & Fold', method: 'delivery', tags: ['Delivery Customer'], branch: 2, months: 3 },
  { n: 720, name: 'Linda Fotso', phone: '+237 675 903 221', status: 'active', points: 2_300, orders: 7, spent: 88_900, lastDays: 1, cadence: 30, service: 'Wash & Fold', tags: ['Regular'], months: 10 },
  { n: 1570, name: 'Ibrahim Sali', phone: '+237 691 556 030', status: 'new', points: 150, orders: 1, spent: 9_540, outstanding: [9_540, 1], lastDays: 0, cadence: 30, service: 'Dry Cleaning', tags: ['New'], branch: 1, months: 0 },
  { n: 1488, name: 'Fatima Bello', phone: '+237 653 119 874', status: 'active', points: 980, orders: 5, spent: 52_300, lastDays: 0, cadence: 20, service: 'Wash & Fold', tags: [], months: 6 },
  { n: 415, name: 'Olivier Tchana', phone: '+237 677 628 105', status: 'inactive', points: 1_900, orders: 9, spent: 134_000, lastDays: 74, cadence: 18, service: 'Dry Cleaning', tags: ['Inactive'], months: 16 },
  { n: 268, name: 'Akwa Suites Hotel', kind: 'corporate', phone: '+237 699 300 772', status: 'active', points: 5_400, orders: 64, spent: 3_120_000, outstanding: [240_000, 2], lastDays: 32, cadence: 14, service: 'Wash & Fold', method: 'delivery', tags: ['Corporate', 'Hotel'], branch: 1, months: 26, corporate: { contact: 'Serge Mballa (Operations)', taxId: 'M0456789012345C', billingAddress: 'Rue Franqueville, Akwa, Douala', terms: 'Net 30', creditLimit: 300_000, contract: 'Room linen, twice weekly' } },
  { n: 990, name: 'Nadia Moussa', phone: '+237 650 482 913', status: 'suspended', points: 300, orders: 4, spent: 28_600, outstanding: [28_600, 2], lastDays: 95, cadence: 30, service: 'Wash & Fold', tags: [], months: 9, note: 'Account suspended by management: two unpaid orders.' },
]

const STREETS = ['123 Akwa Blvd', '18 Rue Joss, Bonanjo', '7 Makepe Missoke', '42 Rue Koloko, Bonapriso']

// Stable pseudo-random value in [0, 1) so the sample charts don't change between renders
function noise(seed: number, index: number) {
  const value = Math.sin(seed * 31 + index * 17) * 43_758.5
  return value - Math.floor(value)
}

function buildCustomer(seed: Seed, index: number): CrmCustomer {
  const kind = seed.kind ?? 'individual'
  const method = seed.method ?? 'pickup'
  const email = `${seed.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`
  const sampleOrders = SAMPLE_ORDERS.filter(
    (order) => order.customer.phone === seed.phone,
  )

  const activeMonths = Math.min(12, Math.max(1, seed.months + 1))
  const perMonth = seed.orders / (seed.months + 1)
  const averageOrder = seed.orders === 0 ? 0 : seed.spent / seed.orders
  const idleMonths = seed.lastDays === null ? 12 : Math.floor(seed.lastDays / 30)
  const monthlyOrders = Array.from({ length: 12 }, (_, month) => {
    const monthsBack = 11 - month
    if (monthsBack >= activeMonths || monthsBack < idleMonths) return 0
    const count = Math.round(perMonth * (0.6 + 0.8 * noise(seed.n, month)))
    return monthsBack === idleMonths ? Math.max(1, count) : count
  })
  // Vary each month a little, then rescale so the year still adds up to orders × average
  const rawSpend = monthlyOrders.map(
    (count, month) => count * (0.8 + 0.4 * noise(seed.n + 7, month)),
  )
  const rawTotal = rawSpend.reduce((sum, value) => sum + value, 0)
  const yearOrders = monthlyOrders.reduce((sum, count) => sum + count, 0)
  const monthlySpend = rawSpend.map((value) =>
    rawTotal === 0 ? 0 : Math.round((value / rawTotal) * yearOrders * averageOrder),
  )

  const payments: CustomerPayment[] = sampleOrders.flatMap((order) =>
    order.payments.map((payment, paymentIndex) => ({
      id: `PAY-${order.id.slice(4)}${paymentIndex + 1}`,
      at: payment.at,
      order: order.id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      status: 'Successful',
      by: payment.by,
    })),
  )

  const activity: ActivityEntry[] = [
    ...sampleOrders.flatMap((order) => [
      { at: order.createdAt, text: `Order #${order.id} created` },
      ...order.timeline
        .slice(-1)
        .map((entry) => ({ at: entry.at, text: `Order #${order.id}: ${entry.action}` })),
    ]),
    ...payments.map((payment) => ({
      at: payment.at,
      text: `Payment of XAF ${payment.amount.toLocaleString('en-US')} received`,
    })),
    ...(seed.points > 0
      ? [{ at: daysAgo((seed.lastDays ?? 0) + 8), text: 'Customer earned 250 loyalty points' }]
      : []),
    { at: daysAgo((seed.lastDays ?? 0) + 12), text: 'Customer profile updated' },
    { at: daysAgo(seed.months * 30 + 1), text: 'Customer registered' },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return {
    id: `CUS-${String(seed.n).padStart(6, '0')}`,
    name: seed.name,
    kind,
    phone: seed.phone,
    email,
    status: seed.status,
    points: seed.points,
    branch: BRANCHES[seed.branch ?? 0],
    registeredAt: daysAgo(seed.months * 30 + 1),
    lastOrderAt: seed.lastDays === null ? null : daysAgo(seed.lastDays),
    orders: seed.orders,
    spent: seed.spent,
    outstanding: seed.outstanding?.[0] ?? 0,
    outstandingOrders: seed.outstanding?.[1] ?? 0,
    preferredService: seed.service,
    cadenceDays: seed.cadence,
    tags: seed.tags,
    addresses: [
      {
        id: 'address-1',
        label: kind === 'corporate' ? 'Main site' : 'Home',
        street: seed.corporate?.billingAddress.split(',')[0] ?? STREETS[index % STREETS.length],
        city: 'Douala',
        region: 'Littoral',
        landmark: '',
        instructions: kind === 'corporate' ? 'Service entrance, ask for housekeeping.' : 'Call upon arrival.',
        isDefault: true,
      },
      ...(index % 3 === 0 && kind === 'individual'
        ? [
            {
              id: 'address-2',
              label: 'Work',
              street: 'Bonanjo Commercial Tower, 4th Floor',
              city: 'Douala',
              region: 'Littoral',
              landmark: 'Opposite the main post office',
              instructions: '',
              isDefault: false,
            },
          ]
        : []),
    ],
    laundry: {
      detergent: seed.instructions ? 'Hypoallergenic' : 'Regular',
      softener: index % 2 === 0 ? 'Lavender' : 'None',
      folding: 'Standard',
      packaging: kind === 'corporate' ? 'Standard' : 'Garment bag',
      ironing: seed.service !== 'Wash & Fold',
      instructions: seed.instructions ?? '',
    },
    delivery: {
      method,
      window: method === 'delivery' ? '17:00–19:00' : '',
      instructions: method === 'delivery' ? 'Call before arriving.' : '',
    },
    notes: seed.note
      ? [{ id: 'note-1', text: seed.note, by: 'Marcus Vance', at: daysAgo((seed.lastDays ?? 0) + 20) }]
      : [],
    communications:
      seed.orders > 0
        ? [
            { at: daysAgo(seed.lastDays ?? 0), channel: 'SMS', message: 'Your order has been received and tagged.', status: 'Delivered' },
            { at: daysAgo((seed.lastDays ?? 0) + seed.cadence), channel: 'WhatsApp', message: 'Your laundry order is ready.', status: 'Read' },
          ]
        : [],
    payments,
    activity,
    monthlyOrders,
    monthlySpend,
    consent: { sms: true, email: kind === 'corporate', whatsapp: true, marketing: seed.status !== 'suspended' },
    corporate: seed.corporate,
    archived: false,
  }
}

export const SAMPLE_CUSTOMERS: CrmCustomer[] = SEEDS.map(buildCustomer)

export function getSampleOrders(phone: string) {
  return SAMPLE_ORDERS.filter((order) => order.customer.phone === phone)
}
