import type { ApiResponse } from '../types/api'
import { api } from './api'

// Promotions (/promotions). Owner and managers work on them; publishing,
// deleting and the stacking policy are owner only. These are the server's
// shapes: branches and services are uuids, enums are UPPER_SNAKE_CASE.
// hooks/usePromotions.ts turns them into what the pages use.

type Num = number | string | null | undefined

export type RawPromotion = {
  uuid?: string
  name?: string | null
  code?: string | null
  automatic?: boolean
  description?: string | null
  notes?: string | null
  // The campaign banner theme (the page stores its preset name here)
  bannerUrl?: string | null
  type?: string | null
  discountKind?: string | null
  value?: Num
  maxDiscount?: Num
  tiers?: { minSpend?: Num; percent?: Num }[] | null
  bundleNote?: string | null
  audience?: string | null
  // Customer uuids, for a SPECIFIC audience
  customers?: string[] | null
  // Branch and service uuids; empty means everywhere / the whole order
  branches?: string[] | null
  services?: string[] | null
  minOrder?: Num
  stackable?: boolean
  // yyyy-MM-dd
  startAt?: string | null
  endAt?: string | null
  // MONDAY ... SUNDAY; empty means every day
  days?: string[] | null
  usageLimit?: number | null
  perCustomerLimit?: number | null
  budget?: Num
  channels?: string[] | null
  // Stored: DRAFT, PUBLISHED, PAUSED, ARCHIVED
  state?: string | null
  // Worked out: DRAFT, PAUSED, ARCHIVED, SCHEDULED, ACTIVE, EXPIRED
  status?: string | null
  stats?: { uses?: Num; revenue?: Num; discount?: Num; reach?: Num } | null
  previous?: { uses?: Num; revenue?: Num; discount?: Num; reach?: Num } | null
  createdBy?: string | null
  createdAt?: string | null
}

// Create takes the whole body; PATCH takes any subset
export type PromotionRequest = {
  name?: string
  code?: string
  automatic?: boolean
  description?: string
  notes?: string
  bannerUrl?: string
  type?: string
  discountKind?: string
  value?: number
  maxDiscount?: number | null
  tiers?: { minSpend: number; percent: number }[]
  bundleNote?: string
  audience?: string
  customers?: string[]
  branches?: string[]
  services?: string[]
  minOrder?: number
  stackable?: boolean
  startAt?: string
  endAt?: string | null
  days?: string[]
  usageLimit?: number | null
  perCustomerLimit?: number | null
  budget?: number | null
  channels?: string[]
  // On create only: DRAFT or PUBLISHED
  state?: 'DRAFT' | 'PUBLISHED'
}

export type StackingBody = { mode: 'NONE' | 'WITH_DELIVERY' | 'ALL'; maxCombined: number }

const LIST = { type: 'Promotion' as const, id: 'LIST' }
const POLICY = { type: 'Promotion' as const, id: 'POLICY' }
// Every change is written to the audit trail, which the history tab reads
const AUDIT = { type: 'Audit' as const, id: 'LIST' }

export const promotionApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Owner and managers; a manager sees their own branch's
    listPromotions: build.query<RawPromotion[], void>({
      query: () => ({ url: '/promotions', params: { page: 0, size: 200 } }),
      transformResponse: (response: ApiResponse<{ data?: RawPromotion[] } | null>) =>
        (response.content?.data ?? []).filter((raw) => raw?.uuid),
      providesTags: [LIST],
    }),
    // 400 with a message per field; 409 when the code is taken
    createPromotion: build.mutation<void, PromotionRequest>({
      query: (body) => ({ url: '/promotions', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, AUDIT],
    }),
    // 409 promotion_in_use to change code, type or kind once redeemed
    updatePromotion: build.mutation<void, { id: string; changes: PromotionRequest }>({
      query: ({ id, changes }) => ({ url: `/promotions/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, AUDIT],
    }),
    // DRAFT or PAUSED to PUBLISHED (owner), PUBLISHED to PAUSED, anything but
    // archived to ARCHIVED. An archived promotion cannot come back: duplicate it
    setPromotionState: build.mutation<void, { id: string; state: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED' }>({
      query: ({ id, state }) => ({ url: `/promotions/${encodeURIComponent(id)}/state`, method: 'PATCH', body: { state } }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, AUDIT],
    }),
    // A copy as a draft, without its code
    duplicatePromotion: build.mutation<void, string>({
      query: (id) => ({ url: `/promotions/${encodeURIComponent(id)}/duplicate`, method: 'POST' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, AUDIT],
    }),
    // A draft with no redemptions, owner only
    deletePromotion: build.mutation<void, string>({
      query: (id) => ({ url: `/promotions/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, AUDIT],
    }),

    // How promotions combine on one order
    getStackingPolicy: build.query<StackingBody, void>({
      query: () => '/promotions/policy',
      transformResponse: (response: ApiResponse<{ mode?: string; maxCombined?: Num } | null>) => ({
        mode: (['NONE', 'WITH_DELIVERY', 'ALL'].includes(response.content?.mode ?? '') ? response.content?.mode : 'NONE') as StackingBody['mode'],
        maxCombined: Number(response.content?.maxCombined) || 30,
      }),
      providesTags: [POLICY],
    }),
    // Owner only; maxCombined is a share of the order, above 0 and up to 100
    setStackingPolicy: build.mutation<void, StackingBody>({
      query: (body) => ({ url: '/promotions/policy', method: 'PUT', body }),
      transformResponse: () => undefined,
      invalidatesTags: [POLICY, AUDIT],
    }),
  }),
})

export const {
  useListPromotionsQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useSetPromotionStateMutation,
  useDuplicatePromotionMutation,
  useDeletePromotionMutation,
  useGetStackingPolicyQuery,
  useSetStackingPolicyMutation,
} = promotionApi
