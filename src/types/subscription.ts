export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type PlanStatus = 'active' | 'draft' | 'archived'
export type AllowanceUnit = 'kg' | 'items' | 'orders'

// A recurring laundry plan customers subscribe to, e.g. 30 kg a month
export type SubscriptionPlan = {
  // e.g. PLN-001
  id: string
  name: string
  description: string
  status: PlanStatus
  price: number
  cycle: BillingCycle
  // Per billing cycle; null = unlimited
  allowance: number | null
  allowanceUnit: AllowanceUnit
  // Charged per unit used beyond the allowance
  overageRate: number
  // Unused allowance carries over to the next cycle
  rollover: boolean
  // Service codes the allowance covers
  serviceIds: string[]
  // Free pickup & delivery trips per cycle
  freePickups: number
  // Percent off services outside the plan
  extrasDiscountPct: number
  // Empty = every branch
  branches: string[]
  trialDays: number
  // Billing cycles the customer commits to; 0 = cancel anytime
  minCycles: number
  setupFee: number
  autoRenew: boolean
  // Shown as "Most popular" to customers
  featured: boolean
  subscribers: number
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export type PlanFilters = {
  query: string
  status: PlanStatus | ''
  cycle: BillingCycle | ''
}
