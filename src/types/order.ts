export type OrderStatus =
  | 'received'
  | 'washing'
  | 'drying'
  | 'ironing'
  | 'qa'
  | 'ready'
  | 'handover'
  | 'completed'
  | 'cancelled'

export type Priority = 'normal' | 'high' | 'express'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PaymentMethod = 'Cash' | 'Mobile Money' | 'Card' | 'Bank Transfer'
export type FulfilmentMethod = 'pickup' | 'delivery'
export type CustomerType = 'new' | 'returning' | 'corporate'
export type OrderRole = 'admin' | 'manager' | 'receptionist' | 'staff'

export type Customer = {
  name: string
  phone: string
  email: string
  type: CustomerType
  since: string
  orders: number
  spent: number
}

export type OrderItem = {
  name: string
  qty: number
  service: string
  unitPrice: number
  tag: string
  condition: string
  notes?: string
}

export type Payment = {
  at: string
  amount: number
  method: PaymentMethod
  reference: string
  by: string
}

export type TimelineEntry = {
  at: string
  action: string
  by: string
  note?: string
}

export type QualityCheck = {
  checks: Record<string, boolean>
  result: 'pending' | 'passed' | 'failed'
  reason?: string
}

export type Order = {
  id: string
  invoice: string
  customer: Customer
  items: OrderItem[]
  status: OrderStatus
  priority: Priority
  createdAt: string
  dueAt: string
  completedAt?: string
  branch: string
  createdBy: string
  assignedTo: string
  method: FulfilmentMethod
  address?: string
  driver?: string
  surcharge: number
  discount: number
  tax: number
  deliveryFee: number
  payments: Payment[]
  customerNotes: string
  staffNotes: string
  handling: string
  qc: QualityCheck
  timeline: TimelineEntry[]
}

export type DueFilter = '' | 'overdue' | 'today' | 'tomorrow' | 'week'
export type OrderGroup = '' | 'processing' | 'awaitingPickup' | 'overdue' | 'unpaid'

export type OrderFilters = {
  query: string
  status: OrderStatus | ''
  group: OrderGroup
  payment: PaymentStatus | ''
  service: string
  staff: string
  branch: string
  method: FulfilmentMethod | ''
  priority: Priority | ''
  due: DueFilter
  customerType: CustomerType | ''
  minAmount: string
  maxAmount: string
}

export type SavedView = {
  name: string
  filters: OrderFilters
}
