export type PromotionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'archived'

// What is stored; scheduled, active and expired follow from the dates and limits
export type PromotionState = 'draft' | 'published' | 'paused' | 'archived'

export type PromotionType =
  | 'percentage'
  | 'fixed'
  | 'freeDelivery'
  | 'firstOrder'
  | 'loyalty'
  | 'referral'
  | 'bundle'
  | 'volume'
  | 'seasonal'

export type DiscountKind = 'percent' | 'amount' | 'freeDelivery' | 'tiered'

export type Audience =
  | 'all'
  | 'new'
  | 'loyalty'
  | 'vip'
  | 'corporate'
  | 'referred'
  | 'specific'

export type SpendTier = { minSpend: number; percent: number }

export type PromotionStats = {
  uses: number
  revenue: number
  discount: number
  // Customers the offer was shown or sent to
  reach: number
}

export type PromotionEvent = { at: string; user: string; text: string }

// Everything entered in the campaign builder
export type PromotionDraft = {
  id: string
  name: string
  // Empty when the promotion applies automatically
  code: string
  automatic: boolean
  description: string
  notes: string
  banner: string
  type: PromotionType
  discountKind: DiscountKind
  // Percent or XAF, depending on the discount kind
  value: number
  maxDiscount: number | null
  tiers: SpendTier[]
  bundleNote: string
  audience: Audience
  customers: string
  // Branch codes; empty means every branch
  branches: string[]
  // Service names; empty means the whole order
  services: string[]
  minOrder: number
  stackable: boolean
  // YYYY-MM-DD; a null end date means no expiry
  startAt: string
  endAt: string | null
  // 0 = Monday; empty means every day
  days: number[]
  usageLimit: number | null
  perCustomerLimit: number | null
  budget: number | null
  channels: string[]
  state: PromotionState
}

export type Promotion = PromotionDraft & {
  stats: PromotionStats
  previous: PromotionStats
  history: PromotionEvent[]
  createdBy: string
  createdAt: string
}

export type PromotionDateFilter = '' | 'today' | 'week' | 'month' | 'custom'

export type PromotionFilters = {
  query: string
  status: PromotionStatus | ''
  type: PromotionType | ''
  branch: string
  service: string
  audience: Audience | ''
  date: PromotionDateFilter
  from: string
  to: string
}

export type StackingPolicy = {
  mode: 'none' | 'withDelivery' | 'all'
  // Highest combined discount as a share of the order
  maxCombined: number
}
