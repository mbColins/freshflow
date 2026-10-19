import type { ApiResponse } from '../types/api'
import type { LaundryService } from '../types/service'
import { resolveIncludes, serviceFromApi } from '../utils/serviceMapping'
import type { ServiceRequest, ServiceResponse } from '../utils/serviceMapping'
import { api } from './api'

export type ServiceListParams = {
  // Code, name or description, case-insensitive
  search?: string
  category?: string
  // UPPER_SNAKE_CASE enum values
  status?: string
  pricingModel?: string
  visibility?: string
  // Branch uuid: services offered there
  branchId?: string
  // Zero-based; the backend defaults to page 0, size 10
  page?: number
  size?: number
}

export type ServicePage = { items: LaundryService[]; total: number }

// One choice in GET /service/dropdown (ACTIVE services, for the order form)
export type ServiceOption = { uuid: string; code: string; name: string; pricingModel: string; basePrice: number }

const toServices = (items: unknown) =>
  resolveIncludes((Array.isArray(items) ? (items as ServiceResponse[]) : []).flatMap((raw) => serviceFromApi(raw) ?? []))

const LIST = { type: 'Service' as const, id: 'LIST' }

export const serviceApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: the caller's tenant (owner) or branch (staff); newest first
    listServices: build.query<ServicePage, ServiceListParams | void>({
      query: (params) => ({ url: '/service', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ totalElements?: number; data?: unknown; content?: unknown } | unknown[]>) => {
        const content = response.content
        if (Array.isArray(content)) return { items: toServices(content), total: content.length }
        const items = toServices(content?.data ?? content?.content)
        return { items, total: content?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    getService: build.query<LaundryService | null, string>({
      query: (uuid) => `/service/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<ServiceResponse>) => serviceFromApi(response.content),
      providesTags: (_result, _error, uuid) => [{ type: 'Service', id: uuid }],
    }),
    // Services offered at the caller's own branch
    listBranchServices: build.query<LaundryService[], void>({
      query: () => '/service/branch',
      transformResponse: (response: ApiResponse<unknown>) => toServices(response.content),
      providesTags: [LIST],
    }),
    // Every service of the caller's tenant; tenant owners only
    listTenantServices: build.query<LaundryService[], void>({
      query: () => '/service/tenant',
      transformResponse: (response: ApiResponse<unknown>) => toServices(response.content),
      providesTags: [LIST],
    }),
    getServiceDropdown: build.query<ServiceOption[], void>({
      query: () => '/service/dropdown',
      transformResponse: (response: ApiResponse<unknown>) =>
        (Array.isArray(response.content) ? response.content : []).flatMap(
          (raw: { uuid?: string; code?: string; name?: string; pricingModel?: string; basePrice?: number | string }) =>
            raw.uuid
              ? [
                  {
                    uuid: raw.uuid,
                    code: raw.code ?? '',
                    name: raw.name ?? raw.code ?? raw.uuid,
                    pricingModel: (raw.pricingModel ?? '').toLowerCase(),
                    basePrice: Number(raw.basePrice) || 0,
                  },
                ]
              : [],
        ),
      providesTags: [{ type: 'Service', id: 'DROPDOWN' }],
    }),
    // Returns the created service
    createService: build.mutation<LaundryService | null, ServiceRequest>({
      query: (body) => ({ url: '/service', method: 'POST', body }),
      transformResponse: (response: ApiResponse<ServiceResponse>) => serviceFromApi(response.content),
      invalidatesTags: [LIST, { type: 'Service', id: 'DROPDOWN' }],
    }),
    // Partial: absent fields are kept, a list that's sent replaces the stored one
    updateService: build.mutation<LaundryService | null, { uuid: string; changes: Partial<ServiceRequest> }>({
      query: ({ uuid, changes }) => ({ url: `/service/${encodeURIComponent(uuid)}`, method: 'PATCH', body: changes }),
      transformResponse: (response: ApiResponse<ServiceResponse>) => serviceFromApi(response.content),
      invalidatesTags: (_result, _error, { uuid }) => [{ type: 'Service', id: uuid }, LIST, { type: 'Service', id: 'DROPDOWN' }],
    }),
    // 409 when orders, price configs or a bundle still reference it
    deleteService: build.mutation<void, string>({
      query: (uuid) => ({ url: `/service/${encodeURIComponent(uuid)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, uuid) => [{ type: 'Service', id: uuid }, LIST, { type: 'Service', id: 'DROPDOWN' }],
    }),
  }),
})

export const {
  useListServicesQuery,
  useGetServiceQuery,
  useListBranchServicesQuery,
  useListTenantServicesQuery,
  useGetServiceDropdownQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
} = serviceApi

// The backend's reasons for a failed save, in plain words. A validation
// failure lists every broken rule ("express.hours: must be above 0").
export function serviceErrorMessage(error: unknown) {
  const status = (error as { status?: unknown } | undefined)?.status
  const data = (error as { data?: { message?: unknown; validationErrors?: Record<string, string> } } | undefined)?.data
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return 'Could not reach the server. Try again in a moment.'
  const problems = Object.entries(data?.validationErrors ?? {}).map(([field, problem]) => `${field}: ${problem}`)
  if (problems.length > 0) return `The server rejected the service. ${problems.join('; ')}.`
  if (status === 409) return typeof data?.message === 'string' && data.message ? data.message : 'This service code is already in use.'
  if (typeof data?.message === 'string' && data.message) return data.message
  if (status === 403) return 'Your account isn’t allowed to change services.'
  return 'The service wasn’t saved. Try again in a moment.'
}
