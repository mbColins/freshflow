import {
  Download,
  Ellipsis,
  FileDown,
  Megaphone,
  Printer,
  Upload,
  UserPlus,
} from 'lucide-react'
import type { CustomerPermissions } from '../../constants/customers'
import { ORDER_ROLES, PREVIEW_STATES } from '../../constants/orders'
import type { PreviewState } from '../../constants/orders'
import type { OrderRole } from '../../types/order'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import Menu, { MenuItem } from '../ui/Menu'
import SegmentedControl from '../ui/SegmentedControl'

type CustomersHeaderProps = {
  role: OrderRole
  onRoleChange: (role: OrderRole) => void
  permissions: CustomerPermissions
  preview: PreviewState
  onPreviewChange: (preview: PreviewState) => void
  onAdd: () => void
  onImport: () => void
  onExport: () => void
  onCampaign: () => void
}

function CustomersHeader({
  role,
  onRoleChange,
  permissions,
  preview,
  onPreviewChange,
  onAdd,
  onImport,
  onExport,
  onCampaign,
}: CustomersHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Customers</h1>
          <p className="text-xs text-muted">
            Manage your customers, relationships and laundry history
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissions.manage && (
            <button type="button" onClick={onImport} className={secondaryButton}>
              <Upload className="size-4 text-muted" aria-hidden="true" />
              Import Customers
            </button>
          )}
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
                    close()
                    onExport()
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
          {permissions.manage && (
            <Menu
              label="More actions"
              trigger={<Ellipsis className="size-4" aria-hidden="true" />}
              triggerClassName={`${secondaryButton} w-9 px-0`}
            >
              {(close) => (
                <MenuItem
                  onSelect={() => {
                    close()
                    onCampaign()
                  }}
                >
                  <Megaphone className="size-4 text-muted" aria-hidden="true" />
                  Send campaign…
                </MenuItem>
              )}
            </Menu>
          )}
          {permissions.edit && (
            <button
              type="button"
              onClick={onAdd}
              className={`${primaryButton} max-md:hidden`}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Add Customer
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

export default CustomersHeader
