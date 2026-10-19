import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  CirclePause,
  Layers,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Wallet,
} from 'lucide-react'
import {
  PRICING_MODELS,
  SERVICE_PACKAGES,
  SERVICE_STATUSES,
  VISIBILITIES,
} from '../../constants/services'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import type { ServicePermissions } from '../../constants/services'
import type {
  LaundryService,
  ServiceFilters,
  ServiceStatus,
} from '../../types/service'
import { formatXaf } from '../../utils/orders'
import {
  countServiceFilters,
  formatCompactXaf,
  getAvailabilityAlert,
} from '../../utils/services'
import {
  fieldClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import InlineNameForm from '../ui/InlineNameForm'
import Menu from '../ui/Menu'
import Modal from '../ui/Modal'
import SegmentedControl from '../ui/SegmentedControl'

// ---------- KPI cards ----------

type KpiProps = {
  services: LaundryService[]
  status: ServiceStatus | ''
  filtersActive: boolean
  onSelectStatus: (status: ServiceStatus | '') => void
  permissions: ServicePermissions
}

const kpiClass = 'min-w-0 rounded-xl bg-white p-3 text-left ring-1 ring-line'

function KpiBody({
  label,
  icon: Icon,
  value,
  note,
}: {
  label: string
  icon: LucideIcon
  value: ReactNode
  note: string
}) {
  return (
    <>
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
        <span className="truncate">{label}</span>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      </span>
      <span className="mt-1 block truncate text-xl font-bold text-ink">{value}</span>
      <span className="block truncate text-[10px] text-muted">{note}</span>
    </>
  )
}

export function ServiceKpiCards({
  services,
  status,
  filtersActive,
  onSelectStatus,
  permissions,
}: KpiProps) {
  const count = (target: ServiceStatus) =>
    services.filter((service) => service.status === target).length
  const live = services.filter(({ stats }) => stats.orders > 0)
  const popular = [...live].sort((a, b) => b.stats.orders - a.stats.orders)[0]
  const topRevenue = [...live].sort((a, b) => b.stats.revenue - a.stats.revenue)[0]
  const averagePrice =
    services.length === 0
      ? 0
      : services.reduce((sum, { basePrice }) => sum + basePrice, 0) / services.length

  const filterCards: [string, LucideIcon, ServiceStatus | '', number, string][] = [
    ['Total Services', Layers, '', services.length, `${new Set(services.map(({ category }) => category)).size} categories`],
    ['Active Services', CircleCheck, 'active', count('active'), 'Available for new orders'],
    ['Inactive Services', CirclePause, 'inactive', count('inactive') + count('unavailable'), 'Inactive or temporarily unavailable'],
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {filterCards.map(([label, icon, target, value, note]) => {
        const active = target ? status === target : !filtersActive
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectStatus(target)}
            className={`${kpiClass} transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active ? 'ring-2 ring-brand' : 'hover:bg-field'
            }`}
          >
            <KpiBody label={label} icon={icon} value={value} note={note} />
          </button>
        )
      })}
      {permissions.financials && popular && (
        <Link to={`/services/${popular.id}`} className={`${kpiClass} hover:bg-field`}>
          <KpiBody
            label="Most Popular"
            icon={Star}
            value={popular.name}
            note={`${popular.stats.orders} orders`}
          />
        </Link>
      )}
      {permissions.financials && topRevenue && (
        <Link to={`/services/${topRevenue.id}`} className={`${kpiClass} hover:bg-field`}>
          <KpiBody
            label="Highest Revenue"
            icon={Trophy}
            value={topRevenue.name}
            note={formatCompactXaf(topRevenue.stats.revenue)}
          />
        </Link>
      )}
      {permissions.pricing && (
        <div className={kpiClass}>
          <KpiBody
            label="Average Service Price"
            icon={Wallet}
            value={formatXaf(averagePrice)}
            note="Across base prices"
          />
        </div>
      )}
    </div>
  )
}

// ---------- Categories ----------

const chipClass =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

export function CategoryNav({
  services,
  categories,
  selected,
  onSelect,
  canEdit,
  showFinancials,
  onAddCategory,
}: {
  services: LaundryService[]
  categories: string[]
  selected: string
  onSelect: (category: string) => void
  canEdit: boolean
  showFinancials: boolean
  onAddCategory: (name: string) => void
}) {
  return (
    <nav
      aria-label="Service categories"
      className="flex items-center gap-2 overflow-x-auto pb-0.5"
    >
      <button
        type="button"
        aria-pressed={selected === ''}
        onClick={() => onSelect('')}
        className={`${chipClass} ${selected === '' ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-line hover:bg-field'}`}
      >
        All
        <span className="tabular-nums opacity-70">{services.length}</span>
      </button>
      {categories.map((category) => {
        const members = services.filter((service) => service.category === category)
        const orders = members.reduce((sum, { stats }) => sum + stats.orders, 0)
        const revenue = members.reduce((sum, { stats }) => sum + stats.revenue, 0)
        const active = selected === category
        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            title={
              showFinancials
                ? `${members.length} services · ${orders} orders · ${formatCompactXaf(revenue)}`
                : `${members.length} services`
            }
            onClick={() => onSelect(active ? '' : category)}
            className={`${chipClass} ${active ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-line hover:bg-field'}`}
          >
            {category}
            <span className="tabular-nums opacity-70">{members.length}</span>
          </button>
        )
      })}
      {canEdit && (
        <Menu
          align="left"
          trigger={
            <>
              <Plus className="size-3" aria-hidden="true" />
              Add Category
            </>
          }
          triggerClassName={`${chipClass} text-brand ring-1 ring-brand/30 hover:bg-brand/5`}
        >
          {(close) => (
            <InlineNameForm
              autoFocus
              label="Category name"
              placeholder="Category name…"
              submitLabel="Add"
              className="w-64 p-1"
              onSave={(name) => {
                onAddCategory(name)
                close()
              }}
            />
          )}
        </Menu>
      )}
    </nav>
  )
}

// ---------- Search & filters ----------

type SelectKey = Exclude<keyof ServiceFilters, 'query' | 'category'>

const SELECTS: Record<
  SelectKey,
  { label: string; all: string; options: { value: string; label: string }[] }
> = {
  status: {
    label: 'Status',
    all: 'All statuses',
    options: SERVICE_STATUSES.map(({ id, label }) => ({ value: id, label })),
  },
  branch: {
    label: 'Branch',
    all: 'All branches',
    // The connected tenant's branches, filled in by FilterSelect
    options: [],
  },
  pricingModel: {
    label: 'Pricing type',
    all: 'Any pricing type',
    options: PRICING_MODELS.map(({ id, label }) => ({ value: id, label })),
  },
  processing: {
    label: 'Processing time',
    all: 'Any processing time',
    options: [
      { value: 'sameDay', label: 'Up to 12 hours' },
      { value: 'day', label: '13–24 hours' },
      { value: 'longer', label: 'More than 24 hours' },
    ],
  },
  express: {
    label: 'Express availability',
    all: 'Express or not',
    options: [
      { value: 'yes', label: 'Express available' },
      { value: 'no', label: 'No express' },
    ],
  },
  visibility: {
    label: 'Customer availability',
    all: 'Any customer visibility',
    options: VISIBILITIES.map(({ id, label }) => ({ value: id, label })),
  },
}

type FilterProps = {
  filters: ServiceFilters
  onChange: (patch: Partial<ServiceFilters>) => void
}

function FilterSelect({
  name,
  filters,
  onChange,
  className = '',
}: FilterProps & { name: SelectKey; className?: string }) {
  const { label, all, options: fixed } = SELECTS[name]
  // Services record their branches by name, so filter by name
  const branches = useGetBranchDropdownQuery(undefined, { skip: name !== 'branch' })
  const options =
    name === 'branch' ? (branches.data ?? []).map(({ name: branch }) => ({ value: branch, label: branch })) : fixed
  return (
    <select
      aria-label={label}
      value={filters[name]}
      onChange={(event) => onChange({ [name]: event.target.value })}
      className={`${fieldClass} ${className}`}
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export type ServicesView = 'table' | 'cards'

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'cards', label: 'Cards' },
] as const

export function ServicesToolbar({
  searchRef,
  filters,
  onChange,
  onReset,
  view,
  onViewChange,
  resultCount,
}: FilterProps & {
  searchRef: RefObject<HTMLInputElement | null>
  onReset: () => void
  view: ServicesView
  onViewChange: (view: ServicesView) => void
  resultCount: number
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const activeCount = countServiceFilters(filters)
  const select = (name: SelectKey, className = '') => (
    <FilterSelect name={name} filters={filters} onChange={onChange} className={className} />
  )

  return (
    <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search services"
            placeholder="Search services by name, code, category or description…"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className={`${fieldClass} h-10 pr-10 pl-9`}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
            /
          </kbd>
        </div>
        <div className="max-md:hidden">
          <SegmentedControl
            label="View"
            options={VIEW_OPTIONS}
            value={view}
            onChange={onViewChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {select('status', 'w-auto!')}
          {select('branch', 'w-auto!')}
          {select('pricingModel', 'w-auto!')}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={secondaryButton}
        >
          <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
          <span className="md:hidden">Filters</span>
          <span className="max-md:hidden">More Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Reset
          </button>
        )}
      </div>

      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Filters"
        subtitle="Filters combine: a service must match all of them."
        footer={
          <>
            <button type="button" onClick={onReset} className={secondaryButton}>
              Reset
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className={primaryButton}
            >
              Show {resultCount} {resultCount === 1 ? 'service' : 'services'}
            </button>
          </>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(SELECTS) as SelectKey[]).map((name) => (
            <div key={name}>{select(name)}</div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ---------- Alerts, ranking, packages ----------

export function ServiceAlerts({ services }: { services: LaundryService[] }) {
  const alerts = services
    .map((service) => ({ service, message: getAvailabilityAlert(service) }))
    .filter((entry): entry is { service: LaundryService; message: string } =>
      Boolean(entry.message),
    )
  if (alerts.length === 0) return null

  return (
    <ul className="space-y-2" aria-label="Service availability alerts">
      {alerts.map(({ service, message }) => (
        <li
          key={service.id}
          className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs ring-1 ${
            service.status === 'unavailable'
              ? 'bg-danger/5 text-danger ring-danger/20'
              : 'bg-warning/5 text-warning ring-warning/20'
          }`}
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 font-semibold">{message}</p>
          <Link
            to={`/services/${service.id}`}
            className="shrink-0 rounded-sm font-bold text-ink underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            View
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ServiceRankingAndPackages({
  services,
  permissions,
}: {
  services: LaundryService[]
  permissions: ServicePermissions
}) {
  const ranked = [...services]
    .filter(({ stats }) => stats.orders > 0)
    .sort((a, b) => b.stats.orders - a.stats.orders)
    .slice(0, 5)
  const topOrders = ranked[0]?.stats.orders ?? 1
  const promoted = services.filter(({ promotions }) => promotions.length > 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {permissions.financials && (
        <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Most popular services</h2>
          <p className="text-[11px] text-muted">Orders, revenue and growth vs last period</p>
          <ol className="mt-3 space-y-3">
            {ranked.map((service, index) => (
              <li key={service.id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/services/${service.id}`}
                    className="min-w-0 truncate rounded-sm font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {index + 1}. {service.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-muted tabular-nums">
                    {service.stats.orders} · {formatCompactXaf(service.stats.revenue)}
                    <span
                      className={`flex items-center gap-0.5 font-bold ${
                        service.stats.growthPct < 0 ? 'text-danger' : 'text-success'
                      }`}
                    >
                      {service.stats.growthPct < 0 ? (
                        <TrendingDown className="size-3" aria-hidden="true" />
                      ) : (
                        <TrendingUp className="size-3" aria-hidden="true" />
                      )}
                      {service.stats.growthPct > 0 && '+'}
                      {service.stats.growthPct}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(service.stats.orders / topOrders) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Package className="size-4 text-brand" aria-hidden="true" />
          Service packages
        </h2>
        <p className="text-[11px] text-muted">Prepaid bundles selectable at order creation</p>
        <ul className="mt-3 space-y-2">
          {SERVICE_PACKAGES.map(({ name, service, quantity, price, validity }) => (
            <li key={name} className="rounded-lg bg-field p-3 text-xs">
              <p className="flex items-center justify-between gap-2 font-semibold text-ink">
                {name}
                {permissions.pricing && (
                  <span className="tabular-nums">{formatXaf(price)}</span>
                )}
              </p>
              <p className="text-[11px] text-muted">
                {quantity} {service} · valid {validity}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Tag className="size-4 text-brand" aria-hidden="true" />
          Active promotions
        </h2>
        <p className={`${sectionTitle} mt-0.5 font-normal tracking-normal normal-case`}>
          Create promotions from a service’s page
        </p>
        {promoted.length === 0 ? (
          <p className="mt-3 rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
            No active promotions.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {promoted.flatMap((service) =>
              service.promotions.map((promotion) => (
                <li key={service.id + promotion.name} className="rounded-lg bg-field p-3 text-xs">
                  <p className="font-semibold text-ink">
                    {service.name}: {promotion.value} {promotion.name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {promotion.type} · {promotion.from} to {promotion.to}
                  </p>
                </li>
              )),
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
