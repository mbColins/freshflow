import { useEffect, useRef, useState } from 'react'
import { Columns3, Download, Play, RefreshCw, RotateCcw, ScanLine, Table2 } from 'lucide-react'
import {
  AssignDialog,
  JobDrawer,
  MachineDialog,
  QcDialog,
  ScanDialog,
} from '../components/operations/OpsDialogs'
import {
  AttentionPanel,
  BottleneckPanel,
  BranchWorkload,
  CapacityPanel,
  FloorTimeline,
  MachineStrip,
  MyWork,
  OpsAnalytics,
  StaffWorkload,
  SuppliesPanel,
} from '../components/operations/OpsPanels'
import {
  Kanban,
  OpsKpis,
  OpsToolbar,
  Pipeline,
  QueueTable,
} from '../components/operations/OpsQueue'
import type { OpsActions } from '../components/operations/OpsQueue'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import { EMPTY_OPS_FILTERS, QC_CHECKLIST, STAGES } from '../constants/operations'
import type { OpsPermissions } from '../constants/operations'
import useBranches from '../hooks/useBranches'
import useCurrentUser from '../hooks/useCurrentUser'
import useLocalStorage from '../hooks/useLocalStorage'
import useMachines from '../hooks/useMachines'
import useNow from '../hooks/useNow'
import useStaff from '../hooks/useStaff'
import {
  useAdvanceStageMutation,
  useAssignStaffMutation,
  useGetOpsJobQuery,
  useGetOpsSummaryQuery,
  useListFloorEventsQuery,
  useListOpsJobsQuery,
  useMoveStageMutation,
  useNotifyFloorCustomerMutation,
  useSetFloorCountsMutation,
  useStartStageMutation,
} from '../services/operationsApi'
import { useQualityCheckMutation } from '../services/orderApi'
import type { OpsFilters, OpsJob, QcResult, StageId } from '../types/operations'
import { describeError } from '../utils/apiReasons'
import {
  formatMinutes,
  getNextAction,
  getStage,
  hasCountMismatch,
  jobsToCsv,
  matchesOpsFilters,
  compareJobs,
} from '../utils/operations'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 5000
// After this long without a refresh the figures are flagged as possibly stale
const STALE_MS = 5 * 60_000
// The floor changes all day; the live stream isn't built yet, so the page asks again
const POLL_MS = 30_000
// TODO: page through the queue if a branch ever has more open jobs than this
const QUEUE = { page: 0, size: 200 }
const NO_JOBS: OpsJob[] = []

type OpsView = 'table' | 'kanban'
type DialogState = { name: 'machine' | 'qc' | 'assign'; id: string } | { name: 'scan' }

function OperationsPage() {
  const now = useNow()
  const branches = useBranches()
  const allMachines = useMachines()
  const staff = useStaff()
  const { can, name: actor, user, workplace } = useCurrentUser()

  const jobsQuery = useListOpsJobsQuery(QUEUE, { pollingInterval: POLL_MS })
  const jobs = jobsQuery.data ?? NO_JOBS
  const { data: events = [] } = useListFloorEventsQuery({ limit: 50 }, { pollingInterval: POLL_MS })

  const [startStage] = useStartStageMutation()
  const [advanceStage] = useAdvanceStageMutation()
  const [moveStage] = useMoveStageMutation()
  const [assignStaff] = useAssignStaffMutation()
  const [setCounts] = useSetFloorCountsMutation()
  const [notifyCustomer] = useNotifyFloorCustomerMutation()
  const [qualityCheck] = useQualityCheckMutation()

  const [filters, setFilters] = useState<OpsFilters>(EMPTY_OPS_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useLocalStorage<OpsView>('operations.view', 'table')
  const searchRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<HTMLElement>(null)

  // From the role's permissions; everything is allowed until the profile says otherwise
  const permissions: OpsPermissions = {
    process: can('OPERATIONS:PROCESS'),
    manage: can('OPERATIONS:OVERRIDE'),
    analytics: can('OPERATIONS:OVERRIDE'),
  }
  // The summary is for managers only
  const { data: summary } = useGetOpsSummaryQuery(undefined, { skip: !permissions.analytics, pollingInterval: POLL_MS })

  const machines = allMachines.filter(({ status }) => status !== 'retired')
  const filtered = jobs.filter((job) => matchesOpsFilters(job, filters, now)).sort(compareJobs)
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const services = [...new Set(jobs.map(({ service }) => service))].sort()
  // The single read adds the job's history, which the queue leaves out
  const { data: openDetail } = useGetOpsJobQuery(openId ?? '', { skip: !openId })
  const listedOpen = jobs.find(({ id }) => id === openId) ?? null
  const openJob = listedOpen ? (openDetail?.id === listedOpen.id ? { ...listedOpen, history: openDetail.history } : listedOpen) : null
  const dialogJob = dialog && 'id' in dialog ? jobs.find(({ id }) => id === dialog.id) : undefined
  const syncedAt = jobsQuery.fulfilledTimeStamp ?? now
  const stale = now - syncedAt > STALE_MS
  const patchFilters = (patch: Partial<OpsFilters>) => setFilters({ ...filters, ...patch })
  // The branch this person works at, for highlighting in the workload list
  const myBranch = branches.find(({ uuid }) => uuid === user?.branchUuid)

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

  function showQueue(patch: Partial<OpsFilters>) {
    setFilters({ ...EMPTY_OPS_FILTERS, ...patch })
    queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Sends a change to the server; the queue reloads by itself once it is accepted
  async function attempt(call: () => Promise<unknown>, done: string, fallback: string) {
    try {
      await call()
      setToast(done)
      return true
    } catch (error) {
      setToast(describeError(error, fallback))
      return false
    }
  }

  // A machine stage needs the order's weight as its load; when the server has
  // none, ask for it once, store it and try again
  async function startOnMachine(job: OpsJob, machineId: string) {
    const start = () => startStage({ order: job.id, machine: machineId }).unwrap()
    try {
      await start()
    } catch (error) {
      if (!describeError(error, '').includes('weight')) throw error
      const entered = Number(window.prompt(`Weight of order #${job.id} in kg`))
      if (!(entered > 0)) throw error
      await setCounts({ order: job.id, weightKg: entered }).unwrap()
      await start()
    }
  }

  function handleAction(id: string) {
    const job = jobs.find((item) => item.id === id)
    if (!job) return
    const action = getNextAction(job)
    if (action.kind === 'notify') {
      void attempt(
        () => notifyCustomer({ order: job.id, channel: 'SMS' }).unwrap(),
        `Customer of #${job.id} notified`,
        'The customer wasn’t notified.',
      )
      return
    }
    if (action.kind === 'inspect') {
      setDialog({ name: 'qc', id })
      return
    }
    if (action.needsMachine) {
      setDialog({ name: 'machine', id })
      return
    }
    if (action.kind === 'complete') {
      // Packaging only finishes when the count matches, or a manager says why it can pass
      let resolution: string | undefined
      if (job.stage === 'packaging' && hasCountMismatch(job)) {
        resolution = permissions.manage ? (window.prompt(`Order #${job.id} has an item count mismatch. Why can it pass?`)?.trim() ?? '') : ''
        if (!resolution) {
          setOpenId(id)
          setToast(`#${job.id} has an item count mismatch. Resolve it before marking it packaged`)
          return
        }
      }
      void attempt(
        () => advanceStage({ order: job.id, ...(resolution ? { resolution } : {}) }).unwrap(),
        `#${job.id}: ${action.label.toLowerCase()}`,
        'The stage wasn’t completed.',
      )
      return
    }
    void attempt(() => startStage({ order: job.id }).unwrap(), `#${job.id}: ${action.label.toLowerCase()}`, 'The stage wasn’t started.')
  }

  function handleMove(id: string, stage: StageId) {
    const job = jobs.find((item) => item.id === id)
    if (!job || job.stage === stage) return
    const from = STAGES.findIndex((item) => item.id === job.stage)
    const to = STAGES.findIndex((item) => item.id === stage)
    const apply = async (reason?: string) => {
      await attempt(
        () => moveStage({ order: job.id, stage, ...(reason ? { reason } : {}) }).unwrap(),
        `#${job.id} moved to ${getStage(stage).label}`,
        'The order wasn’t moved.',
      )
    }
    if (stage !== 'ready' && to === from + 1) {
      void apply()
      return
    }
    setConfirm({
      title: `Move #${job.id} to ${getStage(stage).label}?`,
      body:
        to < from
          ? `This sends the order back from ${getStage(job.stage).label}. The steps in between will be done again.`
          : stage === 'ready'
            ? 'This marks the order ready for the customer without the remaining steps, including the quality check.'
            : `This skips ${to - from - 1} ${to - from - 1 === 1 ? 'stage' : 'stages'} between ${getStage(job.stage).label} and ${getStage(stage).label}.`,
      confirmLabel: 'Move order',
      destructive: to < from || stage === 'ready',
      onConfirm: () => {
        // Skipping or going back needs a written reason
        const reason = window.prompt('Reason for moving this order out of sequence')?.trim()
        if (!reason) {
          setToast('A reason is needed to move an order out of sequence.')
          return
        }
        void apply(reason)
      },
    })
  }

  // The quality check lives on the order; the server moves the floor job with it
  async function handleQc(result: QcResult) {
    const job = dialogJob
    if (!job) return
    const ok = await attempt(
      () =>
        qualityCheck({
          orderNumber: job.id,
          checks: Object.fromEntries(QC_CHECKLIST.map((check) => [check, result.passed])),
          result: result.passed ? 'PASSED' : 'FAILED',
          ...(result.passed ? {} : { reason: result.reason, sendBackTo: result.sendTo === 'ironing' ? 'IRONING' : 'WASHING' }),
        }).unwrap(),
      result.passed ? `#${job.id} passed quality control` : `#${job.id} failed quality control and was sent back to ${getStage(result.sendTo).label}`,
      'The quality check wasn’t saved.',
    )
    if (ok) setDialog(null)
  }

  const actions: OpsActions = {
    now,
    permissions,
    onOpen: setOpenId,
    onAction: handleAction,
    onAssign: (id) => setDialog({ name: 'assign', id }),
  }

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Laundry Operations</h1>
          <p className="text-xs text-muted">
            Monitor and manage today’s laundry processing{workplace ? ` at ${workplace}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadFile('laundry-operations.csv', jobsToCsv(filtered, now), 'text/csv;charset=utf-8')
              setToast(`Exported ${filtered.length} jobs`)
            }}
            className={secondaryButton}
          >
            <Download className="size-4 text-muted" aria-hidden="true" />
            Export
          </button>
          <button type="button" onClick={() => setDialog({ name: 'scan' })} className={secondaryButton}>
            <ScanLine className="size-4 text-muted" aria-hidden="true" />
            Scan Order
          </button>
          {permissions.process && (
            <button type="button" onClick={() => showQueue({ view: 'waiting' })} className={primaryButton}>
              <Play className="size-4" aria-hidden="true" />
              Start Processing
            </button>
          )}
        </div>
      </div>
      <p className="flex items-center gap-2 text-[11px] text-muted" role="status">
        <span className={`size-2 rounded-full ${stale || jobsQuery.isError ? 'bg-warning' : 'bg-success'}`} aria-hidden="true" />
        <span className="font-semibold text-ink">{jobsQuery.isError ? 'Not updating' : stale ? 'May be out of date' : 'Up to date'}</span>
        Refreshed {now - syncedAt < 60_000 ? 'just now' : `${formatMinutes((now - syncedAt) / 60_000)} ago`}
        <button
          type="button"
          onClick={() => {
            void jobsQuery.refetch()
            setToast('Floor data refreshed')
          }}
          disabled={jobsQuery.isFetching}
          className="inline-flex items-center gap-1 rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${jobsQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </p>
    </div>
  )

  if (jobsQuery.isLoading) {
    return (
      <>
        {header}
        <div className="animate-pulse space-y-4" aria-busy="true">
          <p className="sr-only" role="status">Loading the production floor…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
          <div className="h-24 rounded-xl bg-white ring-1 ring-line" />
          <div className="rounded-xl bg-white ring-1 ring-line">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
                <div className="h-3 w-24 rounded bg-field" />
                <div className="h-3 w-32 rounded bg-field" />
                <div className="h-3 flex-1 rounded bg-field" />
                <div className="h-5 w-20 rounded bg-field" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (jobsQuery.isError && jobs.length === 0) {
    return (
      <>
        {header}
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the production floor</h2>
          <p className="max-w-md text-xs text-muted">{describeError(jobsQuery.error, 'The server refused the request.')}</p>
          <button type="button" onClick={() => void jobsQuery.refetch()} disabled={jobsQuery.isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {jobsQuery.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {header}

      {!permissions.analytics && <MyWork jobs={jobs} name={actor} onScan={() => setDialog({ name: 'scan' })} {...actions} />}

      <OpsKpis jobs={jobs} now={now} filters={filters} onFilter={(patch) => patchFilters(patch)} />

      {permissions.analytics && <CapacityPanel jobs={jobs} machines={machines} now={now} />}

      <Pipeline jobs={jobs} now={now} selected={filters.stage} onSelect={(stage) => patchFilters({ stage })} />

      <section ref={queueRef} className="scroll-mt-20 space-y-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Processing Queue{' '}
            <span className="font-normal text-muted">
              ({filtered.length} of {jobs.length} jobs, express and soonest due first)
            </span>
          </h2>
          <div role="group" aria-label="Queue view" className="inline-flex gap-0.5 rounded-md bg-field p-0.5">
            {(
              [
                ['table', 'Table', Table2],
                ['kanban', 'Kanban', Columns3],
              ] as const
            ).map(([value, label, Icon]) => (
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
        <OpsToolbar
          searchRef={searchRef}
          filters={filters}
          services={services}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => setFilters(EMPTY_OPS_FILTERS)}
        />
      </section>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">{filtersActive ? 'No jobs match these filters' : 'No active jobs'}</h2>
          <p className="text-xs text-muted">{filtersActive ? 'That part of the floor is clear.' : 'Everything is currently up to date.'}</p>
          {filtersActive && (
            <button type="button" onClick={() => setFilters(EMPTY_OPS_FILTERS)} className={`${secondaryButton} mt-2`}>
              Show all jobs
            </button>
          )}
        </div>
      ) : view === 'table' ? (
        <QueueTable jobs={filtered} {...actions} />
      ) : (
        <Kanban jobs={filtered} onMove={handleMove} {...actions} />
      )}

      <MachineStrip machines={machines} now={now} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BottleneckPanel jobs={jobs} now={now} onStage={(stage) => showQueue({ stage })} />
        <StaffWorkload jobs={jobs} selected={filters.staff} onSelect={(name) => showQueue({ staff: name })} />
      </div>

      <AttentionPanel jobs={jobs} {...actions} />

      <SuppliesPanel machines={machines} now={now} />

      {permissions.analytics && (
        <>
          <OpsAnalytics jobs={jobs} summary={summary} />
          <div className="grid gap-4 lg:grid-cols-2">
            <FloorTimeline events={events} />
            <BranchWorkload branches={branches} currentId={myBranch?.id ?? ''} />
          </div>
        </>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      <JobDrawer
        job={openJob}
        onClose={() => setOpenId(null)}
        onRecount={(id) => {
          const job = jobs.find((item) => item.id === id)
          if (!job) return
          void attempt(() => setCounts({ order: job.id, itemsFound: job.items }).unwrap(), `#${job.id} item count resolved`, 'The count wasn’t saved.')
        }}
        {...actions}
      />
      {dialog?.name === 'scan' && <ScanDialog jobs={jobs} onClose={() => setDialog(null)} {...actions} />}
      {dialog?.name === 'machine' && dialogJob && (
        <MachineDialog
          job={dialogJob}
          machines={machines}
          onClose={() => setDialog(null)}
          onStart={async (machineId) => {
            const ok = await attempt(
              () => startOnMachine(dialogJob, machineId),
              `#${dialogJob.id}: ${getStage(dialogJob.stage).verb.toLowerCase()} started`,
              'The stage wasn’t started.',
            )
            if (ok) setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'qc' && dialogJob && <QcDialog job={dialogJob} onClose={() => setDialog(null)} onSubmit={(result) => void handleQc(result)} />}
      {dialog?.name === 'assign' && dialogJob && (
        <AssignDialog
          job={dialogJob}
          jobs={jobs}
          onClose={() => setDialog(null)}
          onAssign={async (name) => {
            const person = staff.find((member) => member.name === name)
            if (!person) return
            const ok = await attempt(
              () => assignStaff({ order: dialogJob.id, staff: person.uuid }).unwrap(),
              `#${dialogJob.id} assigned to ${name}`,
              'The job wasn’t assigned.',
            )
            if (ok) setDialog(null)
          }}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default OperationsPage
