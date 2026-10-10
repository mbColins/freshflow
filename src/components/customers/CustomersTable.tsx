import { Link } from 'react-router'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Banknote,
  ChevronDown,
  Download,
  Ellipsis,
  Eye,
  Megaphone,
  MessageCircle,
  Phone,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react'
import { CUSTOMER_STATUSES, CUSTOMER_TAGS } from '../../constants/customers'
import type { CustomerPermissions } from '../../constants/customers'
import { BRANCHES } from '../../constants/orders'
import type { CrmCustomer, CustomerStatus } from '../../types/customer'
import { formatLastOrder } from '../../utils/customers'
import type { CustomerSortKey } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import { iconButton } from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import { Avatar, CustomerStatusBadge, TierBadge } from './CustomerBits'

export type CustomerSort = { key: CustomerSortKey; direction: 'asc' | 'desc' }

const cellClass = 'px-2 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: CustomerSortKey
  sort: CustomerSort
  onSort: (key: CustomerSortKey) => void
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

type CustomersTableProps = {
  customers: CrmCustomer[]
  now: number
  sort: CustomerSort
  onSort: (key: CustomerSortKey) => void
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  hiddenColumns: string[]
  permissions: CustomerPermissions
  canCreateOrder: boolean
  onRecordPayment: (id: string) => void
  onArchive: (id: string) => void
}

function CustomersTable({
  customers,
  now,
  sort,
  onSort,
  selectedIds,
  onToggle,
  onToggleAll,
  hiddenColumns,
  permissions,
  canCreateOrder,
  onRecordPayment,
  onArchive,
}: CustomersTableProps) {
  const shows = (key: string) => !hiddenColumns.includes(key)
  const showSpent = permissions.financials && shows('spent')
  const showOutstanding = permissions.financials && shows('outstanding')
  const allSelected =
    customers.length > 0 &&
    customers.every(({ id }) => selectedIds.includes(id))

  return (
    <>
      <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
        <table className="w-full min-w-[980px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={`${headClass} w-8`}>
                <input
                  type="checkbox"
                  aria-label="Select all customers on this page"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  className="size-4 accent-brand"
                />
              </th>
              <SortHeader label="Customer" sortKey="name" sort={sort} onSort={onSort} />
              {shows('contact') && <th scope="col" className={headClass}>Contact</th>}
              {shows('orders') && (
                <SortHeader label="Orders" sortKey="orders" sort={sort} onSort={onSort} align="right" />
              )}
              {showSpent && (
                <SortHeader label="Total spent" sortKey="spent" sort={sort} onSort={onSort} align="right" />
              )}
              {shows('lastOrder') && (
                <SortHeader label="Last order" sortKey="lastOrder" sort={sort} onSort={onSort} />
              )}
              {showOutstanding && (
                <SortHeader label="Outstanding" sortKey="outstanding" sort={sort} onSort={onSort} align="right" />
              )}
              {shows('loyalty') && (
                <SortHeader label="Loyalty" sortKey="points" sort={sort} onSort={onSort} />
              )}
              {shows('service') && <th scope="col" className={headClass}>Preferred service</th>}
              {shows('status') && <th scope="col" className={headClass}>Status</th>}
              <th scope="col" className={`${headClass} right-0 z-20 text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const selected = selectedIds.includes(customer.id)
              return (
                <tr
                  key={customer.id}
                  className={`border-t border-line transition hover:bg-field/60 ${selected ? 'bg-brand/5' : ''}`}
                >
                  <td className={cellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${customer.name}`}
                      checked={selected}
                      onChange={() => onToggle(customer.id)}
                      className="size-4 accent-brand"
                    />
                  </td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-2.5">
                      <Avatar customer={customer} />
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="block rounded-sm font-semibold whitespace-nowrap text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          {customer.name}
                        </Link>
                        <span className="block font-mono text-[10px] text-muted">
                          {customer.id}
                        </span>
                        {customer.tags.length > 0 && (
                          <span className="block max-w-32 truncate text-[10px] text-muted">
                            {customer.tags.join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {shows('contact') && (
                    <td className={cellClass}>
                      <span className="block whitespace-nowrap text-ink">
                        {customer.phone}
                      </span>
                      <span className="block max-w-36 truncate text-[11px] text-muted">
                        {customer.email}
                      </span>
                    </td>
                  )}
                  {shows('orders') && (
                    <td className={`${cellClass} text-right font-semibold text-ink tabular-nums`}>
                      {customer.orders}
                    </td>
                  )}
                  {showSpent && (
                    <td className={`${cellClass} text-right font-semibold whitespace-nowrap text-ink tabular-nums`}>
                      {formatXaf(customer.spent)}
                    </td>
                  )}
                  {shows('lastOrder') && (
                    <td className={`${cellClass} whitespace-nowrap text-ink`}>
                      {formatLastOrder(customer.lastOrderAt, now)}
                    </td>
                  )}
                  {showOutstanding && (
                    <td
                      className={`${cellClass} text-right whitespace-nowrap tabular-nums ${
                        customer.outstanding > 0 ? 'font-bold text-danger' : 'text-muted'
                      }`}
                    >
                      {customer.outstanding > 0 ? formatXaf(customer.outstanding) : '—'}
                    </td>
                  )}
                  {shows('loyalty') && (
                    <td className={cellClass}>
                      <TierBadge points={customer.points} />
                      <span className="mt-0.5 block text-[10px] text-muted tabular-nums">
                        {customer.points.toLocaleString('en-US')} pts
                      </span>
                    </td>
                  )}
                  {shows('service') && (
                    <td className={`${cellClass} whitespace-nowrap text-ink`}>
                      {customer.preferredService}
                    </td>
                  )}
                  {shows('status') && (
                    <td className={cellClass}>
                      <CustomerStatusBadge customer={customer} />
                    </td>
                  )}
                  <td className={`${cellClass} sticky right-0 bg-white`}>
                    <div className="flex items-center justify-end gap-0.5">
                      {canCreateOrder && customer.status !== 'suspended' && (
                        <Link
                          to={`/orders?new=1&customer=${customer.id}`}
                          aria-label={`New order for ${customer.name}`}
                          title="New order"
                          className={`${iconButton} text-brand`}
                        >
                          <ShoppingCart className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                      <a
                        href={telHref(customer.phone)}
                        aria-label={`Call ${customer.name}`}
                        title="Call"
                        className={iconButton}
                      >
                        <Phone className="size-4" aria-hidden="true" />
                      </a>
                      <Menu
                        label={`More actions for ${customer.name}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => (
                          <>
                            <Link
                              to={`/customers/${customer.id}`}
                              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field"
                            >
                              <Eye className="size-4 text-muted" aria-hidden="true" />
                              View Profile
                            </Link>
                            <a
                              href={whatsappHref(customer.phone)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={close}
                              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field"
                            >
                              <MessageCircle className="size-4 text-muted" aria-hidden="true" />
                              Message on WhatsApp
                            </a>
                            {permissions.financials && customer.outstanding > 0 && (
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onRecordPayment(customer.id)
                                }}
                              >
                                <Banknote className="size-4 text-muted" aria-hidden="true" />
                                Record Payment
                              </MenuItem>
                            )}
                            {permissions.manage && (
                              <MenuItem
                                destructive
                                onSelect={() => {
                                  close()
                                  onArchive(customer.id)
                                }}
                              >
                                <Archive className="size-4" aria-hidden="true" />
                                Archive Customer
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Menu>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per customer instead of the table */}
      <ul className="space-y-2 md:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
            <div className="flex items-start gap-3 p-3">
              <Avatar customer={customer} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{customer.name}</p>
                <p className="text-[11px] text-muted">{customer.phone}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {customer.orders} orders
                  {permissions.financials && (
                    <span className="font-semibold text-ink">
                      {' '}
                      · {formatXaf(customer.spent)} spent
                    </span>
                  )}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <TierBadge points={customer.points} />
                  <CustomerStatusBadge customer={customer} />
                  <span>Last order: {formatLastOrder(customer.lastOrderAt, now)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 border-t border-line text-xs font-semibold text-ink">
              <a href={telHref(customer.phone)} className="flex h-10 items-center justify-center gap-1 hover:bg-field">
                <Phone className="size-3.5 text-muted" aria-hidden="true" />
                Call
              </a>
              <a
                href={whatsappHref(customer.phone)}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center justify-center gap-1 border-l border-line hover:bg-field"
              >
                <MessageCircle className="size-3.5 text-muted" aria-hidden="true" />
                Message
              </a>
              {canCreateOrder ? (
                <Link
                  to={`/orders?new=1&customer=${customer.id}`}
                  className="flex h-10 items-center justify-center gap-1 border-l border-line hover:bg-field"
                >
                  <ShoppingCart className="size-3.5 text-muted" aria-hidden="true" />
                  Order
                </Link>
              ) : (
                <span className="border-l border-line" />
              )}
              <Link
                to={`/customers/${customer.id}`}
                className="flex h-10 items-center justify-center gap-1 border-l border-line hover:bg-field"
              >
                <Eye className="size-3.5 text-muted" aria-hidden="true" />
                View
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

const bulkActionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

type CustomerBulkBarProps = {
  count: number
  permissions: CustomerPermissions
  onClear: () => void
  onMessage: () => void
  onExport: () => void
  onAssignBranch: (branch: string) => void
  onChangeStatus: (status: CustomerStatus) => void
  onAddTag: (tag: string) => void
  onArchive: () => void
}

export function CustomerBulkBar({
  count,
  permissions,
  onClear,
  onMessage,
  onExport,
  onAssignBranch,
  onChangeStatus,
  onAddTag,
  onArchive,
}: CustomerBulkBarProps) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
    >
      <p className="mr-2 text-xs font-bold">
        Selected: {count} {count === 1 ? 'customer' : 'customers'}
      </p>
      {permissions.manage && (
        <button type="button" onClick={onMessage} className={bulkActionClass}>
          <Megaphone className="size-3.5" aria-hidden="true" />
          Send SMS / WhatsApp / Email
        </button>
      )}
      <button type="button" onClick={onExport} className={bulkActionClass}>
        <Download className="size-3.5" aria-hidden="true" />
        Export
      </button>
      {permissions.edit && (
        <Menu
          align="left"
          trigger={
            <>
              <Tag className="size-3.5" aria-hidden="true" />
              Add Tag
            </>
          }
          triggerClassName={bulkActionClass}
        >
          {(close) =>
            CUSTOMER_TAGS.map((tag) => (
              <MenuItem
                key={tag}
                onSelect={() => {
                  close()
                  onAddTag(tag)
                }}
              >
                {tag}
              </MenuItem>
            ))
          }
        </Menu>
      )}
      {permissions.manage && (
        <>
          <Menu
            align="left"
            trigger={
              <>
                Assign Branch
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            }
            triggerClassName={bulkActionClass}
          >
            {(close) =>
              BRANCHES.map((branch) => (
                <MenuItem
                  key={branch}
                  onSelect={() => {
                    close()
                    onAssignBranch(branch)
                  }}
                >
                  {branch}
                </MenuItem>
              ))
            }
          </Menu>
          <Menu
            align="left"
            trigger={
              <>
                Change Status
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            }
            triggerClassName={bulkActionClass}
          >
            {(close) =>
              CUSTOMER_STATUSES.map(({ id, label }) => (
                <MenuItem
                  key={id}
                  onSelect={() => {
                    close()
                    onChangeStatus(id)
                  }}
                >
                  {id === 'suspended' && (
                    <Ban className="size-4 text-danger" aria-hidden="true" />
                  )}
                  {label}
                </MenuItem>
              ))
            }
          </Menu>
          <button
            type="button"
            onClick={onArchive}
            className={`${bulkActionClass} bg-danger/80 hover:bg-danger`}
          >
            <Archive className="size-3.5" aria-hidden="true" />
            Archive
          </button>
        </>
      )}
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

export default CustomersTable
