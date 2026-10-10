import type { LucideIcon } from 'lucide-react'
import {
  Crown,
  Repeat,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import type { CrmCustomer, SegmentId } from '../../types/customer'
import { inSegment } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'

const CARDS: {
  label: string
  note: string
  icon: LucideIcon
  segment: SegmentId | ''
}[] = [
  { label: 'Total Customers', note: 'All profiles', icon: Users, segment: '' },
  { label: 'New Customers', note: 'Recently registered', icon: UserPlus, segment: 'new' },
  { label: 'Active Customers', note: 'Ordering regularly', icon: UserCheck, segment: 'active' },
  { label: 'Returning Customers', note: '2 or more orders', icon: Repeat, segment: 'returning' },
  { label: 'Inactive Customers', note: 'No recent orders', icon: UserMinus, segment: 'inactive' },
  { label: 'VIP Customers', note: 'High-value accounts', icon: Crown, segment: 'vip' },
]

type CustomerKpiCardsProps = {
  customers: CrmCustomer[]
  selected: SegmentId | ''
  filtersActive: boolean
  onSelect: (segment: SegmentId | '') => void
  showFinancials: boolean
}

function CustomerKpiCards({
  customers,
  selected,
  filtersActive,
  onSelect,
  showFinancials,
}: CustomerKpiCardsProps) {
  const averageValue =
    customers.length === 0
      ? 0
      : customers.reduce((sum, { spent }) => sum + spent, 0) / customers.length

  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${showFinancials ? 'xl:grid-cols-7' : 'xl:grid-cols-6'}`}
    >
      {CARDS.map(({ label, note, icon: Icon, segment }) => {
        const count = segment
          ? customers.filter((customer) => inSegment(customer, segment)).length
          : customers.length
        const active = segment ? selected === segment : !filtersActive
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(segment)}
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-xl font-bold text-ink">{count}</span>
            <span className="block truncate text-[10px] text-muted">{note}</span>
          </button>
        )
      })}

      {showFinancials && (
        <div className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-line">
          <p className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
            <span className="truncate">Avg Customer Value</span>
            <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
          </p>
          <p className="mt-1 text-xl font-bold text-ink">
            {formatXaf(averageValue)}
          </p>
          <p className="truncate text-[10px] text-muted">Lifetime, per account</p>
        </div>
      )}
    </div>
  )
}

export default CustomerKpiCards
