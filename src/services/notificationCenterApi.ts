import type {
  AppNotification,
  ChannelStats,
  DeliveryState,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
  NotificationPriority,
} from '../types/notification'
import type { ApiResponse } from '../types/api'
import { api } from './api'

// The notification centre: the message log with its inbox flags. Not the bell
// in the top bar, which is the in-app notification API

type RawItem = {
  uuid?: string
  category?: string | null
  priority?: string | null
  title?: string | null
  message?: string | null
  audience?: string | null
  recipient?: string | null
  branch?: { uuid?: string; name?: string } | null
  channels?: string[] | null
  delivery?: string | null
  createdAt?: string | null
  scheduledFor?: string | null
  failure?: { reason?: string | null; attempts?: number | null; lastAttemptAt?: string | null } | null
  related?: { kind?: string; label?: string; to?: string } | null
  read?: boolean
  readAt?: string | null
  resolved?: boolean
  archived?: boolean
  createdBy?: string | null
}

const CHANNEL_FROM_SERVER: Record<string, NotificationChannel> = {
  IN_APP: 'In-App',
  EMAIL: 'Email',
  SMS: 'SMS',
  PUSH: 'Push',
  WHATSAPP: 'WhatsApp',
}

export const CHANNEL_TO_SERVER: Record<NotificationChannel, string> = {
  'In-App': 'IN_APP',
  Email: 'EMAIL',
  SMS: 'SMS',
  Push: 'PUSH',
  WhatsApp: 'WHATSAPP',
}

const PRIORITIES: Record<string, NotificationPriority> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

const CATEGORIES: NotificationCategory[] = ['orders', 'customers', 'operations', 'delivery', 'payments', 'inventory', 'staff', 'machines', 'system']

const toCategory = (value: string | null | undefined): NotificationCategory =>
  CATEGORIES.find((category) => category === value?.toLowerCase()) ?? 'system'

// QUEUED waits for its turn, a CANCELLED message counts as one that didn't go
const DELIVERY: Record<string, DeliveryState> = {
  DELIVERED: 'delivered',
  QUEUED: 'queued',
  SCHEDULED: 'scheduled',
  FAILED: 'failed',
  CANCELLED: 'failed',
}

function toNotifications(items: unknown): AppNotification[] {
  return (Array.isArray(items) ? (items as RawItem[]) : []).flatMap((raw) => {
    if (!raw?.uuid) return []
    const audience = raw.audience?.toUpperCase() ?? ''
    const cancelled = raw.delivery?.toUpperCase() === 'CANCELLED'
    return [
      {
        id: raw.uuid,
        category: toCategory(raw.category),
        priority: PRIORITIES[raw.priority?.toUpperCase() ?? ''] ?? 'Medium',
        title: raw.title ?? '',
        message: raw.message ?? '',
        audience: audience.includes('CUSTOMER') ? ('customer' as const) : audience.includes('STAFF') || audience.includes('OWNER') || audience.includes('MANAGER') ? ('staff' as const) : ('system' as const),
        recipient: raw.recipient ?? '',
        branchId: raw.branch?.uuid ?? '',
        channels: (raw.channels ?? []).flatMap((channel) => CHANNEL_FROM_SERVER[channel] ?? []),
        delivery: DELIVERY[raw.delivery?.toUpperCase() ?? ''] ?? 'delivered',
        createdAt: raw.createdAt ?? '',
        scheduledFor: raw.scheduledFor ?? null,
        failure: raw.failure
          ? { reason: raw.failure.reason ?? '', attempts: raw.failure.attempts ?? 0, lastAttemptAt: raw.failure.lastAttemptAt ?? '' }
          : cancelled
            ? { reason: 'Cancelled', attempts: 0, lastAttemptAt: '' }
            : null,
        related: raw.related?.to ? { kind: raw.related.kind ?? '', label: raw.related.label ?? '', to: raw.related.to } : null,
        read: raw.read === true,
        readAt: raw.readAt ?? null,
        resolved: raw.resolved === true,
        archived: raw.archived === true,
        createdBy: raw.createdBy ?? '',
      },
    ]
  })
}

export type CenterParams = {
  tab?: string
  priority?: string
  channel?: string
  branch?: string
  date?: string
  search?: string
  page?: number
  size?: number
}

// Inbox flags; send only what changes
export type InboxFlags = { read?: boolean; archived?: boolean; resolved?: boolean }

// POST /notification-center/messages. `audience`: CUSTOMERS, CUSTOMER:<uuid>,
// STAFF_ALL, STAFF_ROLE:<name>, BRANCH_MANAGERS or OWNER
export type ComposeBody = {
  audience: string
  channels: string[]
  title: string
  message: string
  // A manager is pinned to their branch; a platform admin must give one
  branch?: string
  // Local date-time without a zone, or none to send now
  scheduledFor?: string
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  category?: string
  marketing?: boolean
}

export type ComposeResult = { recipients: number; skipped: { reason: string; count: number }[]; scheduled: boolean }

type RawPreferences = {
  roles?: Record<string, string[]> | null
  quietHours?: { enabled?: boolean; from?: string; to?: string } | null
}

const TAG = { type: 'Notification' as const, id: 'CENTER' }
const PREFS = { type: 'Notification' as const, id: 'PREFERENCES' }

export const notificationCenterApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Newest first; archived rows only under tab ARCHIVED. One row per recipient and channel
    listCenter: build.query<AppNotification[], CenterParams | void>({
      query: (params) => ({ url: '/notification-center', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ data?: unknown[] }>) => toNotifications(response.content?.data),
      providesTags: [TAG],
    }),
    composeMessage: build.mutation<ComposeResult, ComposeBody>({
      query: (body) => ({ url: '/notification-center/messages', method: 'POST', body }),
      transformResponse: (response: ApiResponse<{ recipients?: number; skipped?: { reason?: string; count?: number }[]; scheduled?: boolean }>) => ({
        recipients: response.content?.recipients ?? 0,
        skipped: (response.content?.skipped ?? []).map(({ reason, count }) => ({ reason: reason ?? '', count: count ?? 0 })),
        scheduled: response.content?.scheduled === true,
      }),
      invalidatesTags: [TAG],
    }),
    updateCenterItem: build.mutation<void, { id: string } & InboxFlags>({
      query: ({ id, ...flags }) => ({ url: `/notification-center/${encodeURIComponent(id)}`, method: 'PATCH', body: flags }),
      transformResponse: () => undefined,
      invalidatesTags: [TAG],
    }),
    bulkUpdateCenter: build.mutation<number, { ids: string[] } & InboxFlags>({
      query: (body) => ({ url: '/notification-center/bulk', method: 'PATCH', body }),
      transformResponse: (response: ApiResponse<{ updated?: number }>) => response.content?.updated ?? 0,
      invalidatesTags: [TAG],
    }),
    readAllCenter: build.mutation<number, { category?: string } | void>({
      query: (body) => ({ url: '/notification-center/read-all', method: 'POST', body: body ?? {} }),
      transformResponse: (response: ApiResponse<{ updated?: number }>) => response.content?.updated ?? 0,
      invalidatesTags: [TAG],
    }),
    // 409 message_not_failed
    retryMessage: build.mutation<void, string>({
      query: (id) => ({ url: `/message-log/${encodeURIComponent(id)}/retry`, method: 'POST' }),
      transformResponse: () => undefined,
      invalidatesTags: [TAG],
    }),
    // Cancels a scheduled message. 409 message_not_scheduled
    cancelMessage: build.mutation<void, string>({
      query: (id) => ({ url: `/message-log/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [TAG],
    }),
    getChannelStats: build.query<ChannelStats[], number | void>({
      query: (days) => ({ url: '/notification-center/channels', params: { days: days ?? 30 } }),
      transformResponse: (
        response: ApiResponse<
          { channel?: string; status?: string; note?: string | null; sent?: number; delivered?: number; failed?: number; read?: number | null; avgSeconds?: number | string | null }[]
        >,
      ) =>
        (Array.isArray(response.content) ? response.content : []).flatMap((raw) => {
          const channel = CHANNEL_FROM_SERVER[raw.channel ?? '']
          if (!channel) return []
          return [
            {
              channel,
              status: raw.status === 'DOWN' ? ('Down' as const) : raw.status === 'DEGRADED' ? ('Degraded' as const) : ('Operational' as const),
              note: raw.note ?? '',
              sent: raw.sent ?? 0,
              delivered: raw.delivered ?? 0,
              failed: raw.failed ?? 0,
              read: raw.read ?? null,
              avgSeconds: Number(raw.avgSeconds) || 0,
            },
          ]
        }),
      providesTags: [TAG],
    }),
    // Which categories each role is alerted about, and the quiet hours. A role
    // with no entry is alerted about everything
    getNotificationPreferences: build.query<NotificationPreferences, void>({
      query: () => '/notification-preferences',
      transformResponse: (response: ApiResponse<RawPreferences>) => ({
        roles: Object.fromEntries(
          Object.entries(response.content?.roles ?? {}).map(([role, categories]) => [role, categories.map(toCategory)]),
        ),
        quietHours: {
          enabled: response.content?.quietHours?.enabled === true,
          from: response.content?.quietHours?.from ?? '22:00',
          to: response.content?.quietHours?.to ?? '07:00',
        },
      }),
      providesTags: [PREFS],
    }),
    // Replaces the role map and the quiet hours; owner and managers
    setNotificationPreferences: build.mutation<void, NotificationPreferences>({
      query: ({ roles, quietHours }) => ({
        url: '/notification-preferences',
        method: 'PUT',
        body: {
          roles: Object.fromEntries(Object.entries(roles).map(([role, categories]) => [role, categories.map((category) => category.toUpperCase())])),
          quietHours,
        },
      }),
      transformResponse: () => undefined,
      invalidatesTags: [PREFS],
    }),
  }),
})

export const {
  useListCenterQuery,
  useComposeMessageMutation,
  useUpdateCenterItemMutation,
  useBulkUpdateCenterMutation,
  useReadAllCenterMutation,
  useRetryMessageMutation,
  useCancelMessageMutation,
  useGetChannelStatsQuery,
  useGetNotificationPreferencesQuery,
  useSetNotificationPreferencesMutation,
} = notificationCenterApi
