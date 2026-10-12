// From this quantity upward, the unit price is `price`; below the first tier the base price applies
export type PriceTier = { from: number; price: number }

export type CustomerGroup = {
  id: string
  name: string
  // Percent off the service subtotal
  discountPct: number
  note: string
}

export type Surcharge = {
  id: string
  name: string
  kind: 'percent' | 'fixed'
  value: number
  when: string
  enabled: boolean
}

export type DeliveryZone = {
  id: string
  name: string
  distance: string
  deliveryFee: number
  pickupFee: number
  minOrder: number
}

export type Tax = {
  id: string
  name: string
  rate: number
  appliesTo: string
  enabled: boolean
}

export type PricingConfig = {
  groups: CustomerGroup[]
  surcharges: Surcharge[]
  zones: DeliveryZone[]
  taxes: Tax[]
  // Orders at or above this subtotal are delivered free; 0 turns it off
  freeDeliveryAbove: number
  // Service code → quantity tiers
  tiers: Record<string, PriceTier[]>
}

export type PriceChange = {
  id: string
  at: string
  serviceId: string
  serviceName: string
  // A branch name, or "Global"
  scope: string
  from: number
  to: number
  by: string
  reason: string
}

export type ScheduledChange = {
  id: string
  serviceId: string
  newPrice: number
  // YYYY-MM-DD
  effectiveAt: string
  reason: string
  by: string
}

export type PricingFilters = {
  query: string
  category: string
  branch: string
  model: string
  status: string
}

export type Speed = 'standard' | 'express' | 'sameDay'

export type QuoteInput = {
  serviceId: string
  // Index into the service's item list, for item-specific services
  itemIndex: number
  quantity: number
  groupId: string
  speed: Speed
  branch: string
  zoneId: string
  surchargeIds: string[]
}

export type QuoteLine = {
  label: string
  amount: number
  kind: 'base' | 'discount' | 'surcharge' | 'delivery' | 'tax'
  note?: string
}

export type BulkAdjustment = {
  category: string
  direction: 'increase' | 'decrease'
  kind: 'percent' | 'fixed'
  value: number
  // Round new prices to the nearest multiple; 1 keeps them exact
  roundTo: number
  includeOverrides: boolean
  reason: string
}
