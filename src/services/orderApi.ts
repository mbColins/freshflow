import type { ApiResponse } from '../types/api'
import type { Order } from '../types/order'
import { orderFromApi } from '../utils/orderMapping'
import type { OrderRequest, OrderResponse } from '../utils/orderMapping'
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

// The fields PATCH /order/{orderNumber} reads (the backend's OrderRequest);
// send any subset, absent fields are kept. `amountPaid` is the running total
// paid so far, not one payment, and promisedDate is a local date-time without
// a time zone ("2026-10-20T14:00:00").
export type OrderPatch = Partial<{
  promisedDate: string
  deliveryOptions: 'PICKUP' | 'DROP_OFF' | 'DELIVERY' | 'HOME_DELIVERY'
  deliveryFee: number
  amountPaid: number
  paymentStatus: 'PENDING' | 'PARTIALLY_PAID' | 'COMPLETELY_PAID'
  // Backend PaymentMethod: how amountPaid was settled
  paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'OTHER'
  status: string
  notes: string
  priority: 'NORMAL' | 'HIGH' | 'EXPRESS'
  deliveryAddress: string
  customerNotes: string
  staffNotes: string
  handlingInstructions: string
}>

// POST /order/{orderNumber}/quality-check. FAILED needs a reason and the stage
// to send the order back to
export type QualityCheckBody = {
  checks: Record<string, boolean>
  result: 'PASSED' | 'FAILED'
  reason?: string
  sendBackTo?: 'WASHING' | 'IRONING'
}

// POST /order/import: nothing is created when any row is bad
export type OrderImportResult = {
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

// A list in the content as a bare array, our paged shape ({ data }) or Spring's ({ content })
function pageItems(content: unknown) {
  const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
  return { items, total: page?.totalElements ?? items.length }
}

const LIST = { type: 'Order' as const, id: 'LIST' }
const orderTags = (uuid: string) => [{ type: 'Order' as const, id: uuid }, LIST]

// The order API (POST /order and friends). A change refreshes the cache by tag
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
    // One customer's orders, newest first. 403 when the customer belongs to
    // another tenant
    listCustomerOrders: build.query<Order[], string>({
      query: (customerUuid) => `/order/customer/${encodeURIComponent(customerUuid)}`,
      transformResponse: (response: ApiResponse<unknown>) =>
        (Array.isArray(response.content) ? (response.content as OrderResponse[]) : []).flatMap(
          (raw) => orderFromApi(raw) ?? [],
        ),
      providesTags: [LIST],
    }),
    // By order number; 403 when outside the caller's scope
    getOrder: build.query<Order | null, string>({
      query: (orderNumber) => `/order/${encodeURIComponent(orderNumber)}`,
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      providesTags: (_result, _error, orderNumber) => [{ type: 'Order', id: orderNumber }],
    }),
    // 201 with the full order: numbers, tags and totals are computed by the server
    createOrder: build.mutation<Order | null, OrderRequest>({
      query: (body) => ({ url: '/order', method: 'POST', body }),
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      // A new customer may be created along with the order
      invalidatesTags: [LIST, { type: 'Customer', id: 'LIST' }, { type: 'Customer', id: 'DROPDOWN' }],
    }),
    // Status changes go through PATCH /order/{orderNumber}, not a /status
    // sub-path. The order is addressed by its order number (ORD-10421), not its
    // uuid. Only `status` is sent: the backend reads `notes`, which would
    // overwrite the order's own notes, so a cancellation reason stays on the
    // page's timeline for now.
    // The backend completes and collects orders through their own paths
    // (PATCH /{orderNumber}/complete and /collect).
    // TODO: send the cancellation reason once the backend has a field for it
    updateOrderStatus: build.mutation<void, { orderNumber: string; status: string }>({
      query: ({ orderNumber, status }) => ({
        url: `/order/${encodeURIComponent(orderNumber)}`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { orderNumber }) => orderTags(orderNumber),
    }),
    // Any other change to an order (payment, delivery, notes, due date) goes
    // through the same PATCH /order/{orderNumber}, with the fields it reads.
    // The backend keeps one amountPaid and a paymentStatus, not a list of
    // payments, so the method and reference of a payment aren't saved yet.
    updateOrder: build.mutation<void, { orderNumber: string; changes: OrderPatch }>({
      query: ({ orderNumber, changes }) => ({
        url: `/order/${encodeURIComponent(orderNumber)}`,
        method: 'PATCH',
        body: changes,
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { orderNumber }) => orderTags(orderNumber),
    }),
    // Staff uuid, or '' to clear it. 400 assignee_not_in_order_branch / assignee_not_active
    assignOrder: build.mutation<void, { orderNumber: string; assignedTo: string }>({
      query: ({ orderNumber, assignedTo }) => ({
        url: `/order/${encodeURIComponent(orderNumber)}/assign`,
        method: 'PATCH',
        body: { assignedTo },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { orderNumber }) => orderTags(orderNumber),
    }),
    // All or none
    assignOrders: build.mutation<void, { orders: string[]; assignedTo: string }>({
      query: (body) => ({ url: '/order/assign', method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    // The reason is required. 403 cancel_not_allowed_after_washing for front
    // desk, 409 order_already_completed / order_already_cancelled. Resolves to
    // the order, with refundDue when money was paid
    cancelOrder: build.mutation<Order | null, { orderNumber: string; reason: string }>({
      query: ({ orderNumber, reason }) => ({
        url: `/order/${encodeURIComponent(orderNumber)}/cancel`,
        method: 'PATCH',
        body: { reason },
      }),
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      invalidatesTags: (_result, _error, { orderNumber }) => [...orderTags(orderNumber), { type: 'Payment', id: 'LIST' }],
    }),
    // 409 order_not_in_qa, 400 all_checks_must_pass
    qualityCheck: build.mutation<Order | null, { orderNumber: string } & QualityCheckBody>({
      query: ({ orderNumber, ...body }) => ({
        url: `/order/${encodeURIComponent(orderNumber)}/quality-check`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<OrderResponse>) => orderFromApi(response.content),
      invalidatesTags: (_result, _error, { orderNumber }) => orderTags(orderNumber),
    }),
    // From READY or HANDOVER for anyone; 409 balance_outstanding unless a manager
    completeOrder: build.mutation<void, string>({
      query: (orderNumber) => ({ url: `/order/${encodeURIComponent(orderNumber)}/complete`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, orderNumber) => orderTags(orderNumber),
    }),
    collectOrder: build.mutation<void, string>({
      query: (orderNumber) => ({ url: `/order/${encodeURIComponent(orderNumber)}/collect`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, orderNumber) => orderTags(orderNumber),
    }),
    // A CSV with the header customerPhone,customerName,service,quantity,unitPrice,promisedDate,notes
    importOrders: build.mutation<OrderImportResult, { file: File; branch: string }>({
      query: ({ file, branch }) => {
        const body = new FormData()
        body.append('file', file)
        return { url: '/order/import', method: 'POST', params: { branch }, body }
      },
      transformResponse: (response: ApiResponse<{ created?: number; skipped?: number; errors?: { row?: number; message?: string }[] }>) => ({
        created: response.content?.created ?? 0,
        skipped: response.content?.skipped ?? 0,
        errors: (response.content?.errors ?? []).map(({ row, message }) => ({ row: row ?? 0, message: message ?? '' })),
      }),
      invalidatesTags: [LIST, { type: 'Customer', id: 'LIST' }],
    }),
  }),
})

export const {
  useListOrdersQuery,
  useGetOrderQuery,
  useListCustomerOrdersQuery,
  useCreateOrderMutation,
  useUpdateOrderStatusMutation,
  useUpdateOrderMutation,
  useAssignOrderMutation,
  useAssignOrdersMutation,
  useCancelOrderMutation,
  useQualityCheckMutation,
  useCompleteOrderMutation,
  useCollectOrderMutation,
  useImportOrdersMutation,
} = orderApi
