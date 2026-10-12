import type { RefObject } from 'react'
import { Link } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronsUpDown,
  Ellipsis,
  GitBranch,
  Megaphone,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  Tags,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PricingPermissions } from '../../constants/pricing'
import { PRICING_MODELS, SERVICE_STATUSES } from '../../constants/services'
import type { PricingConfig, PricingFilters } from '../../types/pricing'
import type { LaundryService } from '../../types/service'
import { formatDate } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import type { PricingSortKey } from '../../utils/pricing'
import {
  getGlobalPrice,
  getLastPriceChange,
  getModelLabel,
  getOverrides,
  getTierBands,
  getTiers,
  getUnit,
} from '../../utils/pricing'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../orders/styles'
import { ServiceIcon, ServiceStatusBadge } from '../services/ServiceBits'
import Menu, { MenuItem } from '../ui/Menu'

export type PricingActions = {
  permissions: PricingPermissions
  config: PricingConfig
  onEdit: (id: string) => void
  onChangePrice: (id: string) => void
  onTiers: (id: string) => void
}

// ---------- KPI cards ----------

export function PricingKpis({
  cards,
}: {
  cards: { label: string; value: string; note: string; icon: keyof typeof KPI_ICONS }[]
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, note, icon }) => {
        const Icon = KPI_ICONS[icon]
        return (
          <li key={label} className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-line">
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
            </p>
            <p className="mt-1 truncate text-xl font-bold text-ink tabular-nums">{value}</p>
            <p className="truncate text-[11px] text-muted" title={note}>{note}</p>
          </li>
        )
      })}
    </ul>
  )
}

const KPI_ICONS = {
  services: Tags,
  rules: Workflow,
  branches: GitBranch,
  promotions: Megaphone,
  average: TrendingUp,
  changes: CalendarClock,
} satisfies Record<string, LucideIcon>

// ---------- Category tabs ----------

export function CategoryTabs({
  services,
  selected,
  onSelect,
}: {
  services: LaundryService[]
  selected: string
  onSelect: (category: string) => void
}) {
  const active = services.filter(({ status }) => status === 'active')
  const categories = [...new Set(services.map(({ category }) => category))]
  const tabs: [string, string, number][] = [
    ['', 'All Services', active.length],
    ...categories.map(
      (category): [string, string, number] => [category, category, active.filter((service) => service.category === category).length],
    ),
  ]
  return (
    <div className="relative overflow-x-auto">
      <div role="group" aria-label="Service categories" className="flex min-w-max gap-1.5">
        {tabs.map(([value, label, count]) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === value}
            title={`${count} active`}
            onClick={() => onSelect(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-none ${
              selected === value ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-line hover:bg-field'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Search and filters ----------

export function PricingToolbar({
  searchRef,
  filters,
  branches,
  filtersActive,
  onChange,
  onReset,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  filters: PricingFilters
  branches: string[]
  filtersActive: boolean
  onChange: (patch: Partial<PricingFilters>) => void
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
          aria-label="Search services"
          placeholder="Search service name, code, category..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className={`${fieldClass} pl-9`}
        />
      </div>
      <select aria-label="Branch" value={filters.branch} onChange={(event) => onChange({ branch: event.target.value })} className={select}>
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch}>{branch}</option>
        ))}
      </select>
      <select aria-label="Pricing model" value={filters.model} onChange={(event) => onChange({ model: event.target.value })} className={select}>
        <option value="">All pricing models</option>
        {PRICING_MODELS.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
      <select aria-label="Status" value={filters.status} onChange={(event) => onChange({ status: event.target.value })} className={select}>
        <option value="">All statuses</option>
        {SERVICE_STATUSES.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
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

// ---------- Shared ----------

function ServiceMenu({ service, permissions, onEdit, onChangePrice, onTiers }: { service: LaundryService } & PricingActions) {
  const custom = service.pricingModel === 'custom'
  return (
    <Menu
      label={`More actions for ${service.name}`}
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
            <Link
              to={`/services/${service.id}`}
              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-field focus-visible:bg-field focus-visible:outline-none"
            >
              Open service page
            </Link>
            {permissions.manage && (
              <>
                {!custom && <MenuItem onSelect={run(() => onChangePrice(service.id))}>Change or schedule price</MenuItem>}
                {!custom && service.pricingModel !== 'fixed' && (
                  <MenuItem onSelect={run(() => onTiers(service.id))}>Quantity tiers</MenuItem>
                )}
                <MenuItem onSelect={run(() => onEdit(service.id))}>Edit service</MenuItem>
              </>
            )}
          </>
        )
      }}
    </Menu>
  )
}

// ---------- Cards ----------

function PricingCard({ service, ...actions }: { service: LaundryService } & PricingActions) {
  const { permissions, config, onEdit } = actions
  const unit = getUnit(service)
  const tiers = getTiers(config, service.id)
  const overrides = getOverrides(service)
  const offered = service.branches.filter(({ available }) => available).length
  const custom = service.pricingModel === 'custom'

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <ServiceIcon icon={service.icon} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-ink">
            <Link to={`/services/${service.id}`} className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              {service.name}
            </Link>
          </h3>
          <p className="truncate text-[11px] text-muted">
            <span className="font-mono">{service.id}</span> · {service.category}
          </p>
        </div>
        <ServiceStatusBadge status={service.status} />
      </div>

      <div>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {custom && <span className="text-xs text-muted">from</span>}
          <span className="text-2xl font-extrabold text-ink tabular-nums">{formatXaf(getGlobalPrice(service))}</span>
          <span className="text-xs text-muted">/ {service.pricingModel === 'fixed' ? 'order' : unit}</span>
        </p>
        <p className="text-[11px] font-semibold text-brand">{getModelLabel(service, tiers)}</p>
      </div>

      {tiers.length > 0 && (
        <dl className="grid grid-cols-3 gap-1.5">
          {getTierBands(service, tiers).slice(0, 3).map(({ range, price }) => (
            <div key={range} className="rounded-md bg-field px-2 py-1.5 text-center">
              <dt className="text-[10px] text-muted">{range} {unit}</dt>
              <dd className="text-xs font-bold text-ink tabular-nums">{formatXaf(price)}</dd>
            </div>
          ))}
        </dl>
      )}

      {custom && (
        <dl className="space-y-0.5 rounded-lg bg-field px-2.5 py-2 text-[11px]">
          {service.itemPrices.slice(0, 3).map(({ item, price }) => (
            <div key={item} className="flex justify-between gap-2">
              <dt className="truncate text-muted">{item}</dt>
              <dd className="font-semibold text-ink tabular-nums">{formatXaf(price)}</dd>
            </div>
          ))}
          {service.itemPrices.length > 3 && <p className="text-muted">+ {service.itemPrices.length - 3} more items</p>}
        </dl>
      )}

      <ul className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
        {service.express.enabled && (
          <li className="flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-warning">
            <Zap className="size-3" aria-hidden="true" />
            Express +{service.express.surchargePct}%
          </li>
        )}
        {service.minQty > 1 && (
          <li className="rounded-md bg-field px-2 py-1 text-muted">
            Min. {service.minQty} {unit} ({formatXaf(service.minQty * service.basePrice)})
          </li>
        )}
        {overrides.map(({ branch, priceOverride }) => (
          <li key={branch} className="rounded-md bg-brand/10 px-2 py-1 text-brand">
            {branch}: {formatXaf(priceOverride!)}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted">
          Offered at {offered} of {service.branches.length} branches
        </p>
        <Link to={`/services/${service.id}`} className={`${secondaryButton} h-8`}>
          <Receipt className="size-3.5 text-muted" aria-hidden="true" />
          View Pricing
        </Link>
        {permissions.manage && (
          <button type="button" aria-label={`Edit ${service.name}`} title="Edit" onClick={() => onEdit(service.id)} className={`${iconButton} ring-1 ring-line`}>
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        )}
        <ServiceMenu service={service} {...actions} />
      </div>
    </li>
  )
}

export function PricingCards({ services, ...actions }: { services: LaundryService[] } & PricingActions) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <PricingCard key={service.id} service={service} {...actions} />
      ))}
    </ul>
  )
}

// ---------- Table ----------

export type PricingSort = { key: PricingSortKey; descending: boolean }

export function PricingTable({
  services,
  sort,
  onSort,
  ...actions
}: {
  services: LaundryService[]
  sort: PricingSort
  onSort: (key: PricingSortKey) => void
} & PricingActions) {
  const { permissions, config, onChangePrice } = actions
  const columns: { label: string; key?: PricingSortKey; right?: boolean }[] = [
    { label: 'Service', key: 'name' },
    { label: 'Code' },
    { label: 'Category', key: 'category' },
    { label: 'Pricing model' },
    { label: 'Base price', key: 'price', right: true },
    { label: 'Unit' },
    { label: 'Branches', key: 'branches', right: true },
    { label: 'Status' },
    { label: 'Last changed', key: 'changed' },
  ]
  return (
    <div className="relative overflow-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[980px] text-left text-xs">
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
                  <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 rounded-sm tracking-wider uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
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
          {services.map((service) => {
            const changed = getLastPriceChange(service)
            const custom = service.pricingModel === 'custom'
            return (
              <tr key={service.id} className="group transition hover:bg-field/60">
                <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                  <Link to={`/services/${service.id}`} className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    {service.name}
                  </Link>
                </th>
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{service.id}</td>
                <td className="px-3 py-2.5 text-muted">{service.category}</td>
                <td className="px-3 py-2.5">{getModelLabel(service, getTiers(config, service.id))}</td>
                <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap text-ink tabular-nums">
                  {custom && <span className="mr-1 font-normal text-muted">from</span>}
                  {formatXaf(getGlobalPrice(service))}
                </td>
                <td className="px-3 py-2.5 text-muted">{getUnit(service)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {service.branches.filter(({ available }) => available).length}
                  <span className="text-muted"> / {service.branches.length}</span>
                </td>
                <td className="px-3 py-2.5"><ServiceStatusBadge status={service.status} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{changed ? formatDate(changed) : '—'}</td>
                <td className="sticky right-0 bg-white px-3 py-2.5 group-hover:bg-field">
                  <div className="flex items-center justify-end gap-1.5">
                    {permissions.manage && !custom && (
                      <button type="button" onClick={() => onChangePrice(service.id)} className={`${primaryButton} h-8 whitespace-nowrap`}>
                        Change price
                      </button>
                    )}
                    <ServiceMenu service={service} {...actions} />
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
