import { useEffect } from 'react'
import { dashboardCardsApi, toEvents } from '../services/dashboardCardsApi'
import type { RawEvent } from '../services/dashboardCardsApi'
import { PRE_AUTH } from '../store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { readEvents } from '../utils/readEventStream'
import type { StreamEvent } from '../utils/readEventStream'

// Waits between reconnects after an error, doubling up to the last one
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
// The server ends a stream after a while; reconnect at once then
const RECONNECT_MS = 500

// Keeps the dashboard's event card live: opens GET /events/stream with the
// session token and puts each pushed event at the top of the cached feed.
// The stream covers the caller's whole scope, so it is only used when no
// branch is picked; a narrowed card relies on its polling instead.
// fetch is used instead of EventSource because the stream needs the
// Authorization header.
function useDashboardEventStream(limit: number, enabled: boolean) {
  const dispatch = useAppDispatch()
  const token = useAppSelector((state) => state.auth.token)
  const tokenType = useAppSelector((state) => state.auth.tokenType)

  useEffect(() => {
    if (!enabled || !token || tokenType === PRE_AUTH) return
    const controller = new AbortController()
    let attempt = 0
    let timer: number | undefined

    function handle({ event, data }: StreamEvent) {
      if (event === 'connected') {
        // Catch up on anything that happened while disconnected
        dispatch(dashboardCardsApi.util.invalidateTags(['Dashboard']))
        return
      }
      if (event !== 'event') return
      let payload: RawEvent
      try {
        payload = JSON.parse(data) as RawEvent
      } catch {
        return
      }
      const [incoming] = toEvents([payload])
      dispatch(
        dashboardCardsApi.util.updateQueryData('getDashboardEvents', { limit }, (draft) => {
          if (draft.some(({ at, title }) => at === incoming.at && title === incoming.title)) return
          draft.unshift(incoming)
          draft.length = Math.min(draft.length, limit)
        }),
      )
    }

    function retry(delay: number) {
      if (controller.signal.aborted) return
      timer = window.setTimeout(connect, delay)
    }

    async function connect() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/events/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (response.status === 401) {
          // Any API call refreshes an expired token (see services/api.ts); the
          // new token re-runs this effect and reconnects
          dispatch(dashboardCardsApi.endpoints.getDashboardEvents.initiate({ limit }, { forceRefetch: true })).unsubscribe()
          return
        }
        if (!response.ok || !response.body) throw new Error(`Stream refused: ${response.status}`)
        attempt = 0
        await readEvents(response.body, handle)
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
  }, [dispatch, token, tokenType, limit, enabled])
}

export default useDashboardEventStream
