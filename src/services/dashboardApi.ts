import type { ApiResponse } from '../types/api'
import { api } from './api'

export type RevenuePeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type RevenuePoint = {
  label: string
  // YYYY-MM-DD, inclusive
  start: string
  end: string
  mobileMoney: number
  cash: number
  // Card, bank transfer and anything else
  other: number
  total: number
}

// RevenueOverviewResponse, with amounts as numbers
export type RevenueOverview = {
  period: RevenuePeriod
  currency: string
  // Branch uuid the figures cover; empty = every branch the caller can see
  branch: string
  from: string
  to: string
  totals: { mobileMoney: number; cash: number; other: number; total: number }
  // This month so far against the same days of last month; percent is null
  // when last month had nothing
  change: { comparedTo: string; currentTotal: number; previousTotal: number; percent: number | null }
  // Oldest first, every bucket present
  points: RevenuePoint[]
}

type RawAmounts = Partial<Record<'mobileMoney' | 'cash' | 'other' | 'total', number | string | null>>
type RawOverview = {
  period?: string
  currency?: string | null
  branch?: string | null
  from?: string | null
  to?: string | null
  totals?: RawAmounts | null
  change?: { comparedTo?: string | null; currentTotal?: number | string | null; previousTotal?: number | string | null; percent?: number | null } | null
  points?: (RawAmounts & { label?: string | null; start?: string | null; end?: string | null })[] | null
}

// BigDecimal may arrive as a number or a string
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}
const toAmounts = (raw: RawAmounts | null | undefined) => {
  const mobileMoney = toAmount(raw?.mobileMoney)
  const cash = toAmount(raw?.cash)
  const other = toAmount(raw?.other)
  return { mobileMoney, cash, other, total: toAmount(raw?.total) || mobileMoney + cash + other }
}

function toOverview(raw: RawOverview | null, period: RevenuePeriod): RevenueOverview {
  return {
    period,
    currency: raw?.currency ?? 'XAF',
    branch: raw?.branch ?? '',
    from: raw?.from ?? '',
    to: raw?.to ?? '',
    totals: toAmounts(raw?.totals),
    change: {
      comparedTo: raw?.change?.comparedTo ?? 'PREVIOUS_MONTH',
      currentTotal: toAmount(raw?.change?.currentTotal),
      previousTotal: toAmount(raw?.change?.previousTotal),
      percent: typeof raw?.change?.percent === 'number' ? raw.change.percent : null,
    },
    points: (raw?.points ?? []).map((point, index) => ({
      label: point.label || `#${index + 1}`,
      start: point.start ?? '',
      end: point.end ?? '',
      ...toAmounts(point),
    })),
  }
}

// The backend's stage ids, in pipeline order
export const DISTRIBUTION_STAGES = ['RECEIVED', 'WASHING', 'DRYING', 'IRONING', 'QA', 'READY', 'HANDOVER'] as const
export type DistributionStageId = (typeof DISTRIBUTION_STAGES)[number]

// Orders in progress per production stage; all seven always come back
export type OrderDistribution = {
  // Branch uuid, empty when several branches are covered
  branch: string
  asOf: string
  totalActive: number
  stages: { id: DistributionStageId; count: number; percent: number }[]
}

type RawDistribution = {
  branch?: string | null
  asOf?: string | null
  totalActive?: number | null
  stages?: { id?: string; count?: number | null; percent?: number | null }[] | null
}

function toDistribution(raw: RawDistribution | null): OrderDistribution {
  return {
    branch: raw?.branch ?? '',
    asOf: raw?.asOf ?? '',
    totalActive: raw?.totalActive ?? 0,
    stages: DISTRIBUTION_STAGES.map((id) => {
      const stage = raw?.stages?.find((item) => item.id === id)
      return { id, count: stage?.count ?? 0, percent: stage?.percent ?? 0 }
    }),
  }
}

export type RevenueOverviewParams = { period: RevenuePeriod; branch?: string }

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Money collected, by how it was paid. Scoped like the order list: a
    // tenant owner gets every branch unless `branch` narrows it, anyone else
    // their own branch
    getRevenueOverview: build.query<RevenueOverview, RevenueOverviewParams>({
      query: ({ period, branch }) => ({ url: '/dashboard/revenue', params: branch ? { period, branch } : { period } }),
      transformResponse: (response: ApiResponse<RawOverview | null>, _meta, { period }) => toOverview(response.content, period),
      providesTags: [{ type: 'Payment', id: 'REVENUE' }],
    }),
    // Same scope as the revenue chart; `branch` narrows it
    getOrderDistribution: build.query<OrderDistribution, { branch?: string } | void>({
      query: (params) => ({ url: '/dashboard/orders/distribution', params: params?.branch ? { branch: params.branch } : undefined }),
      transformResponse: (response: ApiResponse<RawDistribution | null>) => toDistribution(response.content),
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),
    // Every order the caller can see
    getOrdersTotal: build.query<number, void>({
      query: () => '/dashboard/orders/total',
      transformResponse: (response: ApiResponse<number | null>) => response.content ?? 0,
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),
  }),
})

export const { useGetRevenueOverviewQuery, useGetOrderDistributionQuery, useGetOrdersTotalQuery } = dashboardApi
