import type { ApiResponse } from '../types/api'
import type { InventoryItem, Movement, MovementType } from '../types/inventory'
import { api } from './api'

// What a stock movement does on the server. OPENING is written by the server
// when an item is created and can't be sent
export type ServerMovementType = 'RECEIPT' | 'USAGE' | 'WASTE' | 'ADJUSTMENT' | 'RESERVE' | 'RELEASE' | 'OPENING'

// InventoryItemRequest. PATCH takes any subset except stock and reserved,
// which only change through movements
export type InventoryItemRequest = {
  name?: string
  category?: string
  description?: string
  unit?: string
  location?: string
  // Opening quantities, create only
  stock?: number
  reserved?: number
  reorder?: number
  safety?: number
  max?: number
  unitCost?: number
  supplier?: string
  dailyUse?: number
  batch?: string
  // yyyy-MM-dd
  expiresAt?: string | null
  // Branch uuid; fixed once the item exists
  branch?: string
  // Service uuids; a list that is sent replaces the stored one
  services?: string[]
}

// StockMovementRequest
export type StockMovementRequest = {
  type: Exclude<ServerMovementType, 'OPENING'>
  // Positive, except for ADJUSTMENT where it is the counted level
  quantity: number
  // RECEIPT only: moves the item's unit cost to the weighted average
  unitCost?: number
  reference?: string
  // Required for WASTE and ADJUSTMENT
  note?: string
  // USAGE only: take it from the reservation instead
  fromReserved?: boolean
}

type RawItem = {
  uuid?: string
  name?: string | null
  category?: string | null
  description?: string | null
  unit?: string | null
  location?: string | null
  stock?: number | string | null
  reserved?: number | string | null
  reorder?: number | string | null
  safety?: number | string | null
  max?: number | string | null
  unitCost?: number | string | null
  supplier?: string | null
  dailyUse?: number | string | null
  batch?: string | null
  expiresAt?: string | null
  branch?: string | null
  branchName?: string | null
  lastMovementAt?: string | null
  services?: string[] | null
  serviceIds?: string[] | null
}

type RawMovement = {
  uuid?: string
  item?: string
  type?: string
  stockDelta?: number | string | null
  stockAfter?: number | string | null
  reference?: string | null
  note?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

// BigDecimal may arrive as a number or a string
const toNumber = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

function toItems(items: unknown): InventoryItem[] {
  return (Array.isArray(items) ? (items as RawItem[]) : []).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            // The API addresses items by uuid; there is no SKU
            id: raw.uuid,
            name: raw.name ?? '',
            category: raw.category ?? '',
            description: raw.description ?? '',
            unit: raw.unit ?? '',
            location: raw.location ?? '',
            stock: toNumber(raw.stock),
            reserved: toNumber(raw.reserved),
            reorder: toNumber(raw.reorder),
            safety: toNumber(raw.safety),
            max: toNumber(raw.max),
            unitCost: toNumber(raw.unitCost),
            supplier: raw.supplier ?? '',
            dailyUse: toNumber(raw.dailyUse),
            batch: raw.batch ?? '',
            expiresAt: raw.expiresAt ?? null,
            lastMovementAt: raw.lastMovementAt ?? '',
            services: raw.services ?? [],
            branchId: raw.branch ?? '',
            branchName: raw.branchName ?? '',
            serviceIds: raw.serviceIds ?? [],
          },
        ]
      : [],
  )
}

// RESERVE and RELEASE only move the reservation, which the log doesn't show
const MOVEMENT_LABELS: Partial<Record<string, MovementType>> = {
  OPENING: 'Stock received',
  RECEIPT: 'Stock received',
  USAGE: 'Consumption',
  WASTE: 'Damage',
  ADJUSTMENT: 'Adjustment',
}

function toMovements(items: unknown): Movement[] {
  return (Array.isArray(items) ? (items as RawMovement[]) : []).flatMap((raw) => {
    const type = raw?.type ? MOVEMENT_LABELS[raw.type] : undefined
    if (!raw?.uuid || !raw.item || !type) return []
    const qty = toNumber(raw.stockDelta)
    const after = toNumber(raw.stockAfter)
    return [
      {
        at: raw.createdAt ?? '',
        itemId: raw.item,
        type,
        qty,
        before: after - qty,
        after,
        user: raw.createdBy ?? '',
        reference: raw.reference || raw.note || '',
      },
    ]
  })
}

export type InventoryListParams = { branch?: string; page?: number; size?: number }

const LIST = { type: 'Inventory' as const, id: 'LIST' }
const MOVEMENTS = { type: 'Inventory' as const, id: 'MOVEMENTS' }

export const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a platform admin sees every branch, a business
    // owner their tenant's, anyone else their own branch; `branch` narrows it
    listInventoryItems: build.query<InventoryItem[], InventoryListParams>({
      query: ({ branch, page, size }) => ({
        url: '/inventory',
        params: { filter: '', search: '', page, size, ...(branch ? { branch } : {}) },
      }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toItems(response.content?.data),
      providesTags: [LIST],
    }),
    createInventoryItem: build.mutation<void, InventoryItemRequest>({
      query: (body) => ({ url: '/inventory', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, MOVEMENTS],
    }),
    updateInventoryItem: build.mutation<void, { id: string; changes: InventoryItemRequest }>({
      query: ({ id, changes }) => ({ url: `/inventory/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    // 409 inventory_item_has_stock_history once it has moved
    deleteInventoryItem: build.mutation<void, string>({
      query: (id) => ({ url: `/inventory/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, MOVEMENTS],
    }),
    // The only way stock changes after creation. 409 insufficient_stock
    recordStockMovement: build.mutation<void, { itemId: string; movement: StockMovementRequest }>({
      query: ({ itemId, movement }) => ({
        url: `/inventory/${encodeURIComponent(itemId)}/movements`,
        method: 'POST',
        body: movement,
      }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, MOVEMENTS],
    }),
    // Recent movements across the caller's scope, newest first
    listStockMovements: build.query<Movement[], InventoryListParams>({
      query: ({ branch, page, size }) => ({
        url: '/inventory/movements',
        params: { page, size, ...(branch ? { branch } : {}) },
      }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toMovements(response.content?.data),
      providesTags: [MOVEMENTS],
    }),
  }),
})

export const {
  useListInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useRecordStockMovementMutation,
  useListStockMovementsQuery,
} = inventoryApi
