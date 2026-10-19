import { useState } from 'react'
import type { ReactNode } from 'react'
import { Flame, PackagePlus, SlidersHorizontal } from 'lucide-react'
import type { InventoryPermissions } from '../../constants/inventory'
import type { InventoryItem, Movement } from '../../types/inventory'
import { formatDate } from '../../utils/customers'
import {
  formatQty,
  getAvailable,
  getDaysLeft,
  getDaysToExpiry,
  getRecommendedOrder,
  getValue,
  needsReorder,
} from '../../utils/inventory'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Modal from '../ui/Modal'
import SegmentedControl from '../ui/SegmentedControl'
import { StockGauge, StockStatusBadge } from './InventoryBits'
import type { StockAction } from './InventoryTable'
import { DetailBox } from '../ui/Details'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'forecast', label: 'Forecast' },
  { value: 'batch', label: 'Batch & supplier' },
  { value: 'history', label: 'History' },
] as const

type Tab = (typeof TABS)[number]['value']

type ItemDrawerProps = {
  item: InventoryItem | null
  movements: Movement[]
  now: number
  permissions: InventoryPermissions
  onClose: () => void
  onStock: (action: StockAction, id: string) => void
}

function ItemDrawer({ item, movements, now, permissions, onClose, onStock }: ItemDrawerProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const history = movements.filter(({ itemId }) => itemId === item?.id)
  const left = item ? getDaysLeft(item) : null
  const expiry = item ? getDaysToExpiry(item, now) : null

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      variant="drawer"
      title={item?.name ?? ''}
      subtitle={
        item && (
          <span className="flex flex-wrap items-center gap-2">
            <StockStatusBadge item={item} now={now} />
            <span className="font-mono">{item.id}</span>
            <span>{item.category}</span>
          </span>
        )
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      {item && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {permissions.manage && (
              <button type="button" onClick={() => onStock('add', item.id)} className={primaryButton}>
                <PackagePlus className="size-4" aria-hidden="true" />
                Add Stock
              </button>
            )}
            {(permissions.manage || permissions.consume) && (
              <button
                type="button"
                disabled={item.stock <= 0}
                onClick={() => onStock('consume', item.id)}
                className={secondaryButton}
              >
                <Flame className="size-4 text-muted" aria-hidden="true" />
                Record Consumption
              </button>
            )}
            {permissions.manage && (
              <button type="button" onClick={() => onStock('adjust', item.id)} className={secondaryButton}>
                <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
                Count / Adjust
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Current stock', formatQty(item.stock, item.unit)],
                ['Available', formatQty(getAvailable(item), item.unit)],
                ['Reserved', formatQty(item.reserved, item.unit)],
                permissions.costs
                  ? ['Inventory value', formatXaf(getValue(item))]
                  : ['Reorder level', formatQty(item.reorder, item.unit)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-field px-3 py-2">
                <dt className="text-[10px] font-semibold text-muted">{label}</dt>
                <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <SegmentedControl label="Item sections" options={TABS} value={tab} onChange={setTab} />

          {tab === 'overview' && (
            <div className="space-y-4">
              <section>
                <h3 className={sectionTitle}>Stock level</h3>
                <div className="mt-2 rounded-lg bg-white p-3 ring-1 ring-line">
                  <StockGauge item={item} now={now} detailed />
                  <p className="mt-2 text-[10px] text-muted">
                    Black tick = reorder level, red tick = safety stock. The bar ends at the
                    maximum level.
                  </p>
                </div>
              </section>
              <section>
                <h3 className={sectionTitle}>Details</h3>
                <div className="mt-2">
                  <DetailBox
                    rows={[
                      ['Description', item.description || 'No description'],
                      ['Unit of measurement', item.unit],
                      ['Storage location', item.location],
                      ['Maximum stock', formatQty(item.max, item.unit)],
                      ...(permissions.costs
                        ? ([['Unit cost', formatXaf(item.unitCost)]] as [string, ReactNode][])
                        : []),
                      ['Last movement', formatDate(item.lastMovementAt)],
                    ]}
                  />
                </div>
              </section>
              {item.services.length > 0 && (
                <section>
                  <h3 className={sectionTitle}>Services that need this item</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {item.services.map((service) => (
                      <li
                        key={service}
                        className="rounded-full bg-field px-3 py-1 text-[11px] font-semibold text-ink"
                      >
                        {service}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === 'forecast' && (
            <div className="space-y-3">
              <DetailBox
                rows={[
                  ['Average daily consumption', item.dailyUse > 0 ? `${formatQty(item.dailyUse, item.unit)} / day` : 'No regular use'],
                  [
                    'Estimated remaining',
                    left === null ? '—' : item.stock <= 0 ? 'Out of stock' : `${left.toFixed(1)} days`,
                  ],
                  [
                    'Projected depletion',
                    left === null || item.stock <= 0
                      ? '—'
                      : formatDate(new Date(now + left * 86_400_000).toISOString()),
                  ],
                  ['Recommended order', formatQty(getRecommendedOrder(item), item.unit)],
                ]}
              />
              <p className="rounded-lg bg-field p-3 text-xs text-ink">
                {item.stock <= 0
                  ? 'Out of stock: order now or transfer from another branch.'
                  : needsReorder(item)
                    ? 'Below the reorder level: order now.'
                    : left !== null && item.dailyUse > 0
                      ? `Reorder in about ${Math.max(0, (item.stock - item.reorder) / item.dailyUse).toFixed(0)} days, when stock reaches ${formatQty(item.reorder, item.unit)}.`
                      : 'No reorder needed at the current rate.'}
              </p>
              <p className="text-[10px] text-muted">
                Forecast assumes the average daily consumption stays the same.
              </p>
            </div>
          )}

          {tab === 'batch' && (
            <DetailBox
              rows={[
                ['Batch / lot', item.batch],
                ['Expiration', item.expiresAt ? formatDate(item.expiresAt) : 'Not tracked'],
                ['Days remaining', expiry === null ? '—' : expiry <= 0 ? 'Expired' : `${expiry} days`],
                ['Allocation rule', item.expiresAt ? 'FEFO (first expire, first out)' : 'FIFO (first in, first out)'],
                ['Supplier', item.supplier],
                ['Quantity in batch', formatQty(item.stock, item.unit)],
              ]}
            />
          )}

          {tab === 'history' &&
            (history.length === 0 ? (
              <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
                No movements recorded for this item yet.
              </p>
            ) : (
              <ol className="space-y-3 border-l border-line pl-4">
                {history.map((movement, index) => (
                  <li key={movement.at + index} className="relative text-xs">
                    <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
                    <time className="block text-[10px] text-muted">
                      {formatDate(movement.at)} · {formatClock(movement.at)}
                    </time>
                    <p className="font-semibold text-ink">
                      {movement.type}: {movement.qty > 0 ? '+' : '−'}
                      {formatQty(Math.abs(movement.qty), item.unit)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatQty(movement.before, item.unit)} → {formatQty(movement.after, item.unit)} ·{' '}
                      {movement.user} · {movement.reference}
                    </p>
                  </li>
                ))}
              </ol>
            ))}
        </div>
      )}
    </Modal>
  )
}

export default ItemDrawer
