import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, CheckCheck } from 'lucide-react'
import useNotifications, { notificationStore } from '../../hooks/useNotifications'
import useNow from '../../hooks/useNow'
import type { AppNotification } from '../../types/notification'
import { compareNotifications, formatRelative, getPriority } from '../../utils/notifications'
import { CategoryGlyph } from '../notifications/NotificationsInbox'

const PANEL_TABS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'critical', label: 'Critical', match: (item: AppNotification) => item.priority === 'Critical' },
  { value: 'orders', label: 'Orders', match: (item: AppNotification) => item.category === 'orders' },
  { value: 'payments', label: 'Payments', match: (item: AppNotification) => item.category === 'payments' },
] as const

const MAX_SHOWN = 6

// The bell in the top bar: a quick look at the latest alerts, not a replacement for the full page
function NotificationBell() {
  const { notifications } = useNotifications()
  const now = useNow()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<(typeof PANEL_TABS)[number]['value']>('all')
  const rootRef = useRef<HTMLDivElement>(null)

  // What staff receive in the app; customer messages and scheduled sends stay on the full page
  const inbox = notifications.filter((item) => !item.archived && item.delivery !== 'scheduled' && item.audience !== 'customer')
  const unread = inbox.filter((item) => !item.read)
  const active = PANEL_TABS.find(({ value }) => value === tab)!
  const shown = inbox.filter(active.match).sort(compareNotifications).slice(0, MAX_SHOWN)

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

  function openNotification(id: string) {
    notificationStore.update([id], (item) => (item.read ? item : { ...item, read: true, readAt: new Date().toISOString() }))
    setOpen(false)
    navigate(`/notifications?open=${id}`)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${unread.length} unread`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread.length > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-line max-sm:fixed max-sm:top-14 max-sm:right-4">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="text-sm font-bold text-ink">Notifications</p>
            <p className="text-[11px] text-muted">{unread.length} unread</p>
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
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">You’re all caught up.</p>
          ) : (
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto border-t border-line">
              {shown.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(item.id)}
                    className={`flex w-full gap-2.5 px-3 py-2.5 text-left transition hover:bg-field focus-visible:bg-field focus-visible:outline-none ${item.read ? '' : 'bg-brand/5'}`}
                  >
                    <CategoryGlyph notification={item} />
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 text-xs text-ink ${item.read ? 'font-semibold' : 'font-extrabold'}`}>
                        <span className={`size-1.5 shrink-0 rounded-full ${getPriority(item.priority).dot}`} title={item.priority} aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </span>
                      <span className="line-clamp-2 text-[11px] text-muted">{item.message}</span>
                      <span className="text-[10px] text-muted">
                        {item.priority} · {formatRelative(item.createdAt, now)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <button
              type="button"
              disabled={unread.length === 0}
              onClick={() =>
                notificationStore.update(
                  unread.map(({ id }) => id),
                  (item) => ({ ...item, read: true, readAt: new Date().toISOString() }),
                )
              }
              className="flex items-center gap-1.5 rounded-sm text-[11px] font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all as read
            </button>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="rounded-sm text-[11px] font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
