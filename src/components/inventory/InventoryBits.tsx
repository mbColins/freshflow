import type { InventoryItem } from '../../types/inventory'
import {
  formatQty,
  getStatusInfo,
  getStockStatus,
} from '../../utils/inventory'
import Badge from '../ui/Badge'

export function StockStatusBadge({ item, now }: { item: InventoryItem; now: number }) {
  const { label, tone } = getStatusInfo(getStockStatus(item, now))
  return <Badge tone={tone}>{label}</Badge>
}

const FILL_CLASSES = {
  healthy: 'bg-success',
  overstocked: 'bg-brand',
  expiring: 'bg-success',
  low: 'bg-warning',
  critical: 'bg-danger',
  out: 'bg-danger',
  expired: 'bg-danger',
}

// Bar from zero to the maximum level, with a tick at the reorder level
export function StockGauge({
  item,
  now,
  detailed = false,
}: {
  item: InventoryItem
  now: number
  detailed?: boolean
}) {
  const status = getStockStatus(item, now)
  const scale = Math.max(item.max, item.stock) || 1
  const percent = (value: number) => `${Math.min(100, (value / scale) * 100)}%`

  return (
    <div className="min-w-36">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-bold text-ink tabular-nums">
          {formatQty(item.stock, item.unit)}
        </span>
        <span className="text-muted tabular-nums">/ {formatQty(item.max, item.unit)} max</span>
      </div>
      <div
        className="relative mt-1 h-2 rounded-full bg-field"
        role="meter"
        aria-label={`${item.name} stock level`}
        aria-valuenow={item.stock}
        aria-valuemin={0}
        aria-valuemax={scale}
      >
        <div
          className={`h-full rounded-full ${FILL_CLASSES[status]}`}
          style={{ width: percent(item.stock) }}
        />
        <span
          className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-ink"
          style={{ left: percent(item.reorder) }}
          title={`Reorder level: ${formatQty(item.reorder, item.unit)}`}
        />
        {detailed && (
          <span
            className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-danger"
            style={{ left: percent(item.safety) }}
            title={`Safety stock: ${formatQty(item.safety, item.unit)}`}
          />
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted">
        Reorder at {formatQty(item.reorder, item.unit)}
        {detailed && ` · safety ${formatQty(item.safety, item.unit)}`}
      </p>
    </div>
  )
}
