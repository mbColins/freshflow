import type { ApiResponse } from '../types/api'
import type { Tenant, TenantFormValues } from '../types/tenant'
import { tenantFormData, tenantFromApi, tenantPatchData } from '../utils/tenants'
import { api } from './api'

// A tenant from GET /tenant and GET /tenant/{tenantId}. Field names are
// assumed to mirror TenantRequest; every field is optional so a different
// shape degrades to defaults instead of breaking the page
// TODO: confirm the response shape with the backend
export type TenantResponse = {
  id?: string | number
  uuid?: string
  businessName?: string
  name?: string
  hostname?: string
  phoneNumber?: string
  email?: string
  slogan?: string
  town?: string
  logoUrl?: string | null
  // The plan code, or the plan object
  subscriptionPlan?: string | { code?: string } | null
  status?: string
  statusNote?: string | null
  // Usage, named like the plan limits
  currentShopCount?: number | null
  currentStaffCount?: number | null
  currentMonthOrderCount?: number | null
  createdAt?: string
  trialEndsAt?: string | null
  owner?: {
    username?: string
    firstName?: string
    lastName?: string
    city?: string
    neighborhood?: string
    phoneNumber?: string
    email?: string
    userType?: string
  }
}

export type TenantListParams = {
  filter?: string
  search?: string
  // YYYY-MM-DD, on the creation date
  startDate?: string
  endDate?: string
  // Zero-based, as Spring pages are
  page?: number
  size?: number
}

export type TenantPage = { items: Tenant[]; total: number }

// One choice in GET /tenant/dropdown
export type TenantOption = { id: string; uuid: string; name: string }

// PATCH body: any TenantRequest fields to change, plus an optional new logo
export type TenantPatch = Partial<TenantFormValues>

export const tenantApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Paged like GET /subscription-plans: { totalPages, totalElements, data: [...] }.
    // Spring's own Page ({ content }) and a bare array are read too.
    // TODO: confirm the path and shape with the backend
    listTenants: build.query<TenantPage, TenantListParams | void>({
      query: (params) => ({ url: '/tenant', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
        const raw = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
        const items = (raw as TenantResponse[]).flatMap((tenant) => tenantFromApi(tenant) ?? [])
        return { items, total: page?.totalElements ?? items.length }
      },
      providesTags: [{ type: 'Tenant', id: 'LIST' }],
    }),
    // POST /tenant as multipart/form-data (TenantRequest fields + `logo` file).
    // fetchBaseQuery leaves Content-Type to the browser for FormData, so the
    // multipart boundary is set correctly.
    // The response carries no tenant: `content` is just the string "tenant_created"
    createTenant: build.mutation<void, TenantFormValues>({
      query: (values) => ({
        url: '/tenant',
        method: 'POST',
        body: tenantFormData(values),
      }),
      transformResponse: () => undefined,
      // The response has no tenant, so reload the list to show the new one
      invalidatesTags: [
        { type: 'Tenant', id: 'LIST' },
        { type: 'Tenant', id: 'DROPDOWN' },
      ],
    }),
    getTenant: build.query<TenantResponse, string>({
      query: (tenantId) => `/tenant/${encodeURIComponent(tenantId)}`,
      transformResponse: (response: ApiResponse<TenantResponse>) => response.content,
      providesTags: (_result, _error, tenantId) => [{ type: 'Tenant', id: tenantId }],
    }),
    getTenantDropdown: build.query<TenantOption[], void>({
      query: () => '/tenant/dropdown',
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[] } | null
        const raw = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
        return (raw as { id?: string | number; uuid?: string; name?: string }[]).flatMap(({ id, uuid, name }) =>
          uuid ? [{ id: String(id ?? uuid), uuid, name: name ?? uuid }] : [],
        )
      },
      providesTags: [{ type: 'Tenant', id: 'DROPDOWN' }],
    }),
    // PATCH /tenant/{uuid} as multipart/form-data: only the fields being
    // changed, plus `logo` when a new one was chosen
    updateTenant: build.mutation<void, { id: string; changes: TenantPatch }>({
      query: ({ id, changes }) => ({
        url: `/tenant/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body: tenantPatchData(changes),
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Tenant', id },
        { type: 'Tenant', id: 'LIST' },
        { type: 'Tenant', id: 'DROPDOWN' },
      ],
    }),
    deleteTenant: build.mutation<void, string>({
      query: (id) => ({ url: `/tenant/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Tenant', id },
        { type: 'Tenant', id: 'LIST' },
        { type: 'Tenant', id: 'DROPDOWN' },
      ],
    }),
  }),
})

export const {
  useListTenantsQuery,
  useCreateTenantMutation,
  useGetTenantQuery,
  useGetTenantDropdownQuery,
  useUpdateTenantMutation,
  useDeleteTenantMutation,
} = tenantApi
