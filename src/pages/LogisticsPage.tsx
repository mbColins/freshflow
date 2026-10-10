import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Route, ScanLine, UserCog } from 'lucide-react'
import JobDrawer from '../components/logistics/JobDrawer'
import LogisticsAnalytics from '../components/logistics/LogisticsAnalytics'
import {
  AssignDialog,
  RoutePlannerDialog,
  ScheduleDialog,
} from '../components/logistics/LogisticsDialogs'
import type { NewJobInput } from '../components/logistics/LogisticsDialogs'
import LogisticsMap from '../components/logistics/LogisticsMap'
import {
  DispatchQueues,
  DriversPanel,
  LatestProof,
  LogisticsKpis,
  LogisticsPipeline,
  NeedsAttention,
  ScheduleFeed,
  ZonesAndPricing,
} from '../components/logistics/LogisticsPanels'
import LogisticsTable from '../components/logistics/LogisticsTable'
import { ConfirmDialog, ScanOrderDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import {
  EMPTY_LOGISTICS_FILTERS,
  STATUS_LABELS,
  ZONES,
} from '../constants/logistics'
import { SAMPLE_DRIVERS, SAMPLE_JOBS } from '../constants/sampleLogistics'
import useNow from '../hooks/useNow'
import type {
  DispatchJob,
  Driver,
  JobPriority,
  JobStatus,
  LogisticsFilters,
} from '../types/logistics'
import { downloadFile } from '../utils/orders'
import {
  formatClock,
  isClosed,
  jobsToCsv,
  matchesLogisticsFilters,
} from '../utils/logistics'

const TOAST_MS = 4000

type AssignRequest = { jobIds: string[]; driverId: string }

function LogisticsPage() {
  const now = useNow()
  // TODO: replace these in-memory lists with the logistics API
  const [jobs, setJobs] = useState<DispatchJob[]>(SAMPLE_JOBS)
  const [drivers, setDrivers] = useState<Driver[]>(SAMPLE_DRIVERS)
  const [filters, setFilters] = useState<LogisticsFilters>(EMPTY_LOGISTICS_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openJobId, setOpenJobId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'schedule' | 'route' | 'scan' | null>(null)
  const [assign, setAssign] = useState<AssignRequest | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState(() => new Date().toISOString())
  const searchRef = useRef<HTMLInputElement>(null)
  const registerRef = useRef<HTMLDivElement>(null)

  const driverName = (id: string | null) =>
    drivers.find((driver) => driver.id === id)?.name ?? ''
  const filtered = jobs
    .filter((job) => matchesLogisticsFilters(job, filters, now, driverName(job.driverId)))
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
  const openJob = jobs.find(({ id }) => id === openJobId) ?? null
  const openJobs = jobs.filter((job) => !isClosed(job))
  const filtersActive = Object.values(filters).some((value) => value !== '')

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function replaceFilters(next: LogisticsFilters) {
    setFilters(next)
    setSelectedIds([])
  }
  const patchFilters = (patch: Partial<LogisticsFilters>) =>
    replaceFilters({ ...filters, ...patch })

  function showInRegister(patch: Partial<LogisticsFilters>) {
    replaceFilters({ ...EMPTY_LOGISTICS_FILTERS, ...patch })
    registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateJobs(
    ids: string[],
    change: (job: DispatchJob) => DispatchJob,
    event?: (job: DispatchJob) => string,
  ) {
    const at = new Date().toISOString()
    setJobs((current) =>
      current.map((job) => {
        if (!ids.includes(job.id)) return job
        const next = change(job)
        return event
          ? { ...next, timeline: [...next.timeline, { at, text: event(next) }] }
          : next
      }),
    )
  }

  function handleAssign(jobIds: string[], driverId: string) {
    const name = driverName(driverId)
    updateJobs(
      jobIds,
      (job) => ({
        ...job,
        driverId,
        status:
          job.status === 'requested' || job.status === 'scheduled'
            ? 'assigned'
            : job.status,
      }),
      () => `Assigned to ${name}`,
    )
    setDrivers((current) =>
      current.map((driver) =>
        driver.id === driverId
          ? { ...driver, stopsTotal: driver.stopsTotal + jobIds.length }
          : driver,
      ),
    )
    setAssign(null)
    setSelectedIds([])
    setToast(`${jobIds.length} ${jobIds.length === 1 ? 'job' : 'jobs'} assigned to ${name}`)
  }

  function handleStartRoute(jobIds: string[], driverId: string) {
    const name = driverName(driverId)
    updateJobs(
      jobIds,
      (job) => ({ ...job, driverId, status: 'enRoute' }),
      () => `Route started with ${name}`,
    )
    setDrivers((current) =>
      current.map((driver) =>
        driver.id === driverId
          ? {
              ...driver,
              status: 'onRoute',
              routeId: `DLV-0${25 + current.filter(({ routeId }) => routeId).length}`,
              stopsDone: 0,
              stopsTotal: jobIds.length,
              note: 'Route just started',
            }
          : driver,
      ),
    )
    setDialog(null)
    setToast(`Route with ${jobIds.length} stops started for ${name}`)
  }

  function handleAdvance(id: string, status: JobStatus) {
    updateJobs(
      [id],
      (job) => ({ ...job, status }),
      (job) => STATUS_LABELS[status][job.type],
    )
  }

  function handleCreate(input: NewJobInput) {
    const prefix = input.type === 'pickup' ? 'PCK' : 'DLV'
    const next =
      Math.max(...jobs.map(({ id }) => Number(id.replace(/\D/g, '')))) + 1
    const zone = ZONES.find(({ name }) => name === input.zone)!
    const createdAt = new Date().toISOString()
    const job: DispatchJob = {
      ...input,
      id: `${prefix}-${String(next).padStart(5, '0')}`,
      orderId: input.orderId || 'No order yet',
      packages: 1,
      amount: 0,
      payment: 'Pay on delivery',
      paymentTone: 'neutral',
      status: input.driverId ? 'assigned' : 'scheduled',
      readyAt: input.type === 'delivery' ? createdAt : null,
      etaMin: null,
      distanceKm: zone.avgKm,
      timeline: [{ at: createdAt, text: 'Scheduled' }],
      x: zone.x,
      y: zone.y + 28,
    }
    setJobs([job, ...jobs])
    setDialog(null)
    setToast(`${job.id} scheduled for ${formatClock(job.scheduledAt)}`)
  }

  function requestCancel(ids: string[]) {
    setConfirm({
      title: ids.length === 1 ? `Cancel ${ids[0]}?` : `Cancel ${ids.length} jobs?`,
      body: 'Cancelled jobs leave the schedule and their driver’s manifest. The laundry order itself is not cancelled.',
      confirmLabel: ids.length === 1 ? 'Cancel Job' : 'Cancel Jobs',
      destructive: true,
      onConfirm: () => {
        updateJobs(ids, (job) => ({ ...job, status: 'cancelled' }), () => 'Cancelled')
        setSelectedIds([])
        setToast(`${ids.length} ${ids.length === 1 ? 'job' : 'jobs'} cancelled`)
      },
    })
  }

  function handleScan(code: string) {
    const digits = code.replace(/\D/g, '')
    const match =
      digits &&
      jobs.find(
        (job) =>
          job.id.replace(/\D/g, '').endsWith(digits) ||
          job.orderId.replace(/\D/g, '') === digits,
      )
    if (!match) return false
    setDialog(null)
    setOpenJobId(match.id)
    return true
  }

  const requestAssign = (jobIds: string[]) => setAssign({ jobIds, driverId: '' })
  const requestAssignToDriver = (driverId: string) => setAssign({ jobIds: [], driverId })
  const showDriverJobs = (driverId: string) => showInRegister({ driverId })

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Pickup & Delivery</h1>
          <p className="text-xs text-muted">
            Manage pickups, deliveries, drivers, routes, and scheduled logistics.
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="flex items-center gap-1.5 font-semibold text-success">
              <span className="size-2 rounded-full bg-success" />
              Logistics Live
            </span>
            Last updated: {formatClock(updatedAt)}
            <button
              type="button"
              onClick={() => {
                // TODO: refetch from the logistics API; for now this only stamps the time
                setUpdatedAt(new Date().toISOString())
              }}
              aria-label="Refresh"
              className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => requestAssign([])} className={secondaryButton}>
            <UserCog className="size-4 text-muted" aria-hidden="true" />
            Assign Driver
          </button>
          <button type="button" onClick={() => setDialog('route')} className={secondaryButton}>
            <Route className="size-4 text-muted" aria-hidden="true" />
            Create Route
          </button>
          <button type="button" onClick={() => setDialog('scan')} className={secondaryButton}>
            <ScanLine className="size-4 text-muted" aria-hidden="true" />
            Scan Order
          </button>
          <button
            type="button"
            onClick={() => setDialog('schedule')}
            className={`${primaryButton} max-md:hidden`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Schedule Pickup / Delivery
          </button>
        </div>
      </div>

      <LogisticsKpis
        jobs={jobs}
        drivers={drivers}
        now={now}
        filters={filters}
        onSelect={(patch) => showInRegister(patch)}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <LogisticsMap
            jobs={jobs}
            drivers={drivers}
            now={now}
            onOpenJob={setOpenJobId}
            onShowDriverJobs={showDriverJobs}
            onAssignToDriver={requestAssignToDriver}
          />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ScheduleFeed jobs={jobs} drivers={drivers} now={now} onOpenJob={setOpenJobId} />
          <LatestProof jobs={jobs} onOpenJob={setOpenJobId} />
        </div>
      </div>

      <LogisticsPipeline
        jobs={jobs}
        filters={filters}
        onSelect={(type, status) =>
          showInRegister(
            filters.type === type && filters.status === status ? {} : { type, status },
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <NeedsAttention
            jobs={jobs}
            drivers={drivers}
            now={now}
            onOpenJob={setOpenJobId}
            onAssign={requestAssign}
          />
        </div>
        <DriversPanel
          drivers={drivers}
          onShowDriverJobs={showDriverJobs}
          onAssignToDriver={requestAssignToDriver}
        />
      </div>

      <div ref={registerRef} className="scroll-mt-20">
        <LogisticsTable
          searchRef={searchRef}
          jobs={filtered}
          totalCount={jobs.length}
          drivers={drivers}
          now={now}
          filters={filters}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => replaceFilters(EMPTY_LOGISTICS_FILTERS)}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds(
              selectedIds.includes(id)
                ? selectedIds.filter((current) => current !== id)
                : [...selectedIds, id],
            )
          }
          onToggleAll={(checked) =>
            setSelectedIds(checked ? filtered.map(({ id }) => id) : [])
          }
          onClearSelection={() => setSelectedIds([])}
          onOpenJob={setOpenJobId}
          onAssign={requestAssign}
          onSetPriority={(ids, priority: JobPriority) => {
            updateJobs(ids, (job) => ({ ...job, priority }))
            setToast(`Priority changed for ${ids.length} jobs`)
          }}
          onCancel={requestCancel}
          onExport={(list) => {
            downloadFile('dispatch.csv', jobsToCsv(list, driverName), 'text/csv;charset=utf-8')
            setToast(`Exported ${list.length} jobs`)
          }}
        />
      </div>

      <DispatchQueues jobs={jobs} now={now} onOpenJob={setOpenJobId} onAssign={requestAssign} />
      <ZonesAndPricing jobs={jobs} />
      <LogisticsAnalytics jobs={jobs} drivers={drivers} />

      <button
        type="button"
        onClick={() => setDialog('schedule')}
        className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
      >
        <Plus className="size-4" aria-hidden="true" />
        Schedule
      </button>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      <JobDrawer
        job={openJob}
        drivers={drivers}
        now={now}
        onClose={() => setOpenJobId(null)}
        onAssign={requestAssign}
        onAdvance={handleAdvance}
        onComplete={(id, proof) => {
          const at = new Date().toISOString()
          updateJobs(
            [id],
            (job) => ({ ...job, status: 'done', proof: { ...proof, at } }),
            () => `Delivered to ${proof.recipient} (${proof.method})`,
          )
          setToast(`${id} delivered`)
        }}
        onFail={(id, failure) => {
          const at = new Date().toISOString()
          updateJobs(
            [id],
            (job) => ({ ...job, status: 'failed', failure: { ...failure, at } }),
            () => `Attempt failed: ${failure.reason}`,
          )
          setToast(`${id} marked as failed`)
        }}
        onReschedule={(id, when, notify) => {
          updateJobs(
            [id],
            (job) => ({
              ...job,
              status: job.driverId ? 'assigned' : 'scheduled',
              scheduledAt: when,
              etaMin: null,
              failure: undefined,
            }),
            () => `Rescheduled to ${formatClock(when)}`,
          )
          setToast(
            notify
              ? `${id} rescheduled. Customer notifications aren’t connected yet.`
              : `${id} rescheduled`,
          )
        }}
      />
      {assign && (
        <AssignDialog
          candidates={openJobs}
          drivers={drivers}
          initialJobIds={assign.jobIds}
          initialDriverId={assign.driverId}
          onClose={() => setAssign(null)}
          onAssign={handleAssign}
        />
      )}
      {dialog === 'schedule' && (
        <ScheduleDialog
          drivers={drivers}
          onClose={() => setDialog(null)}
          onCreate={handleCreate}
        />
      )}
      {dialog === 'route' && (
        <RoutePlannerDialog
          candidates={openJobs.filter(({ status }) =>
            ['requested', 'scheduled', 'assigned'].includes(status),
          )}
          drivers={drivers}
          onClose={() => setDialog(null)}
          onStart={handleStartRoute}
        />
      )}
      {dialog === 'scan' && (
        <ScanOrderDialog onClose={() => setDialog(null)} onFind={handleScan} />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default LogisticsPage
