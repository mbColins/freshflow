// The app areas a plan can switch on (backend `Modules` enum)
// TODO: confirm the Modules enum values with the backend
export type PlatformModule =
  | 'ORDERS'
  | 'CUSTOMERS'
  | 'SERVICES'
  | 'OPERATIONS'
  | 'PICKUP_DELIVERY'
  | 'PAYMENTS'
  | 'INVENTORY'
  | 'STAFF'
  | 'MACHINES'
  | 'PROMOTIONS'
  | 'CUSTOMER_SUBSCRIPTIONS'
  | 'REPORTS'
  | 'NOTIFICATIONS'

// A plan tenants subscribe to. Field names follow SubscriptionPlanRequest,
// so this is also the create / update body.
export type PlatformPlan = {
  // Unique and fixed once created, e.g. "SOLO"; tenants refer to it
  code: string
  name: string
  monthlyPrice: number
  // null = billed monthly only
  annualPrice: number | null
  // null = unlimited
  maxShops: number | null
  maxStaff: number | null
  maxOrdersPerMonth: number | null
  // 0 = no trial
  trialPeriodDays: number
  enabledFeatures: PlatformModule[]
  // Inactive plans can't be picked for new tenants; current subscribers keep them
  active: boolean
}
