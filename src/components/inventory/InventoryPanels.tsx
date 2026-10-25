import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  ClipboardList,
  Flame,
  Gauge,
  Lock,
  PackageX,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  CONSUMPTION_VARIANCE,
  INVENTORY_CATEGORIES,
  STOCK_STATUSES,
  SUPPLIERS,
  VARIANCE_ALERT_PCT,
  WEEKLY_CONSUMPTION,
} from '../../constants/inventory'
import type {
  InventoryFilters,
  InventoryItem,
  Movement,
  PurchaseOrder,
  StockStatus,
  StockTransfer,
} from '../../types/inventory'
import { formatDate } from '../../utils/customers'
import {
  formatQty,
  getAvailable,
  getDaysLeft,
  getDaysToExpiry,
  getIdleDays,
  getPoTotal,
  getRecommendedOrder,
  getStockStatus,
  getValue,
  isDeadStock,
  needsReorder,
} from '../../utils/inventory'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { formatCompactXaf } from '../../utils/services'
import { secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'

const smallButton = `${secondaryButton} h-7 px-2.5 text-[11px]`
const thClass =
  'py-1.5 pr-3 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase'

type Shared = { items: InventoryItem[]; now: number }

// ---------- KPI cards ----------

type KpiPatch = Pick<InventoryFilters, 'status' | 'view'>

export function InventoryKpis({
  items,
  now,
  movements,
  orders,
  filters,
  onSelect,
  showCosts,
}: Shared & {
  movements: Movement[]
  orders: PurchaseOrder[]
  filters: InventoryFilters
  onSelect: (patch: KpiPatch) => void
  showCosts: boolean
}) {
  const count = (status: StockStatus) =>
    items.filter((item) => getStockStatus(item, now) === status).length
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  const consumedToday = movements.filter(
    ({ at, type }) => type === 'Consumption' && new Date(at).getTime() >= dayStart,
  )
  const pending = orders.filter(
    ({ status }) => !['Received', 'Cancelled', 'Draft'].includes(status),
  )
  const none: KpiPatch = { status: '', view: '' }

  const cards: {
    label: string
    icon: LucideIcon
    value: string
    note: string
    patch?: KpiPatch
    tone?: 'warning' | 'danger'
  }[] = [
    { label: 'Total Items', icon: Boxes, value: String(items.length), note: 'Active inventory items', patch: none },
    ...(showCosts
      ? [{ label: 'Inventory Value', icon: Wallet, value: formatCompactXaf(items.reduce((sum, item) => sum + getValue(item), 0)), note: 'Stock at unit cost' }]
      : []),
    { label: 'Low Stock', icon: TriangleAlert, value: String(items.filter(needsReorder).length), note: 'At reorder level', patch: { status: '', view: 'reorder' }, tone: 'warning' },
    { label: 'Out of Stock', icon: PackageX, value: String(count('out')), note: 'Critical items', patch: { status: 'out', view: '' }, tone: 'danger' },
    { label: 'Expiring Soon', icon: CalendarClock, value: String(count('expiring') + count('expired')), note: 'Within 30 days', patch: { status: 'expiring', view: '' }, tone: 'warning' },
    { label: 'Consumed Today', icon: Flame, value: String(consumedToday.length), note: 'Entries recorded' },
    { label: 'Reserved Stock', icon: Lock, value: String(items.filter(({ reserved }) => reserved > 0).length), note: 'Items allocated', patch: { status: '', view: 'reserved' } },
    { label: 'Pending POs', icon: Truck, value: String(pending.length), note: 'Awaiting delivery' },
  ]
  const toneClass = { warning: 'text-warning', danger: 'text-danger' }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, icon: Icon, value, note, patch, tone }) => {
        const selected =
          patch !== undefined &&
          patch !== none &&
          filters.status === patch.status &&
          filters.view === patch.view
        const flagged = tone && value !== '0' ? toneClass[tone] : ''
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-3.5 shrink-0 ${flagged}`} aria-hidden="true" />
            </span>
            <span className={`mt-1 block truncate text-xl font-bold tabular-nums ${flagged || 'text-ink'}`}>
              {value}
            </span>
            <span className="block truncate text-[10px] text-muted">{note}</span>
          </>
        )
        const base = 'min-w-0 rounded-xl bg-white p-3 text-left'
        return patch ? (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? none : patch)}
            className={`${base} transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              selected ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            {body}
          </button>
        ) : (
          <div key={label} className={`${base} ring-1 ring-line`}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Health & service impact ----------

export function InventoryHealth({
  items,
  now,
  onSelect,
}: Shared & { onSelect: (status: StockStatus) => void }) {
  const segments = STOCK_STATUSES.map((status) => ({
    ...status,
    count: items.filter((item) => getStockStatus(item, now) === status.id).length,
  })).filter(({ count }) => count > 0)
  const healthy = segments.find(({ id }) => id === 'healthy')?.count ?? 0
  const share = (count: number) => (items.length === 0 ? 0 : (count / items.length) * 100)

  return (
    <Panel
      title="Inventory Health"
      subtitle={`${Math.round(share(healthy))}% of ${items.length} items are healthy`}
      icon={Gauge}
    >
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {segments.map(({ id, color, count }) => (
          <span key={id} style={{ width: `${share(count)}%`, backgroundColor: color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(({ id, label, color, count }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className="flex items-center gap-1.5 rounded-sm text-[11px] text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {label}
              <span className="font-bold text-ink tabular-nums">
                {Math.round(share(count))}% ({count})
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function ServiceImpact({ items, now }: Shared) {
  const services = [...new Set(items.flatMap(({ services: names }) => names))].sort()
  const rows = services.map((service) => {
    const needed = items.filter((item) => item.services.includes(service))
    const blocking = needed.filter((item) =>
      ['out', 'expired'].includes(getStockStatus(item, now)),
    )
    const limited = needed.filter((item) =>
      ['critical', 'low'].includes(getStockStatus(item, now)),
    )
    return { service, blocking, limited }
  })

  return (
    <Panel
      title="Service Availability Impact"
      subtitle="Which services the current shortages put at risk"
    >
      <ul className="space-y-1.5">
        {rows.map(({ service, blocking, limited }) => {
          const tone = blocking.length > 0 ? 'danger' : limited.length > 0 ? 'warning' : 'success'
          const cause = [...blocking, ...limited][0]
          return (
            <li
              key={service}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-field px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="font-semibold text-ink">{service}</span>
                {cause && (
                  <span className="block truncate text-[11px] text-muted">
                    {cause.name}{' '}
                    {blocking.length > 0 ? 'unavailable' : 'below reorder level'}
                    {blocking.length + limited.length > 1 &&
                      ` (+${blocking.length + limited.length - 1} more)`}
                  </span>
                )}
              </span>
              <Badge tone={tone}>
                {blocking.length > 0 ? 'At Risk' : limited.length > 0 ? 'Limited' : 'Available'}
              </Badge>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ---------- Categories ----------

export function CategoryCards({
  items,
  now,
  selected,
  onSelect,
  showCosts,
}: Shared & {
  selected: string
  onSelect: (category: string) => void
  showCosts: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {INVENTORY_CATEGORIES.map(({ name, help }) => {
        const members = items.filter(({ category }) => category === name)
        const low = members.filter(needsReorder).length
        const active = selected === name
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? '' : name)}
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            <span className="block truncate text-xs font-bold text-ink">{name}</span>
            <span className="block truncate text-[10px] text-muted">{help}</span>
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              <span className="font-bold text-ink">{members.length} items</span>
              {showCosts && (
                <span>{formatXaf(members.reduce((sum, item) => sum + getValue(item), 0))}</span>
              )}
              {low > 0 && <Badge tone="warning">{low} to reorder</Badge>}
            </span>
            <span className="sr-only">
              {members.filter((item) => getStockStatus(item, now) === 'out').length} out of stock
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Replenishment ----------

export function ReplenishmentQueue({
  items,
  now,
  canManage,
  onOrder,
  onTransfer,
  onOpen,
}: Shared & {
  canManage: boolean
  onOrder: (itemIds: string[]) => void
  onTransfer: (itemId: string) => void
  onOpen: (itemId: string) => void
}) {
  const queue = items
    .filter(needsReorder)
    .sort((a, b) => (getDaysLeft(a) ?? Infinity) - (getDaysLeft(b) ?? Infinity))

  return (
    <Panel
      title="Urgent Replenishment Queue"
      subtitle="Items at or below their reorder level, soonest to run out first"
      icon={TriangleAlert}
      badge={queue.length > 0 && <Badge tone="danger">{queue.length} to reorder</Badge>}
      action={
        canManage &&
        queue.length > 1 && (
          <button
            type="button"
            onClick={() => onOrder(queue.map(({ id }) => id))}
            className={`${smallButton} font-bold`}
          >
            <ShoppingCart className="size-3 text-muted" aria-hidden="true" />
            Order all {queue.length}
          </button>
        )
      }
    >
      {queue.length === 0 ? (
        <PanelEmpty>Inventory levels are healthy.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {queue.map((item) => {
            const status = getStockStatus(item, now)
            const left = getDaysLeft(item)
            const severe = status === 'out' || status === 'critical'
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-start gap-3 rounded-lg p-3 ring-1 ${
                  severe ? 'bg-danger/5 ring-danger/20' : 'bg-warning/5 ring-warning/20'
                }`}
              >
                <div className="min-w-40 flex-1 text-xs">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <Badge tone={severe ? 'danger' : 'warning'}>
                      {status === 'out' ? 'Out of Stock' : severe ? 'Critical' : 'Low'}
                    </Badge>
                    {item.name}
                    <span className="text-[10px] font-normal text-muted">{item.branchName}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Available {formatQty(getAvailable(item), item.unit)} · reorder at{' '}
                    {formatQty(item.reorder, item.unit)}
                    {left !== null && item.stock > 0 && (
                      <>
                        {' '}
                        ·{' '}
                        <span className={left < 2 ? 'font-bold text-danger' : ''}>
                          {left < 1
                            ? `runs out in about ${Math.max(1, Math.round(left * 24))} hours`
                            : `${left.toFixed(1)} days of supply`}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-muted">
                    Recommended order:{' '}
                    <span className="font-semibold text-ink">
                      {formatQty(getRecommendedOrder(item), item.unit)}
                    </span>{' '}
                    (up to the maximum level)
                    {item.services.length > 0 &&
                      ` · ${item.services.length} ${item.services.length === 1 ? 'service' : 'services'} affected`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOrder([item.id])}
                        className={`${smallButton} font-bold`}
                      >
                        Create Purchase Order
                      </button>
                      <button
                        type="button"
                        onClick={() => onTransfer(item.id)}
                        className={smallButton}
                      >
                        Transfer From Branch
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => onOpen(item.id)} className={smallButton}>
                    View Item
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Consumption ----------

export function ConsumptionPanel() {
  const peak = Math.max(...WEEKLY_CONSUMPTION.map(({ units }) => units))
  const total = WEEKLY_CONSUMPTION.reduce((sum, { units }) => sum + units, 0)

  return (
    <Panel
      title="Consumption & Dosing Variance"
      subtitle="Expected recipe usage vs what was actually drawn (sample figures)"
      icon={Flame}
    >
      <ul className="space-y-3">
        {CONSUMPTION_VARIANCE.map(({ service, recipe, expected, actual, unit }) => {
          const variance = ((actual - expected) / expected) * 100
          const abnormal = Math.abs(variance) >= VARIANCE_ALERT_PCT
          return (
            <li key={service} className="rounded-lg bg-field p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{service}</p>
                  <p className="text-[11px] text-muted">{recipe}</p>
                </div>
                <Badge tone={abnormal ? 'danger' : 'success'}>
                  {abnormal && <TriangleAlert className="size-3" aria-hidden="true" />}
                  {variance > 0 ? '+' : ''}
                  {variance.toFixed(1)}% {abnormal ? 'over-dosing' : 'variance'}
                </Badge>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full ${abnormal ? 'bg-danger' : 'bg-brand'}`}
                  style={{ width: `${Math.min(100, (expected / actual) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-muted tabular-nums">
                Dosed {actual} {unit} · expected {expected} {unit}
              </p>
            </li>
          )
        })}
      </ul>

      <h3 className="mt-4 text-[10px] font-bold tracking-wider text-muted uppercase">
        Units consumed per day, this week ({total} total)
      </h3>
      <ol className="mt-2 flex h-28 items-end gap-2">
        {WEEKLY_CONSUMPTION.map(({ day, units }) => (
          <li key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold text-ink tabular-nums">
              {units === peak ? units : ''}
            </span>
            <span
              className="w-full max-w-6 rounded-t bg-brand"
              style={{ height: `${(units / peak) * 70}%` }}
              title={`${day}: ${units} units`}
            />
            <span className="text-[10px] text-muted">{day}</span>
            <span className="sr-only">{units} units</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

// ---------- Purchase orders & transfers ----------

const PO_TONES = {
  Draft: 'neutral',
  Approved: 'brand',
  Ordered: 'brand',
  'Partially Received': 'warning',
  Received: 'success',
  Cancelled: 'neutral',
} as const

export function PurchaseOrdersPanel({
  orders,
  items,
  canManage,
  showCosts,
  onCreate,
  onReceive,
  onAdvance,
}: {
  orders: PurchaseOrder[]
  items: InventoryItem[]
  canManage: boolean
  showCosts: boolean
  onCreate: () => void
  onReceive: (id: string) => void
  onAdvance: (id: string) => void
}) {
  const name = (itemId: string) => items.find(({ id }) => id === itemId)?.name ?? itemId
  return (
    <Panel
      title="Purchase Orders"
      icon={ClipboardList}
      action={
        canManage && (
          <button type="button" onClick={onCreate} className={`${smallButton} font-bold`}>
            + Purchase Order
          </button>
        )
      }
    >
      {orders.length === 0 ? (
        <PanelEmpty>No purchase orders found.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr>
                <th scope="col" className={thClass}>PO</th>
                <th scope="col" className={thClass}>Supplier & items</th>
                {showCosts && <th scope="col" className={`${thClass} text-right`}>Total</th>}
                <th scope="col" className={thClass}>Expected</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 font-mono text-[11px] font-bold text-ink">
                    {order.id}
                    <span className="block font-sans font-normal text-muted">
                      {order.createdBy}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="block font-semibold text-ink">{order.supplier}</span>
                    <span className="block text-[11px] text-muted">
                      {order.lines.map(({ itemId, qty }) => `${qty} × ${name(itemId)}`).join(', ')}
                    </span>
                  </td>
                  {showCosts && (
                    <td className="py-2.5 pr-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">
                      {formatXaf(getPoTotal(order))}
                    </td>
                  )}
                  <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(order.expectedAt)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={PO_TONES[order.status]}>{order.status}</Badge>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {canManage && order.status === 'Draft' && (
                      <button type="button" onClick={() => onAdvance(order.id)} className={smallButton}>
                        Approve
                      </button>
                    )}
                    {canManage && order.status === 'Approved' && (
                      <button type="button" onClick={() => onAdvance(order.id)} className={smallButton}>
                        Mark Ordered
                      </button>
                    )}
                    {canManage && ['Ordered', 'Partially Received'].includes(order.status) && (
                      <button
                        type="button"
                        onClick={() => onReceive(order.id)}
                        className={`${smallButton} font-bold`}
                      >
                        Receive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

const TRANSFER_TONES = {
  Requested: 'neutral',
  'In Transit': 'brand',
  Received: 'success',
  Cancelled: 'neutral',
} as const

export function TransfersPanel({
  transfers,
  items,
  canManage,
  onReceive,
}: {
  transfers: StockTransfer[]
  items: InventoryItem[]
  canManage: boolean
  onReceive: (id: string) => void
}) {
  return (
    <Panel title="Stock Transfers" icon={ArrowLeftRight}>
      {transfers.length === 0 ? (
        <PanelEmpty>No transfers between branches.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {transfers.map((transfer) => {
            const item = items.find(({ id }) => id === transfer.itemId)
            return (
              <li key={transfer.id} className="rounded-lg bg-field p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    <span className="font-mono text-[11px]">{transfer.id}</span> ·{' '}
                    {formatQty(transfer.qty, item?.unit ?? '')} {item?.name ?? transfer.itemId}
                  </p>
                  <Badge tone={TRANSFER_TONES[transfer.status]}>{transfer.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {transfer.from} → {transfer.to} · requested by {transfer.requestedBy} ·{' '}
                  {formatClock(transfer.at)}
                </p>
                {canManage && transfer.status === 'In Transit' && (
                  <button
                    type="button"
                    onClick={() => onReceive(transfer.id)}
                    className={`${smallButton} mt-2 font-bold`}
                  >
                    Mark Received
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Expiring, suppliers, movements, efficiency ----------

export function ExpiringPanel({
  items,
  now,
  onOpen,
}: Shared & { onOpen: (itemId: string) => void }) {
  const expiring = items
    .map((item) => ({ item, days: getDaysToExpiry(item, now) }))
    .filter(
      (row): row is { item: InventoryItem; days: number } =>
        row.days !== null && row.days <= 90 && row.item.stock > 0,
    )
    .sort((a, b) => a.days - b.days)

  return (
    <Panel
      title="Expiring Soon"
      subtitle="Batches expiring within 90 days; use the earliest first (FEFO)"
      icon={CalendarClock}
    >
      {expiring.length === 0 ? (
        <PanelEmpty>Nothing expires in the next 90 days.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {expiring.map(({ item, days }, index) => (
            <li key={item.id} className="rounded-lg bg-field p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="rounded-sm font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {item.name}
                </button>
                <Badge tone={days <= 30 ? 'warning' : 'neutral'}>
                  {days <= 0 ? 'Expired' : `${days} days left`}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Batch {item.batch} · {formatQty(item.stock, item.unit)} in {item.location} ·
                expires {formatDate(item.expiresAt!)}
                {index === 0 && ' · use first'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function SuppliersPanel({ items }: { items: InventoryItem[] }) {
  return (
    <Panel title="Suppliers" subtitle="Delivery performance (sample figures)" icon={Truck}>
      <ul className="space-y-2">
        {SUPPLIERS.map((supplier) => (
          <li key={supplier.name} className="rounded-lg bg-field p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">{supplier.name}</p>
              <span className="text-[11px] text-muted">
                {items.filter((item) => item.supplier === supplier.name).length} items supplied
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {supplier.contact} · {supplier.leadDays}-day delivery · {supplier.onTime}% on
              time · {supplier.fulfilment}% fulfilment
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function MovementsPanel({
  movements,
  items,
}: {
  movements: Movement[]
  items: InventoryItem[]
}) {
  return (
    <Panel
      title="Stock Movements"
      subtitle="Every change to stock, newest first: who, how much, before and after"
    >
      <div className="relative max-h-80 overflow-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Time</th>
              <th scope="col" className={thClass}>Item</th>
              <th scope="col" className={thClass}>Movement</th>
              <th scope="col" className={`${thClass} text-right`}>Quantity</th>
              <th scope="col" className={`${thClass} text-right`}>Before → after</th>
              <th scope="col" className={thClass}>User</th>
              <th scope="col" className={thClass}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement, index) => {
              const item = items.find(({ id }) => id === movement.itemId)
              const unit = item?.unit ?? ''
              return (
                <tr key={movement.at + index} className="border-t border-line tabular-nums">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">
                    {formatDate(movement.at).replace(/, \d{4}$/, '')} · {formatClock(movement.at)}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-ink">{item?.name ?? movement.itemId}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{movement.type}</td>
                  <td
                    className={`py-2 pr-3 text-right font-bold whitespace-nowrap ${
                      movement.qty < 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {movement.qty > 0 ? '+' : '−'}
                    {formatQty(Math.abs(movement.qty), unit)}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatQty(movement.before, unit)} → {formatQty(movement.after, unit)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{movement.user}</td>
                  <td className="py-2 font-mono text-[11px] whitespace-nowrap">
                    {movement.reference}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function EfficiencyPanel({
  items,
  now,
  movements,
  showCosts,
  onOpen,
}: Shared & {
  movements: Movement[]
  showCosts: boolean
  onOpen: (itemId: string) => void
}) {
  const withBurn = items.filter((item) => getDaysLeft(item) !== null && item.stock > 0)
  const averageDays =
    withBurn.length === 0
      ? 0
      : withBurn.reduce((sum, item) => sum + Math.min(getDaysLeft(item)!, 365), 0) /
        withBurn.length
  const dead = items.filter((item) => isDeadStock(item, now))
  const waste = movements.filter(({ type }) => ['Damage', 'Expiry', 'Loss'].includes(type))
  const wasteValue = waste.reduce((sum, movement) => {
    const item = items.find(({ id }) => id === movement.itemId)
    return sum + Math.abs(movement.qty) * (item?.unitCost ?? 0)
  }, 0)
  const facts: [string, ReactNode][] = [
    ['Average days of stock', `${averageDays.toFixed(0)} days`],
    ['Overstocked items', items.filter((item) => getStockStatus(item, now) === 'overstocked').length],
    ['Waste & loss entries', waste.length],
    ...(showCosts ? ([['Waste value', formatXaf(wasteValue)]] as [string, ReactNode][]) : []),
  ]

  return (
    <Panel title="Inventory Efficiency" subtitle="Computed from current stock and movements">
      <dl className="grid grid-cols-2 gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-md bg-field px-3 py-2">
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-4 text-[10px] font-bold tracking-wider text-muted uppercase">
        Slow / dead stock
      </h3>
      {dead.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted">Every stocked item has moved recently.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {dead.map((item) => (
            <li key={item.id} className="rounded-lg bg-field p-3 text-xs">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="rounded-sm font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {item.name}
              </button>
              <p className="mt-0.5 text-[11px] text-muted">
                Last movement {getIdleDays(item, now)} days ago · {formatQty(item.stock, item.unit)}
                {showCosts && ` · ${formatXaf(getValue(item))}`} · review purchasing level
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
