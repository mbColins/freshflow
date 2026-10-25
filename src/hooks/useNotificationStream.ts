import { useEffect } from 'react'
import { inAppNotificationApi, toInAppNotification } from '../services/inAppNotificationApi'
import type { RawInAppNotification } from '../services/inAppNotificationApi'
import { PRE_AUTH } from '../store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

// Waits between reconnects after an error, doubling up to the last one
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
// The server closes the stream after 30 minutes; reconnect at once then
const RECONNECT_MS = 500

type StreamEvent = { event: string; data: string }

// Reads a text/event-stream body and calls onEvent for each complete event.
// Comments (": ping") are skipped
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    // `stream: true` keeps a character split across chunks intact
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
    let end = buffer.indexOf('\n\n')
    while (end !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        const text = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = text
        else if (field === 'data') data.push(text)
      }
      if (data.length) onEvent({ event, data: data.join('\n') })
      end = buffer.indexOf('\n\n')
    }
  }
}

// Keeps the bell live: opens GET /notifications/stream with the session token
// and folds each pushed notification into the cached list and unread count.
// fetch is used instead of EventSource because the stream needs the
// Authorization header. Mount once (the top bar's bell does).
function useNotificationStream() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((state) => state.auth.token)
  const tokenType = useAppSelector((state) => state.auth.tokenType)

  useEffect(() => {
    if (!token || tokenType === PRE_AUTH) return
    const controller = new AbortController()
    let attempt = 0
    let timer: number | undefined

    function handle({ event, data }: StreamEvent) {
      let payload: unknown
      try {
        payload = JSON.parse(data)
      } catch {
        return
      }
      if (event === 'connected') {
        const count = (payload as { unreadCount?: number }).unreadCount
        if (typeof count === 'number') {
          dispatch(inAppNotificationApi.util.upsertQueryData('getUnreadCount', undefined, count))
        }
        // Catch up on anything that arrived while disconnected
        dispatch(inAppNotificationApi.util.invalidateTags([{ type: 'Notification', id: 'INBOX' }]))
      } else if (event === 'notification') {
        const notification = toInAppNotification(payload as RawInAppNotification)
        if (!notification) return
        let added = false
        dispatch(
          inAppNotificationApi.util.updateQueryData('listMyNotifications', undefined, (draft) => {
            if (draft.some(({ id }) => id === notification.id)) return
            draft.unshift(notification)
            added = true
          }),
        )
        if (!notification.read && added) {
          dispatch(inAppNotificationApi.util.updateQueryData('getUnreadCount', undefined, (draft) => draft + 1))
        }
      }
    }

    function retry(delay: number) {
      if (controller.signal.aborted) return
      timer = window.setTimeout(connect, delay)
    }

    async function connect() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (response.status === 401) {
          // Any API call refreshes an expired token (see services/api.ts); the
          // new token re-runs this effect and reconnects
          dispatch(inAppNotificationApi.endpoints.getUnreadCount.initiate(undefined, { forceRefetch: true })).unsubscribe()
          return
        }
        if (!response.ok || !response.body) throw new Error(`Stream refused: ${response.status}`)
        attempt = 0
        await readEvents(response.body, handle)
        // Closed by the server (30-minute limit, or a newer tab took the slot)
        retry(RECONNECT_MS)
      } catch {
        if (controller.signal.aborted) return
        retry(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)])
        attempt += 1
      }
    }

    void connect()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [dispatch, token, tokenType])
}

export default useNotificationStream
