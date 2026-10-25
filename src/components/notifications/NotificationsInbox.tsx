import type { RefObject } from 'react'
import { Link } from 'react-router'
import {
  Archive,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Clock,
  Inbox,
  MailWarning,
  RotateCcw,
  Search,
  Send,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  CHANNELS,
  PRIORITIES,
  TABS,
} from '../../constants/notifications'
import type {
  AppNotification,
  DeliveryState,
  NotificationFilters,
  NotificationTab,
} from '../../types/notification'
import {
  formatRelative,
  formatStamp,
  getCategory,
  getDeliveryRate,
  getPriority,
  getTimeline,
  matchesTab,
  needsAttention,
} from '../../utils/notifications'
import useChannelStats from '../../hooks/useChannelStats'
import { fieldClass, iconButton, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import Modal from '../ui/Modal'
import Panel from '../ui/Panel'

export type InboxActions = {
  now: number
  branchName: (id: string) => string
  onOpen: (id: string) => void
  onRead: (ids: string[], read: boolean) => void
  onResolve: (ids: string[]) => void
  onArchive: (ids: string[]) => void
  onRetry: (ids: string[]) => void
  onSendNow: (id: string) => void
  onCancel: (id: string) => void
}

const DELIVERY: Record<DeliveryState, { label: string; tone: BadgeTone; icon: LucideIcon }> = {
  delivered: { label: 'Delivered', tone: 'success', icon: CircleCheck },
  queued: { label: 'Queued', tone: 'warning', icon: Clock },
  scheduled: { label: 'Scheduled', tone: 'brand', icon: CalendarClock },
  failed: { label: 'Failed', tone: 'danger', icon: CircleAlert },
}

export function DeliveryBadge({ state }: { state: DeliveryState }) {
  const { label, tone, icon: Icon } = DELIVERY[state]
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function PriorityMark({ notification }: { notification: Pick<AppNotification, 'priority'> }) {
  const { dot } = getPriority(notification.priority)
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {notification.priority}
    </span>
  )
}

export function CategoryGlyph({ notification }: { notification: Pick<AppNotification, 'category' | 'priority' | 'delivery' | 'resolved'> }) {
  const { icon: Icon } = getCategory(notification.category)
  const urgent = !notification.resolved && (notification.priority === 'Critical' || notification.delivery === 'failed')
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${urgent ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand'}`} aria-hidden="true">
      <Icon className="size-4" />
    </span>
  )
}

// ---------- KPI cards ----------

export function NotificationKpis({
  notifications,
  selected,
  onTab,
}: {
  notifications: AppNotification[]
  selected: NotificationTab
  onTab: (tab: NotificationTab) => void
}) {
  const count = (tab: NotificationTab) => notifications.filter((item) => matchesTab(item, tab)).length
  const delivery = getDeliveryRate(useChannelStats().stats)
  const cards: { label: string; icon: LucideIcon; value: string; note: string; tone: string; tab?: NotificationTab }[] = [
    { label: 'Total', icon: Inbox, value: String(notifications.length), note: 'In the inbox', tone: 'text-brand', tab: 'all' },
    { label: 'Unread', icon: BellRing, value: String(count('unread')), note: 'Not opened yet', tone: 'text-brand', tab: 'unread' },
    { label: 'Critical Alerts', icon: TriangleAlert, value: String(count('critical')), note: 'Open and urgent', tone: 'text-danger', tab: 'critical' },
    { label: 'To Customers', icon: Users, value: String(count('customers')), note: 'Customer messages', tone: 'text-brand', tab: 'customers' },
    { label: 'To Staff', icon: Users, value: String(count('staff')), note: 'Staff alerts', tone: 'text-brand', tab: 'staff' },
    { label: 'Failed', icon: MailWarning, value: String(count('failed')), note: 'Not delivered', tone: 'text-danger', tab: 'failed' },
    { label: 'Scheduled', icon: CalendarClock, value: String(count('scheduled')), note: 'Waiting to send', tone: 'text-brand', tab: 'scheduled' },
    { label: 'Delivery Rate', icon: CheckCheck, value: `${delivery.rate.toFixed(1)}%`, note: 'All channels, 30 days', tone: 'text-success' },
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, icon: Icon, value, note, tone, tab }) => {
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
            </span>
            <span className="mt-1 block truncate text-xl font-bold text-ink tabular-nums">{value}</span>
            <span className="block truncate text-[11px] text-muted">{note}</span>
          </>
        )
        return (
          <li key={label} className="min-w-0">
            {tab ? (
              <button
                type="button"
                aria-pressed={selected === tab}
                onClick={() => onTab(tab)}
                className={`block h-full w-full rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected === tab ? 'ring-2 ring-brand' : 'ring-line'
                }`}
              >
                {body}
              </button>
            ) : (
              <div className="h-full rounded-xl bg-white p-3 ring-1 ring-line">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Channel health ----------

const CHANNEL_TONES: Record<string, BadgeTone> = { Operational: 'success', Degraded: 'warning', Down: 'danger' }

export function ChannelHealth() {
  const { stats: channelStats, isLoading } = useChannelStats()
  const { sent, delivered, failed, rate } = getDeliveryRate(channelStats)
  const issues = channelStats.filter(({ status }) => status !== 'Operational')
  if (isLoading) {
    return (
      <Panel title="Notification System Health" subtitle="Loading the last 30 days…">
        <div className="h-24 animate-pulse rounded-md bg-field" aria-busy="true" />
      </Panel>
    )
  }
  return (
    <Panel
      title="Notification System Health"
      subtitle={`${delivered.toLocaleString('en-US')} of ${sent.toLocaleString('en-US')} messages delivered in the last 30 days · ${failed} failed`}
      badge={<Badge tone={issues.length === 0 ? 'success' : 'warning'}>{issues.length === 0 ? 'All channels operational' : `${issues.length} channel degraded`}</Badge>}
    >
      <div className="flex items-center gap-3">
        <p className="text-2xl font-extrabold text-ink tabular-nums">{rate.toFixed(1)}%</p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-field" role="progressbar" aria-label="Delivery rate" aria-valuenow={Math.round(rate)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-success" style={{ width: `${rate}%` }} />
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {channelStats.map((stats) => (
          <li key={stats.channel} className="min-w-0 rounded-lg bg-field p-3">
            <p className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink">{stats.channel}</span>
              <Badge tone={CHANNEL_TONES[stats.status]}>{stats.status}</Badge>
            </p>
            <dl className="mt-2 space-y-0.5 text-[11px]">
              {(
                [
                  ['Sent', stats.sent.toLocaleString('en-US')],
                  ['Delivered', stats.sent === 0 ? '—' : `${((stats.delivered / stats.sent) * 100).toFixed(1)}%`],
                  ['Failed', String(stats.failed)],
                  [stats.channel === 'SMS' ? 'Read' : 'Opened / read', stats.read === null || stats.delivered === 0 ? 'Not reported' : `${Math.round((stats.read / stats.delivered) * 100)}%`],
                  ['Average time', `${stats.avgSeconds} s`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-semibold text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {issues.map(({ channel, status, note }) => (
        <p key={channel} className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink" role="status">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden="true" />
          <span><span className="font-bold">{channel} — {status}.</span> {note}</span>
        </p>
      ))}
    </Panel>
  )
}

// ---------- Tabs and filters ----------

export function NotificationTabs({
  notifications,
  selected,
  onSelect,
}: {
  notifications: AppNotification[]
  selected: NotificationTab
  onSelect: (tab: NotificationTab) => void
}) {
  return (
    <div className="relative overflow-x-auto">
      <div role="tablist" aria-label="Notification filters" className="flex min-w-max gap-1.5">
        {TABS.map(({ value, label }) => {
          const count = notifications.filter((item) => matchesTab(item, value)).length
          const active = selected === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-none ${
                active ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-line hover:bg-field'
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-white/20' : value === 'critical' && count > 0 ? 'bg-danger/10 text-danger' : 'bg-field text-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function NotificationToolbar({
  searchRef,
  filters,
  branches,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: NotificationFilters
  branches: { id: string; name: string }[]
  filtersActive: boolean
  onChange: (patch: Partial<NotificationFilters>) => void
  onReset: () => void
}) {
  const select = `${fieldClass} w-auto! max-sm:flex-1`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search notifications"
          placeholder="Search title, message, ID, customer, order..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className={`${fieldClass} pl-9`}
        />
      </div>
      <select aria-label="Priority" value={filters.priority} onChange={(event) => onChange({ priority: event.target.value as NotificationFilters['priority'] })} className={select}>
        <option value="">Any priority</option>
        {PRIORITIES.map(({ value }) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select aria-label="Channel" value={filters.channel} onChange={(event) => onChange({ channel: event.target.value as NotificationFilters['channel'] })} className={select}>
        <option value="">Any channel</option>
        {CHANNELS.map((channel) => (
          <option key={channel}>{channel}</option>
        ))}
      </select>
      <select aria-label="Branch" value={filters.branch} onChange={(event) => onChange({ branch: event.target.value })} className={select}>
        <option value="">All branches</option>
        {branches.map(({ id, name }) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
      <select aria-label="Date" value={filters.date} onChange={(event) => onChange({ date: event.target.value as NotificationFilters['date'] })} className={select}>
        <option value="">Any date</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="week">Last 7 days</option>
      </select>
      {filtersActive && (
        <button type="button" onClick={onReset} className={secondaryButton}>
          <RotateCcw className="size-3.5 text-muted" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  )
}

// ---------- Inbox ----------

function InboxRow({ notification, selected, onToggle, ...actions }: { notification: AppNotification; selected: boolean; onToggle: () => void } & InboxActions) {
  const { now, branchName, onOpen, onRead, onResolve, onRetry, onSendNow, onCancel } = actions
  const urgent = needsAttention(notification)
  const scheduled = notification.delivery === 'scheduled'
  return (
    <li className={`flex gap-3 px-3 py-3 ${urgent && notification.priority === 'Critical' ? 'bg-danger/5' : notification.read ? '' : 'bg-brand/5'}`}>
      <input
        type="checkbox"
        aria-label={`Select ${notification.title}`}
        checked={selected}
        onChange={onToggle}
        className="mt-2 size-4 shrink-0 accent-brand"
      />
      <CategoryGlyph notification={notification} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {!notification.read && <span className="size-2 shrink-0 self-center rounded-full bg-brand" aria-label="Unread" />}
          <button
            type="button"
            onClick={() => onOpen(notification.id)}
            className={`rounded-sm text-left text-xs text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${notification.read ? 'font-semibold' : 'font-extrabold'}`}
          >
            {notification.title}
          </button>
          <PriorityMark notification={notification} />
          {notification.resolved && <Badge tone="success">Resolved</Badge>}
          <span className="ml-auto text-[11px] whitespace-nowrap text-muted">
            {formatRelative(notification.scheduledFor ?? notification.createdAt, now)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{notification.message}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <DeliveryBadge state={notification.delivery} />
          <span>{notification.channels.join(' + ')}</span>
          <span>To: {notification.recipient}</span>
          {notification.branchId && <span>{branchName(notification.branchId)}</span>}
          {notification.failure && (
            <span className="font-semibold text-danger">
              {notification.failure.reason} · {notification.failure.attempts} {notification.failure.attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {notification.failure && (
            <button type="button" onClick={() => onRetry([notification.id])} className={`${primaryButton} h-7`}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          )}
          {scheduled && (
            <>
              <button type="button" onClick={() => onSendNow(notification.id)} className={`${primaryButton} h-7`}>
                <Send className="size-3.5" aria-hidden="true" />
                Send Now
              </button>
              <button type="button" onClick={() => onCancel(notification.id)} className={`${secondaryButton} h-7 text-danger`}>
                Cancel
              </button>
            </>
          )}
          {notification.related && (
            <Link to={notification.related.to} className={`${secondaryButton} h-7`}>
              {notification.related.label}
              <ArrowUpRight className="size-3 text-muted" aria-hidden="true" />
            </Link>
          )}
          {!scheduled && !notification.resolved && notification.audience !== 'customer' && (
            <button type="button" onClick={() => onResolve([notification.id])} className={`${secondaryButton} h-7`}>
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Resolve
            </button>
          )}
          {!scheduled && (
            <button type="button" onClick={() => onRead([notification.id], !notification.read)} className={`${secondaryButton} h-7`}>
              {notification.read ? 'Mark unread' : 'Mark read'}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

export function NotificationInbox({
  notifications,
  selectedIds,
  emptyMessage,
  onSelect,
  ...actions
}: {
  notifications: AppNotification[]
  selectedIds: string[]
  emptyMessage: string
  onSelect: (ids: string[]) => void
} & InboxActions) {
  const { onRead, onResolve, onArchive, onRetry } = actions
  const allSelected = notifications.length > 0 && notifications.every(({ id }) => selectedIds.includes(id))
  const failedSelected = notifications.filter(({ id, failure }) => failure && selectedIds.includes(id)).map(({ id }) => id)
  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={notifications.length === 0}
            onChange={(event) => onSelect(event.target.checked ? notifications.map(({ id }) => id) : [])}
            className="size-4 accent-brand"
          />
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${notifications.length} ${notifications.length === 1 ? 'notification' : 'notifications'}`}
        </label>
        {selectedIds.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Bulk actions">
            <button type="button" onClick={() => onRead(selectedIds, true)} className={`${secondaryButton} h-8`}>Mark read</button>
            <button type="button" onClick={() => onRead(selectedIds, false)} className={`${secondaryButton} h-8`}>Mark unread</button>
            <button type="button" onClick={() => onResolve(selectedIds)} className={`${secondaryButton} h-8`}>Resolve</button>
            {failedSelected.length > 0 && (
              <button type="button" onClick={() => onRetry(failedSelected)} className={`${secondaryButton} h-8`}>Retry failed ({failedSelected.length})</button>
            )}
            <button type="button" onClick={() => onArchive(selectedIds)} className={`${secondaryButton} h-8 text-danger`}>
              <Archive className="size-3.5" aria-hidden="true" />
              Archive
            </button>
            <button type="button" aria-label="Clear selection" onClick={() => onSelect([])} className={iconButton}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <CircleCheck className="mx-auto size-6 text-success" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold text-ink">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {notifications.map((notification) => (
            <InboxRow
              key={notification.id}
              notification={notification}
              selected={selectedIds.includes(notification.id)}
              onToggle={() => onSelect(selectedIds.includes(notification.id) ? selectedIds.filter((id) => id !== notification.id) : [...selectedIds, notification.id])}
              {...actions}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- Detail drawer ----------

export function NotificationDrawer({ notification, onClose, ...actions }: { notification: AppNotification | null; onClose: () => void } & InboxActions) {
  if (!notification) return null
  const { now, branchName, onRead, onResolve, onArchive, onRetry, onSendNow } = actions
  const details: [string, string][] = [
    ['Notification ID', notification.id],
    ['Type', getCategory(notification.category).label],
    ['Priority', `${notification.priority}: ${getPriority(notification.priority).help.toLowerCase()}`],
    ['Recipient', notification.recipient],
    ['Channel', notification.channels.join(' + ')],
    ['Branch', notification.branchId ? branchName(notification.branchId) : 'All branches'],
    ['Created', `${formatStamp(notification.createdAt)} by ${notification.createdBy}`],
    ...(notification.scheduledFor ? ([['Scheduled for', formatStamp(notification.scheduledFor)]] as [string, string][]) : []),
    ['Read', notification.read ? formatStamp(notification.readAt) : 'Not yet'],
  ]
  const run = (action: () => void) => () => {
    action()
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      title={notification.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <DeliveryBadge state={notification.delivery} />
          <PriorityMark notification={notification} />
          {notification.resolved && <Badge tone="success">Resolved</Badge>}
          <span>{formatRelative(notification.scheduledFor ?? notification.createdAt, now)}</span>
        </span>
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-field p-3">
          <p className={sectionTitle}>Message</p>
          <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-ink">{notification.message}</p>
        </div>

        {notification.failure && (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            <span>
              <span className="font-bold">Not delivered: {notification.failure.reason}.</span> {notification.failure.attempts}{' '}
              {notification.failure.attempts === 1 ? 'attempt' : 'attempts'}, last tried {formatRelative(notification.failure.lastAttemptAt, now)}.
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {notification.failure && (
            <button type="button" onClick={run(() => onRetry([notification.id]))} className={primaryButton}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry
            </button>
          )}
          {notification.delivery === 'scheduled' && (
            <button type="button" onClick={run(() => onSendNow(notification.id))} className={primaryButton}>
              <Send className="size-4" aria-hidden="true" />
              Send Now
            </button>
          )}
          {notification.related && (
            <Link to={notification.related.to} className={secondaryButton}>
              View {notification.related.kind}
              <ArrowUpRight className="size-3.5 text-muted" aria-hidden="true" />
            </Link>
          )}
          {notification.delivery !== 'scheduled' && (
            <>
              {!notification.resolved && (
                <button type="button" onClick={run(() => onResolve([notification.id]))} className={secondaryButton}>
                  <Check className="size-4 text-success" aria-hidden="true" />
                  Resolve
                </button>
              )}
              <button type="button" onClick={() => onRead([notification.id], !notification.read)} className={secondaryButton}>
                {notification.read ? 'Mark as Unread' : 'Mark as Read'}
              </button>
            </>
          )}
          <button type="button" onClick={run(() => onArchive([notification.id]))} className={`${secondaryButton} text-danger`}>
            <Archive className="size-4" aria-hidden="true" />
            Archive
          </button>
        </div>

        {notification.related && (
          <p className="text-xs text-muted">
            Related {notification.related.kind.toLowerCase()}: <span className="font-semibold text-ink">{notification.related.label}</span>
          </p>
        )}

        <div>
          <p className={sectionTitle}>Details</p>
          <dl className="mt-1 divide-y divide-line text-xs">
            {details.map(([label, value]) => (
              <div key={label} className="flex gap-3 py-1.5">
                <dt className="w-28 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 break-words font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className={sectionTitle}>Timeline</p>
          <ol className="mt-2 space-y-3 border-l border-line pl-4">
            {getTimeline(notification).map(({ label, at, state }) => (
              <li key={label} className="relative text-xs">
                <span
                  className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-2 ring-white ${state === 'done' ? 'bg-success' : state === 'failed' ? 'bg-danger' : 'bg-muted/40'}`}
                  aria-hidden="true"
                />
                <p className={`font-semibold ${state === 'failed' ? 'text-danger' : state === 'pending' ? 'text-muted' : 'text-ink'}`}>
                  {label}
                  {state === 'pending' && <span className="ml-1.5 font-normal">(not yet)</span>}
                </p>
                {at && <p className="text-[11px] text-muted">{formatStamp(at)}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}
