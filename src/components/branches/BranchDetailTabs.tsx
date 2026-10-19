import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Download, Ellipsis, Pencil, Plus, TriangleAlert } from 'lucide-react'
import {
  BRANCH_PERIODS,
  BRANCH_SERVICES,
  BRANCH_STATUSES,
  DAYS,
  GRANULARITIES,
} from '../../constants/branches'
import type { BranchPermissions } from '../../constants/branches'
import type {
  Branch,
  BranchPeriod,
  BranchStatus,
  RevenueGranularity,
} from '../../types/branch'
import {
  formatChange,
  formatRevenue,
  getChange,
  getHealth,
  getHealthFactors,
  getMachineCounts,
  getOrderBreakdown,
  getPeriodStats,
  getRevenueSeries,
  getYearToDateRevenue,
} from '../../utils/branches'
import { formatDate } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import type { ConfirmRequest } from '../orders/OrderDialogs'
import { fieldClass, iconButton, labelClass, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import Menu, { MenuItem } from '../ui/Menu'
import Panel, { PanelEmpty } from '../ui/Panel'
import SegmentedControl from '../ui/SegmentedControl'
import StatTile from '../ui/StatTile'
import { HealthMeter, Meter } from './BranchBits'
import { OrderStageChart, RevenueChart } from './BranchCharts'

export type BranchTabProps = {
  branch: Branch
  now: number
  permissions: BranchPermissions
  // Applies a change to the branch and shows the message as a toast
  onChange: (change: (branch: Branch) => Branch, message: string) => void
  onEditStep: (step: number) => void
  onConfirm: (request: ConfirmRequest) => void
  onAdd: (kind: 'staff' | 'machine') => void
  onExport: () => void
}

const number = (value: number) => value.toLocaleString('en-US')

function ModuleLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-field px-3 py-2.5">
      <p className="min-w-0 flex-1 text-[11px] text-muted">{children}</p>
      <Link to={to} className={secondaryButton}>
        {label}
        <ArrowUpRight className="size-3.5 text-muted" aria-hidden="true" />
      </Link>
    </div>
  )
}

function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
}

const tableClass = 'w-full min-w-[640px] text-left text-xs'
const headClass = 'text-[10px] font-bold tracking-wider text-muted uppercase'

// ---------- Overview ----------

function PerformanceMeters({ branch }: { branch: Branch }) {
  const { stats } = branch
  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <Meter label="Order completion rate" value={stats.completion} />
      <Meter label="On-time delivery" value={stats.onTime} />
      <Meter
        label="Customer satisfaction"
        value={Math.round((stats.satisfaction / 5) * 100)}
        display={`${stats.satisfaction.toFixed(1)} / 5`}
      />
      {branch.machines.length > 0 && <Meter label="Machine utilization" value={stats.machineUtil} />}
      <Meter label="Staff utilization" value={stats.staffUtil} />
      <Meter label="Inventory health" value={stats.inventoryHealth} />
    </div>
  )
}

export function OverviewTab({ branch, now, permissions }: BranchTabProps) {
  const [granularity, setGranularity] = useState<RevenueGranularity>('daily')
  const [period, setPeriod] = useState<BranchPeriod>('week')
  const { stats } = branch
  const today = getPeriodStats(branch, 'today')
  const week = getPeriodStats(branch, 'week')
  const month = getPeriodStats(branch, 'month')
  const series = getRevenueSeries(branch, granularity, now)
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0)
  const headline = series.previous ? total(series.current) : series.current.at(-1)!
  const change = series.previous ? getChange(headline, total(series.previous)) : null
  const delivered = Math.round((month.orders * stats.completion) / 100)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {permissions.financials && (
          <Panel title="Revenue">
            <TileGrid>
              <StatTile label="Today" value={formatRevenue(today.revenue)} />
              <StatTile label="This week" value={formatRevenue(week.revenue)} />
              <StatTile label="This month" value={formatRevenue(month.revenue)} />
              <StatTile label="Year to date" value={formatRevenue(getYearToDateRevenue(branch, now))} />
            </TileGrid>
          </Panel>
        )}
        <Panel title="Orders" subtitle="This month, with the live queue">
          <TileGrid>
            <StatTile label="Total orders" value={number(month.orders)} />
            <StatTile label="Active now" value={stats.activeOrders} />
            <StatTile label="Completed" value={number(delivered)} />
            <StatTile label="Cancelled / overdue" value={`${Math.round(month.orders * stats.cancelRate)} / ${stats.overdue}`} note="Overdue is live" />
          </TileGrid>
        </Panel>
        <Panel title="Customers">
          <TileGrid>
            <StatTile label="Total customers" value={number(stats.customers)} />
            <StatTile label="New this month" value={stats.newCustomers} />
            <StatTile label="Returning" value={number(stats.customers - stats.newCustomers)} />
            <StatTile label="Satisfaction" value={`${stats.satisfaction.toFixed(1)} / 5`} />
          </TileGrid>
        </Panel>
        <Panel title="Operations" subtitle="Right now">
          <TileGrid>
            <StatTile label="Processing" value={stats.processing} />
            <StatTile label="Ready for pickup" value={stats.ready} />
            <StatTile label="Out for delivery" value={stats.outForDelivery} />
            <StatTile label="Delivered today" value={stats.deliveredToday} />
          </TileGrid>
        </Panel>
      </div>

      {permissions.financials && (
        <Panel
          title="Revenue Overview"
          action={
            <SegmentedControl label="Revenue interval" options={GRANULARITIES} value={granularity} onChange={setGranularity} />
          }
        >
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold text-ink tabular-nums">{formatRevenue(headline)}</span>
            {series.previous ? (
              <span className={`text-xs font-bold ${change !== null && change < 0 ? 'text-danger' : 'text-success'}`}>
                {formatChange(change)}
                <span className="ml-1 font-normal text-muted">
                  vs previous period ({formatRevenue(total(series.previous))})
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted">
                this year so far · {formatRevenue(series.current.at(-2)!)} in all of last year
              </span>
            )}
          </p>
          <div className="mt-3">
            <RevenueChart labels={series.labels} current={series.current} previous={series.previous} />
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Order Analytics"
          subtitle="Processing and Ready are the live queue; the rest are totals for the period"
          action={
            <select
              aria-label="Order analytics period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as BranchPeriod)}
              className={`${fieldClass} h-8 w-auto!`}
            >
              {BRANCH_PERIODS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          }
        >
          <OrderStageChart stages={getOrderBreakdown(branch, period)} />
        </Panel>
        <Panel title="Branch Performance">
          <PerformanceMeters branch={branch} />
        </Panel>
      </div>
    </div>
  )
}

// ---------- Orders, customers, payments, deliveries ----------

export function OrdersTab({ branch }: BranchTabProps) {
  const { stats } = branch
  return (
    <Panel title="Orders">
      <div className="space-y-3">
        <TileGrid>
          {BRANCH_PERIODS.map(({ value, label }) => (
            <StatTile key={value} label={label} value={number(getPeriodStats(branch, value).orders)} />
          ))}
          <StatTile label="Active now" value={stats.activeOrders} />
          <StatTile label="Processing" value={stats.processing} />
          <StatTile label="Ready for pickup" value={stats.ready} />
          <StatTile label="Overdue" value={stats.overdue} />
        </TileGrid>
        <ModuleLink to="/orders" label="Open Orders">
          Individual orders are managed in the Orders module, which isn’t filtered by branch yet.
        </ModuleLink>
      </div>
    </Panel>
  )
}

export function CustomersTab({ branch }: BranchTabProps) {
  const { stats } = branch
  return (
    <Panel title="Customers">
      <div className="space-y-3">
        <TileGrid>
          <StatTile label="Total customers" value={number(stats.customers)} />
          <StatTile label="New this month" value={stats.newCustomers} />
          <StatTile label="Returning" value={number(stats.customers - stats.newCustomers)} />
          <StatTile label="Satisfaction" value={`${stats.satisfaction.toFixed(1)} / 5`} />
        </TileGrid>
        <ModuleLink to="/customers" label="Open Customers">
          Customer profiles are managed in the Customers module, which isn’t filtered by branch yet.
        </ModuleLink>
      </div>
    </Panel>
  )
}

export function PaymentsTab({ branch, now }: BranchTabProps) {
  return (
    <Panel title="Payments">
      <div className="space-y-3">
        <TileGrid>
          {BRANCH_PERIODS.map(({ value, label }) => (
            <StatTile key={value} label={`Revenue · ${label}`} value={formatRevenue(getPeriodStats(branch, value).revenue)} />
          ))}
          <StatTile label="Year to date" value={formatRevenue(getYearToDateRevenue(branch, now))} />
        </TileGrid>
        <div>
          <p className={labelClass}>Payment methods accepted</p>
          <ul className="flex flex-wrap gap-1.5">
            {branch.paymentMethods.length === 0 && <li className="text-xs text-muted">None configured</li>}
            {branch.paymentMethods.map((method) => (
              <li key={method}><Badge tone="brand">{method}</Badge></li>
            ))}
          </ul>
        </div>
        <ModuleLink to="/payments" label="Open Payments">
          Transactions, refunds and cash sessions are managed in the Payments module.
        </ModuleLink>
      </div>
    </Panel>
  )
}

export function DeliveriesTab({ branch }: BranchTabProps) {
  const { stats, capacity } = branch
  return (
    <Panel title="Deliveries">
      <div className="space-y-3">
        <TileGrid>
          <StatTile label="Pending delivery" value={stats.pendingDelivery} />
          <StatTile label="Out for delivery" value={stats.outForDelivery} />
          <StatTile label="Delivered today" value={stats.deliveredToday} />
          <StatTile label="On-time rate" value={`${stats.onTime}%`} />
          <StatTile label="Pickup capacity" value={capacity.pickups} note="per day" />
          <StatTile label="Delivery capacity" value={capacity.deliveries} note="per day" />
        </TileGrid>
        <ModuleLink to="/pickup-delivery" label="Open Pickup & Delivery">
          Routes, drivers and proof of delivery are managed in the Pickup &amp; Delivery module.
        </ModuleLink>
      </div>
    </Panel>
  )
}

// ---------- Staff ----------

const STAFF_TONES: Record<Branch['staff'][number]['status'], BadgeTone> = {
  Active: 'success',
  'On break': 'warning',
  'Off shift': 'neutral',
}

export function StaffTab({ branch, permissions, onChange, onConfirm, onAdd }: BranchTabProps) {
  return (
    <Panel
      title="Branch Staff"
      subtitle={`${branch.staff.filter(({ status }) => status !== 'Off shift').length} on shift of ${branch.staff.length}`}
      action={
        permissions.manage && (
          <button type="button" onClick={() => onAdd('staff')} className={primaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            Assign Staff
          </button>
        )
      }
    >
      {branch.staff.length === 0 ? (
        <PanelEmpty>No staff assigned to this branch yet.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th scope="col" className="py-2 pr-3">Staff member</th>
                <th scope="col" className="py-2 pr-3">Role</th>
                <th scope="col" className="py-2 pr-3 text-right">Orders processed</th>
                <th scope="col" className="py-2 pr-3">Current workload</th>
                <th scope="col" className="py-2 pr-3 text-right">Performance</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {branch.staff.map((member, index) => (
                <tr key={`${member.name}-${index}`}>
                  <th scope="row" className="py-2 pr-3 font-semibold text-ink">{member.name}</th>
                  <td className="py-2 pr-3 text-muted">{member.role}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{member.ordersProcessed}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-field">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${member.workload}%` }} />
                      </span>
                      <span className="tabular-nums">{member.workload}%</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{member.performance ? `${member.performance}%` : '—'}</td>
                  <td className="py-2 pr-3"><Badge tone={STAFF_TONES[member.status]}>{member.status}</Badge></td>
                  <td className="py-2">
                    <div className="flex justify-end">
                      <Menu
                        label={`Actions for ${member.name}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => (
                          <>
                            <Link
                              to="/staff"
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-field"
                            >
                              Open Staff module
                            </Link>
                            {permissions.manage && (
                              <MenuItem
                                destructive
                                onSelect={() => {
                                  close()
                                  onConfirm({
                                    title: `Remove ${member.name} from ${branch.name}?`,
                                    body: 'They stay in the staff directory but are no longer assigned to this branch.',
                                    confirmLabel: 'Remove',
                                    destructive: true,
                                    onConfirm: () =>
                                      onChange(
                                        (current) => ({
                                          ...current,
                                          staff: current.staff.filter((_, position) => position !== index),
                                        }),
                                        `${member.name} removed from ${branch.name}`,
                                      ),
                                  })
                                }}
                              >
                                Remove from branch
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Menu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---------- Machines ----------

const MACHINE_TONES: Record<Branch['machines'][number]['status'], BadgeTone> = {
  Running: 'brand',
  Available: 'success',
  Maintenance: 'warning',
}

export function MachinesTab({ branch, permissions, onChange, onAdd }: BranchTabProps) {
  const counts = getMachineCounts(branch)
  return (
    <Panel
      title="Branch Machines"
      subtitle={counts.total ? `${counts.up} of ${counts.total} working` : undefined}
      action={
        permissions.manage && (
          <button type="button" onClick={() => onAdd('machine')} className={primaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            Add Machine
          </button>
        )
      }
    >
      {branch.machines.length === 0 ? (
        <PanelEmpty>This branch has no machines. Items are processed at another facility.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th scope="col" className="py-2 pr-3">Machine</th>
                <th scope="col" className="py-2 pr-3">Type</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 pr-3">Current job</th>
                <th scope="col" className="py-2 pr-3 text-right">Utilization</th>
                <th scope="col" className="py-2 pr-3">Next maintenance</th>
                {permissions.manage && <th scope="col" className="py-2 text-right"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {branch.machines.map((machine) => {
                const down = machine.status === 'Maintenance'
                return (
                  <tr key={machine.id}>
                    <th scope="row" className="py-2 pr-3 font-semibold text-ink">
                      {machine.name}
                      <span className="block font-mono text-[10px] font-normal text-muted">{machine.id}</span>
                    </th>
                    <td className="py-2 pr-3 text-muted">{machine.type}</td>
                    <td className="py-2 pr-3"><Badge tone={MACHINE_TONES[machine.status]}>{machine.status}</Badge></td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{machine.job || <span className="font-sans text-muted">—</span>}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{down ? '—' : `${machine.utilization}%`}</td>
                    <td className="py-2 pr-3 text-muted">{down ? 'In progress' : formatDate(machine.maintenanceAt)}</td>
                    {permissions.manage && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          disabled={machine.status === 'Running'}
                          title={machine.status === 'Running' ? 'Finish the current job first' : undefined}
                          onClick={() =>
                            onChange(
                              (current) => ({
                                ...current,
                                machines: current.machines.map((item) =>
                                  item.id === machine.id
                                    ? { ...item, status: down ? 'Available' : 'Maintenance', job: '' }
                                    : item,
                                ),
                              }),
                              down ? `${machine.name} is back in service` : `${machine.name} set to maintenance`,
                            )
                          }
                          className={`${secondaryButton} h-8`}
                        >
                          {down ? 'Back in service' : 'Set maintenance'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---------- Inventory ----------

export function InventoryTab({ branch }: BranchTabProps) {
  return (
    <Panel title="Branch Inventory" subtitle={`Inventory health ${branch.stats.inventoryHealth}%`}>
      <div className="space-y-3">
        {branch.stock.length === 0 ? (
          <PanelEmpty>No stock recorded for this branch yet.</PanelEmpty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className={headClass}>
                <tr>
                  <th scope="col" className="py-2 pr-3">Item</th>
                  <th scope="col" className="py-2 pr-3 text-right">On hand</th>
                  <th scope="col" className="py-2 pr-3 text-right">Reorder at</th>
                  <th scope="col" className="py-2">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {branch.stock.map((item) => {
                  const low = item.onHand <= item.reorderAt
                  return (
                    <tr key={item.name}>
                      <th scope="row" className="py-2 pr-3 font-semibold text-ink">{item.name}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{number(item.onHand)} {item.unit}</td>
                      <td className="py-2 pr-3 text-right text-muted tabular-nums">{number(item.reorderAt)} {item.unit}</td>
                      <td className="py-2">
                        <Badge tone={low ? 'danger' : 'success'}>
                          {low && <TriangleAlert className="size-3" aria-hidden="true" />}
                          {low ? 'Low stock' : 'In stock'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <ModuleLink to="/inventory" label="Open Inventory">
          Stock movements and purchase orders are managed in the Inventory module.
        </ModuleLink>
      </div>
    </Panel>
  )
}

// ---------- Services ----------

export function ServicesTab({ branch, permissions, onChange, onEditStep }: BranchTabProps) {
  return (
    <Panel
      title="Services at this branch"
      subtitle={`${branch.services.filter(({ enabled }) => enabled).length} of ${branch.services.length} offered`}
      action={
        permissions.manage && (
          <button type="button" onClick={() => onEditStep(4)} className={secondaryButton}>
            <Pencil className="size-3.5 text-muted" aria-hidden="true" />
            Edit prices
          </button>
        )
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {branch.services.map((service) => {
          const catalog = BRANCH_SERVICES.find(({ name }) => name === service.name)
          return (
            <li key={service.name} className="flex items-center gap-3 rounded-lg bg-field px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{service.name}</p>
                <p className="text-[11px] text-muted">
                  {service.price !== null
                    ? `${formatXaf(service.price)} branch price`
                    : catalog
                      ? `${formatXaf(catalog.price)} / ${catalog.unit} (catalog)`
                      : 'Catalog price'}
                </p>
              </div>
              {permissions.manage ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={service.enabled}
                    onChange={(event) =>
                      onChange(
                        (current) => ({
                          ...current,
                          services: current.services.map((item) =>
                            item.name === service.name ? { ...item, enabled: event.target.checked } : item,
                          ),
                        }),
                        `${service.name} ${event.target.checked ? 'enabled' : 'disabled'} at ${branch.name}`,
                      )
                    }
                    className="size-4 accent-brand"
                  />
                  Offered
                </label>
              ) : (
                <Badge tone={service.enabled ? 'success' : 'neutral'}>{service.enabled ? 'Offered' : 'Not offered'}</Badge>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ---------- Reports ----------

export function ReportsTab({ branch, onExport }: BranchTabProps) {
  const health = getHealth(branch)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Branch Health"
        subtitle="Weighted score of the factors below"
        action={
          <button type="button" onClick={onExport} className={secondaryButton}>
            <Download className="size-3.5 text-muted" aria-hidden="true" />
            Export report
          </button>
        }
      >
        <div className="space-y-3">
          <HealthMeter health={health} />
          {getHealthFactors(branch).map(({ label, value, weight }) => (
            <Meter key={label} label={`${label} (weight ${Math.round(weight * 100)}%)`} value={value} />
          ))}
        </div>
      </Panel>
      <Panel title="Branch Performance">
        <PerformanceMeters branch={branch} />
      </Panel>
    </div>
  )
}

// ---------- Settings ----------

export function SettingsTab({ branch, permissions, onChange, onEditStep }: BranchTabProps) {
  const [status, setStatus] = useState<BranchStatus>(branch.status)
  const [note, setNote] = useState(branch.statusNote)
  const dirty = status !== branch.status || note.trim() !== branch.statusNote
  const edit = (step: number) =>
    permissions.manage && (
      <button type="button" onClick={() => onEditStep(step)} className={`${secondaryButton} h-8`}>
        <Pencil className="size-3.5 text-muted" aria-hidden="true" />
        Edit
      </button>
    )
  const rows = (items: [string, string][]) => (
    <dl className="space-y-1.5 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-3">
          <dt className="w-28 shrink-0 text-muted">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Branch Status">
        {permissions.manage ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="settings-status" className={labelClass}>Status</label>
              <select
                id="settings-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as BranchStatus)}
                className={fieldClass}
              >
                {BRANCH_STATUSES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="settings-note" className={labelClass}>Note shown on the branch card (optional)</label>
              <textarea
                id="settings-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`${fieldClass} h-auto py-2`}
              />
            </div>
            <button
              type="button"
              disabled={!dirty}
              onClick={() =>
                onChange(
                  (current) => ({ ...current, status, statusNote: note.trim() }),
                  `${branch.name} is now ${BRANCH_STATUSES.find(({ value }) => value === status)!.label.toLowerCase()}`,
                )
              }
              className={primaryButton}
            >
              Save status
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">Only administrators can change a branch’s status.</p>
        )}
      </Panel>

      <Panel title="Pending Setup" badge={branch.pendingSetup.length > 0 && <Badge tone="warning">{branch.pendingSetup.length}</Badge>}>
        {branch.pendingSetup.length === 0 ? (
          <PanelEmpty>Setup is complete.</PanelEmpty>
        ) : (
          <ul className="space-y-1.5">
            {branch.pendingSetup.map((task) => (
              <li key={task} className="flex items-center justify-between gap-2 rounded-lg bg-field px-3 py-1.5 text-xs font-semibold text-ink">
                {task}
                {permissions.manage && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        (current) => ({ ...current, pendingSetup: current.pendingSetup.filter((item) => item !== task) }),
                        `${task} marked as set up`,
                      )
                    }
                    className={`${secondaryButton} h-7`}
                  >
                    Mark done
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Location & Contact" action={edit(1)}>
        {rows([
          ['Address', [branch.address, branch.district, branch.city, branch.region, branch.country].filter(Boolean).join(', ')],
          ['GPS', branch.lat !== null && branch.lng !== null ? `${branch.lat}, ${branch.lng}` : ''],
          ['Phone', [branch.phone, branch.phone2].filter(Boolean).join(' · ')],
          ['Email', branch.email],
          ['WhatsApp', branch.whatsapp],
          ['Website', branch.website],
          ['Manager', branch.manager],
          ['Opened', formatDate(branch.openedAt)],
        ])}
      </Panel>

      <Panel title="Opening Hours" action={edit(3)}>
        <dl className="space-y-1 text-xs">
          {branch.hours.map((day, index) => (
            <div key={DAYS[index]} className="flex justify-between gap-3">
              <dt className="text-muted">{DAYS[index]}</dt>
              <dd className="font-medium text-ink tabular-nums">{day.closed ? 'Closed' : `${day.open} – ${day.close}`}</dd>
            </div>
          ))}
        </dl>
        {branch.specialDays.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-2 text-[11px] text-muted">
            {branch.specialDays.map((day) => (
              <li key={day.date}>
                {formatDate(day.date)}: {day.label} · {day.closed ? 'closed' : `${day.open}–${day.close}`}
              </li>
            ))}
          </ul>
        )}
        {branch.closure && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-[11px] text-warning">
            Temporary closure {formatDate(branch.closure.from)} to {formatDate(branch.closure.to)}
            {branch.closure.reason && `: ${branch.closure.reason}`}
          </p>
        )}
      </Panel>

      <Panel title="Capacity" action={edit(5)} className="lg:col-span-2">
        <TileGrid>
          <StatTile label="Daily orders" value={branch.capacity.dailyOrders} />
          <StatTile label="Max items / day" value={number(branch.capacity.maxItems)} />
          <StatTile label="Avg processing" value={`${branch.capacity.processingHours} h`} />
          <StatTile label="Machines" value={branch.capacity.machines} />
        </TileGrid>
      </Panel>
    </div>
  )
}
