import type { ApiResponse } from '../types/api'
import type { JobEvent, OpsJob, StageId } from '../types/operations'
import { api } from './api'

// The production floor: one processing job per order, moving through stages
// (RECEIVED, SORTING, WASHING, DRYING, IRONING, QC, PACKAGING, READY)

type RawJob = {
  order?: string
  customer?: string | null
  service?: string | null
  items?: number | null
  itemsFound?: number | null
  weightKg?: number | string | null
  postWashKg?: number | string | null
  stage?: string | null
  active?: boolean
  staff?: { uuid?: string; name?: string } | null
  machine?: { uuid?: string; code?: string; name?: string } | null
  stageSince?: string | null
  dueAt?: string | null
  priority?: string | null
  method?: string | null
  instructions?: string[] | null
  qcFailures?: number | null
  customerNotified?: boolean
  branch?: string | null
  history?: { at?: string | null; text?: string | null; by?: string | null }[] | null
}

const STAGE_IDS: StageId[] = ['received', 'sorting', 'washing', 'drying', 'ironing', 'qc', 'packaging', 'ready']

// BigDecimal may arrive as a number or a string
const num = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

// The server sends microseconds; browsers only read milliseconds reliably
const dateTime = (value: string | null | undefined) => (value ? value.replace(/(\.\d{3})\d+/, '$1') : '')

function toJobs(items: unknown): OpsJob[] {
  return (Array.isArray(items) ? (items as RawJob[]) : []).flatMap((raw) => {
    if (!raw?.order) return []
    return [
      {
        id: raw.order,
        customer: raw.customer ?? '',
        service: raw.service ?? '',
        items: raw.items ?? 0,
        itemsFound: raw.itemsFound ?? raw.items ?? 0,
        weightKg: num(raw.weightKg),
        postWashKg: raw.postWashKg == null ? null : num(raw.postWashKg),
        stage: STAGE_IDS.find((stage) => stage === raw.stage?.toLowerCase()) ?? 'received',
        active: raw.active === true,
        staff: raw.staff?.name ?? '',
        staffId: raw.staff?.uuid ?? '',
        machine: raw.machine?.name ?? '',
        machineId: raw.machine?.uuid ?? '',
        stageSince: dateTime(raw.stageSince),
        dueAt: dateTime(raw.dueAt),
        priority: raw.priority?.toUpperCase() === 'EXPRESS' ? ('Express' as const) : ('Normal' as const),
        method: raw.method?.toUpperCase() === 'DELIVERY' ? ('Delivery' as const) : ('Pickup' as const),
        instructions: raw.instructions ?? [],
        qcFailures: raw.qcFailures ?? 0,
        customerNotified: raw.customerNotified === true,
        branch: raw.branch ?? '',
        // Oldest first from the server; the pages show newest first
        history: (raw.history ?? [])
          .map((entry) => ({ at: dateTime(entry.at), text: entry.text ?? '', by: entry.by ?? '' }))
          .reverse(),
      },
    ]
  })
}

export type OpsSummary = {
  asOf: string
  health: 'Good' | 'Warning' | 'Critical'
  healthReason: string
  kpis: { inQueue: number; inProgress: number; delayed: number; express: number; readyToday: number; waitingTooLong: number }
  stages: { stage: StageId; waiting: number; active: number; avgMinutes: number | null }[]
  // Kilograms that reached READY today, in two-hour blocks
  kgByBlock: { from: string; to: string; kg: number }[]
}

type RawSummary = {
  asOf?: string | null
  health?: string | null
  healthReason?: string | null
  kpis?: Partial<OpsSummary['kpis']> | null
  stages?: { stage?: string; waiting?: number; active?: number; avgMinutes?: number | null }[] | null
  kgByBlock?: { from?: string; to?: string; kg?: number | string | null }[] | null
}

export type JobQuery = { branch?: string; page?: number; size?: number; stage?: string; view?: string; search?: string }

const LIST = { type: 'Operations' as const, id: 'LIST' }

// Every floor change touches the job, the machines it runs on, the order's
// status and the audit trail
const invalidates = (order: string) => [
  LIST,
  { type: 'Operations' as const, id: order },
  { type: 'Machine' as const, id: 'LIST' },
  { type: 'Order' as const, id: 'LIST' },
  { type: 'Audit' as const, id: 'LIST' },
]

export const operationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The queue, soonest due first. Scoped by the backend: a platform admin
    // sees everything, an owner their tenant, anyone else their branch
    listOpsJobs: build.query<OpsJob[], JobQuery | void>({
      query: (params) => ({ url: '/operations/jobs', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toJobs(response.content?.data),
      providesTags: [LIST],
    }),
    // One job with its history
    getOpsJob: build.query<OpsJob | undefined, string>({
      query: (order) => `/operations/jobs/${encodeURIComponent(order)}`,
      transformResponse: (response: ApiResponse<RawJob>) => toJobs([response.content])[0],
      providesTags: (_result, _error, order) => [{ type: 'Operations', id: order }],
    }),
    // Managers only
    getOpsSummary: build.query<OpsSummary, { branch?: string } | void>({
      query: (params) => ({ url: '/operations/summary', params: params?.branch ? { branch: params.branch } : undefined }),
      transformResponse: (response: ApiResponse<RawSummary>): OpsSummary => ({
        asOf: dateTime(response.content?.asOf),
        health: response.content?.health === 'CRITICAL' ? 'Critical' : response.content?.health === 'WARNING' ? 'Warning' : 'Good',
        healthReason: response.content?.healthReason ?? '',
        kpis: {
          inQueue: response.content?.kpis?.inQueue ?? 0,
          inProgress: response.content?.kpis?.inProgress ?? 0,
          delayed: response.content?.kpis?.delayed ?? 0,
          express: response.content?.kpis?.express ?? 0,
          readyToday: response.content?.kpis?.readyToday ?? 0,
          waitingTooLong: response.content?.kpis?.waitingTooLong ?? 0,
        },
        stages: (response.content?.stages ?? []).flatMap((item) => {
          const stage = STAGE_IDS.find((id) => id === item.stage?.toLowerCase())
          return stage ? [{ stage, waiting: item.waiting ?? 0, active: item.active ?? 0, avgMinutes: item.avgMinutes ?? null }] : []
        }),
        kgByBlock: (response.content?.kgByBlock ?? []).map((block) => ({ from: block.from ?? '', to: block.to ?? '', kg: num(block.kg) })),
      }),
      providesTags: [LIST],
    }),
    // The floor timeline, newest first
    listFloorEvents: build.query<(JobEvent & { order: string; alert: boolean })[], { branch?: string; limit?: number } | void>({
      query: (params) => ({ url: '/operations/events', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ at?: string; text?: string; by?: string; order?: string; alert?: boolean }[]>) =>
        (Array.isArray(response.content) ? response.content : []).map((event) => ({
          at: dateTime(event.at),
          text: event.text ?? '',
          by: event.by ?? '',
          order: event.order ?? '',
          alert: event.alert === true,
        })),
      providesTags: [LIST],
    }),

    // Begins the current stage. Machine stages need a free machine of the right
    // type: 409 machine_unsuitable, machine_busy, machine_not_operational,
    // machine_over_capacity, machine_wrong_branch; 400 weight_required; 409
    // staff_not_on_duty. `staff` defaults to the caller
    startStage: build.mutation<void, { order: string; staff?: string; machine?: string }>({
      query: ({ order, ...body }) => ({ url: `/operations/jobs/${encodeURIComponent(order)}/start`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
    // Finishes the stage and moves to the next. 409 qc_required, item_count_mismatch
    // (a manager can pass with a written `resolution`)
    advanceStage: build.mutation<void, { order: string; note?: string; postWashKg?: number; resolution?: string }>({
      query: ({ order, ...body }) => ({ url: `/operations/jobs/${encodeURIComponent(order)}/advance`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
    // One step forward is open to anyone who processes; skipping, going back or
    // passing QC is for managers (403 manager_required) with a reason
    moveStage: build.mutation<void, { order: string; stage: StageId; reason?: string; resolution?: string }>({
      query: ({ order, stage, ...body }) => ({
        url: `/operations/jobs/${encodeURIComponent(order)}/move`,
        method: 'POST',
        body: { stage: stage.toUpperCase(), ...body },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
    assignStaff: build.mutation<void, { order: string; staff: string }>({
      query: ({ order, staff }) => ({ url: `/operations/jobs/${encodeURIComponent(order)}/assign`, method: 'PATCH', body: { staff } }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
    // `weightKg` is the intake weight, which machines need as a load
    setFloorCounts: build.mutation<void, { order: string; itemsFound?: number; postWashKg?: number; weightKg?: number }>({
      query: ({ order, ...body }) => ({ url: `/operations/jobs/${encodeURIComponent(order)}/counts`, method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
    // Once READY. 409 no_consent when the customer can't be reached on the channel
    notifyFloorCustomer: build.mutation<void, { order: string; channel?: 'SMS' | 'EMAIL' | 'WHATSAPP' }>({
      query: ({ order, channel }) => ({
        url: `/operations/jobs/${encodeURIComponent(order)}/notify-customer`,
        method: 'POST',
        body: channel ? { channel } : {},
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { order }) => invalidates(order),
    }),
  }),
})

export const {
  useListOpsJobsQuery,
  useGetOpsJobQuery,
  useGetOpsSummaryQuery,
  useListFloorEventsQuery,
  useStartStageMutation,
  useAdvanceStageMutation,
  useMoveStageMutation,
  useAssignStaffMutation,
  useSetFloorCountsMutation,
  useNotifyFloorCustomerMutation,
} = operationsApi
