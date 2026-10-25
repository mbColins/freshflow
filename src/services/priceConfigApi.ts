import type { ApiResponse } from '../types/api'
import { api } from './api'

// A price for one kind of article, at one branch, under one service
export type PriceConfig = {
  id: string
  code: string
  name: string
  description: string
  price: number
  active: boolean
  // An ArticleType constant such as SHIRT
  articleType: string
  branchName: string
  serviceId: string
  serviceName: string
}

// PriceConfigRequest; PATCH sends any subset
export type PriceConfigRequest = Partial<{
  code: string
  name: string
  description: string
  price: number
  active: boolean
  articleType: string
  // Branch uuid, checked against the tenant
  branchId: string
  // Service uuid, which must belong to the branch's tenant
  serviceId: string
}>

type RawConfig = {
  uuid?: string
  code?: string | null
  name?: string | null
  description?: string | null
  price?: number | string | null
  active?: boolean | null
  articleType?: string | null
  branchName?: string | null
  serviceId?: string | null
  serviceName?: string | null
}

const LIST = { type: 'Pricing' as const, id: 'CONFIGS' }

// The list endpoint requires a date range, so a wide one is always sent
const FROM = '2000-01-01T00:00:00'
const TO = '2100-01-01T00:00:00'

export const priceConfigApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a business owner sees every branch's prices, anyone else their branch's
    listPriceConfigs: build.query<PriceConfig[], void>({
      query: () => ({ url: '/price-configs', params: { filter: '', search: '', page: 0, size: 500, startDate: FROM, endDate: TO } }),
      transformResponse: (response: ApiResponse<{ data?: RawConfig[] }>) =>
        (response.content?.data ?? []).flatMap((raw) =>
          raw?.uuid
            ? [
                {
                  id: raw.uuid,
                  code: raw.code ?? '',
                  name: raw.name ?? '',
                  description: raw.description ?? '',
                  price: Number(raw.price) || 0,
                  active: raw.active !== false,
                  articleType: raw.articleType ?? '',
                  branchName: raw.branchName ?? '',
                  serviceId: raw.serviceId ?? '',
                  serviceName: raw.serviceName ?? '',
                },
              ]
            : [],
        ),
      providesTags: [LIST],
    }),
    // Without `serviceId` the branch's only active service is used (404 if it offers none or several)
    createPriceConfig: build.mutation<void, PriceConfigRequest>({
      query: (body) => ({ url: '/price-configs', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    updatePriceConfig: build.mutation<void, { id: string; changes: PriceConfigRequest }>({
      query: ({ id, changes }) => ({ url: `/price-configs/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    deletePriceConfig: build.mutation<void, string>({
      query: (id) => ({ url: `/price-configs/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
  }),
})

export const {
  useListPriceConfigsQuery,
  useCreatePriceConfigMutation,
  useUpdatePriceConfigMutation,
  useDeletePriceConfigMutation,
} = priceConfigApi
