import type { ApiResponse } from '../types/api'
import { api } from './api'
import { DISTRIBUTION_STAGES } from './dashboardApi'
import type { DistributionStageId } from './dashboardApi'

// The dashboard's cards, one small endpoint each so a slow card doesn't hold
// the others. All narrow to `branch` when one is given.

export type KpiPeriod = 'TODAY' | 'WEEK' | 'MONTH'

export type KpiTile = {
  value: number
  previous: number
  // Null when the previous period had nothing
  changePercent: number | null
  // YESTERDAY, PREVIOUS_WEEK or PREVIOUS_MONTH
  compareTo: string
  // 12 equal slices of the period
  trend: number[]
  // pending
  urgent: number
  // completed; null when nothing finished
  onTimePercent: number | null
  // customers
  newToday: number
}

export type Kpis = {
  currency: string
  totalOrders: KpiTile
  revenue: KpiTile
  pending: KpiTile
  completed: KpiTile
  customers: KpiTile
  averageTicket: KpiTile
}

export type PipelineStage = {
  id: DistributionStageId
  count: number
  share: number
  // Percent of capacity in use
  load: number
  items: number
  averageWaitMinutes: number
  machinesBusy: number | null
  machinesTotal: number | null
}

export type Pipeline = { inFlight: number; plantSpeedKgPerHour: number; stages: PipelineStage[] }

export type AttentionSeverity = 'CRITICAL' | 'WARNING'

export type AttentionItem = {
  id: string
  severity: AttentionSeverity
  // ORDER_OVERDUE, UNPAID_COLLECTION, MACHINE_FAULT, MAINTENANCE_OVERDUE, QC_FAILED, STOCK, DELIVERY_FAILED, PAYMENT_EXCEPTION, SUBSCRIPTION_EXPIRING
  kind: string
  title: string
  body: string
  action: { label: string; to: string } | null
  since: string
  branch: string
}

export type Attention = { total: number; items: AttentionItem[] }

export type LogisticsVehicle = {
  driver: string
  vehicle: string
  status: string
  stopsDone: number
  stopsTotal: number
  currentStop: string
  etaMinutes: number | null
}

export type LogisticsCardData = {
  pickups: number
  deliveries: number
  inTransit: number
  delivered: number
  activeRuns: number
  vehicles: LogisticsVehicle[]
}

export type SupplyLevel = 'OK' | 'LOW' | 'CRITICAL' | 'OUT'

export type SupplyItem = {
  id: string
  name: string
  stock: number
  max: number | null
  unit: string
  level: SupplyLevel
  daysLeft: number | null
}

export type Supplies = { critical: number; items: SupplyItem[] }

export type StaffEntry = {
  id: string
  name: string
  role: string
  headline: { label: string; value: number; unit: string }
  note: string
}

export type StaffCard = { shift: { name: string; from: string; to: string }; staff: StaffEntry[] }

export type Insight = {
  id: string
  icon: string
  title: string
  body: string
  values: Record<string, unknown>
}

export type DashboardEvent = {
  at: string
  // FLOOR_STAGE, FLOOR_MACHINE, FLOOR_QC, FLOOR_COUNT, FLOOR_NOTIFY, FLOOR_SYSTEM, PAYMENT_RECEIVED, DELIVERY_<status>
  type: string
  title: string
  body: string
  alert: boolean
  related: { kind: string; id: string } | null
}

type Num = number | string | null | undefined
// BigDecimal may arrive as a number or a string
const num = (value: Num) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}
const numOrNull = (value: Num) => (value === null || value === undefined ? null : num(value))
const text = (value: string | null | undefined) => value ?? ''

type RawTile = {
  value?: Num
  previous?: Num
  changePercent?: number | null
  compareTo?: string | null
  trend?: Num[] | null
  urgent?: number | null
  onTimePercent?: number | null
  newToday?: number | null
}
type RawKpis = { currency?: string | null } & Partial<
  Record<'totalOrders' | 'revenue' | 'pending' | 'completed' | 'customers' | 'averageTicket', RawTile | null>
>

const toTile = (raw: RawTile | null | undefined): KpiTile => ({
  value: num(raw?.value),
  previous: num(raw?.previous),
  changePercent: raw?.changePercent ?? null,
  compareTo: text(raw?.compareTo),
  trend: (raw?.trend ?? []).map(num),
  urgent: raw?.urgent ?? 0,
  onTimePercent: raw?.onTimePercent ?? null,
  newToday: raw?.newToday ?? 0,
})

const toKpis = (raw: RawKpis | null): Kpis => ({
  currency: raw?.currency ?? 'XAF',
  totalOrders: toTile(raw?.totalOrders),
  revenue: toTile(raw?.revenue),
  pending: toTile(raw?.pending),
  completed: toTile(raw?.completed),
  customers: toTile(raw?.customers),
  averageTicket: toTile(raw?.averageTicket),
})

type RawPipeline = {
  inFlight?: number | null
  plantSpeedKgPerHour?: Num
  stages?: {
    id?: string
    count?: number | null
    share?: number | null
    load?: number | null
    items?: Num
    averageWaitMinutes?: number | null
    machinesBusy?: number | null
    machinesTotal?: number | null
  }[] | null
}

// All seven stages always come back, in order
const toPipeline = (raw: RawPipeline | null): Pipeline => ({
  inFlight: raw?.inFlight ?? 0,
  plantSpeedKgPerHour: num(raw?.plantSpeedKgPerHour),
  stages: DISTRIBUTION_STAGES.map((id) => {
    const stage = raw?.stages?.find((item) => item.id === id)
    return {
      id,
      count: stage?.count ?? 0,
      share: stage?.share ?? 0,
      load: Math.min(100, Math.max(0, stage?.load ?? 0)),
      items: num(stage?.items),
      averageWaitMinutes: stage?.averageWaitMinutes ?? 0,
      machinesBusy: stage?.machinesBusy ?? null,
      machinesTotal: stage?.machinesTotal ?? null,
    }
  }),
})

type RawAttention = {
  total?: number | null
  items?: {
    id?: string
    severity?: string
    kind?: string
    title?: string | null
    body?: string | null
    action?: { label?: string | null; to?: string | null } | null
    since?: string | null
    branch?: { name?: string | null } | null
  }[] | null
}

const toAttention = (raw: RawAttention | null): Attention => ({
  total: raw?.total ?? raw?.items?.length ?? 0,
  items: (raw?.items ?? []).map((item, index) => ({
    id: item.id ?? String(index),
    severity: item.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
    kind: text(item.kind),
    title: text(item.title),
    body: text(item.body),
    action: item.action?.label ? { label: item.action.label, to: text(item.action.to) } : null,
    since: text(item.since),
    branch: text(item.branch?.name),
  })),
})

type RawLogistics = {
  pickups?: number | null
  deliveries?: number | null
  inTransit?: number | null
  delivered?: number | null
  activeRuns?: number | null
  vehicles?: {
    driver?: { name?: string | null } | null
    vehicle?: string | null
    status?: string | null
    stopsDone?: number | null
    stopsTotal?: number | null
    currentStop?: string | null
    etaMinutes?: number | null
  }[] | null
}

const toLogistics = (raw: RawLogistics | null): LogisticsCardData => ({
  pickups: raw?.pickups ?? 0,
  deliveries: raw?.deliveries ?? 0,
  inTransit: raw?.inTransit ?? 0,
  delivered: raw?.delivered ?? 0,
  activeRuns: raw?.activeRuns ?? 0,
  vehicles: (raw?.vehicles ?? []).map((vehicle) => ({
    driver: text(vehicle.driver?.name),
    vehicle: text(vehicle.vehicle),
    status: text(vehicle.status),
    stopsDone: vehicle.stopsDone ?? 0,
    stopsTotal: vehicle.stopsTotal ?? 0,
    currentStop: text(vehicle.currentStop),
    etaMinutes: vehicle.etaMinutes ?? null,
  })),
})

type RawSupplies = {
  critical?: number | null
  items?: { uuid?: string; name?: string | null; stock?: Num; max?: Num; unit?: string | null; level?: string | null; daysLeft?: number | null }[] | null
}

const toSupplies = (raw: RawSupplies | null): Supplies => ({
  critical: raw?.critical ?? 0,
  items: (raw?.items ?? []).map((item, index) => ({
    id: item.uuid ?? String(index),
    name: text(item.name),
    stock: num(item.stock),
    max: numOrNull(item.max),
    unit: text(item.unit),
    level: item.level === 'CRITICAL' || item.level === 'OUT' || item.level === 'LOW' ? item.level : 'OK',
    daysLeft: item.daysLeft ?? null,
  })),
})

type RawStaff = {
  shift?: { name?: string | null; from?: string | null; to?: string | null } | null
  staff?: {
    user?: { uuid?: string; name?: string | null; role?: string | null } | null
    headline?: { label?: string | null; value?: Num; unit?: string | null } | null
    note?: string | null
  }[] | null
}

const toStaffCard = (raw: RawStaff | null): StaffCard => ({
  shift: { name: text(raw?.shift?.name), from: text(raw?.shift?.from), to: text(raw?.shift?.to) },
  staff: (raw?.staff ?? []).map((entry, index) => ({
    id: entry.user?.uuid ?? String(index),
    name: text(entry.user?.name),
    role: text(entry.user?.role),
    headline: { label: text(entry.headline?.label), value: num(entry.headline?.value), unit: text(entry.headline?.unit) },
    note: text(entry.note),
  })),
})

type RawInsight = { id?: string; icon?: string | null; title?: string | null; body?: string | null; values?: Record<string, unknown> | null }
const toInsights = (raw: RawInsight[] | null): Insight[] =>
  (raw ?? []).map((item, index) => ({
    id: item.id ?? String(index),
    icon: text(item.icon),
    title: text(item.title),
    body: text(item.body),
    values: item.values ?? {},
  }))

export type RawEvent = {
  at?: string | null
  type?: string | null
  title?: string | null
  body?: string | null
  alert?: boolean | null
  related?: { kind?: string; id?: string } | null
}
export const toEvents = (raw: RawEvent[] | null): DashboardEvent[] =>
  (raw ?? []).map((event) => ({
    at: text(event.at),
    type: text(event.type),
    title: text(event.title),
    body: text(event.body),
    alert: !!event.alert,
    related: event.related?.kind ? { kind: event.related.kind, id: text(event.related.id) } : null,
  }))

export type CardParams = { branch?: string; limit?: number } | void
const cardParams = (params: CardParams, extra: Record<string, string> = {}) => {
  const query: Record<string, string | number> = { ...extra }
  if (params?.branch) query.branch = params.branch
  if (params?.limit) query.limit = params.limit
  return Object.keys(query).length ? query : undefined
}

export const dashboardCardsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The six tiles at the top; `period` sets the window and what it is compared with
    getKpis: build.query<Kpis, { period?: KpiPeriod; branch?: string } | void>({
      query: (params) => ({ url: '/dashboard/kpis', params: cardParams(params, { period: params?.period ?? 'TODAY' }) }),
      transformResponse: (response: ApiResponse<RawKpis | null>) => toKpis(response.content),
      providesTags: ['Dashboard'],
    }),
    getPipeline: build.query<Pipeline, { branch?: string } | void>({
      query: (params) => ({ url: '/dashboard/pipeline', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawPipeline | null>) => toPipeline(response.content),
      providesTags: ['Dashboard'],
    }),
    getAttention: build.query<Attention, CardParams>({
      query: (params) => ({ url: '/dashboard/attention', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawAttention | null>) => toAttention(response.content),
      providesTags: ['Dashboard'],
    }),
    // Hides an item for 24 hours for the caller
    dismissAttention: build.mutation<void, { id: string; branch?: string }>({
      query: ({ id, branch }) => ({
        url: `/dashboard/attention/${encodeURIComponent(id)}/dismiss`,
        method: 'POST',
        params: branch ? { branch } : undefined,
      }),
      invalidatesTags: ['Dashboard'],
    }),
    getDashboardLogistics: build.query<LogisticsCardData, { branch?: string } | void>({
      query: (params) => ({ url: '/dashboard/logistics', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawLogistics | null>) => toLogistics(response.content),
      providesTags: ['Dashboard'],
    }),
    getDashboardSupplies: build.query<Supplies, CardParams>({
      query: (params) => ({ url: '/dashboard/supplies', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawSupplies | null>) => toSupplies(response.content),
      providesTags: ['Dashboard'],
    }),
    // Managers and the owner only
    getDashboardStaff: build.query<StaffCard, CardParams>({
      query: (params) => ({ url: '/dashboard/staff', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawStaff | null>) => toStaffCard(response.content),
      providesTags: ['Dashboard'],
    }),
    getInsights: build.query<Insight[], { branch?: string } | void>({
      query: (params) => ({ url: '/dashboard/insights', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawInsight[] | null>) => toInsights(response.content),
      providesTags: ['Dashboard'],
    }),
    getDashboardEvents: build.query<DashboardEvent[], CardParams>({
      query: (params) => ({ url: '/dashboard/events', params: cardParams(params) }),
      transformResponse: (response: ApiResponse<RawEvent[] | null>) => toEvents(response.content),
      providesTags: ['Dashboard'],
    }),
  }),
})

export const {
  useGetKpisQuery,
  useGetPipelineQuery,
  useGetAttentionQuery,
  useDismissAttentionMutation,
  useGetDashboardLogisticsQuery,
  useGetDashboardSuppliesQuery,
  useGetDashboardStaffQuery,
  useGetInsightsQuery,
  useGetDashboardEventsQuery,
} = dashboardCardsApi
