import { useEffect, useRef, useState } from 'react'
import { Eye, Printer, Search, X } from 'lucide-react'
import { STAGES, getStage } from '../../constants/pipeline'
import type { StageId } from '../../constants/pipeline'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import DashboardCard from './DashboardCard'
import { formatXaf } from '../../utils/orders'

type Order = {
  id: string
  customer: string
  contact: string
  tag?: string
  service: string
  items: string
  amount: number
  intake: string
  due: string
  rush?: boolean
  stage: StageId
  stageDetail: string
  payment: string
  paymentTone: BadgeTone
}

// Sample rows until the orders API exists
const ORDERS: Order[] = [
  {
    id: '#ORD-10452',
    customer: 'John Doe',
    contact: '+237 671-892-104',
    tag: 'VIP',
    service: 'Wash & Fold',
    items: '8 garments · 4.2 kg',
    amount: 12_500,
    intake: '09:30',
    due: '17:00',
    stage: 'wash',
    stageDetail: 'Washer W02',
    payment: 'Paid',
    paymentTone: 'success',
  },
  {
    id: '#ORD-10451',
    customer: 'Sarah K.',
    contact: '+237 694-112-883',
    service: 'Express Dry Clean',
    items: '3 wool suits + 2 silks',
    amount: 24_000,
    intake: '08:45',
    due: '14:00',
    rush: true,
    stage: 'press',
    stageDetail: 'Steam pressing',
    payment: 'Mobile Money',
    paymentTone: 'success',
  },
  {
    id: '#ORD-10450',
    customer: 'Grand Palace Hotel',
    contact: 'Concierge Desk #1',
    tag: 'CORP',
    service: 'Bedding Bulk Commercial',
    items: '140 kg · sheets & duvets',
    amount: 185_000,
    intake: '07:15',
    due: '18:30',
    stage: 'dry',
    stageDetail: 'Tumbler dryer #02',
    payment: 'On account (Net 30)',
    paymentTone: 'neutral',
  },
  {
    id: '#ORD-10449',
    customer: 'Dr. Aris',
    contact: '+237 655-332-901',
    service: 'Lab Coats Sanitization',
    items: '18 items · high temp 90°C',
    amount: 18_000,
    intake: '06:40',
    due: 'Ready',
    stage: 'ready',
    stageDetail: 'Staged Bay A',
    payment: 'Paid',
    paymentTone: 'success',
  },
  {
    id: '#ORD-10448',
    customer: 'Emmanuel M.',
    contact: '+237 670-221-504',
    service: 'Premium Sneaker Clean',
    items: '2 pairs suede / leather restoration',
    amount: 15_000,
    intake: '10:15',
    due: 'Tomorrow 12:00',
    stage: 'intake',
    stageDetail: 'Intake staged',
    payment: 'Unpaid (COD)',
    paymentTone: 'danger',
  },
]

const SERVICES = [...new Set(ORDERS.map(({ service }) => service))]

const filterClass =
  'h-8 rounded-md bg-field px-2.5 text-[11px] font-semibold text-ink outline-none transition focus:ring-2 focus:ring-brand'
const iconButtonClass =
  'flex size-7 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function StagePill({ stage, detail }: { stage: StageId; detail: string }) {
  const { label, color } = getStage(stage)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-field px-2 py-1 text-[10px] font-semibold text-ink">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>
        {label}
        <span className="block font-normal text-muted">{detail}</span>
      </span>
    </span>
  )
}

function OrderDrawer({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
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
              <p className="text-[10px] font-bold tracking-wider text-muted uppercase">
                Order
              </p>
              <h3 className="text-lg font-bold">{order.id}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close order details"
              className={iconButtonClass}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4">
            <StagePill stage={order.stage} detail={order.stageDetail} />
          </div>

          <dl className="mt-5 space-y-3 text-xs">
            {[
              ['Customer', order.customer],
              ['Contact', order.contact],
              ['Service', order.service],
              ['Items', order.items],
              ['Amount', formatXaf(order.amount)],
              ['Intake', order.intake],
              ['Due', order.rush ? `${order.due} (Rush)` : order.due],
              ['Payment', order.payment],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-line pb-3"
              >
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </dialog>
  )
}

type OrdersTableProps = {
  stageFilter: StageId | null
  onStageFilterChange: (stage: StageId | null) => void
}

function OrdersTable({ stageFilter, onStageFilterChange }: OrdersTableProps) {
  const [query, setQuery] = useState('')
  const [service, setService] = useState('')
  const [openOrder, setOpenOrder] = useState<Order | null>(null)

  const needle = query.trim().toLowerCase()
  const filtered = ORDERS.filter(
    (order) =>
      (!stageFilter || order.stage === stageFilter) &&
      (!service || order.service === service) &&
      (!needle ||
        [order.id, order.customer, order.contact].some((field) =>
          field.toLowerCase().includes(needle),
        )),
  )

  return (
    <DashboardCard
      title="Today’s Laundry Orders"
      subtitle="Live intake register across wash, dry, fold & finishing stations"
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
              placeholder="Search client, ticket #, phone…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${filterClass} w-52 pl-8 font-medium placeholder:font-normal placeholder:text-muted/70`}
            />
          </div>
          <select
            aria-label="Filter by stage"
            value={stageFilter ?? ''}
            onChange={(event) =>
              onStageFilterChange((event.target.value as StageId) || null)
            }
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
            value={service}
            onChange={(event) => setService(event.target.value)}
            className={filterClass}
          >
            <option value="">All Services</option>
            {SERVICES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[9px] font-bold tracking-wider text-muted uppercase">
              <th scope="col" className="py-2 pr-3">Order ID</th>
              <th scope="col" className="py-2 pr-3">Customer</th>
              <th scope="col" className="py-2 pr-3">Service & items</th>
              <th scope="col" className="py-2 pr-3 text-right">Amount</th>
              <th scope="col" className="py-2 pr-3">Intake → Due</th>
              <th scope="col" className="py-2 pr-3">Pipeline stage</th>
              <th scope="col" className="py-2 pr-3">Payment</th>
              <th scope="col" className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-line align-top">
                <td className="py-3 pr-3 font-bold text-brand">{order.id}</td>
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    {order.customer}
                    {order.tag && <Badge tone="brand">{order.tag}</Badge>}
                  </span>
                  <span className="text-[11px] text-muted">{order.contact}</span>
                </td>
                <td className="py-3 pr-3">
                  <span className="block font-semibold text-ink">
                    {order.service}
                  </span>
                  <span className="text-[11px] text-muted">{order.items}</span>
                </td>
                <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">
                  {formatXaf(order.amount)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap text-ink tabular-nums">
                  {order.intake} →{' '}
                  <span className="font-semibold">{order.due}</span>
                  {order.rush && (
                    <span className="ml-1.5">
                      <Badge tone="danger">Rush</Badge>
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <StagePill stage={order.stage} detail={order.stageDetail} />
                </td>
                <td className="py-3 pr-3">
                  <Badge tone={order.paymentTone}>{order.payment}</Badge>
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
                    <button
                      type="button"
                      aria-label={`Print ticket for ${order.id}`}
                      className={iconButtonClass}
                    >
                      <Printer className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">
                  No orders match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Showing {filtered.length} of {ORDERS.length} orders
      </p>

      <OrderDrawer order={openOrder} onClose={() => setOpenOrder(null)} />
    </DashboardCard>
  )
}

export default OrdersTable
