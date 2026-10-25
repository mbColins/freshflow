import type { ApiResponse } from '../types/api'
import type { DeliveryZone, DeliveryZoneRequest } from '../types/deliveryZone'
import { api } from './api'

// DeliveryZoneResponse as sent
type RawZone = {
  uuid?: string
  name?: string | null
  collectionFee?: number | string | null
  deliveryFee?: number | string | null
  neighborhood?: string[] | null
  branchId?: string | null
  branchName?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

// BigDecimal may arrive as a number or a string
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

// Zones without a uuid can't be edited or deleted, so they're dropped
function toZones(items: unknown[]): DeliveryZone[] {
  return (items as RawZone[]).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            name: raw.name ?? '',
            collectionFee: toAmount(raw.collectionFee),
            deliveryFee: toAmount(raw.deliveryFee),
            neighborhoods: raw.neighborhood ?? [],
            branchId: raw.branchId ?? '',
            branchName: raw.branchName ?? '',
            createdBy: raw.createdBy ?? '',
            createdAt: raw.createdAt ?? '',
          },
        ]
      : [],
  )
}

// The backend requires both `filter` (the field to search) and `search`,
// even when empty
export type ZoneListParams = { filter: string; search: string; page?: number; size?: number }

export type ZonePage = { items: DeliveryZone[]; total: number }

const LIST = { type: 'DeliveryZone' as const, id: 'LIST' }

export const deliveryZoneApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a branch sees its own zones, a tenant owner every
    // branch's, a platform admin all. Paged as { totalPages, totalElements, data }.
    // The trailing slash matches the controller's @GetMapping("/")
    listDeliveryZones: build.query<ZonePage, ZoneListParams>({
      query: (params) => ({ url: '/delivery-zones/', params }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
        const items = toZones(Array.isArray(content) ? content : (page?.data ?? page?.content ?? []))
        return { items, total: page?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    // The create / update / delete responses carry only a status string
    createDeliveryZone: build.mutation<void, DeliveryZoneRequest>({
      query: (zone) => ({ url: '/delivery-zones/', method: 'POST', body: zone }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    // The backend ignores branchId on update; a zone stays on its branch
    updateDeliveryZone: build.mutation<void, { id: string; zone: DeliveryZoneRequest }>({
      query: ({ id, zone }) => ({ url: `/delivery-zones/${encodeURIComponent(id)}`, method: 'PATCH', body: zone }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    deleteDeliveryZone: build.mutation<void, string>({
      query: (id) => ({ url: `/delivery-zones/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
  }),
})

export const {
  useListDeliveryZonesQuery,
  useCreateDeliveryZoneMutation,
  useUpdateDeliveryZoneMutation,
  useDeleteDeliveryZoneMutation,
} = deliveryZoneApi
