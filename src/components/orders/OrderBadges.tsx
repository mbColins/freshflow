import { ChevronsUp, Clock, TriangleAlert, Truck, Zap } from 'lucide-react'
import { PAYMENT_STATUSES } from '../../constants/orders'
import type { Order } from '../../types/order'
import {
  getDueInfo,
  getPaymentStatus,
  getStatus,
  getStatusLabel,
} from '../../utils/orders'
import Badge from '../ui/Badge'

export function StatusBadge({ order }: { order: Order }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-field px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-ink">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: getStatus(order.status).color }}
      />
      {getStatusLabel(order)}
    </span>
  )
}

export function PaymentBadge({ order }: { order: Order }) {
  const status = getPaymentStatus(order)
  const { label, tone } = PAYMENT_STATUSES.find(({ id }) => id === status)!
  return <Badge tone={tone}>{label}</Badge>
}

export function PriorityBadge({ order }: { order: Order }) {
  if (order.priority === 'express') {
    return (
      <Badge tone="brand">
        <Zap className="size-3" aria-hidden="true" />
        Express
      </Badge>
    )
  }
  if (order.priority === 'high') {
    return (
      <Badge tone="warning">
        <ChevronsUp className="size-3" aria-hidden="true" />
        High
      </Badge>
    )
  }
  return <span className="text-[11px] text-muted">Normal</span>
}

// Small flags for conditions that need attention; each carries a text label for screen readers
export function OrderIndicators({ order, now }: { order: Order; now: number }) {
  const due = getDueInfo(order, now)
  return (
    <span className="inline-flex items-center gap-1">
      {due.overdue && (
        <span title={due.relative} className="text-danger">
          <Clock className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Overdue</span>
        </span>
      )}
      {order.handling && (
        <span title={`Special handling: ${order.handling}`} className="text-warning">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Special handling</span>
        </span>
      )}
      {order.method === 'delivery' && order.status !== 'completed' && (
        <span title="Delivery scheduled" className="text-brand">
          <Truck className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Delivery scheduled</span>
        </span>
      )}
    </span>
  )
}
