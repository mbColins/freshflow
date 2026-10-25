import {
  Ban,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Download,
  PackageCheck,
  Truck,
  UserCog,
  X,
} from 'lucide-react'
import { PIPELINE_STATUSES } from '../../constants/orders'
import useStaff from '../../hooks/useStaff'
import type { Permissions } from '../../constants/orders'
import type { FulfilmentMethod, OrderStatus } from '../../types/order'
import Menu, { MenuItem } from '../ui/Menu'

const actionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

type BulkActionBarProps = {
  count: number
  permissions: Permissions
  onClear: () => void
  onSetStatus: (status: OrderStatus) => void
  onAssign: (staff: string) => void
  onMarkPaid: () => void
  onSchedule: (method: FulfilmentMethod) => void
  onExport: () => void
  onCancel: () => void
}

function BulkActionBar({
  count,
  permissions,
  onClear,
  onSetStatus,
  onAssign,
  onMarkPaid,
  onSchedule,
  onExport,
  onCancel,
}: BulkActionBarProps) {
  const staff = useStaff()
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
    >
      <p className="mr-2 text-xs font-bold">
        Selected: {count} {count === 1 ? 'order' : 'orders'}
      </p>

      {permissions.updateStatus && (
        <>
          <Menu
            align="left"
            trigger={
              <>
                Update Status
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            }
            triggerClassName={actionClass}
          >
            {(close) =>
              PIPELINE_STATUSES.map(({ id, label }) => (
                <MenuItem
                  key={id}
                  onSelect={() => {
                    close()
                    onSetStatus(id)
                  }}
                >
                  {label}
                </MenuItem>
              ))
            }
          </Menu>
          <button
            type="button"
            onClick={() => onSetStatus('ready')}
            className={actionClass}
          >
            <PackageCheck className="size-3.5" aria-hidden="true" />
            Mark as Ready
          </button>
        </>
      )}

      {permissions.assign && (
        <Menu
          align="left"
          trigger={
            <>
              <UserCog className="size-3.5" aria-hidden="true" />
              Assign Staff
            </>
          }
          triggerClassName={actionClass}
        >
          {(close) =>
            staff.map(({ uuid, name }) => (
              <MenuItem
                key={uuid}
                onSelect={() => {
                  close()
                  onAssign(name)
                }}
              >
                {name}
              </MenuItem>
            ))
          }
        </Menu>
      )}

      {permissions.payments && (
        <button type="button" onClick={onMarkPaid} className={actionClass}>
          <CircleCheck className="size-3.5" aria-hidden="true" />
          Mark as Paid
        </button>
      )}

      {permissions.assign && (
        <>
          <button
            type="button"
            onClick={() => onSchedule('pickup')}
            className={actionClass}
          >
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Schedule Pickup
          </button>
          <button
            type="button"
            onClick={() => onSchedule('delivery')}
            className={actionClass}
          >
            <Truck className="size-3.5" aria-hidden="true" />
            Schedule Delivery
          </button>
        </>
      )}

      <button type="button" onClick={onExport} className={actionClass}>
        <Download className="size-3.5" aria-hidden="true" />
        Export
      </button>

      {permissions.cancel && (
        <button
          type="button"
          onClick={onCancel}
          className={`${actionClass} bg-danger/80 hover:bg-danger`}
        >
          <Ban className="size-3.5" aria-hidden="true" />
          Cancel Orders
        </button>
      )}

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className={`${actionClass} ml-auto w-8 justify-center px-0`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default BulkActionBar
