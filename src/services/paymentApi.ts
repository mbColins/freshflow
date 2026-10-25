import type { ApiResponse } from '../types/api'
import type {
  CashSession,
  PayMethod,
  PaymentException,
  Receivable,
  Refund,
  RefundStatus,
  Transaction,
  TxnStatus,
} from '../types/payment'
import { api } from './api'

// ---------- Server shapes ----------

type RawRef = { uuid?: string; name?: string | null; phone?: string | null } | null
type Money = number | string | null | undefined

type RawRefund = {
  uuid?: string
  payment?: string
  paymentCode?: string
  order?: string
  amount?: Money
  reason?: string | null
  method?: string | null
  status?: string | null
  requestedBy?: string | null
  approvedBy?: string | null
  createdAt?: string | null
}

type RawPayment = {
  uuid?: string
  code?: string
  receipt?: string | null
  at?: string | null
  order?: string
  customer?: RawRef
  branch?: RawRef
  amount?: Money
  fee?: Money
  method?: string | null
  provider?: string | null
  reference?: string | null
  status?: string | null
  cashier?: string | null
  refunded?: Money
  reconciled?: boolean
  reviewReason?: string | null
  failureReason?: string | null
  timeline?: { at?: string; text?: string }[] | null
  refunds?: RawRefund[] | null
}

type RawException = {
  uuid?: string
  payment?: string
  paymentCode?: string
  order?: string
  severity?: string | null
  reason?: string | null
  assignee?: RawRef
  resolved?: boolean
}

type RawReceivable = {
  order?: string
  customer?: RawRef
  total?: Money
  paid?: Money
  dueAt?: string | null
  lastReminderAt?: string | null
}

type RawSession = {
  uuid?: string
  register?: string | null
  cashier?: string | null
  open?: boolean
  openedAt?: string | null
  openingFloat?: Money
  cashPayments?: Money
  cashRefunds?: Money
  adjustmentsTotal?: Money
  expected?: Money
  closedAt?: string | null
  counted?: Money
  varianceReason?: string | null
  adjustments?: { amount?: Money; reason?: string | null; by?: string | null; at?: string | null }[] | null
}

// BigDecimal may arrive as a number or a string
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

// ---------- Mapping ----------

const METHOD_FROM_SERVER: Record<string, PayMethod> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
  ACCOUNT_CREDIT: 'Account Credit',
  OTHER: 'Other',
}

export const METHOD_TO_SERVER: Record<PayMethod, string> = {
  Cash: 'CASH',
  'Mobile Money': 'MOBILE_MONEY',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
  'Account Credit': 'ACCOUNT_CREDIT',
  Other: 'OTHER',
}

const STATUS_FROM_SERVER: Record<string, TxnStatus> = {
  COMPLETED: 'completed',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partialRefund',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
}

const REFUND_STATUS: Record<string, RefundStatus> = {
  PENDING_APPROVAL: 'Pending Approval',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
}

const toMethod = (value: string | null | undefined): PayMethod => METHOD_FROM_SERVER[value ?? ''] ?? 'Other'

function toTransaction(raw: RawPayment): Transaction[] {
  if (!raw?.uuid) return []
  return [
    {
      // The payment's code (TXN-…) is what people read; the uuid is what the API wants
      id: raw.code ?? raw.uuid,
      uuid: raw.uuid,
      receipt: raw.receipt ?? '',
      at: raw.at ?? '',
      orderId: raw.order ?? '',
      customer: raw.customer?.name ?? '',
      phone: raw.customer?.phone ?? '',
      branch: raw.branch?.name ?? '',
      amount: toAmount(raw.amount),
      fee: toAmount(raw.fee),
      method: toMethod(raw.method),
      provider: raw.provider ?? '',
      reference: raw.reference ?? '',
      status: STATUS_FROM_SERVER[raw.status ?? ''] ?? 'pending',
      cashier: raw.cashier ?? '',
      refunded: toAmount(raw.refunded),
      reconciled: raw.reconciled === true,
      reviewReason: raw.reviewReason ?? '',
      failureReason: raw.failureReason ?? '',
      timeline: (raw.timeline ?? []).map((entry) => ({ at: entry.at ?? '', text: entry.text ?? '' })),
    },
  ]
}

// A refund doesn't carry the customer or the original amount, so they come
// from the payment it was made on, when that payment is in the list
function toRefunds(items: unknown, payments: Transaction[]): Refund[] {
  return (Array.isArray(items) ? (items as RawRefund[]) : []).flatMap((raw) => {
    if (!raw?.uuid) return []
    const payment = payments.find(({ uuid }) => uuid === raw.payment)
    return [
      {
        id: raw.uuid,
        txnId: raw.paymentCode ?? '',
        customer: payment?.customer ?? '',
        orderId: raw.order ?? '',
        original: payment?.amount ?? 0,
        amount: toAmount(raw.amount),
        reason: raw.reason ?? '',
        method: toMethod(raw.method),
        at: raw.createdAt ?? '',
        requestedBy: raw.requestedBy ?? '',
        approvedBy: raw.approvedBy ?? '',
        status: REFUND_STATUS[raw.status ?? ''] ?? 'Pending Approval',
      },
    ]
  })
}

function toSession(raw: RawSession | null | undefined): CashSession | null {
  if (!raw?.uuid) return null
  return {
    uuid: raw.uuid,
    cashier: raw.cashier ?? '',
    register: raw.register ?? '',
    openedAt: raw.openedAt ?? '',
    opening: toAmount(raw.openingFloat),
    adjustments: (raw.adjustments ?? []).map((item) => ({
      at: item.at ?? '',
      amount: toAmount(item.amount),
      reason: item.reason ?? '',
      by: item.by ?? '',
    })),
    closedAt: raw.closedAt ?? null,
    counted: raw.closedAt ? toAmount(raw.counted) : null,
    varianceReason: raw.varianceReason ?? '',
    totals: {
      cashPayments: toAmount(raw.cashPayments),
      cashRefunds: toAmount(raw.cashRefunds),
      adjustments: toAmount(raw.adjustmentsTotal),
      expected: toAmount(raw.expected),
    },
  }
}

// ---------- Requests ----------

// RecordPaymentRequest. Digital methods need a provider and a reference; cash
// needs an open cash session
export type RecordPaymentBody = {
  // Order number
  order: string
  amount: number
  method: string
  provider?: string
  reference?: string
  // Cash only, for the change
  cashReceived?: number
}

export type PaymentListParams = {
  search?: string
  status?: string
  method?: string
  cashier?: string
  minAmount?: number
  from?: string
  to?: string
  branch?: string
  // DIGITAL, NEEDS_REVIEW or UNRECONCILED
  view?: string
  customer?: string
  order?: string
  page?: number
  size?: number
}

export type PaymentProvider = {
  provider: string
  method: PayMethod
  enabled: boolean
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN'
  feePercent: number
}

export type PaymentSummary = {
  currency: string
  collected: number
  transactions: number
  pending: number
  failed: number
  refunded: number
  needsReview: number
  unreconciled: number
  outstanding: { amount: number; orders: number }
  byMethod: { method: PayMethod; amount: number; count: number }[]
  series: { date: string; amount: number }[]
  byBranch: { branch: string; collected: number; outstanding: number }[]
}

export type Receipt = {
  receipt: string
  code: string
  at: string
  businessName: string
  slogan: string
  logo: string | null
  currency: string
  branchName: string
  branchAddress: string
  phone: string
  order: string
  customer: string
  lines: { description: string; quantity: number; unitPrice: number; total: number }[]
  subtotal: number
  discount: number
  surcharge: number
  tax: number
  deliveryFee: number
  total: number
  amount: number
  method: PayMethod
  provider: string
  reference: string
  cashReceived: number | null
  change: number | null
  balanceAfter: number
  cashier: string
}

export type ReminderResult = { status: string; message: string }

type Page<T> = { data?: T[]; totalElements?: number }

const TAGS = {
  payments: { type: 'Payment' as const, id: 'LIST' },
  refunds: { type: 'Payment' as const, id: 'REFUNDS' },
  exceptions: { type: 'Payment' as const, id: 'EXCEPTIONS' },
  receivables: { type: 'Payment' as const, id: 'RECEIVABLES' },
  session: { type: 'Payment' as const, id: 'SESSION' },
  summary: { type: 'Payment' as const, id: 'SUMMARY' },
  providers: { type: 'Payment' as const, id: 'PROVIDERS' },
}

// Anything that moves money changes most of what the page shows
const MONEY_MOVED = [
  TAGS.payments,
  TAGS.refunds,
  TAGS.exceptions,
  TAGS.receivables,
  TAGS.session,
  TAGS.summary,
  { type: 'Payment' as const, id: 'REVENUE' },
  { type: 'Order' as const, id: 'LIST' },
]

export const paymentApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a platform admin sees everything, a business
    // owner their tenant's, anyone else their branch
    listPayments: build.query<{ items: Transaction[]; total: number }, PaymentListParams | void>({
      query: (params) => ({ url: '/payments', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<Page<RawPayment>>) => {
        const items = (response.content?.data ?? []).flatMap(toTransaction)
        return { items, total: response.content?.totalElements ?? items.length }
      },
      providesTags: [TAGS.payments],
    }),
    getPayment: build.query<Transaction | undefined, string>({
      query: (uuid) => `/payments/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<RawPayment>) => toTransaction(response.content)[0],
      providesTags: [TAGS.payments],
    }),
    // 409 no_open_cash_session for cash, duplicate_reference and
    // provider_unavailable for digital methods, amount_exceeds_balance
    recordPayment: build.mutation<Transaction | undefined, RecordPaymentBody>({
      query: (body) => ({ url: '/payments', method: 'POST', body }),
      transformResponse: (response: ApiResponse<RawPayment>) => toTransaction(response.content)[0],
      invalidatesTags: MONEY_MOVED,
    }),
    getPaymentSummary: build.query<PaymentSummary, { from?: string; to?: string; branch?: string } | void>({
      query: (params) => ({ url: '/payments/summary', params: params ?? undefined }),
      transformResponse: (
        response: ApiResponse<{
          currency?: string
          collected?: Money
          transactions?: number
          pending?: number
          failed?: number
          refunded?: Money
          needsReview?: number
          unreconciled?: number
          outstanding?: { amount?: Money; orders?: number }
          byMethod?: { method?: string; amount?: Money; count?: number }[]
          series?: { date?: string; amount?: Money }[]
          byBranch?: { branch?: RawRef; collected?: Money; outstanding?: Money }[]
        }>,
      ) => {
        const raw = response.content ?? {}
        return {
          currency: raw.currency ?? 'XAF',
          collected: toAmount(raw.collected),
          transactions: raw.transactions ?? 0,
          pending: raw.pending ?? 0,
          failed: raw.failed ?? 0,
          refunded: toAmount(raw.refunded),
          needsReview: raw.needsReview ?? 0,
          unreconciled: raw.unreconciled ?? 0,
          outstanding: { amount: toAmount(raw.outstanding?.amount), orders: raw.outstanding?.orders ?? 0 },
          byMethod: (raw.byMethod ?? []).map((item) => ({ method: toMethod(item.method), amount: toAmount(item.amount), count: item.count ?? 0 })),
          series: (raw.series ?? []).map((item) => ({ date: item.date ?? '', amount: toAmount(item.amount) })),
          byBranch: (raw.byBranch ?? []).map((item) => ({
            branch: item.branch?.name ?? '',
            collected: toAmount(item.collected),
            outstanding: toAmount(item.outstanding),
          })),
        }
      },
      providesTags: [TAGS.summary],
    }),
    // Needs `payment` uuids; the single and bulk forms mark digital payments reconciled
    reconcilePayments: build.mutation<void, string[]>({
      query: (payments) => ({ url: '/payments/reconcile', method: 'POST', body: { payments } }),
      transformResponse: () => undefined,
      invalidatesTags: [TAGS.payments, TAGS.summary, TAGS.exceptions],
    }),
    getReceipt: build.query<Receipt, string>({
      query: (uuid) => `/payments/${encodeURIComponent(uuid)}/receipt`,
      transformResponse: (
        response: ApiResponse<Record<string, unknown> & { lines?: { description?: string; quantity?: number; unitPrice?: Money; total?: Money }[] }>,
      ): Receipt => {
        const raw = response.content ?? {}
        const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
        return {
          receipt: text('receipt'),
          code: text('code'),
          at: text('at'),
          businessName: text('businessName'),
          slogan: text('slogan'),
          logo: typeof raw.logo === 'string' ? raw.logo : null,
          currency: text('currency') || 'XAF',
          branchName: text('branchName'),
          branchAddress: text('branchAddress'),
          phone: text('phone'),
          order: text('order'),
          customer: text('customer'),
          lines: (raw.lines ?? []).map((line) => ({
            description: line.description ?? '',
            quantity: line.quantity ?? 0,
            unitPrice: toAmount(line.unitPrice),
            total: toAmount(line.total),
          })),
          subtotal: toAmount(raw.subtotal),
          discount: toAmount(raw.discount),
          surcharge: toAmount(raw.surcharge),
          tax: toAmount(raw.tax),
          deliveryFee: toAmount(raw.deliveryFee),
          total: toAmount(raw.total),
          amount: toAmount(raw.amount),
          method: toMethod(text('method')),
          provider: text('provider'),
          reference: text('reference'),
          cashReceived: raw.cashReceived == null ? null : toAmount(raw.cashReceived),
          change: raw.change == null ? null : toAmount(raw.change),
          balanceAfter: toAmount(raw.balanceAfter),
          cashier: text('cashier'),
        }
      },
    }),

    // ----- Refunds -----
    listRefunds: build.query<Refund[], { status?: string; branch?: string; page?: number; size?: number } | void>({
      query: (params) => ({ url: '/payments/refunds', params: params ?? undefined }),
      // Customers and original amounts are filled in from the payments by the caller
      transformResponse: (response: ApiResponse<Page<RawRefund>>) => toRefunds(response.content?.data, []),
      providesTags: [TAGS.refunds],
    }),
    // 409 payment_not_refundable, refund_exceeds_payment. The reply says
    // whether it is already COMPLETED or waits for approval
    requestRefund: build.mutation<Refund | undefined, { payment: string; amount: number; reason: string }>({
      query: ({ payment, ...body }) => ({ url: `/payments/${encodeURIComponent(payment)}/refunds`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<RawRefund>) => toRefunds([response.content], [])[0],
      invalidatesTags: MONEY_MOVED,
    }),
    // 409 cannot_approve_own_refund, refund_already_decided
    decideRefund: build.mutation<void, { id: string; approve: boolean; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/payments/refunds/${encodeURIComponent(id)}/decision`, method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: MONEY_MOVED,
    }),

    // ----- Exceptions -----
    listPaymentExceptions: build.query<PaymentException[], { resolved?: boolean; page?: number; size?: number } | void>({
      query: (params) => ({ url: '/payments/exceptions', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<Page<RawException>>) =>
        (response.content?.data ?? []).flatMap((raw) =>
          raw?.uuid
            ? [
                {
                  id: raw.uuid,
                  severity: raw.severity === 'CRITICAL' ? ('critical' as const) : ('warning' as const),
                  txnId: raw.paymentCode ?? '',
                  customer: '',
                  amount: 0,
                  reason: raw.reason ?? '',
                  assignee: raw.assignee?.name ?? '',
                  resolved: raw.resolved === true,
                },
              ]
            : [],
        ),
      providesTags: [TAGS.exceptions],
    }),
    // `resolution` is required when resolving
    updatePaymentException: build.mutation<
      void,
      { id: string; assignee?: string; resolved?: boolean; resolution?: string; reconcile?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `/payments/exceptions/${encodeURIComponent(id)}`, method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: [TAGS.exceptions, TAGS.payments, TAGS.summary],
    }),

    // ----- Receivables -----
    listReceivables: build.query<Receivable[], { search?: string; overdue?: boolean; page?: number; size?: number } | void>({
      query: (params) => ({ url: '/payments/receivables', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<Page<RawReceivable>>) =>
        (response.content?.data ?? []).flatMap((raw) =>
          raw?.order
            ? [
                {
                  id: raw.order,
                  customer: raw.customer?.name ?? '',
                  phone: raw.customer?.phone ?? '',
                  orderId: raw.order,
                  total: toAmount(raw.total),
                  paid: toAmount(raw.paid),
                  dueAt: raw.dueAt ?? '',
                  lastReminderAt: raw.lastReminderAt ?? null,
                },
              ]
            : [],
        ),
      providesTags: [TAGS.receivables],
    }),
    // 422 customer_not_reachable when the customer has no contact for the channel
    sendPaymentReminder: build.mutation<
      ReminderResult,
      { order: string; channel: string; scheduledFor?: string; message?: string }
    >({
      query: ({ order, ...body }) => ({ url: `/payments/receivables/${encodeURIComponent(order)}/reminder`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<{ status?: string } | null>) => ({
        status: response.content?.status ?? '',
        message: response.message,
      }),
      invalidatesTags: [TAGS.receivables],
    }),

    // ----- Providers -----
    listPaymentProviders: build.query<PaymentProvider[], string | void>({
      query: (branch) => ({ url: '/payment-providers', params: branch ? { branch } : undefined }),
      transformResponse: (
        response: ApiResponse<{ provider?: string; method?: string; enabled?: boolean; status?: string; feePercent?: Money }[]>,
      ) =>
        (Array.isArray(response.content) ? response.content : []).flatMap((raw) =>
          raw.provider
            ? [
                {
                  provider: raw.provider,
                  method: toMethod(raw.method),
                  enabled: raw.enabled === true,
                  status: (raw.status ?? 'OPERATIONAL') as PaymentProvider['status'],
                  feePercent: toAmount(raw.feePercent),
                },
              ]
            : [],
        ),
      providesTags: [TAGS.providers],
    }),
    // Replaces the branch's providers. Owner or manager
    setPaymentProviders: build.mutation<void, { branch?: string; providers: { provider: string; method: string; enabled: boolean; status?: string; feePercent: number }[] }>({
      query: (body) => ({ url: '/payment-providers', method: 'PUT', body }),
      transformResponse: () => undefined,
      invalidatesTags: [TAGS.providers],
    }),

    // ----- Cash register -----
    // Null when the caller has no open session
    getCurrentCashSession: build.query<CashSession | null, void>({
      query: () => '/cash-sessions/current',
      transformResponse: (response: ApiResponse<RawSession | null>) => toSession(response.content),
      providesTags: [TAGS.session],
    }),
    openCashSession: build.mutation<CashSession | null, { branch?: string; register: string; openingFloat: number }>({
      query: (body) => ({ url: '/cash-sessions', method: 'POST', body }),
      transformResponse: (response: ApiResponse<RawSession>) => toSession(response.content),
      invalidatesTags: [TAGS.session],
    }),
    // Signed: negative takes cash out of the till
    adjustCashSession: build.mutation<void, { id: string; amount: number; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/cash-sessions/${encodeURIComponent(id)}/adjustments`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [TAGS.session],
    }),
    closeCashSession: build.mutation<CashSession | null, { id: string; counted: number; varianceReason?: string }>({
      query: ({ id, ...body }) => ({ url: `/cash-sessions/${encodeURIComponent(id)}/close`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<RawSession>) => toSession(response.content),
      invalidatesTags: [TAGS.session, TAGS.exceptions],
    }),
  }),
})

export const {
  useListPaymentsQuery,
  useGetPaymentQuery,
  useRecordPaymentMutation,
  useGetPaymentSummaryQuery,
  useReconcilePaymentsMutation,
  useGetReceiptQuery,
  useListRefundsQuery,
  useRequestRefundMutation,
  useDecideRefundMutation,
  useListPaymentExceptionsQuery,
  useUpdatePaymentExceptionMutation,
  useListReceivablesQuery,
  useSendPaymentReminderMutation,
  useListPaymentProvidersQuery,
  useSetPaymentProvidersMutation,
  useGetCurrentCashSessionQuery,
  useOpenCashSessionMutation,
  useAdjustCashSessionMutation,
  useCloseCashSessionMutation,
} = paymentApi
