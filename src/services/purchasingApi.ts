import type { ApiResponse } from '../types/api'
import type { PoStatus, PurchaseOrder, StockTransfer, Supplier, TransferStatus } from '../types/inventory'
import { api } from './api'

// Inventory transfers between branches, suppliers and purchase orders
// (/inventory/transfers, /inventory/suppliers, /inventory/purchase-orders)

type Num = number | string | null | undefined
// BigDecimal may arrive as a number or a string
const num = (value: Num) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}
const text = (value: string | null | undefined) => value ?? ''

type Ref = { uuid?: string; name?: string | null; unit?: string | null } | null | undefined

const TRANSFER_STATUSES: Record<string, TransferStatus> = {
  REQUESTED: 'Requested',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

const PO_STATUSES: Record<string, PoStatus> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

// What the status endpoint accepts
export type PoTargetStatus = 'APPROVED' | 'ORDERED' | 'CANCELLED'

type RawTransfer = {
  uuid?: string
  code?: string | null
  item?: Ref
  quantity?: Num
  fromBranch?: Ref
  toBranch?: Ref
  status?: string | null
  requestedBy?: string | null
  requestedAt?: string | null
  receivedBy?: string | null
}

function toTransfers(rows: unknown): StockTransfer[] {
  return (Array.isArray(rows) ? (rows as RawTransfer[]) : []).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            code: text(raw.code),
            itemId: text(raw.item?.uuid),
            itemName: text(raw.item?.name),
            unit: text(raw.item?.unit),
            from: text(raw.fromBranch?.name),
            to: text(raw.toBranch?.name),
            qty: num(raw.quantity),
            status: TRANSFER_STATUSES[raw.status ?? ''] ?? 'In Transit',
            requestedBy: text(raw.requestedBy),
            receivedBy: text(raw.receivedBy),
            at: text(raw.requestedAt),
          },
        ]
      : [],
  )
}

type RawPurchaseOrder = {
  uuid?: string
  code?: string | null
  supplier?: Ref
  branch?: Ref
  status?: string | null
  expectedAt?: string | null
  notes?: string | null
  lines?: { item?: Ref; quantity?: Num; quantityReceived?: Num; unitCost?: Num }[] | null
  createdBy?: string | null
  createdAt?: string | null
}

function toPurchaseOrders(rows: unknown): PurchaseOrder[] {
  return (Array.isArray(rows) ? (rows as RawPurchaseOrder[]) : []).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            code: text(raw.code),
            supplierId: text(raw.supplier?.uuid),
            supplier: text(raw.supplier?.name),
            branchId: text(raw.branch?.uuid),
            branchName: text(raw.branch?.name),
            lines: (raw.lines ?? []).map((line) => ({
              itemId: text(line.item?.uuid),
              itemName: text(line.item?.name),
              unit: text(line.item?.unit),
              qty: num(line.quantity),
              received: num(line.quantityReceived),
              unitCost: num(line.unitCost),
            })),
            createdAt: text(raw.createdAt),
            expectedAt: text(raw.expectedAt),
            notes: text(raw.notes),
            status: PO_STATUSES[raw.status ?? ''] ?? 'Draft',
            createdBy: text(raw.createdBy),
          },
        ]
      : [],
  )
}

type RawSupplier = {
  uuid?: string
  name?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  paymentTerms?: string | null
  leadTimeDays?: number | null
  active?: boolean | null
  notes?: string | null
}

function toSuppliers(rows: unknown): Supplier[] {
  return (Array.isArray(rows) ? (rows as RawSupplier[]) : []).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            name: text(raw.name),
            contactName: text(raw.contactName),
            phone: text(raw.phone),
            email: text(raw.email),
            address: text(raw.address),
            paymentTerms: text(raw.paymentTerms),
            leadTimeDays: raw.leadTimeDays ?? 0,
            active: raw.active !== false,
            notes: text(raw.notes),
          },
        ]
      : [],
  )
}

// TransferRequest: `item` is in the caller's own branch, `toBranch` another branch of the tenant
export type TransferRequest = { item: string; quantity: number; toBranch: string; notes?: string }

// SupplierRequest; PATCH takes any subset
export type SupplierRequest = {
  name?: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  paymentTerms?: string
  leadTimeDays?: number
  active?: boolean
  notes?: string
}

// PurchaseOrderRequest. `branch` is for the owner and platform admin; every item must be in it
export type PurchaseOrderRequest = {
  supplier: string
  branch?: string
  // yyyy-MM-dd
  expectedAt?: string
  notes?: string
  lines: { item: string; quantity: number; unitCost?: number }[]
}

export type PurchaseOrderReceiveLine = {
  item: string
  quantityReceived: number
  unitCost?: number
  batch?: string
  // yyyy-MM-dd
  expiresAt?: string
}

export type TransferListParams = { status?: string; branch?: string; direction?: 'IN' | 'OUT'; page?: number; size?: number }
export type PurchaseOrderListParams = { status?: string; supplier?: string; branch?: string; page?: number; size?: number }
export type SupplierListParams = { search?: string; active?: boolean; page?: number; size?: number }

const TRANSFERS = { type: 'Inventory' as const, id: 'TRANSFERS' }
const SUPPLIERS = { type: 'Inventory' as const, id: 'SUPPLIERS' }
const ORDERS = { type: 'Inventory' as const, id: 'ORDERS' }
// Receiving a transfer or an order books stock movements and changes the items
const STOCK = [
  { type: 'Inventory' as const, id: 'LIST' },
  { type: 'Inventory' as const, id: 'MOVEMENTS' },
]

export const purchasingApi = api.injectEndpoints({
  endpoints: (build) => ({
    listTransfers: build.query<StockTransfer[], TransferListParams | void>({
      query: (params) => ({ url: '/inventory/transfers', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toTransfers(response.content?.data),
      providesTags: [TRANSFERS],
    }),
    // Ships at once: the stock leaves the source item. 409 insufficient_stock
    createTransfer: build.mutation<void, TransferRequest>({
      query: (body) => ({ url: '/inventory/transfers', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [TRANSFERS, ...STOCK],
    }),
    receiveTransfer: build.mutation<void, string>({
      query: (id) => ({ url: `/inventory/transfers/${encodeURIComponent(id)}/receive`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: [TRANSFERS, ...STOCK],
    }),
    // Only while in transit; the stock goes back to the source
    cancelTransfer: build.mutation<void, string>({
      query: (id) => ({ url: `/inventory/transfers/${encodeURIComponent(id)}/cancel`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: [TRANSFERS, ...STOCK],
    }),

    // Managers and the owner only
    listSuppliers: build.query<Supplier[], SupplierListParams | void>({
      query: (params) => ({ url: '/inventory/suppliers', params: { page: 0, size: 200, ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toSuppliers(response.content?.data),
      providesTags: [SUPPLIERS],
    }),
    createSupplier: build.mutation<void, SupplierRequest>({
      query: (body) => ({ url: '/inventory/suppliers', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [SUPPLIERS],
    }),
    updateSupplier: build.mutation<void, { id: string; changes: SupplierRequest }>({
      query: ({ id, changes }) => ({ url: `/inventory/suppliers/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      // Renaming a supplier renames it on its items
      invalidatesTags: [SUPPLIERS, ...STOCK],
    }),
    // 409 supplier_has_orders once it has purchase orders: set active false instead
    deleteSupplier: build.mutation<void, string>({
      query: (id) => ({ url: `/inventory/suppliers/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [SUPPLIERS],
    }),

    listPurchaseOrders: build.query<PurchaseOrder[], PurchaseOrderListParams | void>({
      query: (params) => ({ url: '/inventory/purchase-orders', params: { page: 0, size: 100, ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toPurchaseOrders(response.content?.data),
      providesTags: [ORDERS],
    }),
    // Saved as a draft
    createPurchaseOrder: build.mutation<void, PurchaseOrderRequest>({
      query: (body) => ({ url: '/inventory/purchase-orders', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [ORDERS],
    }),
    // DRAFT -> APPROVED -> ORDERED; cancel from draft, approved or ordered.
    // 403 owner_required when a manager approves above the auto-approve limit
    setPurchaseOrderStatus: build.mutation<void, { id: string; status: PoTargetStatus }>({
      query: ({ id, status }) => ({
        url: `/inventory/purchase-orders/${encodeURIComponent(id)}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: () => undefined,
      invalidatesTags: [ORDERS],
    }),
    // Without lines, every line is received in full. Each line is a RECEIPT movement
    receivePurchaseOrder: build.mutation<void, { id: string; lines?: PurchaseOrderReceiveLine[] }>({
      query: ({ id, lines }) => ({
        url: `/inventory/purchase-orders/${encodeURIComponent(id)}/receive`,
        method: 'POST',
        body: lines ? { lines } : undefined,
      }),
      transformResponse: () => undefined,
      invalidatesTags: [ORDERS, ...STOCK],
    }),
  }),
})

export const {
  useListTransfersQuery,
  useCreateTransferMutation,
  useReceiveTransferMutation,
  useCancelTransferMutation,
  useListSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useListPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useSetPurchaseOrderStatusMutation,
  useReceivePurchaseOrderMutation,
} = purchasingApi
