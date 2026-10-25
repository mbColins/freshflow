import { useEffect, useRef, useState } from 'react'
import { Columns3, Download, Play, RefreshCw, ScanLine, Table2 } from 'lucide-react'
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
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import { EMPTY_OPS_FILTERS, OPS_BRANCH_ID, OPS_PERMISSIONS, STAGES } from '../constants/operations'
import { CURRENT_USER, ORDER_ROLES, STAFF_PERSPECTIVE_USER } from '../constants/orders'
import { SAMPLE_FLOOR_EVENTS, SAMPLE_JOBS } from '../constants/sampleOperations'
import useBranches from '../hooks/useBranches'
import useLocalStorage from '../hooks/useLocalStorage'
import useMachines from '../hooks/useMachines'
import useNow from '../hooks/useNow'
import type { OpsFilters, OpsJob, QcResult, StageId } from '../types/operations'
import type { OrderRole } from '../types/order'
import {
  advanceJob,
  applyQc,
  assignStaff,
  compareJobs,
  formatMinutes,
  getNextAction,
  getStage,
  hasCountMismatch,
  jobsToCsv,
  matchesOpsFilters,
  moveJob,
} from '../utils/operations'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000
// After this long without a refresh the figures are flagged as possibly stale
const STALE_MS = 5 * 60_000

type OpsView = 'table' | 'kanban'
type DialogState = { name: 'machine' | 'qc' | 'assign'; id: string } | { name: 'scan' }

function OperationsPage() {
  const now = useNow()
  const branches = useBranches()
  const allMachines = useMachines()
  // TODO: replace these in-memory lists with the operations API and a live feed
  const [jobs, setJobs] = useState(SAMPLE_JOBS)
  const [events, setEvents] = useState(SAMPLE_FLOOR_EVENTS)
  const [filters, setFilters] = useState<OpsFilters>(EMPTY_OPS_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState(now)
  const [role, setRole] = useLocalStorage<OrderRole>('operations.role', 'manager')
  const [view, setView] = useLocalStorage<OpsView>('operations.view', 'table')
  const searchRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<HTMLElement>(null)

  const permissions = OPS_PERMISSIONS[role]
  const actor = role === 'staff' ? STAFF_PERSPECTIVE_USER : CURRENT_USER
  const branch = branches.find(({ id }) => id === OPS_BRANCH_ID)
  // TODO: only the branch being worked once the operations page is on the API
  const machines = allMachines.filter(({ status }) => status !== 'retired')
  const filtered = jobs.filter((job) => matchesOpsFilters(job, filters, now)).sort(compareJobs)
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const services = [...new Set(jobs.map(({ service }) => service))].sort()
  const openJob = jobs.find(({ id }) => id === openId) ?? null
  const dialogJob = dialog && 'id' in dialog ? jobs.find(({ id }) => id === dialog.id) : undefined
  const stale = now - syncedAt > STALE_MS
  const patchFilters = (patch: Partial<OpsFilters>) => setFilters({ ...filters, ...patch })

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

  // Replaces one job and adds its newest history line to today's timeline
  function commit(next: OpsJob, message: string) {
    setJobs((current) => current.map((job) => (job.id === next.id ? next : job)))
    const [latest] = next.history
    setEvents((current) => [{ ...latest, text: `#${next.id}: ${latest.text}` }, ...current])
    setToast(message)
  }

  function showQueue(patch: Partial<OpsFilters>) {
    setFilters({ ...EMPTY_OPS_FILTERS, ...patch })
    queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleAction(id: string) {
    const job = jobs.find((item) => item.id === id)!
    const action = getNextAction(job)
    if (action.kind === 'notify') {
      commit(
        { ...job, customerNotified: true, history: [{ at: new Date().toISOString(), text: `Customer notified: ready for ${job.method.toLowerCase()}`, by: actor }, ...job.history] },
        `#${job.id} marked as notified. Messaging isn’t connected, so nothing was sent`,
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
    if (action.kind === 'complete' && job.stage === 'packaging' && hasCountMismatch(job)) {
      setOpenId(id)
      setToast(`#${job.id} has an item count mismatch. Resolve it before marking it packaged`)
      return
    }
    const next = advanceJob(job, actor)
    commit(next, `#${job.id}: ${action.label.toLowerCase()} → ${getStage(next.stage).label}${next.active ? ' in progress' : next.stage === 'ready' ? '' : ' queue'}`)
  }

  function handleMove(id: string, stage: StageId) {
    const job = jobs.find((item) => item.id === id)!
    if (job.stage === stage) return
    const from = STAGES.findIndex((item) => item.id === job.stage)
    const to = STAGES.findIndex((item) => item.id === stage)
    const apply = () => commit(moveJob(job, stage, actor), `#${job.id} moved to ${getStage(stage).label}`)
    if (stage !== 'ready' && to === from + 1) {
      apply()
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
      onConfirm: apply,
    })
  }

  function handleQc(result: QcResult) {
    const job = dialogJob!
    commit(applyQc(job, result, actor), result.passed ? `#${job.id} passed quality control` : `#${job.id} failed quality control and was sent back to ${getStage(result.sendTo).label}`)
    setDialog(null)
  }

  const actions: OpsActions = {
    now,
    permissions,
    onOpen: setOpenId,
    onAction: handleAction,
    onAssign: (id) => setDialog({ name: 'assign', id }),
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Laundry Operations</h1>
            <p className="text-xs text-muted">
              Monitor and manage today’s laundry processing{branch ? ` at ${branch.name}` : ''}.
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-center gap-2 text-[11px] text-muted" role="status">
            <span className={`size-2 rounded-full ${stale ? 'bg-warning' : 'bg-success'}`} aria-hidden="true" />
            <span className="font-semibold text-ink">{stale ? 'May be out of date' : 'Up to date'}</span>
            Refreshed {now - syncedAt < 60_000 ? 'just now' : `${formatMinutes((now - syncedAt) / 60_000)} ago`}
            <button
              type="button"
              onClick={() => {
                setSyncedAt(Date.now())
                setToast('Floor data refreshed')
              }}
              className="inline-flex items-center gap-1 rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Refresh
            </button>
          </p>
          <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
            Viewing as
            <select value={role} onChange={(event) => setRole(event.target.value as OrderRole)} className={`${fieldClass} h-8 w-auto!`}>
              {ORDER_ROLES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {role === 'staff' && <MyWork jobs={jobs} name={actor} onScan={() => setDialog({ name: 'scan' })} {...actions} />}

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
        <StaffWorkload jobs={jobs} selected={filters.staff} onSelect={(staff) => showQueue({ staff })} />
      </div>

      <AttentionPanel jobs={jobs} {...actions} />

      <SuppliesPanel machines={machines} now={now} />

      {permissions.analytics && (
        <>
          <OpsAnalytics jobs={jobs} />
          <div className="grid gap-4 lg:grid-cols-2">
            <FloorTimeline events={events} />
            <BranchWorkload branches={branches} currentId={OPS_BRANCH_ID} />
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
          const job = jobs.find((item) => item.id === id)!
          commit(
            { ...job, itemsFound: job.items, history: [{ at: new Date().toISOString(), text: `Recounted: all ${job.items} items found`, by: actor }, ...job.history] },
            `#${job.id} item count resolved`,
          )
        }}
        {...actions}
      />
      {dialog?.name === 'scan' && <ScanDialog jobs={jobs} onClose={() => setDialog(null)} {...actions} />}
      {dialog?.name === 'machine' && dialogJob && (
        <MachineDialog
          job={dialogJob}
          machines={machines}
          onClose={() => setDialog(null)}
          onStart={(machine) => {
            commit(advanceJob(dialogJob, actor, machine), `#${dialogJob.id}: ${getStage(dialogJob.stage).verb.toLowerCase()} started on ${machine}`)
            setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'qc' && dialogJob && <QcDialog job={dialogJob} onClose={() => setDialog(null)} onSubmit={handleQc} />}
      {dialog?.name === 'assign' && dialogJob && (
        <AssignDialog
          job={dialogJob}
          jobs={jobs}
          onClose={() => setDialog(null)}
          onAssign={(staff) => {
            commit(assignStaff(dialogJob, staff, actor), `#${dialogJob.id} assigned to ${staff}`)
            setDialog(null)
          }}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default OperationsPage
