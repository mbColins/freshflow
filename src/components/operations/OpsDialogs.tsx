import { useState } from 'react'
import { ScanLine, TriangleAlert, UserPlus } from 'lucide-react'
import { QC_CHECKLIST } from '../../constants/operations'
import useStaff from '../../hooks/useStaff'
import type { Machine } from '../../types/machine'
import type { OpsJob, QcResult } from '../../types/operations'
import { formatDate } from '../../utils/customers'
import {
  getNextAction,
  getStage,
  getStaffLoad,
  hasCountMismatch,
  recommendStaff,
} from '../../utils/operations'
import { formatTime } from '../../utils/orders'
import { MachineStatusBadge } from '../machines/MachineBits'
import {
  dangerButton,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'
import { ActionButton, DueLabel, JobFlags, StageState } from './OpsQueue'
import type { OpsActions } from './OpsQueue'

function Instructions({ job }: { job: OpsJob }) {
  if (job.instructions.length === 0) return null
  return (
    <ul className="space-y-0.5 rounded-lg bg-warning/15 px-3 py-2 text-xs font-semibold text-ink">
      {job.instructions.map((line) => (
        <li key={line} className="flex items-start gap-1.5">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
          {line}
        </li>
      ))}
    </ul>
  )
}

// ---------- Job drawer ----------

export function JobDrawer({
  job,
  onClose,
  onRecount,
  ...actions
}: {
  job: OpsJob | null
  onClose: () => void
  onRecount: (id: string) => void
} & OpsActions) {
  if (!job) return null
  const { now, permissions, onAssign } = actions
  const stage = getStage(job.stage)
  const details: [string, string][] = [
    ['Customer', job.customer],
    ['Service', job.service],
    ['Hand-over', job.method === 'Pickup' ? 'Customer pickup' : 'Home delivery'],
    ['Assigned staff', job.staff || 'Unassigned'],
    ['Machine', job.machine || '—'],
    ['Initial weight', `${job.weightKg} kg`],
    ['Post-wash weight', job.postWashKg === null ? 'Not recorded yet' : `${job.postWashKg} kg (${(job.postWashKg - job.weightKg).toFixed(1)} kg)`],
  ]
  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      title={`Order #${job.id}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{stage.label}</span>
          <JobFlags job={job} now={now} />
          <DueLabel job={job} now={now} />
        </span>
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-field p-3">
          <p className={sectionTitle}>Now</p>
          <div className="mt-2"><StageState job={job} now={now} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton job={job} {...actions} className="h-9!" />
            {permissions.manage && job.stage !== 'ready' && (
              <button type="button" onClick={() => onAssign(job.id)} className={secondaryButton}>
                <UserPlus className="size-4 text-muted" aria-hidden="true" />
                {job.staff ? 'Reassign' : 'Assign Staff'}
              </button>
            )}
          </div>
        </div>

        <Instructions job={job} />

        <div className={`rounded-lg px-3 py-2 text-xs ${hasCountMismatch(job) ? 'bg-danger/10' : 'bg-field'}`}>
          <p className={sectionTitle}>Item count</p>
          <p className="mt-1 text-ink">
            Expected <span className="font-bold tabular-nums">{job.items}</span> · counted <span className="font-bold tabular-nums">{job.itemsFound}</span>
          </p>
          {hasCountMismatch(job) && (
            <>
              <p className="mt-1 font-semibold text-danger">
                Item count mismatch: {job.items - job.itemsFound} missing. Find it before this order is packaged.
              </p>
              {permissions.process && (
                <button type="button" onClick={() => onRecount(job.id)} className={`${secondaryButton} mt-2 h-8`}>
                  Recounted: all {job.items} items found
                </button>
              )}
            </>
          )}
        </div>

        <dl className="divide-y divide-line text-xs">
          {details.map(([label, value]) => (
            <div key={label} className="flex gap-3 py-1.5">
              <dt className="w-32 shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className={sectionTitle}>Traceability</p>
          <ol className="mt-2 space-y-3 border-l border-line pl-4">
            {job.history.map((event, index) => (
              <li key={`${event.at}-${index}`} className="relative text-xs">
                <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden="true" />
                <p className="font-semibold text-ink">{event.text}</p>
                <p className="text-[11px] text-muted">{event.by} · {formatDate(event.at)}, {formatTime(event.at)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Choose a machine before starting ----------

export function MachineDialog({
  job,
  machines,
  onClose,
  onStart,
}: {
  job: OpsJob
  machines: Machine[]
  onClose: () => void
  // Receives the machine's uuid
  onStart: (machineId: string) => void
}) {
  const stage = getStage(job.stage)
  const options = machines
    .filter((machine) => machine.type === stage.machineType)
    .sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available') || a.id.localeCompare(b.id))
  const free = options.filter((machine) => machine.status === 'available' && machine.specs.capacityKg >= job.weightKg)
  const [machineId, setMachineId] = useState(free[0]?.id ?? '')
  const chosen = options.find(({ id }) => id === machineId)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Start ${stage.verb}: #${job.id}`}
      subtitle={`${job.customer} · ${job.service} · ${job.weightKg} kg`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!chosen} onClick={() => onStart(chosen!.uuid)} className={primaryButton}>
            Start {stage.verb}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Instructions job={job} />
        <p className={sectionTitle}>Choose a {stage.machineType?.toLowerCase()}</p>
        {free.length === 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink">
            No {stage.machineType?.toLowerCase()} is free and big enough right now. The load stays in the queue until one finishes.
          </p>
        )}
        <ul role="radiogroup" aria-label="Machine" className="space-y-1.5">
          {options.map((machine) => {
            const usable = free.includes(machine)
            const selected = machine.id === machineId
            return (
              <li key={machine.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!usable}
                  onClick={() => setMachineId(machine.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{machine.name}</span>
                    <span className="block text-[11px] text-muted">
                      {machine.specs.capacityKg} kg capacity
                      {machine.job && ` · busy for ${machine.job.remainingMin} more min`}
                      {machine.specs.capacityKg < job.weightKg && ' · too small for this load'}
                    </span>
                  </span>
                  <MachineStatusBadge status={machine.status} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}

// ---------- Quality inspection ----------

export function QcDialog({ job, onClose, onSubmit }: { job: OpsJob; onClose: () => void; onSubmit: (result: QcResult) => void }) {
  const [checked, setChecked] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [sendTo, setSendTo] = useState<'washing' | 'ironing'>('washing')
  const allPassed = checked.length === QC_CHECKLIST.length
  const mismatch = hasCountMismatch(job)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Quality inspection: #${job.id}`}
      subtitle={`${job.customer} · ${job.service} · ${job.items} items`}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${secondaryButton} mr-auto`}>
            Cancel
          </button>
          <button type="button" disabled={allPassed || !reason.trim()} onClick={() => onSubmit({ passed: false, reason: reason.trim(), sendTo })} className={dangerButton}>
            Fail and Send Back
          </button>
          <button type="button" disabled={!allPassed || mismatch} onClick={() => onSubmit({ passed: true })} className={primaryButton}>
            Pass to Packaging
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Instructions job={job} />
        {mismatch && (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            Item count mismatch: {job.itemsFound} of {job.items} items counted. Resolve it in the job details before passing.
          </p>
        )}
        <fieldset>
          <legend className={sectionTitle}>Checklist</legend>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {QC_CHECKLIST.map((item) => (
              <li key={item}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={checked.includes(item)}
                    onChange={(event) => setChecked(event.target.checked ? [...checked, item] : checked.filter((current) => current !== item))}
                    className="size-4 accent-brand"
                  />
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {!allPassed && (
          <div className="grid gap-3 rounded-lg bg-field p-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="qc-reason" className={labelClass}>If it fails: what is wrong?</label>
              <input id="qc-reason" placeholder="e.g. Stain still visible on shirt" value={reason} onChange={(event) => setReason(event.target.value)} className={`${fieldClass} bg-white`} />
            </div>
            <div>
              <label htmlFor="qc-send" className={labelClass}>Send back to</label>
              <select id="qc-send" value={sendTo} onChange={(event) => setSendTo(event.target.value as 'washing' | 'ironing')} className={`${fieldClass} bg-white`}>
                <option value="washing">Washing</option>
                <option value="ironing">Ironing / Folding</option>
              </select>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted">
          {allPassed ? 'Every check is ticked: the order can go to packaging.' : `${checked.length} of ${QC_CHECKLIST.length} checks ticked. Tick them all to pass, or give a reason to send it back.`}
        </p>
      </div>
    </Modal>
  )
}

// ---------- Assign staff ----------

export function AssignDialog({ job, jobs, onClose, onAssign }: { job: OpsJob; jobs: OpsJob[]; onClose: () => void; onAssign: (staff: string) => void }) {
  const names = useStaff().map(({ name }) => name)
  const loads = getStaffLoad(jobs, names).sort((a, b) => a.activeJobs - b.activeJobs)
  const best = recommendStaff(jobs, names)
  // Start on the least busy person who doesn't already have the job
  const [staff, setStaff] = useState(loads.find(({ name }) => name !== job.staff)?.name ?? names[0] ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign staff: #${job.id}`}
      subtitle={`${getStage(job.stage).label} · currently ${job.staff || 'unassigned'}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={staff === job.staff} onClick={() => onAssign(staff)} className={primaryButton}>
            Assign
          </button>
        </>
      }
    >
      <p className="mb-2 text-xs text-muted">{best ? `${best.name} has the lowest current workload.` : 'No staff to assign.'}</p>
      <ul role="radiogroup" aria-label="Staff" className="space-y-1.5">
        {loads.map(({ name, activeJobs, load, stage }) => {
          const selected = staff === name
          return (
            <li key={name}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStaff(name)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${selected ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{name}</span>
                  {name === best.name && <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">Lowest workload</span>}
                  {name === job.staff && <span className="ml-2 text-[10px] text-muted">current</span>}
                  <span className="block text-[11px] text-muted">{activeJobs} active jobs · {stage}</span>
                </span>
                <span className="w-10 text-right font-semibold text-ink tabular-nums">{load}%</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

// ---------- Scan an order ----------

export function ScanDialog({ jobs, onClose, ...actions }: { jobs: OpsJob[]; onClose: () => void } & OpsActions) {
  const { now, onOpen } = actions
  const [code, setCode] = useState('')
  const digits = code.replace(/\D/g, '')
  const job = digits.length >= 3 ? jobs.find(({ id }) => id.replace(/\D/g, '').endsWith(digits)) : undefined
  return (
    <Modal
      open
      onClose={onClose}
      title="Scan Order"
      subtitle="Scan the tag with a barcode reader, or type the order number."
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Done
        </button>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            autoFocus
            aria-label="Order number"
            placeholder="ORD-10452"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={`${fieldClass} h-12 pl-10 font-mono text-base`}
          />
        </div>
        {digits.length < 3 ? (
          <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">Waiting for a scan. A barcode reader types the number here.</p>
        ) : !job ? (
          <p className="rounded-lg bg-danger/10 px-3 py-4 text-center text-xs font-semibold text-danger" role="alert">
            No job on the floor matches “{code}”.
          </p>
        ) : (
          <div className="space-y-3 rounded-lg p-3 ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-brand">#{job.id}</p>
                <p className="text-xs font-semibold text-ink">{job.customer}</p>
                <p className="text-[11px] text-muted">{job.items} items · {job.service} · {job.weightKg} kg · {job.staff || 'Unassigned'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted uppercase">Current stage</p>
                <p className="text-sm font-extrabold text-ink">{getStage(job.stage).label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1"><JobFlags job={job} now={now} /></div>
            <StageState job={job} now={now} />
            <Instructions job={job} />
            <p className="text-[11px] text-muted">Next: <span className="font-semibold text-ink">{getNextAction(job).label}</span></p>
            <div className="flex flex-wrap gap-2">
              <ActionButton job={job} {...actions} className="h-11! flex-1 text-sm" />
              <button type="button" onClick={() => onOpen(job.id)} className={`${secondaryButton} h-11`}>
                Details
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
