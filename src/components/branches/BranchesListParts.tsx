import type { RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Ban,
  Building2,
  ChevronsUpDown,
  CircleCheck,
  Clock,
  Ellipsis,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  ShoppingBag,
  TriangleAlert,
  UserRound,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  BRANCH_PERIODS,
  BRANCH_STATUSES,
  PERFORMANCE_TIERS,
} from '../../constants/branches'
import type { BranchPermissions } from '../../constants/branches'
import type {
  Branch,
  BranchFilters,
  BranchPeriod,
  BranchStatus,
} from '../../types/branch'
import {
  formatChange,
  formatHoursSummary,
  formatRevenue,
  getChange,
  getHealth,
  getMachineCounts,
  getPeriodStats,
  getStaffCounts,
} from '../../utils/branches'
import type { BranchSortKey } from '../../utils/branches'
import {
  fieldClass,
  iconButton,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import Panel from '../ui/Panel'
import { BranchArt, BranchStatusBadge, HealthMeter } from './BranchBits'

const periodShort = (period: BranchPeriod) =>
  BRANCH_PERIODS.find(({ value }) => value === period)!.short

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// ---------- KPI cards ----------

export function BranchKpis({
  branches,
  filters,
  permissions,
  onStatus,
}: {
  branches: Branch[]
  filters: BranchFilters
  permissions: BranchPermissions
  onStatus: (status: BranchStatus | '') => void
}) {
  const count = (...statuses: BranchStatus[]) =>
    branches.filter(({ status }) => statuses.includes(status)).length
  const stats = branches.map((branch) => getPeriodStats(branch, filters.period))
  const orders = sum(stats.map((item) => item.orders))
  const revenue = sum(stats.map((item) => item.revenue))
  const period = periodShort(filters.period)
  const active = count('active')

  const cards: {
    label: string
    icon: LucideIcon
    value: string
    note: string
    status?: BranchStatus | ''
    tone?: string
  }[] = [
    { label: 'Total Branches', icon: Building2, value: String(branches.length), note: `${new Set(branches.map(({ city }) => city)).size} cities`, status: '' },
    { label: 'Active Branches', icon: CircleCheck, value: String(active), note: branches.length ? `${Math.round((active / branches.length) * 100)}% of the network` : 'No branches', status: 'active', tone: 'text-success' },
    { label: 'Maintenance', icon: Wrench, value: String(count('maintenance')), note: 'Reduced capacity', status: 'maintenance', tone: 'text-warning' },
    { label: 'Closed / Inactive', icon: Ban, value: String(count('closed', 'inactive')), note: `${count('closed')} temporarily closed · ${count('inactive')} inactive`, status: count('closed') >= count('inactive') ? 'closed' : 'inactive' },
    { label: `Orders ${period}`, icon: ShoppingBag, value: orders.toLocaleString('en-US'), note: `${formatChange(getChange(orders, sum(stats.map((item) => item.previousOrders))))} vs previous period` },
    ...(permissions.financials
      ? [{ label: `Revenue ${period}`, icon: Banknote, value: formatRevenue(revenue), note: `${formatChange(getChange(revenue, sum(stats.map((item) => item.previousRevenue))))} vs previous period` }]
      : []),
  ]

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, icon: Icon, value, note, status, tone }) => {
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-4 shrink-0 ${tone ?? 'text-brand'}`} aria-hidden="true" />
            </span>
            <span className="mt-1 block truncate text-xl font-bold text-ink tabular-nums">{value}</span>
            <span className="block truncate text-[11px] text-muted">{note}</span>
          </>
        )
        const selected = status !== undefined && status !== '' && filters.status === status
        return (
          <li key={label} className="min-w-0">
            {status === undefined ? (
              <div className="h-full rounded-xl bg-white p-3 ring-1 ring-line">{body}</div>
            ) : (
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onStatus(selected ? '' : status)}
                className={`block h-full w-full rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected ? 'ring-2 ring-brand' : 'ring-line'
                }`}
              >
                {body}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Status summary ----------

export function StatusSummary({
  branches,
  selected,
  onSelect,
}: {
  branches: Branch[]
  selected: BranchStatus | ''
  onSelect: (status: BranchStatus | '') => void
}) {
  const groups = BRANCH_STATUSES.map((status) => ({
    ...status,
    count: branches.filter((branch) => branch.status === status.value).length,
  }))
  return (
    <Panel title="Branch Status" subtitle="Click a status to filter the list">
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

// ---------- Search and filters ----------

export function BranchToolbar({
  searchRef,
  filters,
  cities,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: BranchFilters
  cities: string[]
  filtersActive: boolean
  onChange: (patch: Partial<BranchFilters>) => void
  onReset: () => void
}) {
  const select = `${fieldClass} w-auto! max-sm:flex-1`
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search branches"
          placeholder="Search branches, cities, phone numbers..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className={`${fieldClass} h-10 pl-9`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value as BranchStatus | '' })}
          className={select}
        >
          <option value="">All statuses</option>
          {BRANCH_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          aria-label="City"
          value={filters.city}
          onChange={(event) => onChange({ city: event.target.value })}
          className={select}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
        <select
          aria-label="Performance"
          value={filters.performance}
          onChange={(event) => onChange({ performance: event.target.value as BranchFilters['performance'] })}
          className={select}
        >
          <option value="">All performance</option>
          {PERFORMANCE_TIERS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          aria-label="Period"
          value={filters.period}
          onChange={(event) => onChange({ period: event.target.value as BranchPeriod })}
          className={select}
        >
          {BRANCH_PERIODS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
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

// ---------- Shared row actions ----------

export type BranchListActions = {
  permissions: BranchPermissions
  period: BranchPeriod
  onEdit: (id: string) => void
  onSetActive: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}

function BranchMenu({ branch, permissions, onSetActive, onDelete }: { branch: Branch } & BranchListActions) {
  const navigate = useNavigate()
  const open = (tab: string) => navigate(`/branches/${branch.id}?tab=${tab}`)
  const links: [string, string][] = [
    ['View details', 'overview'],
    ['Manage staff', 'staff'],
    ['Manage machines', 'machines'],
    ['Manage inventory', 'inventory'],
    ['View reports', 'reports'],
    ['Branch settings', 'settings'],
  ]
  return (
    <Menu
      label={`More actions for ${branch.name}`}
      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
      triggerClassName={`${iconButton} ring-1 ring-line`}
    >
      {(close) => (
        <>
          {links.map(([label, tab]) => (
            <MenuItem key={tab} onSelect={() => open(tab)}>
              {label}
            </MenuItem>
          ))}
          {permissions.manage &&
            (branch.status === 'inactive' ? (
              <MenuItem
                onSelect={() => {
                  close()
                  onSetActive(branch.id, true)
                }}
              >
                Activate branch
              </MenuItem>
            ) : (
              <MenuItem
                destructive
                onSelect={() => {
                  close()
                  onSetActive(branch.id, false)
                }}
              >
                Deactivate branch
              </MenuItem>
            ))}
          {permissions.manage && (
            <MenuItem
              destructive
              onSelect={() => {
                close()
                onDelete(branch.id)
              }}
            >
              Delete branch
            </MenuItem>
          )}
        </>
      )}
    </Menu>
  )
}

// ---------- Grid ----------

function BranchCard({ branch, ...actions }: { branch: Branch } & BranchListActions) {
  const { permissions, period, onEdit } = actions
  const { stats } = branch
  const periodStats = getPeriodStats(branch, period)
  const metrics: [string, string][] = [
    [`Orders ${periodShort(period)}`, periodStats.orders.toLocaleString('en-US')],
    ...(permissions.financials
      ? ([[`Revenue ${periodShort(period)}`, formatRevenue(periodStats.revenue)]] as [string, string][])
      : []),
    ['Active Orders', String(stats.activeOrders)],
    ['Customers', stats.customers.toLocaleString('en-US')],
  ]
  const pipeline: [string, number, boolean][] = [
    ['Processing', stats.processing, false],
    ['Ready for Pickup', stats.ready, false],
    ['Pending Delivery', stats.pendingDelivery, false],
    ['Overdue', stats.overdue, stats.overdue > 0],
  ]
  const info: [LucideIcon, string][] = [
    [MapPin, `${branch.address}, ${branch.district ? `${branch.district}, ` : ''}${branch.city}`],
    [Phone, branch.phone],
    [Mail, branch.email || 'No email on file'],
    [UserRound, branch.manager ? `Manager: ${branch.manager}` : 'No manager assigned'],
    [Clock, formatHoursSummary(branch.hours)],
  ]

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <div className="relative">
        <BranchArt branch={branch} className="h-20" />
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">
              {branch.id}
            </span>
            <span className="rounded-md bg-white">
              <BranchStatusBadge status={branch.status} />
            </span>
          </div>
          <div className="min-w-0 text-white">
            <h3 className="truncate text-sm font-bold">
              <Link
                to={`/branches/${branch.id}`}
                className="rounded-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {branch.name}
              </Link>
            </h3>
            <p className="truncate text-[11px] text-white/85">
              {branch.type} · {branch.city}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <ul className="space-y-1 text-[11px] text-muted">
          {info.map(([Icon, text]) => (
            <li key={text} className="flex items-start gap-1.5">
              <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>

        {branch.statusNote && (
          <p
            className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] ${
              branch.status === 'active' ? 'bg-warning/10 text-warning' : 'bg-field text-ink'
            }`}
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {branch.statusNote}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-field p-2.5 sm:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-[10px] text-muted" title={label}>{label}</dt>
              <dd className="truncate text-sm font-bold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className={sectionTitle}>Operational status</p>
          <dl className="mt-1.5 grid grid-cols-4 gap-1.5">
            {pipeline.map(([label, value, alert]) => (
              <div
                key={label}
                className={`min-w-0 rounded-md px-1.5 py-1.5 text-center ${alert ? 'bg-danger/10' : 'bg-brand/5'}`}
              >
                <dd className={`text-sm font-bold tabular-nums ${alert ? 'text-danger' : 'text-ink'}`}>{value}</dd>
                <dt className="text-[9px] leading-tight text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-auto">
          <HealthMeter health={getHealth(branch)} />
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/branches/${branch.id}`} className={`${primaryButton} flex-1`}>
            View Branch
          </Link>
          {permissions.manage && (
            <button
              type="button"
              aria-label={`Edit ${branch.name}`}
              title="Edit"
              onClick={() => onEdit(branch.id)}
              className={`${iconButton} ring-1 ring-line`}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          )}
          <BranchMenu branch={branch} {...actions} />
        </div>
      </div>
    </li>
  )
}

export function BranchGrid({ branches, ...actions }: { branches: Branch[] } & BranchListActions) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {branches.map((branch) => (
        <BranchCard key={branch.id} branch={branch} {...actions} />
      ))}
    </ul>
  )
}

// ---------- Table ----------

export type BranchSort = { key: BranchSortKey; descending: boolean }

export function BranchTable({
  branches,
  sort,
  onSort,
  ...actions
}: {
  branches: Branch[]
  sort: BranchSort
  onSort: (key: BranchSortKey) => void
} & BranchListActions) {
  const navigate = useNavigate()
  const { permissions, period, onEdit } = actions
  const columns: { label: string; key?: BranchSortKey; right?: boolean }[] = [
    { label: 'Branch', key: 'name' },
    { label: 'Code' },
    { label: 'Location' },
    { label: 'Status', key: 'status' },
    { label: `Orders ${periodShort(period)}`, key: 'orders', right: true },
    ...(permissions.financials
      ? [{ label: 'Revenue', key: 'revenue' as const, right: true }]
      : []),
    { label: 'Staff', key: 'staff', right: true },
    { label: 'Machines', right: true },
    { label: 'Performance', key: 'performance' },
  ]

  return (
    <div className="relative overflow-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
          <tr>
            {columns.map(({ label, key, right }) => (
              <th
                key={label}
                scope="col"
                aria-sort={
                  key && sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined
                }
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
            <th scope="col" className="sticky right-0 bg-field px-3 py-2.5 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {branches.map((branch) => {
            const stats = getPeriodStats(branch, period)
            const staff = getStaffCounts(branch)
            const machines = getMachineCounts(branch)
            return (
              <tr
                key={branch.id}
                onClick={() => navigate(`/branches/${branch.id}`)}
                className="group cursor-pointer transition hover:bg-field/60"
              >
                <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                  <Link
                    to={`/branches/${branch.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {branch.name}
                  </Link>
                  <span className="block text-[10px] font-normal text-muted">{branch.type}</span>
                </th>
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{branch.id}</td>
                <td className="px-3 py-2.5 text-muted">{branch.city}</td>
                <td className="px-3 py-2.5"><BranchStatusBadge status={branch.status} /></td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{stats.orders.toLocaleString('en-US')}</td>
                {permissions.financials && (
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatRevenue(stats.revenue)}
                  </td>
                )}
                <td className="px-3 py-2.5 text-right tabular-nums" title={`${staff.on} on shift of ${staff.total}`}>
                  {staff.total}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {machines.total === 0 ? '—' : `${machines.up}/${machines.total}`}
                </td>
                <td className="px-3 py-2.5"><HealthMeter health={getHealth(branch)} compact /></td>
                <td
                  className="sticky right-0 bg-white px-3 py-2.5 group-hover:bg-field"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Link to={`/branches/${branch.id}`} className={`${secondaryButton} h-8`}>
                      View
                    </Link>
                    {permissions.manage && (
                      <button
                        type="button"
                        aria-label={`Edit ${branch.name}`}
                        title="Edit"
                        onClick={() => onEdit(branch.id)}
                        className={`${iconButton} ring-1 ring-line`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    )}
                    <BranchMenu branch={branch} {...actions} />
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
