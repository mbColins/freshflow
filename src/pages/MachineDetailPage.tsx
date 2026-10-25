import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Ellipsis, Pencil, TriangleAlert, Wrench } from 'lucide-react'
import { MachineGlyph, MachineStatusBadge } from '../components/machines/MachineBits'
import StatTile from '../components/ui/StatTile'
import {
  ActivityTab,
  AnalyticsTab,
  DetailsTab,
  FaultsTab,
  MaintenanceTab,
  OverviewTab,
} from '../components/machines/MachineDetailTabs'
import type { MachineTabProps } from '../components/machines/MachineDetailTabs'
import { MachineDialogHost } from '../components/machines/MachineDialogs'
import type { MachineDialogState } from '../components/machines/MachineDialogs'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import Menu, { MenuItem } from '../components/ui/Menu'

import useBranches from '../hooks/useBranches'
import useMachinePermissions from '../hooks/useMachinePermissions'
import useMachineActions from '../hooks/useMachineActions'
import { useMachineDetail, useMachineList } from '../hooks/useMachines'
import { describeError } from '../utils/apiReasons'
import useNow from '../hooks/useNow'
import { formatRuntime, getMaintenance, getOpenFault, isOperational } from '../utils/machines'
import { formatDay } from '../utils/promotions'

const TABS = [
  { id: 'overview', label: 'Overview', panel: OverviewTab },
  { id: 'maintenance', label: 'Maintenance', panel: MaintenanceTab },
  { id: 'faults', label: 'Faults', panel: FaultsTab },
  { id: 'analytics', label: 'Analytics', panel: AnalyticsTab },
  { id: 'activity', label: 'Activity', panel: ActivityTab },
  { id: 'details', label: 'Details', panel: DetailsTab },
] as const

const TOAST_MS = 4000

function MachineDetailPage() {
  const { machineId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const now = useNow()
  const { machines, isLoading } = useMachineList()
  const branches = useBranches()
  const actions = useMachineActions()
  const listed = machines.find(({ id }) => id === machineId)
  // The single read adds costs, logs, faults and transfers to what the list has
  const { machine: detailed } = useMachineDetail(listed?.uuid ?? '')
  const machine = detailed ?? listed
  const [dialog, setDialog] = useState<MachineDialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const permissions = useMachinePermissions()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!machine && isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="sr-only" role="status">Loading the machine…</p>
        <div className="h-32 animate-pulse rounded-xl bg-white ring-1 ring-line" />
        <div className="h-72 animate-pulse rounded-xl bg-white ring-1 ring-line" />
      </div>
    )
  }

  if (!machine) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
        <h1 className="text-sm font-bold text-ink">Machine not found</h1>
        <p className="text-xs text-muted">This machine doesn’t exist in the equipment register.</p>
        <Link to="/machines" className={`${primaryButton} mt-2`}>
          Back to Machines
        </Link>
      </div>
    )
  }

  const branchOptions = branches.map(({ uuid, name }) => ({ id: uuid, name }))
  const branchName = (id: string) => branchOptions.find((branch) => branch.id === id)?.name ?? id
  const activeTab = TABS.find(({ id }) => id === searchParams.get('tab')) ?? TABS[0]
  const ActivePanel = activeTab.panel
  const openTab = (id: string) => setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  const retired = machine.status === 'retired'
  const fault = getOpenFault(machine)
  const maintenance = getMaintenance(machine, now)
  const open = (name: Exclude<MachineDialogState['name'], 'add' | 'compare'>) => setDialog({ name, machineId: machine.id })

  const run: MachineTabProps['run'] = async (call, message) => {
    try {
      await call()
      setToast(message)
    } catch (error) {
      setToast(describeError(error, 'The server refused this change.'))
    }
  }

  function toggleOffline() {
    const offline = machine!.status === 'offline'
    run(
      () => actions.setStatus(machine!.uuid, offline ? 'AVAILABLE' : 'OFFLINE', offline ? '' : 'Marked unavailable'),
      `${machine!.name} marked ${offline ? 'available' : 'unavailable'}`,
    )
  }

  const tabProps: MachineTabProps = {
    machine,
    machines,
    now,
    permissions,
    branchName,
    actions,
    run,
    onDialog: open,
    onConfirm: setConfirm,
  }

  return (
    <>
      <Link
        to="/machines"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Machines
      </Link>

      <section className="rounded-xl bg-white ring-1 ring-line">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <MachineGlyph machine={machine} large />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink">{machine.name}</h1>
                <MachineStatusBadge status={machine.status} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                <span className="font-mono">{machine.id}</span> · {machine.manufacturer} {machine.model} · {branchName(machine.branchId)} · {machine.area}
              </p>
            </div>
            {!retired && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => open('fault')} className={`${secondaryButton} text-danger max-sm:order-first max-sm:h-11 max-sm:w-full`}>
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Report Fault
                </button>
                {permissions.maintain && (
                  <button type="button" onClick={() => open('maintenance')} className={secondaryButton}>
                    <Wrench className="size-4 text-muted" aria-hidden="true" />
                    Schedule Maintenance
                  </button>
                )}
                {permissions.manage && (
                  <>
                    <button type="button" onClick={() => open('edit')} className={primaryButton}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </button>
                    <Menu
                      label="More machine actions"
                      trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                      triggerClassName={`${iconButton} ring-1 ring-line`}
                    >
                      {(close) => {
                        const run = (action: () => void) => () => {
                          close()
                          action()
                        }
                        return (
                          <>
                            {isOperational(machine) && <MenuItem onSelect={run(() => open('assign'))}>Assign job</MenuItem>}
                            {(machine.status === 'available' || machine.status === 'idle' || machine.status === 'offline') && (
                              <MenuItem onSelect={run(toggleOffline)}>{machine.status === 'offline' ? 'Mark available' : 'Mark unavailable'}</MenuItem>
                            )}
                            {permissions.administer && (
                              <>
                                <MenuItem onSelect={run(() => open('transfer'))}>Transfer to another branch</MenuItem>
                                <MenuItem destructive onSelect={run(() => open('retire'))}>Retire machine</MenuItem>
                              </>
                            )}
                          </>
                        )
                      }}
                    </Menu>
                  </>
                )}
              </div>
            )}
          </div>

          {(fault || machine.statusNote) && (
            <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-ink ${fault ? 'bg-danger/10' : 'bg-warning/10'}`}>
              <TriangleAlert className={`mt-px size-4 shrink-0 ${fault ? 'text-danger' : 'text-warning'}`} aria-hidden="true" />
              <span>
                {fault && <span className="font-bold">{fault.severity} fault · {fault.type}. </span>}
                {fault ? fault.description : machine.statusNote}
              </span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Current status" value={machine.job ? `${machine.job.progress}% of cycle` : retired ? 'Retired' : machine.status === 'available' ? 'Ready' : 'Not running'} />
            <StatTile label="Utilization" value={`${machine.utilization}%`} />
            <StatTile label="Runtime today" value={formatRuntime(machine.runtimeTodayMin)} />
            <StatTile label="Cycles today" value={machine.cyclesToday} />
            <StatTile label="Total cycles" value={machine.totalCycles.toLocaleString('en-US')} />
            <StatTile label="Next maintenance" value={formatDay(machine.nextMaintenanceAt, true)} note={maintenance.label} />
          </div>
        </div>

        <div className="overflow-x-auto border-t border-line px-2">
          <div role="tablist" aria-label="Machine sections" className="flex min-w-max gap-1">
            {TABS.map(({ id, label }) => {
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
        <ActivePanel {...tabProps} />
      </div>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      <MachineDialogHost dialog={dialog} branches={branchOptions} permissions={permissions} onClose={() => setDialog(null)} onToast={setToast} />
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default MachineDetailPage
