import { useState } from 'react'
import type { RefObject } from 'react'
import {
  Bookmark,
  Columns3,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { PRESET_VIEWS } from '../../constants/orders'
import type { OrderFilters, SavedView } from '../../types/order'
import { countActiveFilters } from '../../utils/orders'
import Menu, { MenuItem } from '../ui/Menu'
import SegmentedControl from '../ui/SegmentedControl'
import FilterSelect from './OrderFilterFields'
import { fieldClass, primaryButton, secondaryButton } from './styles'

export type OrdersView = 'table' | 'kanban'

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'kanban', label: 'Kanban' },
] as const

type OrdersToolbarProps = {
  searchRef: RefObject<HTMLInputElement | null>
  filters: OrderFilters
  onChange: (patch: Partial<OrderFilters>) => void
  onApplyView: (filters: OrderFilters) => void
  onReset: () => void
  onOpenMoreFilters: () => void
  view: OrdersView
  onViewChange: (view: OrdersView) => void
  savedViews: SavedView[]
  onSaveView: (name: string) => void
  onDeleteView: (name: string) => void
  columns: { key: string; label: string }[]
  hiddenColumns: string[]
  onToggleColumn: (key: string) => void
  showFinancials: boolean
}

function OrdersToolbar({
  searchRef,
  filters,
  onChange,
  onApplyView,
  onReset,
  onOpenMoreFilters,
  view,
  onViewChange,
  savedViews,
  onSaveView,
  onDeleteView,
  columns,
  hiddenColumns,
  onToggleColumn,
  showFinancials,
}: OrdersToolbarProps) {
  const [viewName, setViewName] = useState('')
  const activeCount = countActiveFilters(filters)

  return (
    <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search orders"
            placeholder="Search by order ID, invoice, customer name, phone number…"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className={`${fieldClass} h-10 pr-10 pl-9`}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
            /
          </kbd>
        </div>

        <SegmentedControl
          label="View"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onViewChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <FilterSelect name="status" filters={filters} onChange={onChange} className="w-auto!" />
          {showFinancials && (
            <FilterSelect name="payment" filters={filters} onChange={onChange} className="w-auto!" />
          )}
          <FilterSelect name="service" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="due" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="branch" filters={filters} onChange={onChange} className="w-auto!" />
        </div>

        <button
          type="button"
          onClick={onOpenMoreFilters}
          className={secondaryButton}
        >
          <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
          <span className="md:hidden">Filters</span>
          <span className="max-md:hidden">More Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Reset Filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Menu
            trigger={
              <>
                <Bookmark className="size-4 text-muted" aria-hidden="true" />
                Saved views
              </>
            }
            triggerClassName={secondaryButton}
          >
            {(close) => (
              <div className="w-64">
                {PRESET_VIEWS.map((preset) => (
                  <MenuItem
                    key={preset.name}
                    onSelect={() => {
                      onApplyView(preset.filters)
                      close()
                    }}
                  >
                    {preset.name}
                  </MenuItem>
                ))}
                {savedViews.map((saved) => (
                  <div key={saved.name} className="flex items-center">
                    <div className="min-w-0 flex-1">
                      <MenuItem
                        onSelect={() => {
                          onApplyView(saved.filters)
                          close()
                        }}
                      >
                        <span className="truncate">{saved.name}</span>
                      </MenuItem>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteView(saved.name)}
                      aria-label={`Delete saved view ${saved.name}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-field hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <form
                  className="mt-1 flex gap-1 border-t border-line p-1 pt-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!viewName.trim()) return
                    onSaveView(viewName.trim())
                    setViewName('')
                    close()
                  }}
                >
                  <input
                    aria-label="Name for the current filters"
                    placeholder="Save current filters as…"
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    className={`${fieldClass} h-8`}
                  />
                  <button
                    type="submit"
                    disabled={!viewName.trim() || activeCount === 0}
                    className={`${primaryButton} h-8`}
                  >
                    Save
                  </button>
                </form>
              </div>
            )}
          </Menu>

          {view === 'table' && (
            <Menu
              label="Choose columns"
              trigger={<Columns3 className="size-4" aria-hidden="true" />}
              triggerClassName={`${secondaryButton} w-9 px-0 max-md:hidden`}
            >
              {() => (
                <>
                  {columns.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.includes(key)}
                        onChange={() => onToggleColumn(key)}
                        className="size-4 accent-brand"
                      />
                      {label}
                    </label>
                  ))}
                </>
              )}
            </Menu>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrdersToolbar
