import { useEffect, useRef, useState } from 'react'
import { Eye, RotateCcw, Search, X } from 'lucide-react'
import { Link } from 'react-router'
import { STAGES, getStage } from '../../constants/pipeline'
import type { StageId } from '../../constants/pipeline'
import useCurrentUser from '../../hooks/useCurrentUser'
import useNow from '../../hooks/useNow'
import { useOrdersQuery } from '../../hooks/useOrders'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import type { Order, OrderStatus, PaymentStatus } from '../../types/order'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import {
  formatTime,
  formatXaf,
  getDueInfo,
  getItemCount,
  getItemsPreview,
  getPaymentStatus,
  getPrimaryService,
  getStatusLabel,
  getTotal,
} from '../../utils/orders'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import DashboardCard from './DashboardCard'

// Where an order sits on the operations pipeline; finished orders have no stage
const STAGE_OF: Partial<Record<OrderStatus, StageId>> = {
  received: 'intake',
  washing: 'wash',
  drying: 'dry',
  ironing: 'press',
  qa: 'qa',
  ready: 'ready',
  handover: 'route',
}

const PAYMENT: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part paid', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
}

const filterClass =
  'h-8 rounded-md bg-field px-2.5 text-[11px] font-semibold text-ink outline-none transition focus:ring-2 focus:ring-brand'
const iconButtonClass =
  'flex size-7 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function StagePill({ order }: { order: Order }) {
  const stage = STAGE_OF[order.status]
  if (!stage) {
    return <Badge tone={order.status === 'cancelled' ? 'neutral' : 'success'}>{getStatusLabel(order)}</Badge>
  }
  const { label, color } = getStage(stage)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-field px-2 py-1 text-[10px] font-semibold text-ink">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span>
        {label}
        <span className="block font-normal text-muted">{getStatusLabel(order)}</span>
      </span>
    </span>
  )
}

function OrderDrawer({ order, now, onClose }: { order: Order | null; now: number; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (order && !dialog.open) dialog.showModal()
    if (!order && dialog.open) dialog.close()
  }, [order])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Order details"
      className="m-0 ml-auto h-full max-h-none w-full max-w-sm bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {order && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-muted uppercase">Order</p>
              <h3 className="text-lg font-bold">{order.id}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close order details" className={iconButtonClass}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4">
            <StagePill order={order} />
          </div>

          <dl className="mt-5 space-y-3 text-xs">
            {[
              ['Customer', order.customer.name || '—'],
              ['Contact', order.customer.phone || '—'],
              ['Branch', order.branch || '—'],
              ['Service', getPrimaryService(order)],
              ['Items', getItemsPreview(order) || '—'],
              ['Amount', formatXaf(getTotal(order))],
              ['Intake', formatTime(order.createdAt)],
              ['Due', getDueInfo(order, now).label],
              ['Payment', PAYMENT[getPaymentStatus(order)].label],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-line pb-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <Link to={`/orders?order=${encodeURIComponent(order.id)}`} className="mt-5 inline-block text-xs font-bold text-brand hover:underline">
            Open in Orders
          </Link>
        </>
      )}
    </dialog>
  )
}

type OrdersTableProps = {
  // Branch uuid chosen on the dashboard; empty = every branch the user sees
  branch: string
  stageFilter: StageId | null
  onStageFilterChange: (stage: StageId | null) => void
}

// The dashboard's order register, from GET /order. The backend scopes the list:
// a tenant owner gets every branch's orders, anyone else their own branch's.
// The dashboard's branch picker narrows a tenant owner's view to one branch
function OrdersTable({ branch, stageFilter, onStageFilterChange }: OrdersTableProps) {
  const now = useNow()
  const { items: orders, isLoading, isError, isFetching, error, refetch } = useOrdersQuery()
  const { user, isPlatformAdmin } = useCurrentUser()
  const seesAllBranches = user?.userType === 'TENANT' || isPlatformAdmin
  const { data: branchOptions = [] } = useGetBranchDropdownQuery(undefined, { skip: !seesAllBranches })
  const [query, setQuery] = useState('')
  const [service, setService] = useState('')
  const [openOrder, setOpenOrder] = useState<Order | null>(null)

  // Branch names: the tenant's list, plus any branch an order names that the list doesn't
  const branches = [
    ...branchOptions.map(({ uuid, name }) => ({ id: uuid, name })),
    ...orders
      .filter(({ branchId }) => branchId && !branchOptions.some(({ uuid }) => uuid === branchId))
      .map(({ branchId, branch: name }) => ({ id: branchId!, name: name || 'Unknown branch' })),
  ].filter((option, index, all) => all.findIndex(({ id }) => id === option.id) === index)

  const inBranch = orders.filter((order) => !branch || order.branchId === branch)
  const services = [...new Set(inBranch.map(getPrimaryService))].filter((name) => name !== '—').sort()
  // A service chosen for another branch may not exist in this one
  const serviceShown = services.includes(service) ? service : ''
  const needle = query.trim().toLowerCase()
  const filtered = inBranch
    .filter(
      (order) =>
        (!stageFilter || STAGE_OF[order.status] === stageFilter) &&
        (!serviceShown || getPrimaryService(order) === serviceShown) &&
        (!needle ||
          [order.id, order.customer.name, order.customer.phone].some((field) => field.toLowerCase().includes(needle))),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const showBranchColumn = seesAllBranches && !branch && branches.length > 1

  return (
    <DashboardCard
      title="Laundry Orders"
      subtitle={
        seesAllBranches
          ? branch
            ? `Orders at ${branches.find(({ id }) => id === branch)?.name ?? 'this branch'}`
            : 'Orders across all your branches'
          : user?.branch
            ? `Orders at ${user.branch}`
            : 'Orders at your branch'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Search client, order #, phone…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${filterClass} w-52 pl-8 font-medium placeholder:font-normal placeholder:text-muted/70`}
            />
          </div>
          <select
            aria-label="Filter by stage"
            value={stageFilter ?? ''}
            onChange={(event) => onStageFilterChange((event.target.value as StageId) || null)}
            className={filterClass}
          >
            <option value="">All Stages</option>
            {STAGES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by service"
            value={serviceShown}
            onChange={(event) => setService(event.target.value)}
            className={filterClass}
          >
            <option value="">All Services</option>
            {services.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading orders…</p>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-12 animate-pulse rounded-md bg-field" />
          ))}
        </div>
      ) : isError && orders.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-bold text-ink">Couldn’t load the orders</p>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-1 flex items-center gap-1.5 text-xs font-bold text-brand hover:underline disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[9px] font-bold tracking-wider text-muted uppercase">
                  <th scope="col" className="py-2 pr-3">Order ID</th>
                  <th scope="col" className="py-2 pr-3">Customer</th>
                  {showBranchColumn && <th scope="col" className="py-2 pr-3">Branch</th>}
                  <th scope="col" className="py-2 pr-3">Service & items</th>
                  <th scope="col" className="py-2 pr-3 text-right">Amount</th>
                  <th scope="col" className="py-2 pr-3">Intake → Due</th>
                  <th scope="col" className="py-2 pr-3">Pipeline stage</th>
                  <th scope="col" className="py-2 pr-3">Payment</th>
                  <th scope="col" className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const due = getDueInfo(order, now)
                  const payment = PAYMENT[getPaymentStatus(order)]
                  const count = getItemCount(order)
                  return (
                    <tr key={order.id} className="border-b border-line align-top">
                      <td className="py-3 pr-3 font-bold text-brand">{order.id}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          {order.customer.name || 'Walk-in'}
                          {order.customer.type === 'corporate' && <Badge tone="brand">CORP</Badge>}
                        </span>
                        <span className="text-[11px] text-muted">{order.customer.phone}</span>
                      </td>
                      {showBranchColumn && <td className="py-3 pr-3 text-ink">{order.branch || '—'}</td>}
                      <td className="py-3 pr-3">
                        <span className="block font-semibold text-ink">{getPrimaryService(order)}</span>
                        <span className="text-[11px] text-muted">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">
                        {formatXaf(getTotal(order))}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-ink tabular-nums">
                        {formatTime(order.createdAt)} → <span className="font-semibold">{due.label}</span>
                        <span className={`block text-[11px] ${due.overdue ? 'font-semibold text-danger' : 'text-muted'}`}>
                          {due.relative}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <StagePill order={order} />
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={payment.tone}>{payment.label}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setOpenOrder(order)}
                            aria-label={`View order ${order.id}`}
                            className={iconButtonClass}
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showBranchColumn ? 9 : 8} className="py-8 text-center text-muted">
                      {inBranch.length === 0 ? 'No orders yet.' : 'No orders match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-muted">
            Showing {filtered.length} of {inBranch.length} orders
          </p>
        </>
      )}

      <OrderDrawer order={openOrder} now={now} onClose={() => setOpenOrder(null)} />
    </DashboardCard>
  )
}

export default OrdersTable
