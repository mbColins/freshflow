import type { FulfilmentMethod, PaymentMethod } from './order'

export type CustomerStatus = 'active' | 'inactive' | 'new' | 'vip' | 'suspended'
export type CustomerKind = 'individual' | 'corporate'
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type Channel = 'SMS' | 'WhatsApp' | 'Email' | 'Call'

export type Address = {
  id: string
  label: string
  street: string
  city: string
  region: string
  landmark: string
  instructions: string
  isDefault: boolean
}

export type CustomerNote = {
  id: string
  text: string
  by: string
  at: string
}

export type Communication = {
  at: string
  channel: Channel
  message: string
  status: string
}

export type CustomerPayment = {
  id: string
  at: string
  order: string
  amount: number
  method: PaymentMethod
  reference: string
  status: string
  by: string
}

export type ActivityEntry = {
  at: string
  text: string
}

export type LaundryPrefs = {
  detergent: string
  softener: string
  folding: string
  packaging: string
  ironing: boolean
  instructions: string
}

export type DeliveryPrefs = {
  method: FulfilmentMethod
  window: string
  instructions: string
}

export type CorporateProfile = {
  contact: string
  taxId: string
  billingAddress: string
  terms: string
  creditLimit: number
  contract: string
}

export type Consent = {
  sms: boolean
  email: boolean
  whatsapp: boolean
  marketing: boolean
}

export type CrmCustomer = {
  id: string
  name: string
  kind: CustomerKind
  phone: string
  email: string
  status: CustomerStatus
  points: number
  branch: string
  registeredAt: string
  lastOrderAt: string | null
  orders: number
  spent: number
  outstanding: number
  outstandingOrders: number
  preferredService: string
  // Typical days between orders, used for the retention indicator
  cadenceDays: number
  tags: string[]
  addresses: Address[]
  laundry: LaundryPrefs
  delivery: DeliveryPrefs
  notes: CustomerNote[]
  communications: Communication[]
  payments: CustomerPayment[]
  activity: ActivityEntry[]
  // Last 12 months, oldest first
  monthlyOrders: number[]
  monthlySpend: number[]
  consent: Consent
  corporate?: CorporateProfile
  archived: boolean
}

export type SegmentId =
  | 'new'
  | 'active'
  | 'returning'
  | 'frequent'
  | 'vip'
  | 'inactive'
  | 'highSpenders'
  | 'delivery'
  | 'corporate'
  | 'balance'

export type CustomerFilters = {
  query: string
  segment: SegmentId | ''
  status: CustomerStatus | ''
  kind: CustomerKind | ''
  branch: string
  tier: LoyaltyTier | ''
  lastOrder: '' | '30' | '90' | 'older'
  registered: '' | '30' | '365' | 'older'
  minOrders: string
  minSpent: string
  balance: '' | 'yes' | 'no'
  service: string
  method: FulfilmentMethod | ''
  tag: string
}

export type CustomSegment = {
  name: string
  filters: CustomerFilters
}
