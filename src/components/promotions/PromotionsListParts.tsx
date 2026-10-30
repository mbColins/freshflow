import { useState } from 'react'
import type { RefObject } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  Ellipsis,
  Megaphone,
  Pause,
  Pencil,
  Percent,
  Play,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useServiceNames } from '../../hooks/usePromotions'
import {
  AUDIENCES,
  PROMOTION_STATUSES,
  PROMOTION_TYPES,
  STACKING_MODES,
} from '../../constants/promotions'
import type { PromotionPermissions } from '../../constants/promotions'
import type {
  Promotion,
  PromotionFilters,
  PromotionStatus,
  StackingPolicy,
} from '../../types/promotion'
import {
  dayNumber,
  formatBranches,
  formatDay,
  formatDays,
  formatDelta,
  formatOffer,
  formatServices,
  formatValidity,
  getBannerClass,
  getChannelBreakdown,
  getConversion,
  getCountdown,
  getPromotionStatus,
  getTypeMeta,
  sumStats,
  toDateKey,
} from '../../utils/promotions'
import type { PromotionSortKey } from '../../utils/promotions'
import { formatCompactXaf } from '../../utils/services'
import {
  fieldClass,
  iconButton,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import Panel, { PanelEmpty } from '../ui/Panel'
import { PromotionCode, PromotionStatusBadge, UsageBar } from './PromotionBits'

const number = (value: number) => value.toLocaleString('en-US')

export type PromotionActions = {
  permissions: PromotionPermissions
  now: number
  branches: { id: string; name: string }[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onTogglePause: (id: string) => void
  onDuplicate: (id: string) => void
  onArchive: (id: string) => void
  onCopyCode: (code: string) => void
}

// ---------- KPI cards ----------

export function PromotionKpis({
  promotions,
  now,
  permissions,
  selected,
  onStatus,
}: {
  promotions: Promotion[]
  now: number
  permissions: PromotionPermissions
  selected: PromotionStatus | ''
  onStatus: (status: PromotionStatus | '') => void
}) {
  const count = (status: PromotionStatus) =>
    promotions.filter((promotion) => getPromotionStatus(promotion, now) === status).length
  const current = sumStats(promotions.map(({ stats }) => stats))
  const previous = sumStats(promotions.map((promotion) => promotion.previous))
  const soon = promotions.filter(
    (promotion) =>
      getPromotionStatus(promotion, now) === 'scheduled' &&
      dayNumber(promotion.startAt) - dayNumber(toDateKey(now)) <= 14,
  ).length

  const cards: {
    label: string
    icon: LucideIcon
    value: string
    note: string
    // Whether the comparison moved the right way; undefined shows no trend arrow
    good?: boolean
    status?: PromotionStatus
  }[] = [
    { label: 'Active Promotions', icon: Megaphone, value: String(count('active')), note: `${count('paused')} paused`, status: 'active' },
    { label: 'Scheduled', icon: CalendarClock, value: String(count('scheduled')), note: `${soon} starting within 14 days`, status: 'scheduled' },
    { label: 'Orders From Promotions', icon: ShoppingBag, value: number(current.uses), note: `${formatDelta(current.uses, previous.uses)} vs previous period`, good: current.uses >= previous.uses },
    ...(permissions.financials
      ? [
          { label: 'Discount Given', icon: ReceiptText, value: formatCompactXaf(current.discount), note: `${formatDelta(current.discount, previous.discount)} vs previous period` },
          { label: 'Promotion Revenue', icon: Banknote, value: formatCompactXaf(current.revenue), note: `${formatDelta(current.revenue, previous.revenue)} vs previous period`, good: current.revenue >= previous.revenue },
        ]
      : []),
    { label: 'Conversion Rate', icon: Percent, value: `${getConversion(current).toFixed(1)}%`, note: `${formatDelta(getConversion(current), getConversion(previous), true)} vs previous period`, good: getConversion(current) >= getConversion(previous) },
  ]

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, icon: Icon, value, note, good, status }) => {
        const Trend = good ? TrendingUp : TrendingDown
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
            </span>
            <span className="mt-1 block truncate text-xl font-bold text-ink tabular-nums">{value}</span>
            <span className={`flex items-center gap-1 text-[11px] ${good === undefined ? 'text-muted' : good ? 'text-success' : 'text-danger'}`}>
              {good !== undefined && <Trend className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{note}</span>
            </span>
          </>
        )
        return (
          <li key={label} className="min-w-0">
            {status ? (
              <button
                type="button"
                aria-pressed={selected === status}
                onClick={() => onStatus(selected === status ? '' : status)}
                className={`block h-full w-full rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected === status ? 'ring-2 ring-brand' : 'ring-line'
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

// ---------- Status overview ----------

export function PromotionStatusSummary({
  promotions,
  now,
  selected,
  onSelect,
}: {
  promotions: Promotion[]
  now: number
  selected: PromotionStatus | ''
  onSelect: (status: PromotionStatus | '') => void
}) {
  const groups = PROMOTION_STATUSES.map((status) => ({
    ...status,
    count: promotions.filter((promotion) => getPromotionStatus(promotion, now) === status.value).length,
  }))
  return (
    <Panel title="Campaign Status" subtitle="Click a status to filter the list">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {groups
          .filter(({ count }) => count > 0)
          .map(({ value, bar, count }) => (
            <span key={value} className={`${bar} rounded-full`} style={{ flexGrow: count }} />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {groups.map(({ value, label, icon: Icon, bar, count }) => (
          <li key={value}>
            <button
              type="button"
              aria-pressed={selected === value}
              onClick={() => onSelect(selected === value ? '' : value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                selected === value ? 'bg-brand/10 text-brand ring-1 ring-brand' : 'bg-field text-ink hover:bg-line'
              }`}
            >
              <span className={`size-2 rounded-full ${bar}`} aria-hidden="true" />
              <Icon className="size-3.5 text-muted" aria-hidden="true" />
              {label}
              <span className="tabular-nums">— {count}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ---------- Stacking policy banner ----------

export function StackingBanner({
  promotions,
  now,
  policy,
  canManage,
  onConfigure,
}: {
  promotions: Promotion[]
  now: number
  policy: StackingPolicy
  canManage: boolean
  onConfigure: () => void
}) {
  const mode = STACKING_MODES.find(({ value }) => value === policy.mode)!
  const budgeted = promotions.filter(
    (promotion) => promotion.budget !== null && getPromotionStatus(promotion, now) === 'active',
  )
  const budget = budgeted.reduce((sum, promotion) => sum + promotion.budget!, 0)
  const spent = budgeted.reduce((sum, promotion) => sum + promotion.stats.discount, 0)
  const share = budget === 0 ? 0 : Math.min(100, (spent / budget) * 100)
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-brand/5 p-4 ring-1 ring-brand/20">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-sm font-bold text-ink">Stacking rule: {mode.label}</h2>
        <p className="text-[11px] text-muted">
          {mode.detail}
          {policy.mode !== 'none' && ` Combined discounts are capped at ${policy.maxCombined}% of an order.`}
        </p>
      </div>
      {budget > 0 && (
        <div className="w-full sm:w-56">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-muted">Active campaign budgets used</span>
            <span className="font-bold text-ink tabular-nums">{share.toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
            <div className={`h-full rounded-full ${share >= 90 ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${share}%` }} />
          </div>
          <p className="mt-0.5 text-[10px] text-muted tabular-nums">
            {formatCompactXaf(spent)} of {formatCompactXaf(budget)}
          </p>
        </div>
      )}
      {canManage && (
        <button type="button" onClick={onConfigure} className={secondaryButton}>
          Configure Stacking Rules
        </button>
      )}
    </section>
  )
}

// ---------- Search and filters ----------

export function PromotionToolbar({
  searchRef,
  filters,
  branches,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: PromotionFilters
  branches: { id: string; name: string }[]
  filtersActive: boolean
  onChange: (patch: Partial<PromotionFilters>) => void
  onReset: () => void
}) {
  const serviceNames = useServiceNames()
  const select = `${fieldClass} w-auto! max-sm:flex-1`
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search promotions"
          placeholder="Search promotions, codes, campaigns..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className={`${fieldClass} h-10 pl-9`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Status" value={filters.status} onChange={(event) => onChange({ status: event.target.value as PromotionFilters['status'] })} className={select}>
          <option value="">All statuses</option>
          {PROMOTION_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Promotion type" value={filters.type} onChange={(event) => onChange({ type: event.target.value as PromotionFilters['type'] })} className={select}>
          <option value="">All types</option>
          {PROMOTION_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Branch" value={filters.branch} onChange={(event) => onChange({ branch: event.target.value })} className={select}>
          <option value="">All branches</option>
          {branches.map(({ id, name }) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select aria-label="Service" value={filters.service} onChange={(event) => onChange({ service: event.target.value })} className={select}>
          <option value="">All services</option>
          {serviceNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select aria-label="Customer group" value={filters.audience} onChange={(event) => onChange({ audience: event.target.value as PromotionFilters['audience'] })} className={select}>
          <option value="">Any customer group</option>
          {AUDIENCES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Running during" value={filters.date} onChange={(event) => onChange({ date: event.target.value as PromotionFilters['date'] })} className={select}>
          <option value="">Any date</option>
          <option value="today">Running today</option>
          <option value="week">Running this week</option>
          <option value="month">Running this month</option>
          <option value="custom">Custom range</option>
        </select>
        {filters.date === 'custom' && (
          <>
            <input type="date" aria-label="From" value={filters.from} onChange={(event) => onChange({ from: event.target.value })} className={`${fieldClass} w-36!`} />
            <input type="date" aria-label="To" value={filters.to} min={filters.from} onChange={(event) => onChange({ to: event.target.value })} className={`${fieldClass} w-36!`} />
          </>
        )}
        {filtersActive && (
          <button type="button" onClick={onReset} className={secondaryButton}>
            <RotateCcw className="size-3.5 text-muted" aria-hidden="true" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Shared actions ----------

function PauseButton({ promotion, status, onTogglePause }: { promotion: Promotion; status: PromotionStatus } & Pick<PromotionActions, 'onTogglePause'>) {
  if (status !== 'active' && status !== 'scheduled' && status !== 'paused') return null
  const paused = status === 'paused'
  const Icon = paused ? Play : Pause
  return (
    <button
      type="button"
      aria-label={`${paused ? 'Resume' : 'Pause'} ${promotion.name}`}
      title={paused ? 'Resume' : 'Pause'}
      onClick={() => onTogglePause(promotion.id)}
      className={`${iconButton} ring-1 ring-line`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

function PromotionMenu({ promotion, status, permissions, onView, onDuplicate, onArchive, onCopyCode }: { promotion: Promotion; status: PromotionStatus } & PromotionActions) {
  return (
    <Menu
      label={`More actions for ${promotion.name}`}
      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
      triggerClassName={`${iconButton} ring-1 ring-line`}
    >
      {(close) => {
        const run = (action: () => void) => () => {
          close()
          action()
        }
        return (
          <>
            <MenuItem onSelect={run(() => onView(promotion.id))}>View campaign</MenuItem>
            {promotion.code && <MenuItem onSelect={run(() => onCopyCode(promotion.code))}>Copy code</MenuItem>}
            {permissions.manage && (
              <>
                <MenuItem onSelect={run(() => onDuplicate(promotion.id))}>Duplicate</MenuItem>
                <MenuItem destructive={status !== 'archived'} onSelect={run(() => onArchive(promotion.id))}>
                  {status === 'archived' ? 'Restore as draft' : 'Archive'}
                </MenuItem>
              </>
            )}
          </>
        )
      }}
    </Menu>
  )
}

// ---------- Grid ----------

function PromotionCard({ promotion, ...actions }: { promotion: Promotion } & PromotionActions) {
  const { permissions, now, branches, onView, onEdit } = actions
  const status = getPromotionStatus(promotion, now)
  const countdown = getCountdown(promotion, now)
  const { stats } = promotion
  const launched = stats.reach > 0
  const metrics: [string, string][] = [
    ['Orders', number(stats.uses)],
    ...(permissions.financials
      ? ([
          ['Revenue', formatCompactXaf(stats.revenue).replace('XAF ', '')],
          ['Discount', formatCompactXaf(stats.discount).replace('XAF ', '')],
        ] as [string, string][])
      : []),
    ['Conversion', `${getConversion(stats).toFixed(1)}%`],
  ]

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <div className={`relative px-3 py-3 text-white ${getBannerClass(promotion.banner)}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[10px] font-bold tracking-wider text-white/85 uppercase">
            {getTypeMeta(promotion.type).label}
          </p>
          <span className="shrink-0 rounded-md bg-white">
            <PromotionStatusBadge status={status} />
          </span>
        </div>
        <h3 className="mt-1 truncate text-base font-bold tracking-tight uppercase">{promotion.name}</h3>
        <p className="text-xl font-extrabold">{formatOffer(promotion)}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PromotionCode promotion={promotion} />
          <span className="text-[11px] text-muted">{formatServices(promotion)}</span>
        </div>
        <p className="line-clamp-2 text-[11px] text-muted">{promotion.description}</p>
        <dl className="space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Valid</dt>
            <dd className="text-right font-medium text-ink">
              {formatValidity(promotion)}
              {promotion.days.length > 0 && <span className="text-muted"> · {formatDays(promotion.days)}</span>}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Branches</dt>
            <dd className="font-medium text-ink">{formatBranches(promotion, branches)}</dd>
          </div>
        </dl>

        {launched ? (
          <>
            <dl className="grid grid-cols-4 gap-1 rounded-lg bg-field p-2 text-center">
              {metrics.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="truncate text-[9px] text-muted">{label}</dt>
                  <dd className="truncate text-xs font-bold text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <UsageBar promotion={promotion} />
          </>
        ) : (
          <p className="rounded-lg bg-field px-3 py-3 text-center text-[11px] text-muted">
            {status === 'draft' ? 'Draft: not published yet.' : 'No redemptions yet.'}
          </p>
        )}

        {countdown && <p className="text-[11px] font-semibold text-brand">{countdown}</p>}

        <div className="mt-auto flex items-center gap-2">
          <button type="button" onClick={() => onView(promotion.id)} className={`${primaryButton} flex-1`}>
            View Campaign
          </button>
          {permissions.manage && (
            <>
              <button
                type="button"
                aria-label={`Edit ${promotion.name}`}
                title="Edit"
                onClick={() => onEdit(promotion.id)}
                className={`${iconButton} ring-1 ring-line`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <PauseButton promotion={promotion} status={status} onTogglePause={actions.onTogglePause} />
            </>
          )}
          <PromotionMenu promotion={promotion} status={status} {...actions} />
        </div>
      </div>
    </li>
  )
}

export function PromotionGrid({ promotions, ...actions }: { promotions: Promotion[] } & PromotionActions) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {promotions.map((promotion) => (
        <PromotionCard key={promotion.id} promotion={promotion} {...actions} />
      ))}
    </ul>
  )
}

// ---------- Table ----------

export type PromotionSort = { key: PromotionSortKey; descending: boolean }

export function PromotionTable({
  promotions,
  sort,
  onSort,
  ...actions
}: {
  promotions: Promotion[]
  sort: PromotionSort
  onSort: (key: PromotionSortKey) => void
} & PromotionActions) {
  const { permissions, now, branches, onView, onEdit } = actions
  const columns: { label: string; key?: PromotionSortKey; right?: boolean }[] = [
    { label: 'Promotion', key: 'name' },
    { label: 'Code' },
    { label: 'Type' },
    { label: 'Status', key: 'status' },
    { label: 'Validity', key: 'start' },
    { label: 'Branches' },
    { label: 'Uses', key: 'uses', right: true },
    ...(permissions.financials
      ? [
          { label: 'Revenue', key: 'revenue' as const, right: true },
          { label: 'Discount', key: 'discount' as const, right: true },
        ]
      : []),
  ]
  return (
    <div className="relative overflow-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[1020px] text-left text-xs">
        <thead className="bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
          <tr>
            {columns.map(({ label, key, right }) => (
              <th
                key={label}
                scope="col"
                aria-sort={key && sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined}
                className={`px-3 py-2.5 whitespace-nowrap ${right ? 'text-right' : ''}`}
              >
                {key ? (
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="inline-flex items-center gap-1 rounded-sm tracking-wider uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {label}
                    {sort.key !== key ? (
                      <ChevronsUpDown className="size-3" aria-hidden="true" />
                    ) : sort.descending ? (
                      <ArrowDown className="size-3 text-brand" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-3 text-brand" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
            <th scope="col" className="sticky right-0 bg-field px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {promotions.map((promotion) => {
            const status = getPromotionStatus(promotion, now)
            return (
              <tr key={promotion.id} onClick={() => onView(promotion.id)} className="group cursor-pointer transition hover:bg-field/60">
                <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onView(promotion.id)
                    }}
                    className="rounded-sm text-left hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {promotion.name}
                  </button>
                  <span className="block text-[10px] font-normal text-muted">{formatServices(promotion)}</span>
                </th>
                <td className="px-3 py-2.5"><PromotionCode promotion={promotion} /></td>
                <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-ink">{formatOffer(promotion)}</td>
                <td className="px-3 py-2.5"><PromotionStatusBadge status={status} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                  {formatDay(promotion.startAt)} – {promotion.endAt ? formatDay(promotion.endAt) : 'no end'}
                </td>
                <td className="px-3 py-2.5 text-muted">{promotion.branches.length || branches.length}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {number(promotion.stats.uses)}
                  {promotion.usageLimit !== null && <span className="text-muted"> / {number(promotion.usageLimit)}</span>}
                </td>
                {permissions.financials && (
                  <>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{formatCompactXaf(promotion.stats.revenue)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCompactXaf(promotion.stats.discount)}</td>
                  </>
                )}
                <td className="sticky right-0 bg-white px-3 py-2.5 group-hover:bg-field" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" onClick={() => onView(promotion.id)} className={`${secondaryButton} h-8`}>
                      View
                    </button>
                    {permissions.manage && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${promotion.name}`}
                          title="Edit"
                          onClick={() => onEdit(promotion.id)}
                          className={`${iconButton} ring-1 ring-line`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <PauseButton promotion={promotion} status={status} onTogglePause={actions.onTogglePause} />
                      </>
                    )}
                    <PromotionMenu promotion={promotion} status={status} {...actions} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Calendar ----------

export function PromotionCalendar({ promotions, now, onView }: { promotions: Promotion[] } & Pick<PromotionActions, 'now' | 'onView'>) {
  const [offset, setOffset] = useState(0)
  const today = new Date(now)
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const firstDay = dayNumber(toDateKey(first.getTime()))
  const lastDay = firstDay + days - 1
  const todayDay = dayNumber(toDateKey(now))
  const visible = promotions
    .filter((promotion) => getPromotionStatus(promotion, now) !== 'archived')
    .filter(
      (promotion) =>
        dayNumber(promotion.startAt) <= lastDay &&
        (promotion.endAt === null || dayNumber(promotion.endAt) >= firstDay),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const ticks = Array.from({ length: Math.ceil(days / 7) }, (_, index) => index * 7 + 1)

  return (
    <Panel
      title="Campaign Calendar"
      subtitle={`${visible.length} ${visible.length === 1 ? 'campaign runs' : 'campaigns run'} in ${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
      icon={CalendarClock}
      action={
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => setOffset(offset - 1)} className={`${iconButton} ring-1 ring-line`}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" disabled={offset === 0} onClick={() => setOffset(0)} className={`${secondaryButton} h-8`}>
            This month
          </button>
          <button type="button" aria-label="Next month" onClick={() => setOffset(offset + 1)} className={`${iconButton} ring-1 ring-line`}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <PanelEmpty>No campaigns run in this month.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="relative ml-40 h-4 text-[10px] text-muted tabular-nums">
              {ticks.map((date) => (
                <span key={date} className="absolute" style={{ left: `${((date - 1) / days) * 100}%` }}>
                  {date} {first.toLocaleDateString('en-GB', { month: 'short' })}
                </span>
              ))}
            </div>
            <ul className="relative mt-1 space-y-1.5">
              {visible.map((promotion) => {
                const status = getPromotionStatus(promotion, now)
                const start = Math.max(dayNumber(promotion.startAt), firstDay)
                const end = Math.min(promotion.endAt ? dayNumber(promotion.endAt) : lastDay, lastDay)
                const { bar } = PROMOTION_STATUSES.find(({ value }) => value === status)!
                return (
                  <li key={promotion.id} className="flex items-center gap-2">
                    <span className="w-38 shrink-0 truncate text-xs font-semibold text-ink" title={promotion.name}>
                      {promotion.name}
                    </span>
                    <div className="relative h-7 flex-1 rounded bg-field">
                      <button
                        type="button"
                        onClick={() => onView(promotion.id)}
                        title={`${promotion.name}: ${formatValidity(promotion)} (${status})`}
                        className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded px-2 text-[10px] font-semibold whitespace-nowrap text-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-none ${
                          status === 'draft' ? 'bg-muted' : status === 'expired' ? 'bg-danger' : status === 'archived' ? 'bg-ink/50' : bar
                        }`}
                        style={{
                          left: `${((start - firstDay) / days) * 100}%`,
                          width: `${((end - start + 1) / days) * 100}%`,
                        }}
                      >
                        {formatOffer(promotion)} · {status}
                      </button>
                    </div>
                  </li>
                )
              })}
              {todayDay >= firstDay && todayDay <= lastDay && (
                <li
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-px bg-ink"
                  style={{ left: `calc(10rem + (100% - 10rem) * ${(todayDay - firstDay + 0.5) / days})` }}
                />
              )}
            </ul>
            <p className="mt-2 text-[10px] text-muted">
              Bars show the days a campaign runs and its status. The vertical line is today.
            </p>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ---------- Performance register ----------

export function PerformanceRegister({ promotions, permissions, onView }: { promotions: Promotion[] } & Pick<PromotionActions, 'permissions' | 'onView'>) {
  const ranked = promotions
    .filter(({ stats }) => stats.uses > 0)
    .sort((a, b) => b.stats.revenue - a.stats.revenue || b.stats.uses - a.stats.uses)
    .slice(0, 8)
  return (
    <Panel
      title="Campaign Performance"
      subtitle={`Top ${ranked.length} campaigns in the current filters, by ${permissions.financials ? 'revenue' : 'orders'}`}
      icon={CircleCheck}
    >
      {ranked.length === 0 ? (
        <PanelEmpty>No campaign in the current filters has redemptions yet.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-[10px] font-bold tracking-wider text-muted uppercase">
              <tr>
                <th scope="col" className="py-2 pr-3">Campaign</th>
                <th scope="col" className="py-2 pr-3">Top channel</th>
                <th scope="col" className="py-2 pr-3 text-right">Redemptions</th>
                <th scope="col" className="py-2 pr-3 text-right">Conversion</th>
                {permissions.financials && (
                  <>
                    <th scope="col" className="py-2 pr-3 text-right">Revenue</th>
                    <th scope="col" className="py-2 pr-3 text-right">Discount share</th>
                    <th scope="col" className="py-2 text-right">Revenue per XAF 1 discount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ranked.map((promotion) => {
                const { stats } = promotion
                const [top] = getChannelBreakdown(promotion)
                return (
                  <tr key={promotion.id}>
                    <th scope="row" className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => onView(promotion.id)}
                        className="rounded-sm text-left font-semibold text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        {promotion.name}
                      </button>
                      <span className="block font-mono text-[10px] font-normal text-muted">{promotion.code || 'automatic'}</span>
                    </th>
                    <td className="py-2 pr-3 text-muted">{top.channel}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{number(stats.uses)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{getConversion(stats).toFixed(1)}%</td>
                    {permissions.financials && (
                      <>
                        <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatCompactXaf(stats.revenue)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{((stats.discount / stats.revenue) * 100).toFixed(1)}%</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {stats.discount > 0 ? `XAF ${(stats.revenue / stats.discount).toFixed(1)}` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
