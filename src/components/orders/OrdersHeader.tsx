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
import type { Permissions } from '../../constants/orders'
import Menu, { MenuItem } from '../ui/Menu'
import { primaryButton, secondaryButton } from './styles'

type OrdersHeaderProps = {
  permissions: Permissions
  // Whether the person may import orders from a file
  canImport: boolean
  onImport: () => void
  confirmMoves: boolean
  onConfirmMovesChange: (value: boolean) => void
  onNewOrder: () => void
  onScan: () => void
  onExportCsv: () => void
  onOpenNotificationPrefs: () => void
}

function OrdersHeader({
  permissions,
  canImport,
  onImport,
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
                <MenuItem
                  onSelect={() => {
                    close()
                    onImport()
                  }}
                  disabled={!canImport}
                >
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

    </div>
  )
}

export default OrdersHeader
