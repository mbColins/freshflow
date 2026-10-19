export type ServiceStatus = 'active' | 'inactive' | 'unavailable' | 'draft'
export type PricingModel = 'item' | 'kg' | 'piece' | 'fixed' | 'custom'
export type ServiceVisibility = 'visible' | 'hidden' | 'comingSoon'
export type PromotionType =
  | 'Percentage discount'
  | 'Fixed discount'
  | 'Buy X get Y'
  | 'Free service'
  | 'Free delivery'

export type ItemPrice = {
  item: string
  price: number
  expressPrice: number
}

export type ExpressConfig = {
  enabled: boolean
  hours: number
  surchargePct: number
  cutoff: string
  minQty: number
}

export type BranchSetting = {
  // Branch name, for display
  branch: string
  // Branch uuid from the branches API (absent on older sample data)
  branchId?: string
  available: boolean
  // null = use the global price
  priceOverride: number | null
}

export type Consumption = {
  material: string
  amount: number
  unit: string
}

export type Promotion = {
  name: string
  type: PromotionType
  value: string
  from: string
  to: string
}

export type AuditEntry = {
  at: string
  by: string
  change: string
  from?: string
  to?: string
}

export type ServiceStats = {
  orders: number
  revenue: number
  growthPct: number
  avgHours: number
  satisfaction: number
  qualityPass: number
  reprocessRate: number
  lateRate: number
  complaints: number
}

export type LaundryService = {
  // The service code, e.g. WAF-001
  id: string
  // What the API addresses the service by; absent until it's saved there
  uuid?: string
  name: string
  category: string
  description: string
  icon: string
  status: ServiceStatus
  statusReason: string
  pricingModel: PricingModel
  basePrice: number
  minQty: number
  maxQty: number | null
  itemPrices: ItemPrice[]
  standardHours: number
  express: ExpressConfig
  workflow: string[]
  machines: string[]
  staffSkill: string
  consumption: Consumption[]
  addOnIds: string[]
  options: string[]
  branches: BranchSetting[]
  visibility: ServiceVisibility
  availableDays: string
  availableHours: string
  dailyCapacity: number | null
  currentLoad: number
  capacityUnit: string
  includes: string[]
  stats: ServiceStats
  // Last 12 months, oldest first
  monthlyOrders: number[]
  monthlyRevenue: number[]
  promotions: Promotion[]
  audit: AuditEntry[]
}

export type ServiceFilters = {
  query: string
  category: string
  status: ServiceStatus | ''
  branch: string
  pricingModel: PricingModel | ''
  processing: '' | 'sameDay' | 'day' | 'longer'
  express: '' | 'yes' | 'no'
  visibility: ServiceVisibility | ''
}
