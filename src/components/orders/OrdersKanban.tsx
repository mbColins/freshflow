import { useState } from 'react'
import { PIPELINE_STATUSES } from '../../constants/orders'
import type { Permissions } from '../../constants/orders'
import type { Order, OrderStatus } from '../../types/order'
import {
  formatXaf,
  getDueInfo,
  getItemCount,
  getPrimaryService,
  getTotal,
} from '../../utils/orders'
import { OrderIndicators, PaymentBadge, PriorityBadge } from './OrderBadges'

type OrdersKanbanProps = {
  orders: Order[]
  now: number
  permissions: Permissions
  onOpen: (id: string) => void
  onMove: (id: string, status: OrderStatus) => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
}

function OrdersKanban({
  orders,
  now,
  permissions,
  onOpen,
  onMove,
}: OrdersKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStatus, setOverStatus] = useState<OrderStatus | null>(null)
  const canMove = permissions.updateStatus

  function handleDrop(status: OrderStatus) {
    const order = orders.find(({ id }) => id === draggingId)
    if (order && order.status !== status) onMove(order.id, status)
    setDraggingId(null)
    setOverStatus(null)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_STATUSES.map(({ id: status, label, color }) => {
        const columnOrders = orders.filter((order) => order.status === status)
        return (
          <section
            key={status}
            aria-label={`${label}, ${columnOrders.length} orders`}
            onDragOver={(event) => {
              if (!draggingId) return
              event.preventDefault()
              setOverStatus(status)
            }}
            onDragLeave={() => setOverStatus(null)}
            onDrop={() => handleDrop(status)}
            className={`flex w-64 shrink-0 flex-col rounded-xl p-2 transition ${
              overStatus === status ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field'
            }`}
          >
            <h3 className="flex items-center gap-2 px-1 py-1.5 text-[11px] font-bold text-ink">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
              <span className="ml-auto rounded-full bg-white px-1.5 text-[10px] text-muted">
                {columnOrders.length}
              </span>
            </h3>

            <ul className="mt-1 min-h-16 flex-1 space-y-2">
              {columnOrders.map((order) => {
                const due = getDueInfo(order, now)
                return (
                  <li
                    key={order.id}
                    draggable={canMove}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', order.id)
                      setDraggingId(order.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverStatus(null)
                    }}
                    className={`rounded-lg bg-white shadow-sm ring-1 ring-line ${
                      canMove ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${draggingId === order.id ? 'opacity-50' : ''} ${
                      due.overdue ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(order.id)}
                      className="block w-full rounded-lg p-3 text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand">
                          #{order.id}
                        </span>
                        <OrderIndicators order={order} now={now} />
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-ink">
                        {order.customer.name}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {getItemCount(order)} items · {getPrimaryService(order)}
                      </span>
                      {permissions.financials && (
                        <span className="mt-1 block text-[11px] font-semibold text-ink">
                          {formatXaf(getTotal(order))}
                        </span>
                      )}
                      <span
                        className={`mt-1 block text-[11px] ${due.overdue ? 'font-bold text-danger' : 'text-muted'}`}
                      >
                        {due.overdue ? due.relative : `Due: ${due.label}`}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5">
                        {permissions.financials && <PaymentBadge order={order} />}
                        {order.priority !== 'normal' && (
                          <PriorityBadge order={order} />
                        )}
                        <span
                          title={`Assigned to ${order.assignedTo}`}
                          className="ml-auto flex size-6 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white"
                        >
                          {getInitials(order.assignedTo)}
                          <span className="sr-only">
                            Assigned to {order.assignedTo}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {columnOrders.length === 0 && (
                <li className="rounded-lg border border-dashed border-line py-4 text-center text-[11px] text-muted">
                  No orders
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default OrdersKanban
