import { PLATFORM_MODULES } from '../constants/platformPlans'
import type { ApiResponse } from '../types/api'
import type { PlatformModule, PlatformPlan } from '../types/platformPlan'
import { api } from './api'

// SubscriptionPlanRequest. `isActive` is sent alongside `active` because the
// JSON name depends on how the backend declares the field (`boolean isActive`
// binds as "active", `Boolean isActive` as "isActive"); Spring ignores the other.
// TODO: confirm with the backend and drop the unused one
function planRequest(plan: Partial<PlatformPlan>) {
  return plan.active === undefined ? plan : { ...plan, isActive: plan.active }
}

// One choice in the plan dropdown. The response shape isn't documented, so
// each item is read as { code | value | id, name | label, monthlyPrice? }
// TODO: confirm the GET /subscription-plans/dropdown response with the backend
export type PlanOption = { code: string; name: string; monthlyPrice: number | null }

type RawPlanOption = {
  code?: string
  value?: string
  id?: string
  name?: string
  label?: string
  monthlyPrice?: number
}

function toPlanOptions(content: unknown): PlanOption[] {
  // A bare array, or a page object with the items in `data` (or Spring's `content`)
  const page = content as { data?: unknown; content?: unknown } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content)
  if (!Array.isArray(items)) return []
  return (items as RawPlanOption[]).flatMap((item) => {
    const code = item.code ?? item.value ?? item.id
    if (!code) return []
    return [{ code, name: item.name ?? item.label ?? code, monthlyPrice: item.monthlyPrice ?? null }]
  })
}

type RawPlan = Partial<Omit<PlatformPlan, 'monthlyPrice' | 'annualPrice'>> & {
  monthlyPrice?: number | string | null
  annualPrice?: number | string | null
  isActive?: boolean
}

// BigDecimal may arrive as a number or a string; anything else is null
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

// The backend sends a Set, so the order varies; show modules in the app's order,
// with any unknown ones last
const MODULE_ORDER = Object.keys(PLATFORM_MODULES)
const moduleRank = (module: string) => {
  const rank = MODULE_ORDER.indexOf(module)
  return rank === -1 ? MODULE_ORDER.length : rank
}
const sortModules = (modules: PlatformModule[]) => [...modules].sort((a, b) => moduleRank(a) - moduleRank(b))

// Fills the gaps a plan from the API may have so the UI can rely on every field;
// items without a code are dropped
function toPlatformPlans(items: unknown[]): PlatformPlan[] {
  return (items as RawPlan[]).flatMap((raw) => {
    if (!raw?.code) return []
    return [
      {
        code: raw.code,
        name: raw.name ?? raw.code,
        monthlyPrice: toAmount(raw.monthlyPrice) ?? 0,
        annualPrice: toAmount(raw.annualPrice),
        maxShops: raw.maxShops ?? null,
        maxStaff: raw.maxStaff ?? null,
        maxOrdersPerMonth: raw.maxOrdersPerMonth ?? null,
        trialPeriodDays: raw.trialPeriodDays ?? 0,
        enabledFeatures: sortModules(raw.enabledFeatures ?? []),
        active: raw.active ?? raw.isActive ?? true,
      },
    ]
  })
}

export type PlanListParams = {
  filter?: string
  search?: string
  // Zero-based, as Spring pages are
  page?: number
  size?: number
}

// The backend pages as { totalPages, totalElements, data: [...] }; Spring's own
// Page ({ content: [...] }) and a bare array are read too
export type PlanPage = { items: PlatformPlan[]; total: number }

export const platformPlanApi = api.injectEndpoints({
  endpoints: (build) => ({
    listPlatformPlans: build.query<PlanPage, PlanListParams | void>({
      query: (params) => ({ url: '/subscription-plans/', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        if (Array.isArray(content)) return { items: toPlatformPlans(content), total: content.length }
        const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
        const items = toPlatformPlans(page?.data ?? page?.content ?? [])
        return { items, total: page?.totalElements ?? items.length }
      },
      providesTags: [{ type: 'PlatformPlan', id: 'LIST' }],
    }),
    getPlatformPlan: build.query<PlatformPlan, string>({
      query: (code) => `/subscription-plans/${encodeURIComponent(code)}`,
      transformResponse: (response: ApiResponse<unknown>) => toPlatformPlans([response.content])[0],
      providesTags: (_result, _error, code) => [{ type: 'PlatformPlan', id: code }],
    }),
    // Plans a tenant can be put on, for the tenant form
    getPlanDropdown: build.query<PlanOption[], void>({
      query: () => '/subscription-plans/dropdown',
      transformResponse: (response: ApiResponse<unknown>) => toPlanOptions(response.content),
      providesTags: [{ type: 'PlatformPlan', id: 'DROPDOWN' }],
    }),
    // The create / update / delete responses carry only a status string, like POST /tenant
    createPlatformPlan: build.mutation<void, PlatformPlan>({
      query: (plan) => ({ url: '/subscription-plans', method: 'POST', body: planRequest(plan) }),
      transformResponse: () => undefined,
      invalidatesTags: [
        { type: 'PlatformPlan', id: 'LIST' },
        { type: 'PlatformPlan', id: 'DROPDOWN' },
      ],
    }),
    // The code identifies the plan and can't change once created; PATCH takes
    // a partial body, so a status toggle can send just `active`
    updatePlatformPlan: build.mutation<void, Partial<PlatformPlan> & Pick<PlatformPlan, 'code'>>({
      query: ({ code, ...changes }) => ({
        url: `/subscription-plans/${encodeURIComponent(code)}`,
        method: 'PATCH',
        body: planRequest(changes),
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { code }) => [
        { type: 'PlatformPlan', id: code },
        { type: 'PlatformPlan', id: 'LIST' },
        { type: 'PlatformPlan', id: 'DROPDOWN' },
      ],
    }),
    deletePlatformPlan: build.mutation<void, string>({
      query: (code) => ({ url: `/subscription-plans/${encodeURIComponent(code)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, code) => [
        { type: 'PlatformPlan', id: code },
        { type: 'PlatformPlan', id: 'LIST' },
        { type: 'PlatformPlan', id: 'DROPDOWN' },
      ],
    }),
  }),
})

export const {
  useListPlatformPlansQuery,
  useGetPlatformPlanQuery,
  useGetPlanDropdownQuery,
  useCreatePlatformPlanMutation,
  useUpdatePlatformPlanMutation,
  useDeletePlatformPlanMutation,
} = platformPlanApi
