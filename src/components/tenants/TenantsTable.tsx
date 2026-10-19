import { Ellipsis } from 'lucide-react'
import { TENANT_STATUSES } from '../../constants/tenants'
import usePlatformPlans from '../../hooks/usePlatformPlans'
import type { Tenant } from '../../types/tenant'
import { formatDate } from '../../utils/customers'
import { findPlan } from '../../utils/platformPlans'
import { ownerName, trialDaysLeft, usageLabel } from '../../utils/tenants'
import { iconButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Menu, { MenuItem } from '../ui/Menu'

type TenantsTableProps = {
  tenants: Tenant[]
  now: number
  onEdit: (id: string) => void
  onSuspend: (id: string) => void
  onReactivate: (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}

function TenantsTable({ tenants, now, onEdit, onSuspend, onReactivate, onCancel, onDelete }: TenantsTableProps) {
  const plans = usePlatformPlans()
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="bg-field text-[11px] text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-bold">Tenant</th>
            <th scope="col" className="px-3 py-2 font-bold">Owner</th>
            <th scope="col" className="px-3 py-2 font-bold">Plan</th>
            <th scope="col" className="px-3 py-2 font-bold">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Branches</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Users</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Orders (month)</th>
            <th scope="col" className="px-3 py-2 font-bold">Created</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tenants.map((tenant) => {
            // A deleted plan shows its code with no limits
            const plan = findPlan(plans, tenant.plan)
            const status = TENANT_STATUSES[tenant.status]
            const daysLeft = trialDaysLeft(tenant, now)
            const closed = tenant.status === 'cancelled'
            return (
              <tr key={tenant.id} className="align-top hover:bg-field/60">
                <td className="px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-field text-[11px] font-bold text-muted ring-1 ring-line">
                      {tenant.logoUrl ? (
                        <img src={tenant.logoUrl} alt="" className="size-full object-contain" />
                      ) : (
                        tenant.name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{tenant.name}</p>
                      <p className="font-mono text-[10px] text-muted">
                        {tenant.ref} · {tenant.hostname}
                      </p>
                      {tenant.slogan && <p className="text-[11px] text-muted italic">{tenant.slogan}</p>}
                      <p className="text-[11px] text-muted">
                        {tenant.town} · {tenant.phone}
                      </p>
                      <p className="text-[11px] text-muted">{tenant.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{ownerName(tenant)}</p>
                  <p className="font-mono text-[10px] text-muted">@{tenant.owner.username}</p>
                  <p className="text-[11px] text-muted">{tenant.owner.email}</p>
                  <p className="text-[11px] text-muted">{tenant.owner.phone}</p>
                </td>
                <td className="px-3 py-2.5 font-semibold text-ink">{plan?.name ?? tenant.plan}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {daysLeft !== null && (
                    <p className={`mt-1 text-[11px] ${daysLeft <= 3 ? 'font-semibold text-warning' : 'text-muted'}`}>
                      {daysLeft === 0 ? 'Trial ends today' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
                    </p>
                  )}
                  {tenant.statusNote && (
                    <p className="mt-1 max-w-40 text-[11px] text-muted">{tenant.statusNote}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {usageLabel(tenant.branches, plan?.maxShops ?? null)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {usageLabel(tenant.users, plan?.maxStaff ?? null)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {tenant.ordersThisMonth.toLocaleString('en-US')}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDate(tenant.createdAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Menu
                    label={`Actions for ${tenant.name}`}
                    trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                    triggerClassName={iconButton}
                  >
                    {(close) => (
                      <>
                        <MenuItem onSelect={() => { close(); onEdit(tenant.id) }}>Edit details & plan</MenuItem>
                        {tenant.status === 'suspended' || closed ? (
                          <MenuItem onSelect={() => { close(); onReactivate(tenant.id) }}>Reactivate</MenuItem>
                        ) : (
                          <MenuItem onSelect={() => { close(); onSuspend(tenant.id) }}>Suspend</MenuItem>
                        )}
                        {!closed && (
                          <MenuItem onSelect={() => { close(); onCancel(tenant.id) }}>
                            <span className="text-danger">Cancel subscription</span>
                          </MenuItem>
                        )}
                        <MenuItem destructive onSelect={() => { close(); onDelete(tenant.id) }}>
                          Delete tenant
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TenantsTable
