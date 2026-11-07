import type { AccountRequest, AccountRequestStatus } from '../types/accountRequest'
import type { ApiResponse } from '../types/api'
import { api } from './api'

export type AccountRequestListParams = {
  status?: AccountRequestStatus | ''
  // Business name, applicant name, email or reference
  search?: string
  // Zero-based
  page?: number
  // At most 50
  size?: number
}

export type AccountRequestPage = { items: AccountRequest[]; total: number; totalPages: number }

type RawAccountRequest = Partial<AccountRequest>

// Fills the gaps so the screens can rely on every field
function toAccountRequest(raw: RawAccountRequest): AccountRequest {
  return {
    uuid: raw.uuid ?? '',
    reference: raw.reference ?? '',
    status: raw.status ?? 'PENDING',
    legalName: raw.legalName ?? '',
    registrationId: raw.registrationId ?? '',
    industry: raw.industry ?? null,
    country: raw.country ?? null,
    address: raw.address ?? '',
    website: raw.website ?? null,
    establishedYear: raw.establishedYear ?? null,
    branchCount: raw.branchCount ?? null,
    adminName: raw.adminName ?? '',
    adminTitle: raw.adminTitle ?? null,
    adminEmail: raw.adminEmail ?? '',
    adminPhone: raw.adminPhone ?? '',
    channels: raw.channels ?? [],
    userCount: raw.userCount ?? null,
    monthlyBags: raw.monthlyBags ?? null,
    currentStack: raw.currentStack ?? null,
    painPoints: raw.painPoints ?? null,
    modules: raw.modules ?? [],
    preferredPlan: raw.preferredPlan ?? null,
    termsAcceptedAt: raw.termsAcceptedAt ?? null,
    submittedFromIp: raw.submittedFromIp ?? null,
    reviewedBy: raw.reviewedBy ?? null,
    reviewedAt: raw.reviewedAt ?? null,
    rejectionReason: raw.rejectionReason ?? null,
    tenantUuid: raw.tenantUuid ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? null,
  }
}

export type ApproveAccountRequestBody = {
  uuid: string
  // Plan code. Falls back to the request's preferred plan when left out
  subscriptionPlan?: string
  // Owner login; defaults to the part of the email before the @
  username?: string
}

export const accountRequestApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Platform admin only; newest first
    listAccountRequests: build.query<AccountRequestPage, AccountRequestListParams>({
      query: ({ status, search, page, size }) => ({
        url: '/account-requests',
        params: {
          ...(status ? { status } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
          page,
          size,
        },
      }),
      transformResponse: (response: ApiResponse<{ data?: RawAccountRequest[]; totalElements?: number; totalPages?: number }>) => {
        const items = (response.content?.data ?? []).map(toAccountRequest)
        return {
          items,
          total: response.content?.totalElements ?? items.length,
          totalPages: response.content?.totalPages ?? 1,
        }
      },
      providesTags: [{ type: 'AccountRequest', id: 'LIST' }],
    }),
    getAccountRequest: build.query<AccountRequest, string>({
      query: (uuid) => `/account-requests/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<RawAccountRequest>) => toAccountRequest(response.content),
      providesTags: (_result, _error, uuid) => [{ type: 'AccountRequest', id: uuid }],
    }),
    // Creates the tenant and its owner, and mails the owner's credentials. All or nothing:
    // on any failure the request stays pending
    approveAccountRequest: build.mutation<AccountRequest, ApproveAccountRequestBody>({
      query: ({ uuid, ...body }) => ({
        url: `/account-requests/${encodeURIComponent(uuid)}/approve`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<RawAccountRequest>) => toAccountRequest(response.content),
      // A new tenant now exists, so the tenants list is stale too
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: 'AccountRequest', id: uuid },
        { type: 'AccountRequest', id: 'LIST' },
        { type: 'Tenant', id: 'LIST' },
        { type: 'Tenant', id: 'DROPDOWN' },
      ],
    }),
    rejectAccountRequest: build.mutation<AccountRequest, { uuid: string; reason: string }>({
      query: ({ uuid, reason }) => ({
        url: `/account-requests/${encodeURIComponent(uuid)}/reject`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (response: ApiResponse<RawAccountRequest>) => toAccountRequest(response.content),
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: 'AccountRequest', id: uuid },
        { type: 'AccountRequest', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useListAccountRequestsQuery,
  useGetAccountRequestQuery,
  useApproveAccountRequestMutation,
  useRejectAccountRequestMutation,
} = accountRequestApi
