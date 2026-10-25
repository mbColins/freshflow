import type { ApiResponse } from '../types/api'
import type { InAppNotification } from '../types/inAppNotification'
import { api } from './api'

// InAppNotificationResponse as sent
export type RawInAppNotification = {
  uuid?: string
  title?: string | null
  message?: string | null
  type?: string | null
  read?: boolean | null
  readAt?: string | null
  createdAt?: string | null
}

export function toInAppNotification(raw: RawInAppNotification): InAppNotification | null {
  if (!raw?.uuid) return null
  return {
    id: raw.uuid,
    title: raw.title ?? '',
    message: raw.message ?? '',
    type: raw.type ?? '',
    read: raw.read ?? false,
    readAt: raw.readAt ?? '',
    createdAt: raw.createdAt ?? '',
  }
}

const INBOX = { type: 'Notification' as const, id: 'INBOX' }
const UNREAD = { type: 'Notification' as const, id: 'UNREAD' }

// The signed-in user's own notifications (the bell). These keep working when
// the subscription has expired, so the expiry notice stays readable.
export const inAppNotificationApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Newest first
    listMyNotifications: build.query<InAppNotification[], void>({
      query: () => '/notifications',
      transformResponse: (response: ApiResponse<unknown>) =>
        (Array.isArray(response.content) ? (response.content as RawInAppNotification[]) : []).flatMap(
          (raw) => toInAppNotification(raw) ?? [],
        ),
      providesTags: [INBOX],
    }),
    getUnreadCount: build.query<number, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (response: ApiResponse<{ unreadCount?: number } | null>) => response.content?.unreadCount ?? 0,
      providesTags: [UNREAD],
    }),
    // Shown as read at once; undone if the server refuses
    markNotificationRead: build.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${encodeURIComponent(id)}/read`, method: 'PATCH' }),
      transformResponse: () => undefined,
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const readAt = new Date().toISOString()
        let wasUnread = false
        const list = dispatch(
          inAppNotificationApi.util.updateQueryData('listMyNotifications', undefined, (draft) => {
            const item = draft.find((notification) => notification.id === id)
            if (item && !item.read) {
              wasUnread = true
              item.read = true
              item.readAt = readAt
            }
          }),
        )
        const count = wasUnread
          ? dispatch(
              inAppNotificationApi.util.updateQueryData('getUnreadCount', undefined, (draft) => Math.max(0, draft - 1)),
            )
          : null
        try {
          await queryFulfilled
        } catch {
          list.undo()
          count?.undo()
        }
      },
    }),
  }),
})

export const { useListMyNotificationsQuery, useGetUnreadCountQuery, useMarkNotificationReadMutation } =
  inAppNotificationApi
