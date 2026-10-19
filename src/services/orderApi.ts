import type { ApiResponse } from '../types/api'
import type { Order } from '../types/order'
import { orderFromApi } from '../utils/orderMapping'
import type { ApiPaymentMethod, OrderRequest, OrderResponse } from '../utils/orderMapping'
import { api } from './api'

export type OrderListParams = {
  filter?: string
  search?: string
  // UPPER_SNAKE_CASE enum values
  status?: string
  paymentStatus?: string
  priority?: string
  branchId?: string
  customerId?: string
  // YYYY-MM-DD
  startDate?: string
  endDate?: string
  // Zero-based, as Spring pages are
  page?: number
  size?: number
}

export type OrderPage = { items: Order[]; total: number }

// A list in the content as a bare array, our paged shape ({ data }) or Spring's ({ content })
function pageItems(content: unknown) {
  const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
  return { items, total: page?.totalElements ?? items.length }
}

const LIST = { type: 'Order' as const, id: 'LIST' }
const orderTags = (uuid: string) => [{ type: 'Order' as const, id: uuid }, LIST]

// The order API as agreed in the backend contract (POST /order and friends).
// Every change answers with the updated order, so the cache is refreshed by tag.
// TODO: confirm the paths and response shapes once the backend implements them
export const orderApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend to the caller's tenant / branches
    listOrders: build.query<OrderPage, OrderListParams | void>({
      query: (params) => ({ url: '/order', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const { items, total } = pageItems(response.content)
        return { items: (items as OrderResponse[]).flatMap((raw) => orderFromApi(raw) ?? []), total }
      },
      providesTags: [LIST],
    }),
    // 403 when outside the caller's scope
    getOrder: build.query<Order | null, string>({
      query: (uuid) => `/order/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      providesTags: (_result, _error, uuid) => [{ type: 'Order', id: uuid }],
    }),
    // 201 with the full order: numbers, tags and totals are computed by the server
    createOrder: build.mutation<Order | null, OrderRequest>({
      query: (body) => ({ url: '/order', method: 'POST', body }),
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      // A new customer may be created along with the order
      invalidatesTags: [LIST, { type: 'Customer', id: 'LIST' }, { type: 'Customer', id: 'DROPDOWN' }],
    }),
    // Forward moves only; CANCELLED needs a note. 409 on an illegal move
    updateOrderStatus: build.mutation<void, { uuid: string; status: string; note?: string }>({
      query: ({ uuid, status, note }) => ({
        url: `/order/${encodeURIComponent(uuid)}/status`,
        method: 'PATCH',
        body: { status, note },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => orderTags(uuid),
    }),
    // Amount must not exceed the balance
    addOrderPayment: build.mutation<void, { uuid: string; amount: number; method: ApiPaymentMethod; reference: string }>({
      query: ({ uuid, ...payment }) => ({
        url: `/order/${encodeURIComponent(uuid)}/payments`,
        method: 'POST',
        body: payment,
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => orderTags(uuid),
    }),
    // Notes, handling, assignee, due date, address; before READY only
    updateOrder: build.mutation<
      void,
      {
        uuid: string
        changes: Partial<{
          customerNotes: string
          staffNotes: string
          handlingInstructions: string
          assignedToId: string | null
          dueAt: string
          deliveryAddress: string | null
        }>
      }
    >({
      query: ({ uuid, changes }) => ({ url: `/order/${encodeURIComponent(uuid)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => orderTags(uuid),
    }),
    // A reason is required when the result is FAILED
    updateOrderQc: build.mutation<
      void,
      { uuid: string; checks: Record<string, boolean>; result: 'PASSED' | 'FAILED'; reason?: string }
    >({
      query: ({ uuid, ...qc }) => ({ url: `/order/${encodeURIComponent(uuid)}/qc`, method: 'PATCH', body: qc }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => orderTags(uuid),
    }),
  }),
})

export const {
  useListOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderStatusMutation,
  useAddOrderPaymentMutation,
  useUpdateOrderMutation,
  useUpdateOrderQcMutation,
} = orderApi
