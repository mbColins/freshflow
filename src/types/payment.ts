export type PayMethod =
  | 'Cash'
  | 'Mobile Money'
  | 'Card'
  | 'Bank Transfer'
  | 'Account Credit'

export type TxnStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'partialRefund'
  | 'cancelled'
  | 'reversed'

export type RefundStatus = 'Pending Approval' | 'Completed' | 'Rejected'

export type Transaction = {
  id: string
  receipt: string
  at: string
  orderId: string
  customer: string
  phone: string
  branch: string
  amount: number
  // Provider processing fee taken out of the amount
  fee: number
  method: PayMethod
  // Empty for cash and account credit
  provider: string
  reference: string
  status: TxnStatus
  cashier: string
  refunded: number
  reconciled: boolean
  // Set when the transaction needs a human look
  reviewReason: string
  failureReason: string
  timeline: { at: string; text: string }[]
}

export type Receivable = {
  id: string
  customer: string
  phone: string
  orderId: string
  total: number
  paid: number
  dueAt: string
  lastReminderAt: string | null
}

export type Refund = {
  id: string
  txnId: string
  customer: string
  orderId: string
  original: number
  amount: number
  reason: string
  method: PayMethod
  at: string
  requestedBy: string
  approvedBy: string
  status: RefundStatus
}

export type PaymentException = {
  id: string
  severity: 'critical' | 'warning'
  txnId: string
  customer: string
  amount: number
  reason: string
  assignee: string
  resolved: boolean
}

export type CashSession = {
  cashier: string
  register: string
  openedAt: string
  opening: number
  adjustments: { at: string; amount: number; reason: string; by: string }[]
  // Set when the session is counted and closed
  closedAt: string | null
  counted: number | null
  varianceReason: string
}

export type AuditEntry = {
  at: string
  user: string
  action: string
  from?: string
  to?: string
}

export type PaymentFilters = {
  query: string
  status: TxnStatus | ''
  method: PayMethod | ''
  cashier: string
  minAmount: string
  // Quick views from the KPI cards
  view: '' | 'digital' | 'review' | 'unreconciled'
}
