import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Ellipsis,
  Eye,
  Phone,
  Printer,
  RefreshCw,
} from 'lucide-react'
import type { Permissions } from '../../constants/orders'
import type { Order } from '../../types/order'
import {
  formatXaf,
  getDueInfo,
  getItemCount,
  getItemsPreview,
  getPrimaryService,
  getTotal,
} from '../../utils/orders'
import type { SortKey } from '../../utils/orders'
import Menu, { MenuItem } from '../ui/Menu'
import {
  OrderIndicators,
  PaymentBadge,
  PriorityBadge,
  StatusBadge,
} from './OrderBadges'
import { iconButton } from './styles'

export type SortState = { key: SortKey; direction: 'asc' | 'desc' }

type OrdersTableProps = {
  orders: Order[]
  now: number
  sort: SortState
  onSort: (key: SortKey) => void
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  hiddenColumns: string[]
  permissions: Permissions
  onOpen: (id: string) => void
  onPrint: (id: string) => void
  onCancel: (id: string) => void
}

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
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

function DueCell({ order, now }: { order: Order; now: number }) {
  const due = getDueInfo(order, now)
  return (
    <>
      <span className="block whitespace-nowrap text-ink tabular-nums">
        {due.label}
      </span>
      <span
        className={`block text-[11px] whitespace-nowrap ${due.overdue ? 'font-bold text-danger' : 'text-muted'}`}
      >
        {due.relative}
      </span>
    </>
  )
}

function OrdersTable({
  orders,
  now,
  sort,
  onSort,
  selectedIds,
  onToggle,
  onToggleAll,
  hiddenColumns,
  permissions,
  onOpen,
  onPrint,
  onCancel,
}: OrdersTableProps) {
  const shows = (key: string) => !hiddenColumns.includes(key)
  const showAmount = permissions.financials && shows('amount')
  const showPayment = permissions.financials && shows('payment')
  const allSelected =
    orders.length > 0 && orders.every(({ id }) => selectedIds.includes(id))

  return (
    <>
      {/* Desktop: data table */}
      <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
        <table className="w-full min-w-[960px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={`${headClass} w-8`}>
                <input
                  type="checkbox"
                  aria-label="Select all orders on this page"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  className="size-4 accent-brand"
                />
              </th>
              <SortHeader label="Order" sortKey="id" sort={sort} onSort={onSort} />
              <SortHeader label="Customer" sortKey="customer" sort={sort} onSort={onSort} />
              {shows('items') && <th scope="col" className={headClass}>Items</th>}
              {shows('service') && <th scope="col" className={headClass}>Service</th>}
              {showAmount && (
                <SortHeader label="Amount" sortKey="amount" sort={sort} onSort={onSort} align="right" />
              )}
              {showPayment && <th scope="col" className={headClass}>Payment</th>}
              <SortHeader label="Current stage" sortKey="status" sort={sort} onSort={onSort} />
              {shows('due') && (
                <SortHeader label="Due" sortKey="due" sort={sort} onSort={onSort} />
              )}
              {shows('method') && (
                <th scope="col" className={headClass}>
                  Pickup /<br />
                  Delivery
                </th>
              )}
              {shows('priority') && (
                <SortHeader label="Priority" sortKey="priority" sort={sort} onSort={onSort} />
              )}
              {shows('assigned') && <th scope="col" className={headClass}>Assigned to</th>}
              <th scope="col" className={`${headClass} right-0 z-20 text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const selected = selectedIds.includes(order.id)
              const overdue = getDueInfo(order, now).overdue
              return (
                <tr
                  key={order.id}
                  className={`border-t border-line transition hover:bg-field/60 ${selected ? 'bg-brand/5' : ''} ${
                    overdue ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''
                  }`}
                >
                  <td className={cellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select order ${order.id}`}
                      checked={selected}
                      onChange={() => onToggle(order.id)}
                      className="size-4 accent-brand"
                    />
                  </td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      onClick={() => onOpen(order.id)}
                      className="rounded-sm font-bold whitespace-nowrap text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    >
                      #{order.id}
                    </button>
                    <span className="mt-1 block">
                      <OrderIndicators order={order} now={now} />
                    </span>
                  </td>
                  <td className={cellClass}>
                    <span className="block font-semibold whitespace-nowrap text-ink">
                      {order.customer.name}
                    </span>
                    <span className="block text-[11px] whitespace-nowrap text-muted">
                      {order.customer.phone}
                    </span>
                  </td>
                  {shows('items') && (
                    <td className={cellClass}>
                      <span className="block font-semibold whitespace-nowrap text-ink">
                        {getItemCount(order)} items
                      </span>
                      <span className="block max-w-28 truncate text-[11px] text-muted">
                        {getItemsPreview(order)}
                      </span>
                    </td>
                  )}
                  {shows('service') && (
                    <td className={`${cellClass} whitespace-nowrap text-ink`}>
                      {getPrimaryService(order)}
                    </td>
                  )}
                  {showAmount && (
                    <td className={`${cellClass} text-right font-semibold whitespace-nowrap text-ink tabular-nums`}>
                      {formatXaf(getTotal(order))}
                    </td>
                  )}
                  {showPayment && (
                    <td className={cellClass}>
                      <PaymentBadge order={order} />
                    </td>
                  )}
                  <td className={cellClass}>
                    <StatusBadge order={order} />
                  </td>
                  {shows('due') && (
                    <td className={cellClass}>
                      <DueCell order={order} now={now} />
                    </td>
                  )}
                  {shows('method') && (
                    <td className={`${cellClass} text-ink capitalize`}>
                      {order.method}
                    </td>
                  )}
                  {shows('priority') && (
                    <td className={cellClass}>
                      <PriorityBadge order={order} />
                    </td>
                  )}
                  {shows('assigned') && (
                    <td className={`${cellClass} whitespace-nowrap text-ink`}>
                      {order.assignedTo.split(' ')[0]}
                    </td>
                  )}
                  {/* Pinned so row actions stay reachable when the table scrolls sideways */}
                  <td className={`${cellClass} sticky right-0 bg-white text-right`}>
                    <Menu
                      label={`Actions for order ${order.id}`}
                      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                      triggerClassName={`${iconButton} ml-auto`}
                    >
                      {(close) => (
                        <>
                          <MenuItem
                            onSelect={() => {
                              close()
                              onOpen(order.id)
                            }}
                          >
                            <Eye className="size-4 text-muted" aria-hidden="true" />
                            View Order
                          </MenuItem>
                          <MenuItem
                            onSelect={() => {
                              close()
                              onPrint(order.id)
                            }}
                          >
                            <Printer className="size-4 text-muted" aria-hidden="true" />
                            Print Receipt
                          </MenuItem>
                          {permissions.cancel &&
                            order.status !== 'cancelled' &&
                            order.status !== 'completed' && (
                              <MenuItem
                                destructive
                                onSelect={() => {
                                  close()
                                  onCancel(order.id)
                                }}
                              >
                                <Ban className="size-4" aria-hidden="true" />
                                Cancel Order
                              </MenuItem>
                            )}
                        </>
                      )}
                    </Menu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per order instead of the table */}
      <ul className="space-y-2 md:hidden">
        {orders.map((order) => {
          const due = getDueInfo(order, now)
          return (
            <li
              key={order.id}
              className={`overflow-hidden rounded-xl bg-white ring-1 ring-line ${
                due.overdue ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''
              }`}
            >
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-brand">#{order.id}</p>
                    <p className="text-xs font-semibold text-ink">
                      {order.customer.name}
                    </p>
                  </div>
                  <StatusBadge order={order} />
                </div>
                <p className="text-[11px] text-muted">
                  {getItemCount(order)} items · {getPrimaryService(order)}
                  {permissions.financials && (
                    <span className="font-semibold text-ink">
                      {' '}
                      · {formatXaf(getTotal(order))}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={due.overdue ? 'font-bold text-danger' : 'text-muted'}
                  >
                    {due.overdue ? due.relative : `Due ${due.label}`}
                  </span>
                  {permissions.financials && <PaymentBadge order={order} />}
                  {order.priority !== 'normal' && <PriorityBadge order={order} />}
                  <OrderIndicators order={order} now={now} />
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-line text-xs font-semibold text-ink">
                <a
                  href={`tel:${order.customer.phone.replace(/\s/g, '')}`}
                  className="flex h-10 items-center justify-center gap-1.5 hover:bg-field"
                >
                  <Phone className="size-3.5 text-muted" aria-hidden="true" />
                  Call
                </a>
                <button
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className="flex h-10 items-center justify-center gap-1.5 border-x border-line hover:bg-field"
                >
                  <RefreshCw className="size-3.5 text-muted" aria-hidden="true" />
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className="flex h-10 items-center justify-center gap-1.5 hover:bg-field"
                >
                  <Eye className="size-3.5 text-muted" aria-hidden="true" />
                  View
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default OrdersTable
