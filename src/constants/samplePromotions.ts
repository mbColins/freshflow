import type { Promotion, PromotionDraft, PromotionStats } from '../types/promotion'
import { CURRENT_USER } from './orders'

// Sample data is relative to page-load time so campaigns always look current
const NOW = Date.now()
const DAY = 86_400_000
const day = (offset: number) => {
  const date = new Date(NOW + offset * DAY)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type Seed = Pick<PromotionDraft, 'name' | 'code' | 'type' | 'discountKind' | 'value' | 'description'> &
  Partial<PromotionDraft> & {
    // Day offsets from today; a null end means no expiry
    run: [start: number, end: number | null]
    // uses, revenue, discount, reach
    stats?: [number, number, number, number]
    // Growth on the previous period, e.g. 0.14 = +14%
    growth?: number
  }

const SEEDS: Seed[] = [
  // Active
  { name: 'Weekend Fresh', code: 'WEEKEND20', type: 'percentage', discountKind: 'percent', value: 20, description: '20% off Wash & Fold loads dropped off on Saturday or Sunday.', services: ['Wash & Fold'], days: [5, 6], run: [-9, 21], usageLimit: 500, perCustomerLimit: 4, budget: 800_000, channels: ['WhatsApp', 'SMS', 'In-App'], banner: 'fresh', stats: [248, 2_840_000, 420_000, 1107], growth: 0.14 },
  { name: 'FirstWash VIP', code: 'FIRST1500', type: 'firstOrder', discountKind: 'amount', value: 1500, description: 'XAF 1,500 off a first order of XAF 8,000 or more.', audience: 'new', minOrder: 8000, run: [-40, 50], usageLimit: 1000, perCustomerLimit: 1, budget: 1_500_000, channels: ['SMS', 'In-App'], stats: [412, 4_120_000, 618_000, 1450], growth: 0.22 },
  { name: 'Rainy Logistics', code: 'FREEPICKUP', type: 'freeDelivery', discountKind: 'freeDelivery', value: 0, description: 'Free pickup and delivery on orders above XAF 20,000 during the rainy season.', minOrder: 20_000, branches: ['BR-001', 'BR-002', 'BR-004', 'BR-005'], run: [-20, 40], stackable: true, budget: 600_000, channels: ['SMS', 'WhatsApp'], banner: 'night', stats: [320, 3_400_000, 320_000, 1620], growth: 0.09 },
  { name: 'Suit & Dress Duo', code: 'DUOPOWER', type: 'bundle', discountKind: 'amount', value: 2500, description: 'Save XAF 2,500 on two suits and three pressed shirts.', bundleNote: '2 executive suits + 3 steam-pressed shirts', services: ['Dry Cleaning', 'Ironing'], branches: ['BR-001', 'BR-004'], run: [-30, 30], usageLimit: 300, channels: ['Counter POS', 'WhatsApp'], banner: 'berry', stats: [184, 2_208_000, 460_000, 1120], growth: 0.06 },
  { name: 'Loyalty 5X Boost', code: 'LOYAL5000', type: 'loyalty', discountKind: 'amount', value: 5000, description: 'XAF 5,000 reward after the fifth order in 30 days.', audience: 'loyalty', minOrder: 15_000, run: [-60, null], perCustomerLimit: 1, budget: 900_000, channels: ['In-App', 'Email'], banner: 'sunset', stats: [120, 1_900_000, 600_000, 640], growth: 0.18 },
  { name: 'Bring a Friend', code: 'REFER10', type: 'referral', discountKind: 'percent', value: 10, maxDiscount: 3000, description: '10% off for a referred friend and for the customer who referred them.', audience: 'referred', run: [-75, null], perCustomerLimit: 5, channels: ['WhatsApp', 'In-App'], stats: [96, 820_000, 82_000, 610], growth: -0.04 },
  { name: 'Big Load Saver', code: '', automatic: true, type: 'volume', discountKind: 'tiered', value: 0, tiers: [{ minSpend: 15_000, percent: 5 }, { minSpend: 30_000, percent: 10 }, { minSpend: 50_000, percent: 15 }], description: 'The bigger the order, the bigger the discount. Applied automatically.', run: [-25, 65], channels: ['Counter POS', 'In-App'], banner: 'fresh', stats: [142, 3_100_000, 286_000, 980], growth: 0.11 },
  { name: 'Corporate Linen', code: 'CORP15', type: 'percentage', discountKind: 'percent', value: 15, maxDiscount: 25_000, description: '15% off bedding and linen for corporate accounts.', audience: 'corporate', services: ['Bedding'], minOrder: 50_000, run: [-45, 45], budget: 600_000, channels: ['Email'], banner: 'night', stats: [38, 2_600_000, 390_000, 150], growth: 0.31 },
  // Scheduled
  { name: 'Black Friday Linen', code: 'BFMEGA30', type: 'seasonal', discountKind: 'percent', value: 30, maxDiscount: 15_000, description: '30% off commercial blankets and bedding for Black Friday weekend.', services: ['Bedding'], run: [45, 48], usageLimit: 400, budget: 1_200_000, channels: ['WhatsApp', 'SMS', 'Email'], banner: 'night' },
  { name: 'Festive Fresh', code: 'NOEL25', type: 'seasonal', discountKind: 'percent', value: 25, maxDiscount: 10_000, description: '25% off every service through the festive season.', run: [75, 92], budget: 2_000_000, channels: ['WhatsApp', 'SMS', 'In-App', 'Email'], banner: 'berry' },
  { name: 'New Year Reset', code: 'NY2000', type: 'fixed', discountKind: 'amount', value: 2000, description: 'XAF 2,000 off orders of XAF 10,000 or more in January.', minOrder: 10_000, run: [83, 113], usageLimit: 800, channels: ['SMS', 'In-App'], banner: 'sunset' },
  { name: 'Midweek Express', code: 'MIDWEEK10', type: 'percentage', discountKind: 'percent', value: 10, description: '10% off Express Service from Tuesday to Thursday.', services: ['Express Service'], days: [1, 2, 3], run: [5, 60], channels: ['In-App', 'Counter POS'] },
  { name: 'Shoe Shine Week', code: 'SHOES500', type: 'fixed', discountKind: 'amount', value: 500, description: 'XAF 500 off every pair of shoes cleaned.', services: ['Shoe Cleaning'], run: [12, 19], channels: ['WhatsApp'], banner: 'fresh' },
  // Drafts
  { name: 'Carpet Revival', code: 'CARPET15', type: 'percentage', discountKind: 'percent', value: 15, description: '15% off carpet cleaning before the dry season.', services: ['Carpet Cleaning'], run: [20, 50], state: 'draft', channels: ['WhatsApp'] },
  { name: 'Student Saver', code: 'STUDENT10', type: 'percentage', discountKind: 'percent', value: 10, maxDiscount: 2000, description: '10% off Wash & Fold for students at the Yaoundé branches.', services: ['Wash & Fold'], branches: ['BR-001', 'BR-005'], run: [15, 105], state: 'draft', channels: ['In-App'] },
  { name: 'VIP Platinum Delivery', code: '', automatic: true, type: 'freeDelivery', discountKind: 'freeDelivery', value: 0, description: 'Free pickup and delivery on every VIP order.', audience: 'vip', run: [10, null], stackable: true, state: 'draft', channels: ['In-App'], banner: 'night' },
  // Paused
  { name: 'Express Hour', code: 'EXPRESS5', type: 'percentage', discountKind: 'percent', value: 5, description: '5% off Express Service orders placed before 10:00.', services: ['Express Service'], run: [-35, 25], state: 'paused', channels: ['Counter POS'], stats: [44, 380_000, 19_000, 400], growth: -0.12 },
  // Expired
  { name: 'Rentrée Ready', code: 'RENTREE15', type: 'seasonal', discountKind: 'percent', value: 15, description: '15% off school uniforms and bedding for back to school.', run: [-55, -22], channels: ['SMS', 'WhatsApp'], banner: 'sunset', stats: [301, 3_010_000, 451_000, 1500], growth: 0.2 },
  { name: 'Flash Friday', code: 'FLASH500', type: 'fixed', discountKind: 'amount', value: 500, description: 'XAF 500 off the first 100 orders on Friday.', run: [-15, 15], usageLimit: 100, channels: ['WhatsApp'], stats: [100, 720_000, 50_000, 890], growth: 0.05 },
  { name: 'Youth Day Wash', code: 'YOUTH11', type: 'percentage', discountKind: 'percent', value: 11, description: '11% off for Youth Day week.', run: [-240, -233], channels: ['SMS'], stats: [87, 640_000, 70_000, 720], growth: 0 },
  { name: 'National Day Fresh', code: 'UNITY20', type: 'seasonal', discountKind: 'percent', value: 20, maxDiscount: 5000, description: '20% off for the National Day long weekend.', run: [-145, -140], channels: ['SMS', 'WhatsApp'], banner: 'fresh', stats: [156, 1_480_000, 262_000, 1310], growth: 0.08 },
  // Archived
  { name: 'Opening Week', code: 'OPEN50', type: 'percentage', discountKind: 'percent', value: 50, maxDiscount: 5000, description: 'Half price for the Akwa branch opening week.', branches: ['BR-007'], run: [-400, -393], state: 'archived', channels: ['Counter POS'], stats: [210, 610_000, 590_000, 400], growth: 0 },
]

const toStats = ([uses, revenue, discount, reach]: [number, number, number, number]): PromotionStats => ({
  uses,
  revenue,
  discount,
  reach,
})

// TODO: replace with the promotions API
export const SAMPLE_PROMOTIONS: Promotion[] = SEEDS.map(({ run, stats, growth = 0, ...seed }, index) => {
  const current = stats ?? [0, 0, 0, 0]
  // Created and published before today, even when the campaign starts later
  const origin = Math.min(run[0], 0)
  const createdAt = new Date(NOW + (origin - 6) * DAY).toISOString()
  return {
    id: `PRM-${String(101 + index)}`,
    automatic: false,
    notes: '',
    banner: 'ocean',
    maxDiscount: null,
    tiers: [],
    bundleNote: '',
    audience: 'all',
    customers: '',
    branches: [],
    services: [],
    minOrder: 0,
    stackable: false,
    days: [],
    usageLimit: null,
    perCustomerLimit: null,
    budget: null,
    channels: [],
    state: 'published',
    ...seed,
    startAt: day(run[0]),
    endAt: run[1] === null ? null : day(run[1]),
    stats: toStats(current),
    previous: toStats(current.map((value) => Math.round(value / (1 + growth))) as typeof current),
    history: [
      ...(seed.state === 'paused' ? [{ at: new Date(NOW - 2 * DAY).toISOString(), user: CURRENT_USER, text: 'Paused the promotion' }] : []),
      ...(seed.state === 'draft' ? [] : [{ at: new Date(NOW + (origin - 3) * DAY).toISOString(), user: CURRENT_USER, text: 'Published the promotion' }]),
      { at: createdAt, user: 'Solange Biya', text: 'Created the promotion' },
    ],
    createdBy: 'Solange Biya',
    createdAt,
  }
})
