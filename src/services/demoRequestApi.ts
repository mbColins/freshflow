import type { ApiResponse } from '../types/api'
import type { DemoRequest, DemoRequestStatus } from '../types/demoRequest'
import { api } from './api'

export type DemoRequestListParams = {
  status?: DemoRequestStatus | ''
  // Name, email, company or reference
  search?: string
  // Zero-based
  page?: number
  // At most 50
  size?: number
}

export type DemoRequestPage = { items: DemoRequest[]; total: number; totalPages: number }

type RawDemoRequest = Partial<DemoRequest>

// Fills the gaps so the screens can rely on every field
function toDemoRequest(raw: RawDemoRequest): DemoRequest {
  return {
    uuid: raw.uuid ?? '',
    reference: raw.reference ?? '',
    status: raw.status ?? 'NEW',
    name: raw.name ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? null,
    company: raw.company ?? '',
    jobTitle: raw.jobTitle ?? null,
    businessType: raw.businessType ?? 'other',
    branchCount: raw.branchCount ?? null,
    message: raw.message ?? null,
    preferredDate: raw.preferredDate ?? null,
    preferredWindow: raw.preferredWindow ?? 'ANY',
    timezone: raw.timezone ?? null,
    consentAt: raw.consentAt ?? null,
    submittedFromIp: raw.submittedFromIp ?? null,
    scheduledFor: raw.scheduledFor ?? null,
    note: raw.note ?? null,
    handledBy: raw.handledBy ?? null,
    statusChangedAt: raw.statusChangedAt ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? null,
  }
}

export type ChangeDemoStatusBody = {
  uuid: string
  status: DemoRequestStatus
  // Required, and in the future, when the status is SCHEDULED. yyyy-MM-ddTHH:mm:ss
  scheduledFor?: string
  // Replaces the previous note when sent
  note?: string
}

export const demoRequestApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Platform admin only; newest first
    listDemoRequests: build.query<DemoRequestPage, DemoRequestListParams>({
      query: ({ status, search, page, size }) => ({
        url: '/demo-requests',
        params: {
          ...(status ? { status } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
          page,
          size,
        },
      }),
      transformResponse: (response: ApiResponse<{ data?: RawDemoRequest[]; totalElements?: number; totalPages?: number }>) => {
        const items = (response.content?.data ?? []).map(toDemoRequest)
        return {
          items,
          total: response.content?.totalElements ?? items.length,
          totalPages: response.content?.totalPages ?? 1,
        }
      },
      providesTags: [{ type: 'DemoRequest', id: 'LIST' }],
    }),
    getDemoRequest: build.query<DemoRequest, string>({
      query: (uuid) => `/demo-requests/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<RawDemoRequest>) => toDemoRequest(response.content),
      providesTags: (_result, _error, uuid) => [{ type: 'DemoRequest', id: uuid }],
    }),
    // Moves a request along; the backend refuses a move its status doesn't allow
    changeDemoRequestStatus: build.mutation<DemoRequest, ChangeDemoStatusBody>({
      query: ({ uuid, ...body }) => ({
        url: `/demo-requests/${encodeURIComponent(uuid)}/status`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<RawDemoRequest>) => toDemoRequest(response.content),
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: 'DemoRequest', id: uuid },
        { type: 'DemoRequest', id: 'LIST' },
      ],
    }),
  }),
})

export const { useListDemoRequestsQuery, useGetDemoRequestQuery, useChangeDemoRequestStatusMutation } = demoRequestApi
