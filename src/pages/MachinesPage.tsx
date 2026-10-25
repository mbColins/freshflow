import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarClock,
  Download,
  GitCompareArrows,
  LayoutGrid,
  MonitorDot,
  Plus,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import { MachineDialogHost } from '../components/machines/MachineDialogs'
import type { MachineDialogState } from '../components/machines/MachineDialogs'
import {
  AlertsPanel,
  DowntimePanel,
  MachineGrid,
  MachineKpis,
  MachineTable,
  MachineToolbar,
  OperationalView,
  StatusOverview,
  UpcomingMaintenancePanel,
} from '../components/machines/MachinesListParts'
import type { MachineActions, MachineSort } from '../components/machines/MachinesListParts'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import { EMPTY_MACHINE_FILTERS } from '../constants/machines'
import { buildMachineSeed } from '../constants/machineSeed'
import useBranches from '../hooks/useBranches'
import useCurrentUser from '../hooks/useCurrentUser'
import useLocalStorage from '../hooks/useLocalStorage'
import { machineStore, useMachineList } from '../hooks/useMachines'
import useMachinePermissions from '../hooks/useMachinePermissions'
import useNow from '../hooks/useNow'
import { useCreateMachineMutation } from '../services/machineApi'
import type { MachineFilters } from '../types/machine'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { toMachineRequest } from '../utils/machineMapping'
import {
  compareMachines,
  getMachineAlerts,
  machinesToCsv,
  matchesMachineFilters,
  withActivity,
} from '../utils/machines'
import type { MachineSortKey } from '../utils/machines'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000

type MachineView = 'grid' | 'table' | 'operational'

const VIEWS = [
  ['grid', 'Grid', LayoutGrid],
  ['table', 'Table', Table2],
  ['operational', 'Operational', MonitorDot],
] as const

function MachinesPage() {
  const now = useNow()
  const { machines, isLoading, isError, isFetching, error: loadError, refetch } = useMachineList()
  const branches = useBranches()
  const me = useCurrentUser().name || 'You'
  const [createMachine] = useCreateMachineMutation()
  const [importing, setImporting] = useState(false)
  const [filters, setFilters] = useState<MachineFilters>(EMPTY_MACHINE_FILTERS)
  const [sort, setSort] = useState<MachineSort>({ key: 'name', descending: false })
  const [dialog, setDialog] = useState<MachineDialogState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useLocalStorage<MachineView>('machines.view', 'grid')
  const searchRef = useRef<HTMLInputElement>(null)
  const maintenanceRef = useRef<HTMLDivElement>(null)

  const permissions = useMachinePermissions()
  // Machines refer to their branch by the API's uuid, not the branch code
  const branchOptions = branches.map(({ uuid, name }) => ({ id: uuid, name }))
  const branchName = (id: string) => branchOptions.find((branch) => branch.id === id)?.name ?? id
  // Everything except the status filter, so the status cards keep their counts
  const scoped = machines.filter((machine) => matchesMachineFilters(machine, { ...filters, status: '' }, now))
  const filtered = scoped
    .filter((machine) => !filters.status || machine.status === filters.status)
    .sort((a, b) => compareMachines(a, b, sort.key) * (sort.descending ? -1 : 1))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const manufacturers = [...new Set(machines.map(({ manufacturer }) => manufacturer))].sort()
  const alerts = getMachineAlerts(scoped, now)
  const critical = alerts.find(({ severity }) => severity === 'Critical')
  const patchFilters = (patch: Partial<MachineFilters>) => setFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleToggleOffline(machineId: string) {
    const machine = machines.find(({ id }) => id === machineId)!
    const offline = machine.status === 'offline'
    machineStore.update(machineId, (current) =>
      withActivity({ ...current, status: offline ? 'available' : 'offline', statusNote: offline ? '' : 'Marked unavailable' }, me, offline ? 'Marked available' : 'Marked unavailable'),
    )
    setToast(`${machine.name} marked ${offline ? 'available' : 'unavailable'}`)
  }

  // One-off: stores the demo fleet that used to be this page's mock data,
  // spread over the business's branches. Remove with constants/machineSeed.ts
  async function handleImport() {
    if (branchOptions.length === 0) {
      setToast('Create a branch first; machines belong to a branch.')
      return
    }
    setImporting(true)
    let stored = 0
    try {
      for (const { floor, ...profile } of buildMachineSeed()) {
        const branchId = branchOptions[floor % branchOptions.length].id
        await createMachine(toMachineRequest({ ...profile, uuid: '', branchId }, true)).unwrap()
        stored += 1
      }
      setToast(`Imported ${stored} machines`)
    } catch (error) {
      const reason = serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], 'The server refused it.') ?? NETWORK_ERROR_MESSAGE
      setToast(`Imported ${stored} machines, then stopped: ${reason}`)
    } finally {
      setImporting(false)
    }
  }

  function handleSort(key: MachineSortKey) {
    setSort({ key, descending: sort.key === key ? !sort.descending : key === 'utilization' || key === 'runtime' })
  }

  const actions: MachineActions = {
    permissions,
    now,
    branchName,
    onDialog: (name, machineId) => setDialog({ name, machineId }),
    onToggleOffline: handleToggleOffline,
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Machines &amp; Equipment</h1>
            <p className="text-xs text-muted">
              Monitor equipment performance, workload, maintenance, and operational health.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => maintenanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
              <CalendarClock className="size-4 text-muted" aria-hidden="true" />
              Maintenance Schedule
            </button>
            <button type="button" onClick={() => setDialog({ name: 'compare' })} className={secondaryButton}>
              <GitCompareArrows className="size-4 text-muted" aria-hidden="true" />
              Compare
            </button>
            <button
              type="button"
              onClick={() => {
                downloadFile('machines.csv', machinesToCsv(filtered, branchName, now), 'text/csv;charset=utf-8')
                setToast(`Exported ${filtered.length} ${filtered.length === 1 ? 'machine' : 'machines'}`)
              }}
              className={secondaryButton}
            >
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {permissions.manage && (
              <button type="button" onClick={() => setDialog({ name: 'add' })} className={`${primaryButton} max-md:hidden`}>
                <Plus className="size-4" aria-hidden="true" />
                Add Machine
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4" aria-busy="true">
          <p className="sr-only" role="status">Loading machines…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-40 rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
        </div>
      ) : isError && machines.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the machines</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ?? errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : (
      <>
      {critical && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/10 px-4 py-3 ring-1 ring-danger/30" role="alert">
          <TriangleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-64 text-xs">
            <p className="font-bold text-ink">Critical fault · {critical.title}</p>
            <p className="text-ink">{critical.text} <span className="text-muted">{critical.action}</span></p>
          </div>
          <Link to={`/machines/${critical.machineId}?tab=faults`} className={primaryButton}>
            Open Incident
          </Link>
        </section>
      )}

      <MachineKpis machines={scoped} selected={filters.status} onStatus={(status) => patchFilters({ status })} />

      <StatusOverview machines={scoped} selected={filters.status} onSelect={(status) => patchFilters({ status })} />

      <section className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            All Machines{' '}
            <span className="font-normal text-muted">
              ({filtered.length} of {machines.length})
            </span>
          </h2>
          <div role="group" aria-label="Machine view" className="inline-flex gap-0.5 rounded-md bg-field p-0.5">
            {VIEWS.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  view === value ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <MachineToolbar
          searchRef={searchRef}
          filters={filters}
          branches={branchOptions}
          manufacturers={manufacturers}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => setFilters(EMPTY_MACHINE_FILTERS)}
        />
      </section>

      {machines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No machines registered</h2>
          <p className="text-xs text-muted">Add your first machine to start monitoring laundry equipment.</p>
          {permissions.manage && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setDialog({ name: 'add' })} className={primaryButton}>
                <Plus className="size-4" aria-hidden="true" />
                Add Machine
              </button>
              <button type="button" onClick={() => void handleImport()} disabled={importing} className={secondaryButton}>
                {importing ? 'Importing…' : 'Import sample fleet (40 machines)'}
              </button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No machines match these filters</h2>
          <p className="text-xs text-muted">Try a different search, branch, type or status.</p>
          <button type="button" onClick={() => setFilters(EMPTY_MACHINE_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <MachineGrid machines={filtered} {...actions} />
      ) : view === 'table' ? (
        <MachineTable machines={filtered} sort={sort} onSort={handleSort} {...actions} />
      ) : (
        <OperationalView machines={filtered} branchName={branchName} onDialog={actions.onDialog} />
      )}

      <div ref={maintenanceRef} className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} />
        <UpcomingMaintenancePanel machines={scoped} {...actions} />
      </div>

      <DowntimePanel machines={scoped} />
      </>
      )}

      {permissions.manage && (
        <button
          type="button"
          onClick={() => setDialog({ name: 'add' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Machine
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      <MachineDialogHost dialog={dialog} branches={branchOptions} permissions={permissions} onClose={() => setDialog(null)} onToast={setToast} />
    </>
  )
}

export default MachinesPage
