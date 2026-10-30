import type { ApiResponse } from '../types/api'
import type { Receivable } from '../types/payment'
import { api } from './api'

// Orders that are not cancelled and either still open or not fully paid
// (GET /order/pending-unpaid). The record-payment form picks one of these.

// One entry of the dropdown list
type RawOrderOption = {
  uuid?: string
  orderNumber?: string
  customerName?: string | null
  totalPrice?: number | string | null
  // What is still owed
  balance?: number | string | null
  status?: string | null
  paymentStatus?: string | null
}

// BigDecimal may arrive as a number or a string
const amount = (value: unknown) => {
  const number = typeof value === 'string' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : 0
}

export type PendingUnpaidParams = {
  // PENDING: still open. UNPAID: not fully paid, completed orders included
  type?: 'PENDING' | 'UNPAID'
  // Order number or customer name
  search?: string
  // Default 50, at most 100
  limit?: number
}

export const pendingOrdersApi = api.injectEndpoints({
  endpoints: (build) => ({
    // A plain array, oldest first, scoped like the order list. Shaped as
    // receivables so the payment form works with one kind of row
    listPendingUnpaidOrders: build.query<Receivable[], PendingUnpaidParams | void>({
      query: (params) => ({ url: '/order/pending-unpaid', params: { limit: 100, ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<RawOrderOption[] | null>) =>
        (Array.isArray(response.content) ? response.content : []).flatMap((raw) => {
          if (!raw?.orderNumber) return []
          const total = amount(raw.totalPrice)
          return [
            {
              id: raw.orderNumber,
              customer: raw.customerName ?? '',
              // The list doesn't carry the phone number
              phone: '',
              orderId: raw.orderNumber,
              total,
              paid: Math.max(0, total - amount(raw.balance)),
              dueAt: '',
              lastReminderAt: null,
            },
          ]
        }),
      // A payment changes what is owed; a new or changed order changes the list
      providesTags: [
        { type: 'Order', id: 'LIST' },
        { type: 'Payment', id: 'RECEIVABLES' },
      ],
    }),
  }),
})

export const { useListPendingUnpaidOrdersQuery } = pendingOrdersApi
