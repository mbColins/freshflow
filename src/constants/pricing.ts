import type { OrderRole } from '../types/order'
import type {
  PriceChange,
  PricingConfig,
  PricingFilters,
  ScheduledChange,
} from '../types/pricing'

// Sample data is relative to page-load time so dates always look current
const NOW = Date.now()
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()
const dayKey = (offset: number) => {
  const date = new Date(NOW + offset * DAY)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const SAME_DAY_SURCHARGE_ID = 'sameday'

// TODO: replace with the pricing API
export const SAMPLE_PRICING_CONFIG: PricingConfig = {
  groups: [
    { id: 'standard', name: 'Standard', discountPct: 0, note: 'Walk-in and app customers' },
    { id: 'vip', name: 'VIP', discountPct: 10, note: 'Loyalty Gold and Platinum' },
    { id: 'corporate', name: 'Corporate', discountPct: 15, note: 'Contracted companies' },
    { id: 'hotel', name: 'Hotel', discountPct: 20, note: 'Hospitality linen contracts' },
    { id: 'wholesale', name: 'Wholesale', discountPct: 25, note: 'Resellers and agents' },
    { id: 'staff', name: 'Staff', discountPct: 30, note: 'Employees' },
  ],
  surcharges: [
    { id: SAME_DAY_SURCHARGE_ID, name: 'Same-Day Service', kind: 'percent', value: 60, when: 'Order must be ready the same day', enabled: true },
    { id: 'weekend', name: 'Weekend Service', kind: 'percent', value: 15, when: 'Dropped off on Saturday or Sunday', enabled: true },
    { id: 'holiday', name: 'Holiday Service', kind: 'percent', value: 25, when: 'Processed on a public holiday', enabled: true },
    { id: 'stain', name: 'Heavy Stain', kind: 'fixed', value: 2000, when: 'Items needing extra pre-treatment', enabled: true },
    { id: 'handling', name: 'Special Handling', kind: 'fixed', value: 1500, when: 'Fragile or oversized items', enabled: false },
  ],
  zones: [
    { id: 'zone-a', name: 'Zone A', distance: '0–5 km', deliveryFee: 1000, pickupFee: 0, minOrder: 0 },
    { id: 'zone-b', name: 'Zone B', distance: '5–10 km', deliveryFee: 2000, pickupFee: 500, minOrder: 5000 },
    { id: 'zone-c', name: 'Zone C', distance: '10–20 km', deliveryFee: 3500, pickupFee: 1000, minOrder: 10_000 },
  ],
  taxes: [
    { id: 'vat', name: 'VAT', rate: 19.25, appliesTo: 'All services', enabled: false },
  ],
  freeDeliveryAbove: 25_000,
  tiers: {
    'WAF-001': [
      { from: 6, price: 1800 },
      { from: 11, price: 1600 },
      { from: 21, price: 1400 },
    ],
    'SAN-007': [{ from: 15, price: 2700 }],
  },
}

export const SAMPLE_PRICE_CHANGES: PriceChange[] = [
  { id: 'PC-108', at: ago(4), serviceId: 'WAF-001', serviceName: 'Wash & Fold', scope: 'Global', from: 1800, to: 2000, by: 'Mary Ngono', reason: 'Detergent supplier cost increase' },
  { id: 'PC-107', at: ago(9), serviceId: 'IRN-003', serviceName: 'Ironing Only', scope: 'Global', from: 700, to: 800, by: 'Marcus Vance', reason: 'Electricity tariff adjustment' },
  { id: 'PC-106', at: ago(16), serviceId: 'WAF-001', serviceName: 'Wash & Fold', scope: 'Akwa Branch', from: 2000, to: 2200, by: 'Marcus Vance', reason: 'Higher commercial rent at Akwa' },
  { id: 'PC-105', at: ago(38), serviceId: 'SNK-005', serviceName: 'Sneaker Spa', scope: 'Global', from: 4500, to: 5000, by: 'Mary Ngono', reason: 'New ozone sanitizing step' },
  { id: 'PC-104', at: ago(71), serviceId: 'BED-004', serviceName: 'Bedding & Duvet', scope: 'Global', from: 3200, to: 3500, by: 'Marcus Vance', reason: 'Annual price review' },
]

export const SAMPLE_SCHEDULED_CHANGES: ScheduledChange[] = [
  { id: 'SC-21', serviceId: 'SAN-007', newPrice: 3200, effectiveAt: dayKey(1), reason: 'Boiler fuel index', by: 'Marcus Vance' },
  { id: 'SC-22', serviceId: 'WAF-001', newPrice: 2100, effectiveAt: dayKey(83), reason: 'January price review', by: 'Mary Ngono' },
]

export const EMPTY_PRICING_FILTERS: PricingFilters = {
  query: '',
  category: '',
  branch: '',
  model: '',
  status: '',
}

export const SPEEDS = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'sameDay', label: 'Same day' },
] as const

// Branch prices this far from the global price are flagged for review
export const OVERRIDE_REVIEW_PCT = 20
export const PROMOTION_EXPIRY_WARNING_DAYS = 7

export type PricingPermissions = {
  // Change prices, rules and configuration
  manage: boolean
  // See revenue, analytics and the change log
  financials: boolean
}

export const PRICING_PERMISSIONS: Record<OrderRole, PricingPermissions> = {
  admin: { manage: true, financials: true },
  manager: { manage: true, financials: true },
  receptionist: { manage: false, financials: false },
  staff: { manage: false, financials: false },
}
