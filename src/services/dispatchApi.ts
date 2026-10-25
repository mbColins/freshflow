import { DEPOT } from '../constants/logistics'
import type { ApiResponse } from '../types/api'
import type { DispatchJob, JobPriority, JobStatus, JobType } from '../types/logistics'
import { api } from './api'

// ---------- Wire formats ----------

// Backend DispatchJobStatus, DispatchPriority and DispatchJobType
export type ApiJobStatus = 'SCHEDULED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type ApiPriority = 'STANDARD' | 'EXPRESS' | 'SAME_DAY'

type RawEvent = { status?: string | null; note?: string | null; actor?: string | null; createdAt?: string | null }

// DispatchJobResponse as sent
type RawJob = {
  id?: number | null
  uuid?: string
  type?: string | null
  orderNumber?: string | null
  customerName?: string | null
  customerPhone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  zone?: string | null
  zoneName?: string | null
  branch?: string | null
  manifest?: string | null
  amountDue?: number | string | null
  fee?: number | string | null
  priority?: string | null
  status?: string | null
  driver?: string | null
  driverName?: string | null
  instructions?: string | null
  scheduledAt?: string | null
  readyAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  // Only on GET /logistics/jobs/{jobId}
  events?: RawEvent[] | null
}

// DispatchJobRequest. Dates are LocalDateTime: local wall-clock time, no zone
export type DispatchJobRequest = {
  type: 'PICKUP' | 'DELIVERY'
  orderNumber?: string
  customerName: string
  customerPhone: string
  address: string
  latitude?: number
  longitude?: number
  // Zone uuid; the job's branch comes from it
  zone: string
  manifest?: string
  amountDue?: number
  priority: ApiPriority
  scheduledAt: string
  readyAt?: string
  // Creates the job already ASSIGNED
  driver?: string
  instructions?: string
}

// LogisticsSettingsRequest / Response
export type LogisticsSettings = {
  pickupFee: number
  expressSurcharge: number
  sameDaySurcharge: number
  freeDeliveryThreshold: number
  delayLimitMinutes: number
}

// ---------- Mapping to the page's model ----------

const STATUS_FROM_API: Record<ApiJobStatus, JobStatus> = {
  SCHEDULED: 'scheduled',
  ASSIGNED: 'assigned',
  EN_ROUTE: 'enRoute',
  ARRIVED: 'arrived',
  COMPLETED: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}
// The page's 'requested' and 'received' have no backend status
export const STATUS_TO_API: Partial<Record<JobStatus, ApiJobStatus>> = {
  scheduled: 'SCHEDULED',
  assigned: 'ASSIGNED',
  enRoute: 'EN_ROUTE',
  arrived: 'ARRIVED',
  done: 'COMPLETED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
}
const PRIORITY_FROM_API: Record<ApiPriority, JobPriority> = { STANDARD: 'standard', EXPRESS: 'express', SAME_DAY: 'sameDay' }
export const PRIORITY_TO_API: Record<JobPriority, ApiPriority> = { standard: 'STANDARD', express: 'EXPRESS', sameDay: 'SAME_DAY' }

// LocalDateTime string <-> what the page keeps. A zone-less ISO string is read
// as local time by Date, which is what the backend means
export function toLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const toIso = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

// The page's map is an illustration, not to scale. Until it draws real
// coordinates, each zone gets a fixed spot around the depot so its jobs group
function mapPosition(zone: string, id: string) {
  const hash = (text: string) => [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  const angle = ((hash(zone || 'none') % 360) * Math.PI) / 180
  const spread = (hash(id) % 30) - 15
  return { x: Math.round(DEPOT.x + Math.cos(angle) * (110 + spread)), y: Math.round(DEPOT.y + Math.sin(angle) * (80 + spread)) }
}

// The notes this page writes on status changes, so the drawer can show them as
// proof and failure details again (see LogisticsPage)
export const proofNote = (recipient: string, method: string) => `Delivered to ${recipient} (${method})`
export const failureNote = (reason: string, notes: string, nextAction: string) =>
  [reason, notes, nextAction && `Next: ${nextAction}`].filter(Boolean).join(' · ')

function readProof(note: string) {
  const match = /^Delivered to (.+) \((.+)\)$/.exec(note)
  return match ? { recipient: match[1], method: match[2] } : null
}
function readFailure(note: string) {
  const parts = note.split(' · ')
  const next = parts.at(-1)?.startsWith('Next: ') ? parts.pop()!.slice(6) : ''
  return { reason: parts[0] || 'Failed attempt', notes: parts.slice(1).join(' · '), nextAction: next }
}

export function toDispatchJob(raw: RawJob): DispatchJob | null {
  if (!raw?.uuid) return null
  const status = STATUS_FROM_API[raw.status as ApiJobStatus] ?? 'scheduled'
  const type: JobType = raw.type === 'DELIVERY' ? 'delivery' : 'pickup'
  const amount = toAmount(raw.amountDue)
  const updatedAt = toIso(raw.updatedAt) || toIso(raw.createdAt)
  const events = (raw.events ?? []).map((event) => ({
    at: toIso(event.createdAt),
    status: event.status ?? '',
    note: event.note ?? '',
    actor: event.actor ?? '',
  }))
  // The latest completed / failed event carries the details this page wrote
  const lastEvent = (apiStatus: ApiJobStatus) => [...events].reverse().find((event) => event.status === apiStatus)
  const completed = lastEvent('COMPLETED')
  const failed = lastEvent('FAILED')
  const { x, y } = mapPosition(raw.zone ?? '', raw.uuid)

  return {
    id: raw.uuid,
    type,
    orderId: raw.orderNumber || 'No order yet',
    customer: raw.customerName ?? '',
    phone: raw.customerPhone ?? '',
    address: raw.address ?? '',
    zone: raw.zoneName ?? '',
    instructions: raw.instructions ?? '',
    manifest: raw.manifest ?? '',
    // Not tracked by the backend yet
    packages: 1,
    amount,
    payment: amount > 0 ? 'Collect on delivery' : 'Nothing to collect',
    paymentTone: amount > 0 ? 'warning' : 'neutral',
    priority: PRIORITY_FROM_API[raw.priority as ApiPriority] ?? 'standard',
    status,
    driverId: raw.driver || null,
    scheduledAt: toIso(raw.scheduledAt),
    readyAt: toIso(raw.readyAt) || null,
    etaMin: null,
    distanceKm: 0,
    timeline: events.map(({ at, note, status: eventStatus, actor }) => ({
      at,
      text: [note || eventStatus.replace('_', ' ').toLowerCase(), actor && `by ${actor}`].filter(Boolean).join(' · '),
    })),
    ...(status === 'done'
      ? {
          proof: {
            ...(readProof(completed?.note ?? '') ?? { recipient: raw.customerName ?? '', method: 'Completed' }),
            at: completed?.at || updatedAt,
          },
        }
      : {}),
    ...(status === 'failed' ? { failure: { ...readFailure(failed?.note ?? ''), at: failed?.at || updatedAt } } : {}),
    x,
    y,
    fee: toAmount(raw.fee),
    driverName: raw.driverName ?? '',
    branchId: raw.branch ?? '',
    zoneId: raw.zone ?? '',
    code: raw.id ? `${type === 'pickup' ? 'PCK' : 'DLV'}-${String(raw.id).padStart(5, '0')}` : undefined,
  }
}

// ---------- Endpoints ----------

// The backend requires both `filter` (the field to search) and `search`, even when empty
export type JobListParams = { filter: string; search: string; page?: number; size?: number }

const LIST = { type: 'Logistics' as const, id: 'JOBS' }
const jobTag = (id: string) => ({ type: 'Logistics' as const, id: `JOB-${id}` })

export const dispatchApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend to the caller's branch, or the tenant for an owner
    listJobs: build.query<DispatchJob[], JobListParams>({
      query: (params) => ({ url: '/logistics/jobs', params }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[] } | null
        const raw = (Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])) as RawJob[]
        return raw.flatMap((job) => toDispatchJob(job) ?? [])
      },
      providesTags: [LIST],
    }),
    // With the events timeline
    getJob: build.query<DispatchJob | null, string>({
      query: (id) => `/logistics/jobs/${encodeURIComponent(id)}`,
      transformResponse: (response: ApiResponse<RawJob>) => toDispatchJob(response.content),
      providesTags: (_result, _error, id) => [jobTag(id)],
    }),
    createJob: build.mutation<void, DispatchJobRequest>({
      query: (job) => ({ url: '/logistics/jobs', method: 'POST', body: job }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    // Only while the job is SCHEDULED or ASSIGNED
    assignJob: build.mutation<void, { id: string; driver: string }>({
      query: ({ id, driver }) => ({ url: `/logistics/jobs/${encodeURIComponent(id)}/assign`, method: 'PATCH', body: { driver } }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [LIST, jobTag(id)],
    }),
    // Refused outside the allowed transitions; logs a timeline event with the note
    changeJobStatus: build.mutation<void, { id: string; status: ApiJobStatus; note?: string }>({
      query: ({ id, status, note }) => ({
        url: `/logistics/jobs/${encodeURIComponent(id)}/status`,
        method: 'PATCH',
        body: note ? { status, note } : { status },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [LIST, jobTag(id)],
    }),
    // Zeros when the branch never saved settings
    getLogisticsSettings: build.query<LogisticsSettings, string>({
      query: (branchId) => `/logistics/settings/${encodeURIComponent(branchId)}`,
      transformResponse: (response: ApiResponse<Partial<Record<keyof LogisticsSettings, number | string | null>>>) => {
        const content = response.content ?? {}
        return {
          pickupFee: toAmount(content.pickupFee),
          expressSurcharge: toAmount(content.expressSurcharge),
          sameDaySurcharge: toAmount(content.sameDaySurcharge),
          freeDeliveryThreshold: toAmount(content.freeDeliveryThreshold),
          delayLimitMinutes: toAmount(content.delayLimitMinutes),
        }
      },
      providesTags: (_result, _error, branchId) => [{ type: 'Logistics', id: `SETTINGS-${branchId}` }],
    }),
    // Owner or platform admin only
    updateLogisticsSettings: build.mutation<void, { branchId: string; settings: LogisticsSettings }>({
      query: ({ branchId, settings }) => ({
        url: `/logistics/settings/${encodeURIComponent(branchId)}`,
        method: 'PUT',
        body: settings,
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { branchId }) => [{ type: 'Logistics', id: `SETTINGS-${branchId}` }],
    }),
  }),
})

export const {
  useListJobsQuery,
  useGetJobQuery,
  useCreateJobMutation,
  useAssignJobMutation,
  useChangeJobStatusMutation,
  useGetLogisticsSettingsQuery,
  useUpdateLogisticsSettingsMutation,
} = dispatchApi
