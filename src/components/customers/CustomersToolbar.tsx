import { useState } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router'
import { Columns3, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TAGS,
  LOYALTY_TIERS,
  SEGMENTS,
} from '../../constants/customers'
import { BRANCHES, SERVICES } from '../../constants/orders'
import type {
  CrmCustomer,
  CustomSegment,
  CustomerFilters,
} from '../../types/customer'
import { countCustomerFilters, formatLastOrder } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import {
  fieldClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Menu from '../ui/Menu'
import Modal from '../ui/Modal'
import { Avatar } from './CustomerBits'

type SelectKey = Exclude<
  keyof CustomerFilters,
  'query' | 'segment' | 'minOrders' | 'minSpent'
>

const SELECTS: Record<
  SelectKey,
  { label: string; all: string; options: { value: string; label: string }[] }
> = {
  status: {
    label: 'Customer status',
    all: 'All statuses',
    options: CUSTOMER_STATUSES.map(({ id, label }) => ({ value: id, label })),
  },
  kind: {
    label: 'Customer type',
    all: 'All types',
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'corporate', label: 'Corporate' },
    ],
  },
  branch: {
    label: 'Branch',
    all: 'All branches',
    options: BRANCHES.map((branch) => ({ value: branch, label: branch })),
  },
  tier: {
    label: 'Loyalty tier',
    all: 'All tiers',
    options: LOYALTY_TIERS.map(({ id, label }) => ({ value: id, label })),
  },
  lastOrder: {
    label: 'Last order',
    all: 'Any last order',
    options: [
      { value: '30', label: 'Last 30 days' },
      { value: '90', label: 'Last 90 days' },
      { value: 'older', label: 'More than 90 days ago' },
    ],
  },
  registered: {
    label: 'Registration date',
    all: 'Registered any time',
    options: [
      { value: '30', label: 'Last 30 days' },
      { value: '365', label: 'Last 12 months' },
      { value: 'older', label: 'More than a year ago' },
    ],
  },
  balance: {
    label: 'Outstanding balance',
    all: 'Any balance',
    options: [
      { value: 'yes', label: 'Has balance due' },
      { value: 'no', label: 'Nothing due' },
    ],
  },
  service: {
    label: 'Preferred service',
    all: 'Any preferred service',
    options: SERVICES.map((service) => ({ value: service, label: service })),
  },
  method: {
    label: 'Pickup / delivery preference',
    all: 'Pickup & delivery',
    options: [
      { value: 'pickup', label: 'Customer pickup' },
      { value: 'delivery', label: 'Delivery' },
    ],
  },
  tag: {
    label: 'Tag',
    all: 'Any tag',
    options: CUSTOMER_TAGS.map((tag) => ({ value: tag, label: tag })),
  },
}

type FilterProps = {
  filters: CustomerFilters
  onChange: (patch: Partial<CustomerFilters>) => void
}

function FilterSelect({
  name,
  filters,
  onChange,
  className = '',
}: FilterProps & { name: SelectKey; className?: string }) {
  const { label, all, options } = SELECTS[name]
  return (
    <select
      aria-label={label}
      value={filters[name]}
      onChange={(event) => onChange({ [name]: event.target.value })}
      className={`${fieldClass} ${className}`}
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

type MoreFiltersProps = FilterProps & {
  open: boolean
  onClose: () => void
  onReset: () => void
  showFinancials: boolean
  resultCount: number
}

export function CustomerFiltersDialog({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  showFinancials,
  resultCount,
}: MoreFiltersProps) {
  const select = (name: SelectKey) => (
    <FilterSelect name={name} filters={filters} onChange={onChange} />
  )
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Filters combine: a customer must match all of them."
      footer={
        <>
          <button type="button" onClick={onReset} className={secondaryButton}>
            Reset Filters
          </button>
          <button type="button" onClick={onClose} className={primaryButton}>
            Show {resultCount} {resultCount === 1 ? 'customer' : 'customers'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className={sectionTitle}>Profile</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('status')}
            {select('kind')}
            {select('branch')}
            {select('tier')}
            {select('tag')}
            {select('registered')}
          </div>
        </section>
        <section>
          <h3 className={sectionTitle}>Ordering</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('lastOrder')}
            {select('service')}
            {select('method')}
            <input
              type="number"
              min="0"
              inputMode="numeric"
              aria-label="Minimum number of orders"
              placeholder="Min orders"
              value={filters.minOrders}
              onChange={(event) => onChange({ minOrders: event.target.value })}
              className={fieldClass}
            />
          </div>
        </section>
        {showFinancials && (
          <section>
            <h3 className={sectionTitle}>Financial</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {select('balance')}
              <input
                type="number"
                min="0"
                inputMode="numeric"
                aria-label="Minimum total spending in XAF"
                placeholder="Min spent (XAF)"
                value={filters.minSpent}
                onChange={(event) => onChange({ minSpent: event.target.value })}
                className={fieldClass}
              />
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

const chipClass =
  'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

type CustomersToolbarProps = FilterProps & {
  searchRef: RefObject<HTMLInputElement | null>
  // Matches for the search box's quick results
  results: CrmCustomer[]
  now: number
  onReset: () => void
  onOpenMoreFilters: () => void
  customSegments: CustomSegment[]
  onApplySegment: (filters: CustomerFilters) => void
  onSaveSegment: (name: string) => void
  onDeleteSegment: (name: string) => void
  columns: { key: string; label: string }[]
  hiddenColumns: string[]
  onToggleColumn: (key: string) => void
  showFinancials: boolean
  canCreateOrder: boolean
}

function CustomersToolbar({
  searchRef,
  results,
  now,
  filters,
  onChange,
  onReset,
  onOpenMoreFilters,
  customSegments,
  onApplySegment,
  onSaveSegment,
  onDeleteSegment,
  columns,
  hiddenColumns,
  onToggleColumn,
  showFinancials,
  canCreateOrder,
}: CustomersToolbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [segmentName, setSegmentName] = useState('')
  const activeCount = countCustomerFilters(filters)
  const showResults = searchFocused && filters.query.trim() !== ''

  return (
    <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
      <div
        className="relative"
        onFocus={() => setSearchFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setSearchFocused(false)
          }
        }}
      >
        <Search
          className="pointer-events-none absolute top-5 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search customers"
          placeholder="Search customers by name, phone number, email, customer ID or order ID…"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur()
          }}
          className={`${fieldClass} h-10 pr-10 pl-9`}
        />
        <kbd className="pointer-events-none absolute top-5 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
          /
        </kbd>

        {showResults && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg bg-white p-1 shadow-lg ring-1 ring-line">
            {results.slice(0, 5).map((customer) => (
              <li
                key={customer.id}
                className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2 hover:bg-field"
              >
                <Avatar customer={customer} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">
                    {customer.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {customer.phone} · {customer.orders} orders
                    {showFinancials && ` · ${formatXaf(customer.spent)} spent`} ·
                    Last order: {formatLastOrder(customer.lastOrderAt, now)}
                  </p>
                </div>
                <Link
                  to={`/customers/${customer.id}`}
                  className={`${secondaryButton} h-7 px-2.5`}
                >
                  View
                </Link>
                {canCreateOrder && (
                  <Link
                    to={`/orders?new=1&customer=${customer.id}`}
                    className={`${primaryButton} h-7 px-2.5`}
                  >
                    New Order
                  </Link>
                )}
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-muted">
                No customers match “{filters.query}”.
              </li>
            )}
            {results.length > 5 && (
              <li className="px-3 py-1.5 text-[11px] text-muted">
                {results.length - 5} more in the list below
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <FilterSelect name="status" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="kind" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="branch" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="tier" filters={filters} onChange={onChange} className="w-auto!" />
          <FilterSelect name="lastOrder" filters={filters} onChange={onChange} className="w-auto!" />
        </div>
        <button type="button" onClick={onOpenMoreFilters} className={secondaryButton}>
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
        <div className="ml-auto max-md:hidden">
          <Menu
            label="Choose columns"
            trigger={<Columns3 className="size-4" aria-hidden="true" />}
            triggerClassName={`${secondaryButton} w-9 px-0`}
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
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className={`${sectionTitle} shrink-0`}>Segments</span>
        {SEGMENTS.filter(({ financial }) => showFinancials || !financial).map(
          ({ id, label }) => {
            const active = filters.segment === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ segment: active ? '' : id })}
                className={`${chipClass} ${active ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-brand/10'}`}
              >
                {label}
              </button>
            )
          },
        )}
        {customSegments.map((segment) => (
          <span key={segment.name} className={`${chipClass} bg-field pr-1 text-ink`}>
            <button
              type="button"
              onClick={() => onApplySegment(segment.filters)}
              className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {segment.name}
            </button>
            <button
              type="button"
              onClick={() => onDeleteSegment(segment.name)}
              aria-label={`Delete segment ${segment.name}`}
              className="flex size-5 items-center justify-center rounded-full text-muted hover:bg-white hover:text-danger"
            >
              <Trash2 className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <Menu
          align="left"
          trigger={
            <>
              <Plus className="size-3" aria-hidden="true" />
              Save segment
            </>
          }
          triggerClassName={`${chipClass} text-brand ring-1 ring-brand/30 hover:bg-brand/5 disabled:opacity-50`}
          disabled={activeCount === 0}
        >
          {(close) => (
            <form
              className="flex w-64 gap-1 p-1"
              onSubmit={(event) => {
                event.preventDefault()
                if (!segmentName.trim()) return
                onSaveSegment(segmentName.trim())
                setSegmentName('')
                close()
              }}
            >
              <input
                autoFocus
                aria-label="Segment name"
                placeholder="Name these filters…"
                value={segmentName}
                onChange={(event) => setSegmentName(event.target.value)}
                className={`${fieldClass} h-8`}
              />
              <button
                type="submit"
                disabled={!segmentName.trim()}
                className={`${primaryButton} h-8`}
              >
                Save
              </button>
            </form>
          )}
        </Menu>
      </div>
    </div>
  )
}

export default CustomersToolbar
