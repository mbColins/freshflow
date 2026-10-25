import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, CheckCheck, Clock, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import useNotificationStream from '../../hooks/useNotificationStream'
import useNow from '../../hooks/useNow'
import {
  useGetUnreadCountQuery,
  useListMyNotificationsQuery,
  useMarkNotificationReadMutation,
} from '../../services/inAppNotificationApi'
import type { InAppNotification } from '../../types/inAppNotification'
import { formatRelative } from '../../utils/notifications'

const PANEL_TABS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'unread', label: 'Unread', match: (item: InAppNotification) => !item.read },
] as const

// Backend InAppNotificationType; any other type gets the plain bell
const TYPE_STYLES: Record<string, { icon: LucideIcon; className: string }> = {
  SUBSCRIPTION_EXPIRING_SOON: { icon: Clock, className: 'bg-warning/10 text-warning' },
  SUBSCRIPTION_EXPIRED: { icon: AlertTriangle, className: 'bg-danger/10 text-danger' },
}
const DEFAULT_STYLE = { icon: Bell, className: 'bg-brand/10 text-brand' }

function TypeGlyph({ type }: { type: string }) {
  const { icon: Icon, className } = TYPE_STYLES[type] ?? DEFAULT_STYLE
  return (
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  )
}

// The bell in the top bar: the signed-in user's own notifications, kept live
// by the server's notification stream
function NotificationBell() {
  useNotificationStream()
  const { data: notifications = [], isLoading, isError, isFetching, refetch } = useListMyNotificationsQuery()
  // The stream's "connected" event keeps this current; the query covers the
  // moments before it connects
  const { data: unreadCount = 0 } = useGetUnreadCountQuery()
  const [markRead] = useMarkNotificationReadMutation()
  const now = useNow()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<(typeof PANEL_TABS)[number]['value']>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((item) => !item.read)
  const active = PANEL_TABS.find(({ value }) => value === tab)!
  const shown = notifications.filter(active.match)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Opening one shows its whole message and marks it read
  function toggle(item: InAppNotification) {
    setExpandedId(expandedId === item.id ? null : item.id)
    if (!item.read) void markRead(item.id)
  }

  // There's no bulk endpoint, so each unread one is marked on its own
  function markAllRead() {
    for (const { id } of unread) void markRead(id)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-line max-sm:fixed max-sm:top-14 max-sm:right-4">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="text-sm font-bold text-ink">Notifications</p>
            <p className="text-[11px] text-muted">{unreadCount} unread</p>
          </div>
          <div role="tablist" aria-label="Notification panel filters" className="flex gap-1 px-3 pt-2">
            {PANEL_TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  tab === value ? 'bg-brand text-white' : 'bg-field text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              <p className="sr-only" role="status">Loading notifications…</p>
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-12 animate-pulse rounded-md bg-field" />
              ))}
            </div>
          ) : isError && notifications.length === 0 ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <p className="text-xs text-muted">Couldn’t load your notifications.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 text-[11px] font-bold text-brand hover:underline disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {isFetching ? 'Retrying…' : 'Try again'}
              </button>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">
              {tab === 'unread' && notifications.length > 0 ? 'You’re all caught up.' : 'No notifications yet.'}
            </p>
          ) : (
            <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto border-t border-line">
              {shown.map((item) => {
                const expanded = expandedId === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggle(item)}
                      className={`flex w-full gap-2.5 px-3 py-2.5 text-left transition hover:bg-field focus-visible:bg-field focus-visible:outline-none ${item.read ? '' : 'bg-brand/5'}`}
                    >
                      <TypeGlyph type={item.type} />
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1.5 text-xs text-ink ${item.read ? 'font-semibold' : 'font-extrabold'}`}>
                          {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
                          <span className="truncate">{item.title || 'Notification'}</span>
                          {!item.read && <span className="sr-only">(unread)</span>}
                        </span>
                        <span className={`text-[11px] whitespace-pre-line text-muted ${expanded ? '' : 'line-clamp-2'}`}>{item.message}</span>
                        {item.createdAt && <span className="text-[10px] text-muted">{formatRelative(item.createdAt, now)}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <button
              type="button"
              disabled={unread.length === 0}
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-sm text-[11px] font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
