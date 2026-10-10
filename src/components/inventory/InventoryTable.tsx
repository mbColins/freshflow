import type { RefObject } from 'react'
import {
  Ellipsis,
  Eye,
  Flame,
  PackagePlus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { STOCK_STATUSES, SUPPLIERS } from '../../constants/inventory'
import type { InventoryPermissions } from '../../constants/inventory'
import type {
  InventoryFilters,
  InventoryItem,
  StockStatus,
} from '../../types/inventory'
import {
  formatQty,
  getAvailable,
  getDaysLeft,
  getValue,
} from '../../utils/inventory'
import { formatXaf } from '../../utils/orders'
import { fieldClass, iconButton, secondaryButton } from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import { StockGauge, StockStatusBadge } from './InventoryBits'

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'

export type StockAction = 'add' | 'consume' | 'adjust'

type InventoryTableProps = {
  searchRef: RefObject<HTMLInputElement | null>
  items: InventoryItem[]
  totalCount: number
  now: number
  filters: InventoryFilters
  filtersActive: boolean
  onChange: (patch: Partial<InventoryFilters>) => void
  onReset: () => void
  permissions: InventoryPermissions
  onOpen: (id: string) => void
  onStock: (action: StockAction, id: string) => void
}

function BurnRate({ item }: { item: InventoryItem }) {
  const left = getDaysLeft(item)
  if (left === null) return <span className="text-[11px] text-muted">No regular use</span>
  return (
    <>
      <span className="block whitespace-nowrap text-ink tabular-nums">
        {formatQty(item.dailyUse, item.unit)} / day
      </span>
      <span
        className={`block text-[11px] whitespace-nowrap ${
          item.stock <= 0 || left < 2 ? 'font-bold text-danger' : 'text-muted'
        }`}
      >
        {item.stock <= 0 ? 'Stockout' : `${left.toFixed(1)} days left`}
      </span>
    </>
  )
}

function InventoryTable({
  searchRef,
  items,
  totalCount,
  now,
  filters,
  filtersActive,
  onChange,
  onReset,
  permissions,
  onOpen,
  onStock,
}: InventoryTableProps) {
  const select = `${fieldClass} w-auto!`
  const canAct = permissions.manage || permissions.consume

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <h2 className="text-sm font-bold text-ink">
          Inventory Items{' '}
          <span className="font-normal text-muted">
            ({items.length} of {totalCount})
          </span>
        </h2>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search inventory"
            placeholder="Search item, SKU, category, supplier, batch or location…"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className={`${fieldClass} h-10 pr-10 pl-9`}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
            /
          </kbd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Stock status"
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as StockStatus | '' })}
            className={select}
          >
            <option value="">All statuses</option>
            {STOCK_STATUSES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Supplier"
            value={filters.supplier}
            onChange={(event) => onChange({ supplier: event.target.value })}
            className={select}
          >
            <option value="">All suppliers</option>
            {SUPPLIERS.map(({ name }) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={filters.view === 'reorder'}
            onClick={() => onChange({ view: filters.view === 'reorder' ? '' : 'reorder' })}
            className={`${secondaryButton} ${filters.view === 'reorder' ? 'bg-brand/5 text-brand ring-brand/40' : ''}`}
          >
            <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
            Needs reorder
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
          <p className="text-sm font-bold text-ink">No inventory items match</p>
          <p className="mt-1 text-xs text-muted">Try clearing the filters above.</p>
          <button type="button" onClick={onReset} className={`${secondaryButton} mt-3`}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className={headClass}>Item & SKU</th>
                  <th scope="col" className={headClass}>Category</th>
                  <th scope="col" className={headClass}>Current stock</th>
                  <th scope="col" className={headClass}>Available / reserved</th>
                  <th scope="col" className={headClass}>Burn rate</th>
                  {permissions.costs && (
                    <th scope="col" className={`${headClass} text-right`}>Unit cost / value</th>
                  )}
                  <th scope="col" className={headClass}>Supplier</th>
                  <th scope="col" className={headClass}>Status</th>
                  <th scope="col" className={`${headClass} right-0 z-20`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-line transition hover:bg-field/60 ${
                      item.stock <= 0 ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''
                    }`}
                  >
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => onOpen(item.id)}
                        className="max-w-56 rounded-sm text-left font-semibold text-ink hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        {item.name}
                      </button>
                      <span className="block font-mono text-[10px] text-muted">
                        {item.id} · {item.location}
                      </span>
                    </td>
                    <td className={`${cellClass} whitespace-nowrap text-ink`}>{item.category}</td>
                    <td className={cellClass}>
                      <StockGauge item={item} now={now} />
                    </td>
                    <td className={`${cellClass} whitespace-nowrap tabular-nums`}>
                      <span className="block font-semibold text-ink">
                        {formatQty(getAvailable(item), item.unit)} free
                      </span>
                      <span className="block text-[11px] text-muted">
                        {item.reserved > 0
                          ? `${formatQty(item.reserved, item.unit)} reserved`
                          : 'None reserved'}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <BurnRate item={item} />
                    </td>
                    {permissions.costs && (
                      <td className={`${cellClass} text-right whitespace-nowrap tabular-nums`}>
                        <span className="block font-semibold text-ink">
                          {formatXaf(getValue(item))}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {formatXaf(item.unitCost)} / {item.unit}
                        </span>
                      </td>
                    )}
                    <td className={`${cellClass} max-w-36 text-ink`}>{item.supplier}</td>
                    <td className={cellClass}>
                      <StockStatusBadge item={item} now={now} />
                    </td>
                    <td className={`${cellClass} sticky right-0 bg-white`}>
                      <Menu
                        label={`Actions for ${item.name}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => {
                          const act = (action: StockAction) => () => {
                            close()
                            onStock(action, item.id)
                          }
                          return (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onOpen(item.id)
                                }}
                              >
                                <Eye className="size-4 text-muted" aria-hidden="true" />
                                View Item
                              </MenuItem>
                              {permissions.manage && (
                                <MenuItem onSelect={act('add')}>
                                  <PackagePlus className="size-4 text-muted" aria-hidden="true" />
                                  Add Stock
                                </MenuItem>
                              )}
                              {canAct && (
                                <MenuItem onSelect={act('consume')} disabled={item.stock <= 0}>
                                  <Flame className="size-4 text-muted" aria-hidden="true" />
                                  Record Consumption
                                </MenuItem>
                              )}
                              {permissions.manage && (
                                <MenuItem onSelect={act('adjust')}>
                                  <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
                                  Count / Adjust
                                </MenuItem>
                              )}
                            </>
                          )
                        }}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per item */}
          <ul className="space-y-2 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-line">
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="flex w-full items-start justify-between gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink">{item.name}</span>
                    <span className="block font-mono text-[10px] text-muted">{item.id}</span>
                  </span>
                  <StockStatusBadge item={item} now={now} />
                </button>
                <div className="mt-2">
                  <StockGauge item={item} now={now} />
                </div>
                {canAct && (
                  <div className="mt-2 flex gap-1.5">
                    {permissions.manage && (
                      <button
                        type="button"
                        onClick={() => onStock('add', item.id)}
                        className={`${secondaryButton} h-8 flex-1`}
                      >
                        Add Stock
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={item.stock <= 0}
                      onClick={() => onStock('consume', item.id)}
                      className={`${secondaryButton} h-8 flex-1`}
                    >
                      Consume
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default InventoryTable
