import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  ClipboardList,
  Clock,
  Inbox,
  PackageCheck,
  ShoppingBag,
  Wallet,
  WashingMachine,
} from 'lucide-react'
import { EMPTY_FILTERS } from '../../constants/orders'
import type { Order, OrderFilters } from '../../types/order'
import { matchesFilters } from '../../utils/orders'

type CardFilter = Pick<OrderFilters, 'status' | 'group'>

const CARDS: {
  label: string
  icon: LucideIcon
  filter: CardFilter
  tone?: 'danger' | 'warning'
  financial?: boolean
}[] = [
  { label: 'All Orders', icon: ClipboardList, filter: { status: '', group: '' } },
  { label: 'New', icon: Inbox, filter: { status: 'received', group: '' } },
  {
    label: 'In Processing',
    icon: WashingMachine,
    filter: { status: '', group: 'processing' },
  },
  { label: 'Ready', icon: PackageCheck, filter: { status: 'ready', group: '' } },
  {
    label: 'Awaiting Pickup',
    icon: ShoppingBag,
    filter: { status: '', group: 'awaitingPickup' },
  },
  {
    label: 'Overdue',
    icon: Clock,
    filter: { status: '', group: 'overdue' },
    tone: 'danger',
  },
  {
    label: 'Completed',
    icon: CircleCheck,
    filter: { status: 'completed', group: '' },
  },
  {
    label: 'Unpaid',
    icon: Wallet,
    filter: { status: '', group: 'unpaid' },
    tone: 'warning',
    financial: true,
  },
]

const TONE_CLASSES = {
  danger: 'text-danger',
  warning: 'text-warning',
}

type OrderSummaryCardsProps = {
  orders: Order[]
  now: number
  filters: OrderFilters
  onSelect: (filter: CardFilter) => void
  showFinancials: boolean
}

function OrderSummaryCards({
  orders,
  now,
  filters,
  onSelect,
  showFinancials,
}: OrderSummaryCardsProps) {
  const cards = CARDS.filter(({ financial }) => showFinancials || !financial)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, icon: Icon, filter, tone }) => {
        const count = orders.filter((order) =>
          matchesFilters(order, { ...EMPTY_FILTERS, ...filter }, now),
        ).length
        const active =
          filters.status === filter.status && filters.group === filter.group
        const flagged = tone && count > 0
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(filter)}
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon
                className={`size-3.5 shrink-0 ${flagged ? TONE_CLASSES[tone] : ''}`}
                aria-hidden="true"
              />
            </span>
            <span
              className={`mt-1 block text-xl font-bold ${flagged ? TONE_CLASSES[tone] : 'text-ink'}`}
            >
              {count}
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-field">
              <span
                className={`block h-full rounded-full ${flagged ? 'bg-current ' + TONE_CLASSES[tone] : 'bg-brand'}`}
                style={{
                  width: `${orders.length === 0 ? 0 : (count / orders.length) * 100}%`,
                }}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default OrderSummaryCards
