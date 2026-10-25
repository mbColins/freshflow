import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, RotateCcw, UserCog } from 'lucide-react'
import JobDrawer from '../components/logistics/JobDrawer'
import {
  CostAnalysisPanel,
  DeliveryVolumePanel,
  DriverPerformancePanel,
} from '../components/logistics/LogisticsAnalytics'
import {
  AssignDialog,
  RoutePlannerDialog,
  ScheduleDialog,
} from '../components/logistics/LogisticsDialogs'
import type { NewJobInput } from '../components/logistics/LogisticsDialogs'
import {
  DriversPanel,
  LogisticsKpis,
} from '../components/logistics/LogisticsPanels'
import LogisticsTable from '../components/logistics/LogisticsTable'
import { LogisticsSkeleton } from '../components/logistics/LogisticsSkeleton'
import { PricingPanel, ZonesTable } from '../components/logistics/ZonesPanel'
import { ConfirmDialog, ScanOrderDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import { DEPOT, EMPTY_LOGISTICS_FILTERS } from '../constants/logistics'
import useNow from '../hooks/useNow'
import {
  PRIORITY_TO_API,
  STATUS_TO_API,
  failureNote,
  proofNote,
  toLocalDateTime,
  useAssignJobMutation,
  useChangeJobStatusMutation,
  useCreateJobMutation,
  useGetJobQuery,
  useListJobsQuery,
} from '../services/dispatchApi'
import type { ApiJobStatus, JobListParams } from '../services/dispatchApi'
import { useListDriversQuery, useUpdateDriverStatusMutation } from '../services/driverApi'
import type { DriverListParams } from '../services/driverApi'
import type { DeliveryDriver } from '../types/driver'
import type {
  DispatchJob,
  Driver,
  JobStatus,
  LogisticsFilters,
} from '../types/logistics'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { downloadFile } from '../utils/orders'
import {
  formatClock,
  isClosed,
  jobRef,
  jobsToCsv,
  matchesLogisticsFilters,
} from '../utils/logistics'

const TOAST_MS = 4000
// TODO: page through the jobs once a branch has more than this open at once
const ALL_JOBS: JobListParams = { filter: '', search: '', page: 0, size: 200 }
const ALL_DRIVERS: DriverListParams = { filter: '', search: '', page: 0, size: 100 }
const NO_JOBS: DispatchJob[] = []
const NO_DRIVERS: DeliveryDriver[] = []

type AssignRequest = { jobIds: string[]; driverId: string }

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

// A driver from the API as the page's panels show them. Stops are counted
// from the jobs; route, ETA and note aren't tracked by the backend yet
function toPageDriver(driver: DeliveryDriver, jobs: DispatchJob[], index: number): Driver {
  const mine = jobs.filter((job) => job.driverId === driver.id && job.status !== 'cancelled')
  const open = mine.filter((job) => !isClosed(job))
  const angle = (index * 137.5 * Math.PI) / 180
  return {
    id: driver.id,
    name: driver.name || 'Unnamed driver',
    vehicle: [driver.vehicleModel || driver.vehicleType, driver.vehiclePlate].filter(Boolean).join(' · ') || '—',
    phone: driver.phone,
    status: driver.status === 'ON_ROUTE' ? 'onRoute' : driver.status === 'OFF_DUTY' ? 'offline' : 'available',
    routeId: '',
    location: driver.latitude !== null ? 'Location reported' : 'No location yet',
    stopsDone: mine.length - open.length,
    stopsTotal: mine.length,
    etaMin: null,
    score: driver.score ?? 0,
    note: open.length ? `${open.length} open ${open.length === 1 ? 'job' : 'jobs'}` : '',
    // The map is illustrative; drivers are spread around the depot
    x: Math.round(DEPOT.x + Math.cos(angle) * 60),
    y: Math.round(DEPOT.y + Math.sin(angle) * 45),
  }
}

function LogisticsPage() {
  const now = useNow()
  const jobsQuery = useListJobsQuery(ALL_JOBS)
  const jobs = jobsQuery.data ?? NO_JOBS
  const { data: driverPage, isLoading: driversLoading } = useListDriversQuery(ALL_DRIVERS)
  const [createJob] = useCreateJobMutation()
  const [assignJob] = useAssignJobMutation()
  const [changeStatus] = useChangeJobStatusMutation()
  const [updateDriverStatus] = useUpdateDriverStatusMutation()
  const [filters, setFilters] = useState<LogisticsFilters>(EMPTY_LOGISTICS_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openJobId, setOpenJobId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'schedule' | 'route' | 'scan' | null>(null)
  const [assign, setAssign] = useState<AssignRequest | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const registerRef = useRef<HTMLDivElement>(null)

  // The drivers the caller can see, plus any driver a job names that isn't
  // among them (e.g. a tenant-wide driver outside a branch user's list)
  const listed = (driverPage?.items ?? NO_DRIVERS).map((driver, index) => toPageDriver(driver, jobs, index))
  const drivers: Driver[] = [
    ...listed,
    ...jobs
      .filter((job, index, all) => job.driverId && !listed.some(({ id }) => id === job.driverId) && all.findIndex(({ driverId }) => driverId === job.driverId) === index)
      .map((job, index) => ({
        ...toPageDriver(
          { id: job.driverId!, name: job.driverName || 'Driver', phone: '', email: '', userId: '', branchId: '', branchName: '', allBranches: false, vehicleType: '', vehiclePlate: '', vehicleModel: '', status: 'AVAILABLE', latitude: null, longitude: null, locationUpdatedAt: '', score: null, createdAt: '' },
          jobs,
          listed.length + index,
        ),
      })),
  ]

  // The open job's timeline comes from GET /logistics/jobs/{id}
  const { data: openDetail } = useGetJobQuery(openJobId ?? '', { skip: !openJobId })
  const listedOpen = jobs.find(({ id }) => id === openJobId) ?? null
  const openJob = listedOpen && openDetail?.id === listedOpen.id ? { ...listedOpen, ...openDetail } : listedOpen

  const driverName = (id: string | null) =>
    drivers.find((driver) => driver.id === id)?.name ?? ''
  const label = (job: DispatchJob) => jobRef(job)
  const filtered = jobs
    .filter((job) => matchesLogisticsFilters(job, filters, now, driverName(job.driverId)))
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
  const openJobs = jobs.filter((job) => !isClosed(job))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const updatedAt = jobsQuery.fulfilledTimeStamp ? new Date(jobsQuery.fulfilledTimeStamp).toISOString() : ''

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

  // Runs one call per job and reports how many went through; the list
  // refetches on its own after each one
  async function forEachJob(ids: string[], run: (job: DispatchJob) => Promise<unknown>, done: (count: number) => string, refused: string) {
    const targets = jobs.filter(({ id }) => ids.includes(id))
    const results = await Promise.allSettled(targets.map(run))
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    const passed = results.length - failed.length
    if (!failed.length) setToast(done(passed))
    else
      setToast(
        `${passed ? `${done(passed)}. ` : ''}${failed.length} refused: ${failure(failed[0].reason, refused)}`,
      )
    return failed.length === 0
  }

  async function setStatus(id: string, status: ApiJobStatus, note?: string) {
    await changeStatus({ id, status, note }).unwrap()
  }

  async function handleAssign(jobIds: string[], driverId: string) {
    const name = driverName(driverId)
    // The backend only assigns scheduled or assigned jobs
    const ok = await forEachJob(
      jobIds,
      (job) => assignJob({ id: job.id, driver: driverId }).unwrap(),
      (count) => `${count} ${count === 1 ? 'job' : 'jobs'} assigned to ${name}`,
      'The job can no longer be reassigned.',
    )
    if (ok) {
      setAssign(null)
      setSelectedIds([])
    }
  }

  async function handleStartRoute(jobIds: string[], driverId: string) {
    const name = driverName(driverId)
    const ok = await forEachJob(
      jobIds,
      async (job) => {
        if (job.driverId !== driverId) await assignJob({ id: job.id, driver: driverId }).unwrap()
        await setStatus(job.id, 'EN_ROUTE', `Route started with ${name}`)
      },
      (count) => `Route with ${count} ${count === 1 ? 'stop' : 'stops'} started for ${name}`,
      'A stop couldn’t be started.',
    )
    // The driver is out on the road now
    if (listed.some(({ id }) => id === driverId)) {
      updateDriverStatus({ id: driverId, status: 'ON_ROUTE' }).unwrap().catch(() => { })
    }
    if (ok) setDialog(null)
  }

  async function handleAdvance(id: string, status: JobStatus) {
    const target = STATUS_TO_API[status]
    if (!target) return
    try {
      await setStatus(id, target)
      const job = jobs.find((item) => item.id === id)
      setToast(`${job ? label(job) : 'Job'} updated`)
    } catch (error) {
      setToast(failure(error, 'The job can’t move to that status from where it is.'))
    }
  }

  async function handleCreate(input: NewJobInput) {
    try {
      await createJob({
        type: input.type === 'pickup' ? 'PICKUP' : 'DELIVERY',
        ...(input.orderId ? { orderNumber: input.orderId } : {}),
        customerName: input.customer,
        customerPhone: input.phone,
        address: input.address,
        zone: input.zoneId,
        ...(input.manifest ? { manifest: input.manifest } : {}),
        priority: PRIORITY_TO_API[input.priority],
        scheduledAt: toLocalDateTime(new Date(input.scheduledAt)),
        // A delivery is ready to go as soon as it's booked
        ...(input.type === 'delivery' ? { readyAt: toLocalDateTime(new Date()) } : {}),
        ...(input.driverId ? { driver: input.driverId } : {}),
        ...(input.instructions ? { instructions: input.instructions } : {}),
      }).unwrap()
      setDialog(null)
      setToast(`${input.type === 'pickup' ? 'Pickup' : 'Delivery'} scheduled for ${formatClock(input.scheduledAt)}`)
    } catch (error) {
      setToast(failure(error, 'The server rejected this job. Check the fields and try again.'))
    }
  }

  function requestCancel(ids: string[]) {
    const single = ids.length === 1 ? jobs.find(({ id }) => id === ids[0]) : undefined
    setConfirm({
      title: single ? `Cancel ${label(single)}?` : `Cancel ${ids.length} jobs?`,
      body: 'Cancelled jobs leave the schedule and their driver’s manifest. The laundry order itself is not cancelled.',
      confirmLabel: ids.length === 1 ? 'Cancel Job' : 'Cancel Jobs',
      destructive: true,
      onConfirm: async () => {
        await forEachJob(
          ids,
          (job) => setStatus(job.id, 'CANCELLED'),
          (count) => `${count} ${count === 1 ? 'job' : 'jobs'} cancelled`,
          'A completed job can’t be cancelled.',
        )
        setSelectedIds([])
      },
    })
  }

  function handleScan(code: string) {
    const digits = code.replace(/\D/g, '')
    const match =
      digits &&
      jobs.find(
        (job) =>
          jobRef(job).replace(/\D/g, '').endsWith(digits) ||
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
            {jobsQuery.isError ? (
              <span className="flex items-center gap-1.5 font-semibold text-danger">
                <span className="size-2 rounded-full bg-danger" />
                Not updating
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-success">
                <span className="size-2 rounded-full bg-success" />
                Logistics Live
              </span>
            )}
            {updatedAt && <>Last updated: {formatClock(updatedAt)}</>}
            <button
              type="button"
              onClick={() => void jobsQuery.refetch()}
              disabled={jobsQuery.isFetching}
              aria-label="Refresh"
              className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${jobsQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => requestAssign([])} className={secondaryButton}>
            <UserCog className="size-4 text-muted" aria-hidden="true" />
            Assign Driver
          </button>
          {/* <button type="button" onClick={() => setDialog('route')} className={secondaryButton}>
            <Route className="size-4 text-muted" aria-hidden="true" />
            Create Route
          </button> */}
          {/* <button type="button" onClick={() => setDialog('scan')} className={secondaryButton}>
            <ScanLine className="size-4 text-muted" aria-hidden="true" />
            Scan Order
          </button> */}
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

      {jobsQuery.isError && jobs.length === 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-4 py-3 text-xs">
          <span className="font-semibold text-danger">
            Couldn’t load pickups and deliveries.{' '}
            {serverMessage(jobsQuery.error) ?? errorMessage(jobsQuery.error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </span>
          <button type="button" onClick={() => void jobsQuery.refetch()} disabled={jobsQuery.isFetching} className={secondaryButton}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {jobsQuery.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      )}

      {jobsQuery.isLoading ? (
        <LogisticsSkeleton />
      ) : (
        <LogisticsKpis
          jobs={jobs}
          drivers={drivers}
          now={now}
          filters={filters}
          onSelect={(patch) => showInRegister(patch)}
        />
      )}

      {/* Every job, with search, filters and bulk actions */}
      <div ref={registerRef} className={`scroll-mt-20 ${jobsQuery.isLoading ? 'hidden' : ''}`}>
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
          onCancel={requestCancel}
          onExport={(list) => {
            downloadFile('dispatch.csv', jobsToCsv(list, driverName), 'text/csv;charset=utf-8')
            setToast(`Exported ${list.length} jobs`)
          }}
        />
      </div>

     

      {/* Two columns that stack on their own, so a short panel on one side
          never leaves a gap before the next one: zones and volume on the left,
          drivers, pricing and costs on the right */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ZonesTable jobs={jobs} />
          <DeliveryVolumePanel />
        </div>
        <div className="min-w-0 space-y-4">
          <DriversPanel
            loading={driversLoading}
            drivers={drivers}
            onShowDriverJobs={showDriverJobs}
            onAssignToDriver={requestAssignToDriver}
          />
          <PricingPanel />
          <DriverPerformancePanel jobs={jobs} drivers={drivers} />
          <CostAnalysisPanel />
        </div>
      </div>

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
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
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
        onAdvance={(id, status) => void handleAdvance(id, status)}
        onComplete={async (id, proof) => {
          try {
            await setStatus(id, 'COMPLETED', proofNote(proof.recipient, proof.method))
            setToast(`Delivered to ${proof.recipient}`)
          } catch (error) {
            setToast(failure(error, 'Only a job marked as arrived can be completed.'))
          }
        }}
        onFail={async (id, details) => {
          try {
            await setStatus(id, 'FAILED', failureNote(details.reason, details.notes, details.nextAction))
            setToast('Marked as failed')
          } catch (error) {
            setToast(failure(error, 'The job couldn’t be marked as failed.'))
          }
        }}
        onReschedule={async (id, when, notify) => {
          // A failed job goes back to SCHEDULED. The API can't change the time
          // yet, so the new one is recorded in the timeline note
          // TODO: send scheduledAt once the backend accepts it on reschedule
          try {
            await setStatus(id, 'SCHEDULED', `Rescheduled to ${new Date(when).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`)
            setToast(
              notify
                ? 'Rescheduled. Customer notifications aren’t connected yet.'
                : 'Rescheduled',
            )
          } catch (error) {
            setToast(failure(error, 'Only a failed job can be rescheduled.'))
          }
        }}
      />
      {assign && (
        <AssignDialog
          // The backend reassigns only jobs that haven't left yet
          candidates={openJobs.filter(({ status }) => status === 'scheduled' || status === 'assigned')}
          drivers={drivers}
          initialJobIds={assign.jobIds}
          initialDriverId={assign.driverId}
          onClose={() => setAssign(null)}
          onAssign={(jobIds, driverId) => void handleAssign(jobIds, driverId)}
        />
      )}
      {dialog === 'schedule' && (
        <ScheduleDialog
          onClose={() => setDialog(null)}
          onCreate={(input) => void handleCreate(input)}
        />
      )}
      {dialog === 'route' && (
        <RoutePlannerDialog
          candidates={openJobs.filter(({ status }) => status === 'scheduled' || status === 'assigned')}
          drivers={drivers}
          onClose={() => setDialog(null)}
          onStart={(jobIds, driverId) => void handleStartRoute(jobIds, driverId)}
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
