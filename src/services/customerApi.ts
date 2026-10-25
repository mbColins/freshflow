import type { ApiResponse } from '../types/api'
import type { CrmCustomer } from '../types/customer'
import { customerFromApi } from '../utils/customers'
import { api } from './api'

// A customer from the API. Field names follow CustomerRequest; the rest are
// guesses, and everything is optional so a different shape degrades to
// defaults instead of breaking the pages
// TODO: confirm the response shape with the backend
export type CustomerResponse = {
  id?: string | number
  uuid?: string
  firstname?: string
  lastname?: string
  phoneNumber?: string
  email?: string | null
  homeAddress?: string | null
  neighbourhood?: string | null
  loyaltyPoints?: number | null
  // The branch uuid, or the branch itself
  branchId?: string | number | null
  branch?: { id?: string | number; uuid?: string; name?: string } | string | null
  branchName?: string | null
  referralSource?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

// The create / update body. createdBy is left out: the backend knows the caller.
export type CustomerRequest = {
  firstname: string
  lastname: string
  phoneNumber: string
  email: string
  homeAddress: string
  neighbourhood: string
  loyaltyPoints: number
  branchId: string
  referralSource: string
}

export type CustomerPage = { items: CrmCustomer[]; total: number }

export type CustomerListParams = { page?: number; size?: number }

// One choice in GET /customer/dropdown (DropDownResponse): the id, uuid,
// display name and phone number. There's no email or address.
export type CustomerOption = { id: number | null; uuid: string; name: string; phone: string }

export type CustomerDropdownParams = {
  // Matches first name, last name or phone, case-insensitive
  search?: string
  // How many to return; the backend defaults to 10
  size?: number
}

// A list in the content as a bare array, our paged shape ({ data }) or Spring's ({ content })
function pageItems(content: unknown) {
  const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
  return { items, total: page?.totalElements ?? items.length }
}

// The created customer's id, when the create response carries the customer
function createdId(content: unknown) {
  const raw = content as CustomerResponse | null
  const id = typeof raw === 'object' && raw ? (raw.uuid ?? raw.id) : undefined
  return id === undefined || id === null ? null : String(id)
}

const DROPDOWN = { type: 'Customer' as const, id: 'DROPDOWN' }
const LIST = { type: 'Customer' as const, id: 'LIST' }

// Paths are relative to /api/v1/customer
// TODO: confirm the base path with the backend
export const customerApi = api.injectEndpoints({
  endpoints: (build) => ({
    // GET /customer/tenant: every customer of the connected tenant. The plain
    // GET /customer list isn't scoped to a tenant yet, so it isn't used.
    // Requires UserType.TENANT; other accounts get 403.
    // TODO: switch to a scoped GET /customer once the backend scopes it
    listCustomers: build.query<CustomerPage, CustomerListParams | void>({
      query: (params) => ({ url: '/customer/tenant', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const { items, total } = pageItems(response.content)
        return { items: (items as CustomerResponse[]).flatMap((raw) => customerFromApi(raw) ?? []), total }
      },
      providesTags: [LIST],
    }),
    getCustomer: build.query<CrmCustomer | null, string>({
      query: (customerId) => `/customer/${encodeURIComponent(customerId)}`,
      transformResponse: (response: ApiResponse<CustomerResponse>) => customerFromApi(response.content),
      providesTags: (_result, _error, customerId) => [{ type: 'Customer', id: customerId }],
    }),
    // Search-as-you-type on first name, last name and phone, for the order form
    // TODO: the backend's getCustomerDropDown isn't tenant-scoped yet
    getCustomerDropdown: build.query<CustomerOption[], CustomerDropdownParams | void>({
      query: (params) => ({ url: '/customer/dropdown', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (
          pageItems(response.content).items as {
            id?: number | null
            uuid?: string
            name?: string | null
            phoneNumber?: string | null
          }[]
        ).flatMap((raw) =>
          raw.uuid
            ? [
                {
                  id: raw.id ?? null,
                  uuid: raw.uuid,
                  name: raw.name?.trim() || 'Unnamed customer',
                  phone: raw.phoneNumber?.trim() ?? '',
                },
              ]
            : [],
        ),
      providesTags: [DROPDOWN],
    }),
    // Resolves to the new customer's id when the response carries it
    createCustomer: build.mutation<string | null, CustomerRequest>({
      query: (body) => ({ url: '/customer', method: 'POST', body }),
      transformResponse: (response: ApiResponse<unknown>) => createdId(response.content),
      invalidatesTags: [LIST, DROPDOWN],
    }),
    // Only the fields given are changed; a new branchId is checked against the tenant
    updateCustomer: build.mutation<void, { id: string; changes: Partial<CustomerRequest> }>({
      query: ({ id, changes }) => ({ url: `/customer/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Customer', id }, LIST, DROPDOWN],
    }),
    deleteCustomer: build.mutation<void, string>({
      query: (id) => ({ url: `/customer/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, id) => [{ type: 'Customer', id }, LIST, DROPDOWN],
    }),
  }),
})

export const {
  useListCustomersQuery,
  useGetCustomerQuery,
  useGetCustomerDropdownQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customerApi
