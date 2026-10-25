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
import { VIEW_STATES } from './dashboardState'
import type { ViewState } from './dashboardState'

const SECONDARY_ACTIONS = [
  { label: 'Add Customer', icon: UserPlus },
  { label: 'Schedule Pickup', icon: CalendarPlus },
  { label: 'Record Payment', icon: Banknote },
  { label: 'Add Expense', icon: Receipt },
]

const secondaryClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-semibold text-ink ring-1 ring-line transition hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

type QuickActionsProps = {
  // The connected user's type, e.g. "Store manager"; it picks the dashboard's sections
  userTypeLabel: string
  // Tenant owners only: the branches they can narrow the dashboard to
  branches?: { id: string; name: string }[]
  branch: string
  onBranchChange: (branch: string) => void
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
  refreshing: boolean
  onRefresh: () => void
}

function QuickActions({
  userTypeLabel,
  branches,
  branch,
  onBranchChange,
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
        {branches && (
          <select
            aria-label="Show the dashboard for branch"
            value={branch}
            onChange={(event) => onBranchChange(event.target.value)}
            className="h-8 rounded-md bg-field px-2.5 text-[11px] font-semibold text-ink outline-none transition focus:ring-2 focus:ring-brand"
          >
            <option value="">All branches</option>
            {branches.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        {userTypeLabel && (
          <div className="inline-flex rounded-md bg-field p-0.5" title="The dashboard shown for your account type">
            <span className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm">
              {userTypeLabel}
            </span>
          </div>
        )}
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
