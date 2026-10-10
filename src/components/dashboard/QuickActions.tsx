import {
  Banknote,
  CalendarPlus,
  Download,
  Plus,
  Receipt,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import SegmentedControl from '../ui/SegmentedControl'
import { ROLES, VIEW_STATES } from './dashboardState'
import type { Role, ViewState } from './dashboardState'

const SECONDARY_ACTIONS = [
  { label: 'Add Customer', icon: UserPlus },
  { label: 'Schedule Pickup', icon: CalendarPlus },
  { label: 'Record Payment', icon: Banknote },
  { label: 'Add Expense', icon: Receipt },
]

const secondaryClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-semibold text-ink ring-1 ring-line transition hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

type QuickActionsProps = {
  role: Role
  onRoleChange: (role: Role) => void
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
  refreshing: boolean
  onRefresh: () => void
}

function QuickActions({
  role,
  onRoleChange,
  viewState,
  onViewStateChange,
  refreshing,
  onRefresh,
}: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-[11px] font-bold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New Order
        </button>
        {SECONDARY_ACTIONS.map(({ label, icon: Icon }) => (
          <button key={label} type="button" className={secondaryClass}>
            <Icon className="size-3.5 text-muted" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Role perspective"
          options={ROLES}
          value={role}
          onChange={onRoleChange}
        />
        <SegmentedControl
          label="Dashboard state preview"
          options={VIEW_STATES}
          value={viewState}
          onChange={onViewStateChange}
        />
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh dashboard"
          className={`${secondaryClass} w-8 justify-center px-0`}
        >
          <RefreshCw
            className={`size-3.5 text-muted ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
        <button type="button" className={secondaryClass}>
          <Download className="size-3.5 text-muted" aria-hidden="true" />
          Export
        </button>
      </div>
    </div>
  )
}

export default QuickActions
