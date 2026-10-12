import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Clock, Cpu, Ellipsis, MapPin, Pencil, Phone, TriangleAlert, Users } from 'lucide-react'
import { BranchArt, BranchStatusBadge, HealthMeter } from '../components/branches/BranchBits'
import {
  CustomersTab,
  DeliveriesTab,
  InventoryTab,
  MachinesTab,
  OrdersTab,
  OverviewTab,
  PaymentsTab,
  ReportsTab,
  ServicesTab,
  SettingsTab,
  StaffTab,
} from '../components/branches/BranchDetailTabs'
import type { BranchTabProps } from '../components/branches/BranchDetailTabs'
import { QuickAddDialog } from '../components/branches/BranchDialogs'
import BranchWizard from '../components/branches/BranchWizard'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import Menu, { MenuItem } from '../components/ui/Menu'
import {
  BRANCH_PERMISSIONS,
  BRANCH_STATUSES,
  MACHINE_TYPES,
  STAFF_ROLES,
} from '../constants/branches'
import useBranches, { branchStore } from '../hooks/useBranches'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type { BranchStatus } from '../types/branch'
import type { OrderRole } from '../types/order'
import { branchesToCsv, formatHoursSummary, getHealth } from '../utils/branches'
import { downloadFile } from '../utils/orders'

const TABS = [
  { id: 'overview', label: 'Overview', panel: OverviewTab, financial: false },
  { id: 'orders', label: 'Orders', panel: OrdersTab, financial: false },
  { id: 'customers', label: 'Customers', panel: CustomersTab, financial: false },
  { id: 'staff', label: 'Staff', panel: StaffTab, financial: false },
  { id: 'machines', label: 'Machines', panel: MachinesTab, financial: false },
  { id: 'inventory', label: 'Inventory', panel: InventoryTab, financial: false },
  { id: 'services', label: 'Services', panel: ServicesTab, financial: false },
  { id: 'payments', label: 'Payments', panel: PaymentsTab, financial: true },
  { id: 'deliveries', label: 'Deliveries', panel: DeliveriesTab, financial: false },
  { id: 'reports', label: 'Reports', panel: ReportsTab, financial: false },
  { id: 'settings', label: 'Settings', panel: SettingsTab, financial: false },
] as const

const TOAST_MS = 4000
const DAY_MS = 86_400_000

function BranchDetailPage() {
  const { branchId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const now = useNow()
  const branches = useBranches()
  const branch = branches.find(({ id }) => id === branchId)
  const [role] = useLocalStorage<OrderRole>('branches.role', 'admin')
  const [wizardStep, setWizardStep] = useState<number | null>(null)
  const [adding, setAdding] = useState<'staff' | 'machine' | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const permissions = BRANCH_PERMISSIONS[role]

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!branch) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
        <h1 className="text-sm font-bold text-ink">Branch not found</h1>
        <p className="text-xs text-muted">This branch doesn’t exist or was removed.</p>
        <Link to="/branches" className={`${primaryButton} mt-2`}>
          Back to Branches
        </Link>
      </div>
    )
  }

  const tabs = TABS.filter(({ financial }) => !financial || permissions.financials)
  const activeTab = tabs.find(({ id }) => id === searchParams.get('tab')) ?? tabs[0]
  const ActivePanel = activeTab.panel
  const openTab = (id: string) => setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  const change: BranchTabProps['onChange'] = (apply, message) => {
    branchStore.update(branch.id, apply)
    setToast(message)
  }

  function setStatus(status: BranchStatus) {
    const { label } = BRANCH_STATUSES.find(({ value }) => value === status)!
    const apply = () =>
      change(
        (current) => ({ ...current, status, statusNote: status === 'active' ? '' : current.statusNote }),
        `${branch!.name} is now ${label.toLowerCase()}`,
      )
    if (status === 'active' || status === 'maintenance') {
      apply()
      return
    }
    setConfirm({
      title: status === 'inactive' ? `Deactivate ${branch!.name}?` : `Temporarily close ${branch!.name}?`,
      body: `The branch stops accepting new orders. ${branch!.stats.activeOrders} active orders stay open until completed, and all history is kept.`,
      confirmLabel: status === 'inactive' ? 'Deactivate' : 'Close branch',
      destructive: true,
      onConfirm: apply,
    })
  }

  function handleAdd(name: string, kind: string) {
    if (adding === 'staff') {
      change(
        (current) => ({
          ...current,
          staff: [...current.staff, { name, role: kind, ordersProcessed: 0, workload: 0, performance: 0, status: 'Off shift' }],
        }),
        `${name} assigned to ${branch!.name}`,
      )
    } else {
      const maintenanceAt = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10)
      change(
        (current) => ({
          ...current,
          machines: [
            ...current.machines,
            {
              id: `${current.id}-M${String(current.machines.length + 1).padStart(2, '0')}`,
              name,
              type: kind,
              status: 'Available',
              job: '',
              utilization: 0,
              maintenanceAt,
            },
          ],
        }),
        `${name} added to ${branch!.name}`,
      )
    }
    setAdding(null)
  }

  const tabProps: BranchTabProps = {
    branch,
    now,
    permissions,
    onChange: change,
    onEditStep: setWizardStep,
    onConfirm: setConfirm,
    onAdd: setAdding,
    onExport: () => {
      downloadFile(`${branch.id}-report.csv`, branchesToCsv([branch], 'month', permissions.financials), 'text/csv;charset=utf-8')
      setToast('Branch report exported')
    },
  }

  return (
    <>
      <Link
        to="/branches"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Branches
      </Link>

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
        <BranchArt branch={branch} className="h-14" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink">{branch.name}</h1>
                <BranchStatusBadge status={branch.status} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                <span className="font-mono">{branch.id}</span> · {branch.type} · {branch.city}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {permissions.manage && (
                <button type="button" onClick={() => setWizardStep(0)} className={primaryButton}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit Branch
                </button>
              )}
              <button type="button" onClick={() => openTab('staff')} className={secondaryButton}>
                <Users className="size-4 text-muted" aria-hidden="true" />
                Manage Staff
              </button>
              <button type="button" onClick={() => openTab('machines')} className={secondaryButton}>
                <Cpu className="size-4 text-muted" aria-hidden="true" />
                Manage Machines
              </button>
              <Menu
                label="More branch actions"
                trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                triggerClassName={`${iconButton} ring-1 ring-line`}
              >
                {(close) => (
                  <>
                    <MenuItem
                      onSelect={() => {
                        close()
                        tabProps.onExport()
                      }}
                    >
                      Export report
                    </MenuItem>
                    <MenuItem
                      onSelect={() => {
                        close()
                        openTab('settings')
                      }}
                    >
                      Branch settings
                    </MenuItem>
                    {permissions.manage &&
                      BRANCH_STATUSES.filter(({ value }) => value !== branch.status).map(({ value, label }) => (
                        <MenuItem
                          key={value}
                          destructive={value === 'inactive'}
                          onSelect={() => {
                            close()
                            setStatus(value)
                          }}
                        >
                          {value === 'inactive' ? 'Deactivate branch' : `Set to ${label}`}
                        </MenuItem>
                      ))}
                  </>
                )}
              </Menu>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
              <li className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {branch.address}, {branch.city}
              </li>
              <li className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {branch.phone}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                {formatHoursSummary(branch.hours)}
              </li>
            </ul>
            <HealthMeter health={getHealth(branch)} />
          </div>

          {(branch.statusNote || branch.pendingSetup.length > 0) && (
            <div className="space-y-1.5">
              {branch.statusNote && (
                <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {branch.statusNote}
                </p>
              )}
              {branch.pendingSetup.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs text-ink">
                  <span>
                    <span className="font-semibold">Setup pending:</span> {branch.pendingSetup.join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => openTab('settings')}
                    className="rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    Review in Settings
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto border-t border-line px-2">
          <div role="tablist" aria-label="Branch sections" className="flex min-w-max gap-1">
            {tabs.map(({ id, label }) => {
              const selected = id === activeTab.id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => openTab(id)}
                  className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset ${
                    selected ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <div role="tabpanel" aria-label={activeTab.label}>
        <ActivePanel key={`${branch.status}|${branch.statusNote}`} {...tabProps} />
      </div>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {wizardStep !== null && (
        <BranchWizard
          mode="edit"
          initial={branch}
          initialStep={wizardStep}
          takenCodes={[]}
          onClose={() => setWizardStep(null)}
          onSave={(profile) => {
            branchStore.update(branch.id, (current) => ({ ...current, ...profile }))
            setWizardStep(null)
            setToast(`${profile.name} updated`)
          }}
        />
      )}
      {adding && (
        <QuickAddDialog
          title={adding === 'staff' ? 'Assign Staff' : 'Add Machine'}
          nameLabel={adding === 'staff' ? 'Staff member' : 'Machine name'}
          namePlaceholder={adding === 'staff' ? 'Full name' : 'e.g. Washer 05'}
          kindLabel={adding === 'staff' ? 'Role at this branch' : 'Machine type'}
          kinds={adding === 'staff' ? STAFF_ROLES : MACHINE_TYPES}
          submitLabel={adding === 'staff' ? 'Assign' : 'Add Machine'}
          onClose={() => setAdding(null)}
          onSubmit={handleAdd}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default BranchDetailPage
