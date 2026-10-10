import { ChevronDown } from 'lucide-react'
import type { Order } from '../../types/order'
import { formatDuration, formatXaf, getTotal } from '../../utils/orders'

type OrderStatsProps = {
  orders: Order[]
  now: number
  showFinancials: boolean
}

function percent(part: number, whole: number) {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`
}

function OrderStats({ orders, now, showFinancials }: OrderStatsProps) {
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  const completed = orders.filter(
    (order) => order.status === 'completed' && order.completedAt,
  )
  const processingMs = completed.map(
    (order) =>
      new Date(order.completedAt!).getTime() -
      new Date(order.createdAt).getTime(),
  )
  const onTime = completed.filter(
    (order) =>
      new Date(order.completedAt!).getTime() <=
      new Date(order.dueAt).getTime(),
  )
  const billable = orders.filter(({ status }) => status !== 'cancelled')

  const stats = [
    {
      label: 'Orders today',
      value: String(
        orders.filter(
          (order) => new Date(order.createdAt).getTime() >= dayStart,
        ).length,
      ),
    },
    {
      label: 'Avg processing time',
      value:
        processingMs.length === 0
          ? '—'
          : formatDuration(
              processingMs.reduce((sum, ms) => sum + ms, 0) /
                processingMs.length,
            ),
    },
    {
      label: 'On-time completion',
      value: percent(onTime.length, completed.length),
    },
    ...(showFinancials
      ? [
          {
            label: 'Avg order value',
            value:
              billable.length === 0
                ? '—'
                : formatXaf(
                    billable.reduce((sum, order) => sum + getTotal(order), 0) /
                      billable.length,
                  ),
          },
        ]
      : []),
    {
      label: 'Cancellation rate',
      value: percent(
        orders.filter(({ status }) => status === 'cancelled').length,
        orders.length,
      ),
    },
    {
      label: 'Reprocessing rate',
      value: percent(
        orders.filter(({ qc }) => qc.result === 'failed').length,
        orders.length,
      ),
    },
  ]

  return (
    <details className="group rounded-xl bg-white ring-1 ring-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
        Order statistics
        <ChevronDown
          className="size-4 text-muted transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="grid grid-cols-2 gap-3 border-t border-line px-4 py-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="mt-0.5 text-base font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export default OrderStats
