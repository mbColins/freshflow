import {
  Bell,
  Download,
  Ellipsis,
  FileDown,
  Plus,
  Printer,
  ScanLine,
  Upload,
} from 'lucide-react'
import { ORDER_ROLES, PREVIEW_STATES } from '../../constants/orders'
import type { Permissions, PreviewState } from '../../constants/orders'
import type { OrderRole } from '../../types/order'
import Menu, { MenuItem } from '../ui/Menu'
import SegmentedControl from '../ui/SegmentedControl'
import { fieldClass, primaryButton, secondaryButton } from './styles'

type OrdersHeaderProps = {
  role: OrderRole
  onRoleChange: (role: OrderRole) => void
  permissions: Permissions
  preview: PreviewState
  onPreviewChange: (preview: PreviewState) => void
  confirmMoves: boolean
  onConfirmMovesChange: (value: boolean) => void
  onNewOrder: () => void
  onScan: () => void
  onExportCsv: () => void
  onOpenNotificationPrefs: () => void
}

function OrdersHeader({
  role,
  onRoleChange,
  permissions,
  preview,
  onPreviewChange,
  confirmMoves,
  onConfirmMovesChange,
  onNewOrder,
  onScan,
  onExportCsv,
  onOpenNotificationPrefs,
}: OrdersHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Orders</h1>
          <p className="text-xs text-muted">
            Manage and track all laundry orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onScan} className={secondaryButton}>
            <ScanLine className="size-4 text-muted" aria-hidden="true" />
            Scan Order
          </button>
          <Menu
            trigger={
              <>
                <Download className="size-4 text-muted" aria-hidden="true" />
                Export
              </>
            }
            triggerClassName={secondaryButton}
          >
            {(close) => (
              <>
                <MenuItem
                  onSelect={() => {
                    onExportCsv()
                    close()
                  }}
                >
                  <FileDown className="size-4 text-muted" aria-hidden="true" />
                  CSV / Excel (current filters)
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    window.print()
                  }}
                >
                  <Printer className="size-4 text-muted" aria-hidden="true" />
                  Print / Save as PDF
                </MenuItem>
              </>
            )}
          </Menu>
          <Menu
            label="More actions"
            trigger={<Ellipsis className="size-4" aria-hidden="true" />}
            triggerClassName={`${secondaryButton} w-9 px-0`}
          >
            {(close) => (
              <>
                {/* TODO: needs a file format and an import endpoint */}
                <MenuItem onSelect={close} disabled>
                  <Upload className="size-4 text-muted" aria-hidden="true" />
                  Import Orders
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    onOpenNotificationPrefs()
                  }}
                >
                  <Bell className="size-4 text-muted" aria-hidden="true" />
                  Notification preferences
                </MenuItem>
                {permissions.configure && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink hover:bg-field">
                    <input
                      type="checkbox"
                      checked={confirmMoves}
                      onChange={(event) =>
                        onConfirmMovesChange(event.target.checked)
                      }
                      className="size-4 accent-brand"
                    />
                    Confirm Kanban moves
                  </label>
                )}
              </>
            )}
          </Menu>
          {permissions.create && (
            <button
              type="button"
              onClick={onNewOrder}
              className={`${primaryButton} max-md:hidden`}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Order
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <label className="flex items-center gap-2 whitespace-nowrap">
          Viewing as
          <select
            value={role}
            onChange={(event) => onRoleChange(event.target.value as OrderRole)}
            className={`${fieldClass} h-8 w-auto!`}
          >
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <SegmentedControl
          label="Page state preview"
          options={PREVIEW_STATES}
          value={preview}
          onChange={onPreviewChange}
        />
      </div>
    </div>
  )
}

export default OrdersHeader
