import { Link } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Download,
  Ellipsis,
  Eye,
  Pencil,
  X,
  Zap,
} from 'lucide-react'
import type { ServicePermissions } from '../../constants/services'
import type { LaundryService } from '../../types/service'
import { formatXaf } from '../../utils/orders'
import {
  formatCompactXaf,
  formatHours,
  formatPrice,
  getBranchCount,
} from '../../utils/services'
import type { ServiceSortKey } from '../../utils/services'
import { iconButton, secondaryButton } from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import { ServiceIcon, ServiceStatusBadge } from './ServiceBits'

export type ServiceSort = { key: ServiceSortKey; direction: 'asc' | 'desc' }

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'
const menuLinkClass =
  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field'

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: ServiceSortKey
  sort: ServiceSort
  onSort: (key: ServiceSortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={`${headClass} ${align === 'right' ? 'text-right' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded-sm tracking-wider uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${active ? 'text-ink' : ''}`}
      >
        {label}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    </th>
  )
}

function ExpressLabel({ service }: { service: LaundryService }) {
  if (!service.express.enabled) {
    return <span className="text-[11px] text-muted">Not offered</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-ink">
      <Zap className="size-3 text-brand" aria-hidden="true" />
      {service.express.hours}h (+{service.express.surchargePct}%)
    </span>
  )
}

type ListProps = {
  services: LaundryService[]
  permissions: ServicePermissions
  branchTotal: number
  onEdit: (id: string) => void
  onToggleActive: (id: string) => void
}

type ServicesTableProps = ListProps & {
  sort: ServiceSort
  onSort: (key: ServiceSortKey) => void
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
}

function RowMenu({
  service,
  permissions,
  onEdit,
  onToggleActive,
}: Pick<ListProps, 'permissions' | 'onEdit' | 'onToggleActive'> & {
  service: LaundryService
}) {
  return (
    <Menu
      label={`Actions for ${service.name}`}
      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
      triggerClassName={iconButton}
    >
      {(close) => (
        <>
          <Link to={`/services/${service.id}`} className={menuLinkClass}>
            <Eye className="size-4 text-muted" aria-hidden="true" />
            View Service
          </Link>
          {permissions.edit && (
            <>
              <MenuItem
                onSelect={() => {
                  close()
                  onEdit(service.id)
                }}
              >
                <Pencil className="size-4 text-muted" aria-hidden="true" />
                Edit
              </MenuItem>
              <MenuItem
                destructive={service.status === 'active'}
                onSelect={() => {
                  close()
                  onToggleActive(service.id)
                }}
              >
                {service.status === 'active' ? (
                  <CirclePause className="size-4" aria-hidden="true" />
                ) : (
                  <CirclePlay className="size-4 text-muted" aria-hidden="true" />
                )}
                {service.status === 'active' ? 'Deactivate' : 'Activate'}
              </MenuItem>
            </>
          )}
        </>
      )}
    </Menu>
  )
}

export function ServiceCards({
  services,
  permissions,
  branchTotal,
  onEdit,
  onToggleActive,
  className = '',
}: ListProps & { className?: string }) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {services.map((service) => (
        <li
          key={service.id}
          className="flex min-w-0 flex-col rounded-xl bg-white p-4 ring-1 ring-line"
        >
          <div className="flex items-start gap-3">
            <ServiceIcon icon={service.icon} />
            <div className="min-w-0 flex-1">
              <Link
                to={`/services/${service.id}`}
                className="block truncate rounded-sm text-sm font-bold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {service.name}
              </Link>
              <p className="font-mono text-[10px] text-muted">
                {service.id} · {service.category}
              </p>
            </div>
            <ServiceStatusBadge status={service.status} />
          </div>
          <p className="mt-2 line-clamp-2 flex-1 text-[11px] leading-snug text-muted">
            {service.description}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {permissions.pricing && (
              <div>
                <dt className="text-[10px] text-muted">Price</dt>
                <dd className="font-semibold text-ink">{formatPrice(service)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] text-muted">Processing</dt>
              <dd className="font-semibold text-ink">{service.standardHours} hours</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">Express</dt>
              <dd>
                <ExpressLabel service={service} />
              </dd>
            </div>
            {permissions.financials ? (
              <div>
                <dt className="text-[10px] text-muted">Orders · Revenue</dt>
                <dd className="font-semibold text-ink">
                  {service.stats.orders} · {formatCompactXaf(service.stats.revenue)}
                </dd>
              </div>
            ) : (
              <div>
                <dt className="text-[10px] text-muted">Branches</dt>
                <dd className="font-semibold text-ink">
                  {getBranchCount(service)} / {branchTotal}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <Link to={`/services/${service.id}`} className={`${secondaryButton} h-8 flex-1`}>
              <Eye className="size-3.5 text-muted" aria-hidden="true" />
              View
            </Link>
            {permissions.edit && (
              <button
                type="button"
                onClick={() => onEdit(service.id)}
                className={`${secondaryButton} h-8 flex-1`}
              >
                <Pencil className="size-3.5 text-muted" aria-hidden="true" />
                Edit
              </button>
            )}
            <RowMenu
              service={service}
              permissions={permissions}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ServicesTable({
  services,
  permissions,
  branchTotal,
  onEdit,
  onToggleActive,
  sort,
  onSort,
  selectedIds,
  onToggle,
  onToggleAll,
}: ServicesTableProps) {
  const allSelected =
    services.length > 0 && services.every(({ id }) => selectedIds.includes(id))

  return (
    <>
      <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
        <table className="w-full min-w-[920px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={`${headClass} w-8`}>
                <input
                  type="checkbox"
                  aria-label="Select all services on this page"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  className="size-4 accent-brand"
                />
              </th>
              <SortHeader label="Service" sortKey="name" sort={sort} onSort={onSort} />
              <SortHeader label="Category" sortKey="category" sort={sort} onSort={onSort} />
              {permissions.pricing && (
                <SortHeader label="Pricing" sortKey="price" sort={sort} onSort={onSort} />
              )}
              <SortHeader label="Processing time" sortKey="hours" sort={sort} onSort={onSort} />
              <th scope="col" className={headClass}>Express</th>
              {permissions.financials && (
                <>
                  <SortHeader label="Orders" sortKey="orders" sort={sort} onSort={onSort} align="right" />
                  <SortHeader label="Revenue" sortKey="revenue" sort={sort} onSort={onSort} align="right" />
                </>
              )}
              <th scope="col" className={headClass}>Branches</th>
              <th scope="col" className={headClass}>Status</th>
              <th scope="col" className={`${headClass} right-0 z-20`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const selected = selectedIds.includes(service.id)
              return (
                <tr
                  key={service.id}
                  className={`border-t border-line transition hover:bg-field/60 ${selected ? 'bg-brand/5' : ''}`}
                >
                  <td className={cellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${service.name}`}
                      checked={selected}
                      onChange={() => onToggle(service.id)}
                      className="size-4 accent-brand"
                    />
                  </td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-2.5">
                      <ServiceIcon icon={service.icon} />
                      <div>
                        <Link
                          to={`/services/${service.id}`}
                          className="rounded-sm font-semibold whitespace-nowrap text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          {service.name}
                        </Link>
                        <span className="block font-mono text-[10px] text-muted">
                          {service.id}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={`${cellClass} whitespace-nowrap text-ink`}>
                    {service.category}
                  </td>
                  {permissions.pricing && (
                    <td className={`${cellClass} font-semibold whitespace-nowrap text-ink tabular-nums`}>
                      {formatPrice(service)}
                    </td>
                  )}
                  <td className={`${cellClass} whitespace-nowrap text-ink`}>
                    {formatHours(service.standardHours)}
                  </td>
                  <td className={cellClass}>
                    <ExpressLabel service={service} />
                  </td>
                  {permissions.financials && (
                    <>
                      <td className={`${cellClass} text-right font-semibold text-ink tabular-nums`}>
                        {service.stats.orders}
                      </td>
                      <td className={`${cellClass} text-right font-semibold whitespace-nowrap text-ink tabular-nums`}>
                        {formatXaf(service.stats.revenue)}
                      </td>
                    </>
                  )}
                  <td className={`${cellClass} text-ink tabular-nums`}>
                    {getBranchCount(service)} / {branchTotal}
                  </td>
                  <td className={cellClass}>
                    <ServiceStatusBadge status={service.status} />
                  </td>
                  <td className={`${cellClass} sticky right-0 bg-white`}>
                    <RowMenu
                      service={service}
                      permissions={permissions}
                      onEdit={onEdit}
                      onToggleActive={onToggleActive}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards instead of the wide table */}
      <ServiceCards
        services={services}
        permissions={permissions}
        branchTotal={branchTotal}
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        className="md:hidden"
      />
    </>
  )
}

const bulkActionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

type ServiceBulkBarProps = {
  count: number
  canEdit: boolean
  categories: string[]
  onClear: () => void
  onActivate: () => void
  onDeactivate: () => void
  onAssignCategory: (category: string) => void
  onExport: () => void
}

export function ServiceBulkBar({
  count,
  canEdit,
  categories,
  onClear,
  onActivate,
  onDeactivate,
  onAssignCategory,
  onExport,
}: ServiceBulkBarProps) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
    >
      <p className="mr-2 text-xs font-bold">
        Selected: {count} {count === 1 ? 'service' : 'services'}
      </p>
      {canEdit && (
        <>
          <button type="button" onClick={onActivate} className={bulkActionClass}>
            <CirclePlay className="size-3.5" aria-hidden="true" />
            Activate
          </button>
          <button type="button" onClick={onDeactivate} className={bulkActionClass}>
            <CirclePause className="size-3.5" aria-hidden="true" />
            Deactivate
          </button>
          <Menu
            align="left"
            trigger={
              <>
                Assign Category
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            }
            triggerClassName={bulkActionClass}
          >
            {(close) =>
              categories.map((category) => (
                <MenuItem
                  key={category}
                  onSelect={() => {
                    close()
                    onAssignCategory(category)
                  }}
                >
                  {category}
                </MenuItem>
              ))
            }
          </Menu>
        </>
      )}
      <button type="button" onClick={onExport} className={bulkActionClass}>
        <Download className="size-3.5" aria-hidden="true" />
        Export
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className={`${bulkActionClass} ml-auto w-8 justify-center px-0`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default ServicesTable
