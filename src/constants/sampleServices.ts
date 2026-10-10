import type {
  ItemPrice,
  LaundryService,
  PricingModel,
  ServiceStatus,
} from '../types/service'
import { BRANCHES } from './orders'

// Sample service catalog until the services API exists
const DAY_MS = 86_400_000
const loadedAt = Date.now()
const daysAgo = (days: number) => new Date(loadedAt - days * DAY_MS).toISOString()

type Seed = {
  id: string
  name: string
  category: string
  description: string
  icon: string
  status?: ServiceStatus
  statusReason?: string
  model: PricingModel
  price: number
  items?: [string, number][]
  hours: number
  express?: [hours: number, surchargePct: number]
  workflow: string[]
  machines: string[]
  skill?: string
  consumption?: [string, number, string][]
  addOns?: string[]
  options?: string[]
  // Branch indexes where the service is offered
  offered?: number[]
  capacity?: [daily: number, current: number, unit: string]
  includes?: string[]
  orders: number
  revenue: number
  growth: number
}

const SEEDS: Seed[] = [
  { id: 'WAF-001', name: 'Wash & Fold', category: 'Washing', description: 'Professional washing, drying and folding of everyday clothing.', icon: 'wash', model: 'kg', price: 2_000, hours: 24, express: [8, 35], workflow: ['Received', 'Washing', 'Drying', 'Folding', 'Quality Check', 'Ready'], machines: ['Washing Machine', 'Dryer'], consumption: [['Detergent', 20, 'ml'], ['Fabric Softener', 10, 'ml'], ['Packaging Bag', 0.2, 'bag']], addOns: ['stain', 'detergent', 'softener', 'packaging', 'delivery'], options: ['Folding', 'Fragrance', 'Stain treatment', 'Pickup', 'Delivery'], capacity: [500, 372, 'kg'], orders: 432, revenue: 1_850_000, growth: 14.2 },
  { id: 'DRC-002', name: 'Dry Cleaning', category: 'Dry Cleaning', description: 'Solvent cleaning and hand finishing for suits, dresses and delicate garments.', icon: 'suit', model: 'custom', price: 2_000, items: [['Shirt', 2_000], ['Trousers', 2_400], ['Dress', 5_000], ['Suit (2pc)', 8_000], ['Jacket', 3_500]], hours: 48, express: [24, 50], workflow: ['Received', 'Inspection', 'Pre-spotting', 'Dry Cleaning', 'Finishing', 'Quality Check', 'Ready'], machines: ['Dry Cleaning Machine', 'Steam Press'], skill: 'Dry Cleaning Specialist', consumption: [['Dry Cleaning Solvent', 45, 'ml'], ['Hanger', 1, 'piece']], addOns: ['stain', 'packaging', 'delivery'], options: ['Ironing', 'Stain treatment', 'Packaging', 'Delivery'], capacity: [180, 96, 'pieces'], orders: 248, revenue: 2_140_000, growth: 8.4 },
  { id: 'IRN-003', name: 'Ironing Only', category: 'Ironing', description: 'Rotary steam press for shirts, trousers and linens brought in clean.', icon: 'iron', model: 'item', price: 800, hours: 12, express: [4, 40], workflow: ['Received', 'Steam Pressing', 'Quality Check', 'Ready'], machines: ['Steam Press'], skill: 'Pressing & Finishing', consumption: [['Hanger', 1, 'piece']], addOns: ['packaging', 'delivery'], options: ['Packaging', 'Delivery'], capacity: [400, 388, 'pieces'], orders: 310, revenue: 420_000, growth: -2.3 },
  { id: 'BED-004', name: 'Bedding & Duvet', category: 'Bedding', description: 'Thermal wash for sheets, duvets and hotel linen with calender finish.', icon: 'bed', model: 'piece', price: 3_500, hours: 36, express: [12, 30], workflow: ['Received', 'Washing', 'Drying', 'Ironing', 'Folding', 'Quality Check', 'Ready'], machines: ['Washing Machine', 'Dryer', 'Steam Press'], consumption: [['Detergent', 45, 'ml'], ['Packaging Bag', 1, 'bag']], addOns: ['stain', 'softener', 'delivery'], options: ['Ironing', 'Folding', 'Delivery'], orders: 96, revenue: 890_000, growth: 6.1 },
  { id: 'SNK-005', name: 'Sneaker Spa', category: 'Shoes', description: 'De-lace, sonic clean and ozone sanitize, priced per pair.', icon: 'shoe', model: 'fixed', price: 5_000, hours: 48, express: [24, 25], workflow: ['Received', 'Inspection', 'Washing', 'Drying', 'Quality Check', 'Ready'], machines: ['Ozone Chamber'], consumption: [['Detergent', 30, 'ml']], addOns: ['stain', 'packaging'], options: ['Fragrance', 'Packaging'], offered: [0, 1], orders: 64, revenue: 320_000, growth: 21.5 },
  { id: 'DEL-006', name: 'Delicate Silk & Wedding Gown', category: 'Specialty', description: 'Hand pre-spotting, silk wash and hand forming, returned in an acid-free box.', icon: 'gown', status: 'unavailable', statusReason: 'Steam valve down on Steam Press #02 (maintenance).', model: 'fixed', price: 15_000, hours: 72, workflow: ['Received', 'Inspection', 'Pre-spotting', 'Dry Cleaning', 'Finishing', 'Quality Check', 'Packaging', 'Ready'], machines: ['Dry Cleaning Machine', 'Steam Press'], skill: 'Dry Cleaning Specialist', consumption: [['Dry Cleaning Solvent', 80, 'ml']], addOns: ['packaging', 'delivery'], options: ['Packaging', 'Delivery'], offered: [0], orders: 18, revenue: 270_000, growth: 0 },
  { id: 'SAN-007', name: 'Sanitize 60°C', category: 'Washing', description: 'High-temperature bio-safe wash for medical and hospitality textiles.', icon: 'sanitize', model: 'kg', price: 3_000, hours: 24, express: [10, 35], workflow: ['Received', 'Washing', 'Drying', 'Folding', 'Quality Check', 'Ready'], machines: ['Washing Machine', 'Dryer'], consumption: [['Detergent', 30, 'ml']], addOns: ['packaging', 'delivery'], options: ['Folding', 'Delivery'], capacity: [300, 140, 'kg'], orders: 121, revenue: 1_120_000, growth: 11.0 },
  { id: 'CRP-008', name: 'Carpet Deep Clean', category: 'Carpets', description: 'Extraction clean and drying for rugs and carpets up to 6 m².', icon: 'carpet', status: 'inactive', statusReason: 'No carpet line at any branch this season.', model: 'piece', price: 12_000, hours: 96, workflow: ['Received', 'Inspection', 'Washing', 'Drying', 'Quality Check', 'Ready'], machines: ['Washing Machine'], addOns: ['stain', 'delivery'], options: ['Pickup', 'Delivery'], offered: [], orders: 0, revenue: 0, growth: 0 },
  { id: 'PKD-009', name: 'Pickup & Delivery', category: 'Pickup & Delivery', description: 'Door pickup and return delivery within the city.', icon: 'delivery', model: 'fixed', price: 1_500, hours: 4, workflow: ['Received', 'Ready'], machines: [], skill: 'Delivery Driver', options: ['Pickup', 'Delivery'], orders: 205, revenue: 307_500, growth: 9.3 },
  { id: 'PRM-010', name: 'Premium Laundry', category: 'Washing', description: 'Bundle: wash & fold, ironing and premium packaging in one service.', icon: 'premium', status: 'draft', model: 'kg', price: 3_200, hours: 30, express: [12, 35], workflow: ['Received', 'Washing', 'Drying', 'Ironing', 'Folding', 'Quality Check', 'Packaging', 'Ready'], machines: ['Washing Machine', 'Dryer', 'Steam Press'], consumption: [['Detergent', 20, 'ml'], ['Packaging Bag', 1, 'bag']], addOns: ['detergent', 'packaging', 'delivery'], options: ['Ironing', 'Folding', 'Packaging'], includes: ['Wash & Fold', 'Ironing Only', 'Premium Packaging'], orders: 0, revenue: 0, growth: 0 },
]

// Stable pseudo-random value in [0, 1) so sample charts don't change between renders
function noise(seed: number, index: number) {
  const value = Math.sin(seed * 13 + index * 29) * 43_758.5
  return value - Math.floor(value)
}

// Spread a yearly total over 12 months with a gentle upward trend
function spread(total: number, seed: number) {
  const weights = Array.from(
    { length: 12 },
    (_, month) => 0.7 + month * 0.04 + 0.3 * noise(seed, month),
  )
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((weight) => Math.round((weight / sum) * total))
}

function buildService(seed: Seed, index: number): LaundryService {
  const offered = seed.offered ?? BRANCHES.map((_, branchIndex) => branchIndex)
  const express = seed.express
  const itemPrices: ItemPrice[] = (seed.items ?? []).map(([item, price]) => ({
    item,
    price,
    expressPrice: Math.round(price * (1 + (express?.[1] ?? 0) / 100)),
  }))
  const live = seed.orders > 0

  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    description: seed.description,
    icon: seed.icon,
    status: seed.status ?? 'active',
    statusReason: seed.statusReason ?? '',
    pricingModel: seed.model,
    basePrice: seed.price,
    minQty: seed.model === 'kg' ? 3 : 1,
    maxQty: null,
    itemPrices,
    standardHours: seed.hours,
    express: {
      enabled: Boolean(express),
      hours: express?.[0] ?? Math.round(seed.hours / 3),
      surchargePct: express?.[1] ?? 30,
      cutoff: '14:00',
      minQty: 1,
    },
    workflow: seed.workflow,
    machines: seed.machines,
    staffSkill: seed.skill ?? 'Laundry Operator',
    consumption: (seed.consumption ?? []).map(([material, amount, unit]) => ({
      material,
      amount,
      unit,
    })),
    addOnIds: seed.addOns ?? [],
    options: seed.options ?? [],
    branches: BRANCHES.map((branch, branchIndex) => ({
      branch,
      available: offered.includes(branchIndex),
      // Akwa runs a slightly higher rate on weight-priced services
      priceOverride:
        branchIndex === 1 && seed.model === 'kg' ? Math.round(seed.price * 1.1) : null,
    })),
    visibility: seed.status === 'draft' ? 'hidden' : 'visible',
    availableDays: 'Monday–Saturday',
    availableHours: '08:00–18:00',
    dailyCapacity: seed.capacity?.[0] ?? null,
    currentLoad: seed.capacity?.[1] ?? 0,
    capacityUnit: seed.capacity?.[2] ?? '',
    includes: seed.includes ?? [],
    stats: {
      orders: seed.orders,
      revenue: seed.revenue,
      growthPct: seed.growth,
      avgHours: live ? Math.round(seed.hours * 0.89 * 10) / 10 : 0,
      satisfaction: live ? 90 + Math.round(noise(index, 1) * 8) : 0,
      qualityPass: live ? 95 + Math.round(noise(index, 2) * 40) / 10 : 0,
      reprocessRate: live ? 1 + Math.round(noise(index, 3) * 20) / 10 : 0,
      lateRate: live ? 2 + Math.round(noise(index, 4) * 30) / 10 : 0,
      complaints: live ? Math.round(noise(index, 5) * 6) : 0,
    },
    monthlyOrders: spread(seed.orders, index + 1),
    monthlyRevenue: spread(seed.revenue, index + 1),
    promotions:
      seed.id === 'WAF-001'
        ? [
            {
              name: 'Weekend Discount',
              type: 'Percentage discount',
              value: '10%',
              from: daysAgo(0).slice(0, 10),
              to: daysAgo(-2).slice(0, 10),
            },
          ]
        : [],
    audit: [
      ...(seed.id === 'WAF-001'
        ? [
            { at: daysAgo(4), by: 'Mary Ngono', change: 'Changed price', from: 'XAF 1,800 / kg', to: 'XAF 2,000 / kg' },
            { at: daysAgo(6), by: 'Marcus Vance', change: 'Enabled express service' },
          ]
        : []),
      ...(seed.statusReason
        ? [{ at: daysAgo(2), by: 'Marcus Vance', change: 'Changed status', from: 'Active', to: seed.status === 'inactive' ? 'Inactive' : 'Temporarily Unavailable' }]
        : []),
      { at: daysAgo(200 + index * 9), by: 'Marcus Vance', change: 'Created service' },
    ],
  }
}

export const SAMPLE_SERVICES: LaundryService[] = SEEDS.map(buildService)
