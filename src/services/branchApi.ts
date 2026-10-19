import type { ApiResponse } from '../types/api'
import type { Branch, BranchProfile } from '../types/branch'
import { branchFormData, branchFromApi } from '../utils/branches'
import { api } from './api'

// A branch from GET /branch and GET /branch/{branchId}. Field names are
// assumed to mirror BranchRequest; everything is optional so a different
// shape degrades to defaults instead of breaking the pages
// TODO: confirm the response shape with the backend
export type BranchResponse = {
  id?: string | number
  uuid?: string
  code?: string
  name?: string
  description?: string
  logoUrl?: string | null
  logo?: string | null
  type?: string
  status?: string
  isOpen?: boolean
  currency?: string
  country?: string
  region?: string
  city?: string
  district?: string
  address?: string
  postalCode?: string
  latitude?: string | number | null
  longitude?: string | number | null
  lat?: string | number | null
  lng?: string | number | null
  phone?: string
  phone2?: string
  email?: string
  whatsapp?: string
  website?: string
  manager?: string
  hours?: { open?: string; close?: string; closed?: boolean }[]
  specialDays?: { date?: string; label?: string; closed?: boolean; open?: string; close?: string }[]
  closure?: { from?: string; to?: string; reason?: string } | null
  services?: { name?: string; enabled?: boolean; price?: number | string | null }[]
  capacity?: Partial<Record<keyof BranchProfile['capacity'], number | string>>
  paymentMethods?: string[]
  pendingSetup?: string[]
  createdAt?: string
}

export type BranchListParams = {
  filter?: string
  search?: string
  // YYYY-MM-DD, on the creation date
  startDate?: string
  endDate?: string
  // Zero-based, as Spring pages are
  page?: number
  size?: number
}

export type BranchPage = { items: Branch[]; total: number }

// One choice in GET /branch/dropdown, read as { uuid | id, name, code? }
// TODO: confirm the dropdown response with the backend
export type BranchOption = { uuid: string; code: string; name: string }

// A list in the content as a bare array, our paged shape ({ data }) or Spring's ({ content })
function pageItems(content: unknown) {
  const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
  return { items, total: page?.totalElements ?? items.length }
}

export const branchApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend to the branches the caller may see
    listBranches: build.query<BranchPage, BranchListParams | void>({
      query: (params) => ({ url: '/branch', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const { items, total } = pageItems(response.content)
        const branches = (items as BranchResponse[]).flatMap((raw) => branchFromApi(raw) ?? [])
        return { items: branches, total }
      },
      providesTags: [{ type: 'Branch', id: 'LIST' }],
    }),
    // 403 when the branch is outside the caller's access
    getBranch: build.query<Branch | null, string>({
      query: (branchId) => `/branch/${encodeURIComponent(branchId)}`,
      transformResponse: (response: ApiResponse<BranchResponse>) => branchFromApi(response.content),
      providesTags: (_result, _error, branchId) => [{ type: 'Branch', id: branchId }],
    }),
    getBranchDropdown: build.query<BranchOption[], void>({
      query: () => '/branch/dropdown',
      transformResponse: (response: ApiResponse<unknown>) =>
        (pageItems(response.content).items as { id?: string | number; uuid?: string; code?: string; name?: string }[]).flatMap(
          ({ id, uuid, code, name }) => {
            const key = uuid ?? (id !== undefined && id !== null ? String(id) : '')
            return key ? [{ uuid: key, code: code ?? key, name: name ?? code ?? key }] : []
          },
        ),
      providesTags: [{ type: 'Branch', id: 'DROPDOWN' }],
    }),
    // POST /branch as multipart/form-data; the tenant comes from the caller.
    // The response is assumed to carry no branch (like POST /tenant), so the
    // list reloads to show it
    createBranch: build.mutation<void, { profile: BranchProfile; logo?: File | null }>({
      query: ({ profile, logo }) => ({
        url: '/branch',
        method: 'POST',
        body: branchFormData({ ...profile, currency: 'XAF' } as Partial<BranchProfile>, logo ?? null),
      }),
      transformResponse: () => undefined,
      invalidatesTags: [
        { type: 'Branch', id: 'LIST' },
        { type: 'Branch', id: 'DROPDOWN' },
      ],
    }),
    // PATCH /branch/{uuid} as multipart/form-data with only the changed fields
    updateBranch: build.mutation<void, { uuid: string; changes: Partial<BranchProfile>; logo?: File | null }>({
      query: ({ uuid, changes, logo }) => ({
        url: `/branch/${encodeURIComponent(uuid)}`,
        method: 'PATCH',
        body: branchFormData(changes, logo ?? null),
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: 'Branch', id: uuid },
        { type: 'Branch', id: 'LIST' },
        { type: 'Branch', id: 'DROPDOWN' },
      ],
    }),
    deleteBranch: build.mutation<void, string>({
      query: (uuid) => ({ url: `/branch/${encodeURIComponent(uuid)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, uuid) => [
        { type: 'Branch', id: uuid },
        { type: 'Branch', id: 'LIST' },
        { type: 'Branch', id: 'DROPDOWN' },
      ],
    }),
  }),
})

export const {
  useListBranchesQuery,
  useGetBranchQuery,
  useGetBranchDropdownQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
} = branchApi
