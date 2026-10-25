import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react'
import {
  FAULT_TYPES,
  MACHINE_TYPES,
  MAINTENANCE_TYPES,
  MAX_COMPARE_MACHINES,
  MIN_COMPARE_MACHINES,
  SEVERITIES,
  TECHNICIANS,
} from '../../constants/machines'
import type { MachinePermissions } from '../../constants/machines'
import useCurrentUser from '../../hooks/useCurrentUser'
import useMachineActions from '../../hooks/useMachineActions'
import useMachines from '../../hooks/useMachines'
import useNow from '../../hooks/useNow'
import { useCreateMachineMutation, useUpdateMachineMutation } from '../../services/machineApi'
import type { Machine, MachineProfile } from '../../types/machine'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { toMachineRequest } from '../../utils/machineMapping'
import {
  COMPARE_MACHINE_METRICS,
  emptyProfile,
  formatRuntime,
  getTypeForService,
  nextMachineId,
  recommendMachines,
  toProfile,
} from '../../utils/machines'
import type { FaultInput, JobInput, MaintenanceInput } from '../../utils/machines'
import { formatDay, toDateKey } from '../../utils/promotions'
import {
  dangerButton,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'
import { MachineStatusBadge } from './MachineBits'
import MachineWizard from './MachineWizard'
import type { MachineDialogName } from './MachinesListParts'
import FormField from '../ui/FormField'

// The signed-in person's name, for "reported by" lines
function CurrentUserName() {
  return <>{useCurrentUser().name || 'you'}</>
}

function Options({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </>
  )
}

// ---------- Report fault ----------

function FaultDialog({ machine, onClose, onSubmit }: { machine: Machine; onClose: () => void; onSubmit: (input: FaultInput) => void }) {
  const { register, handleSubmit, control } = useForm<FaultInput>({
    defaultValues: { type: FAULT_TYPES[0], severity: 'Medium', description: '', technician: '', downtimeMin: 60 },
  })
  const [severity, description] = useWatch({ control, name: ['severity', 'description'] })
  const stops = severity === 'Critical' || severity === 'High'
  return (
    <Modal
      open
      onClose={onClose}
      title="Report Machine Fault"
      subtitle={`${machine.name} · ${machine.id}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="fault-form" disabled={!description.trim()} className={dangerButton}>
            Report Fault
          </button>
        </>
      }
    >
      <form
        id="fault-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={handleSubmit((input) => onSubmit({ ...input, description: input.description.trim() }))}
      >
        <FormField label="Fault type" htmlFor="fault-type">
          <select id="fault-type" {...register('type')} className={fieldClass}>
            <Options items={FAULT_TYPES} />
          </select>
        </FormField>
        <FormField label="Severity" htmlFor="fault-severity">
          <select id="fault-severity" {...register('severity')} className={fieldClass}>
            <Options items={SEVERITIES.map(({ value }) => value)} />
          </select>
        </FormField>
        <FormField label="What is the machine doing?" htmlFor="fault-description" wide>
          <textarea id="fault-description" rows={3} placeholder="Symptoms, error code, noise, leak..." {...register('description', { validate: (value) => value.trim() !== '' })} className={`${fieldClass} h-auto py-2`} />
        </FormField>
        <FormField label="Assign technician" htmlFor="fault-technician">
          <select id="fault-technician" {...register('technician')} className={fieldClass}>
            <option value="">Not assigned yet</option>
            <Options items={TECHNICIANS} />
          </select>
        </FormField>
        <FormField label="Estimated downtime (minutes)" htmlFor="fault-downtime">
          <input id="fault-downtime" type="number" min={0} step={15} {...register('downtimeMin', { setValueAs: (value) => Math.max(0, Number(value)) })} className={fieldClass} />
        </FormField>
        <p className="text-[11px] text-muted sm:col-span-2">Reported by <CurrentUserName />, now.</p>
        {stops ? (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink sm:col-span-2" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            <span>
              A {severity.toLowerCase()} fault takes the machine out of service: it is set to Fault and no new jobs can be assigned.
              {machine.job && ` Order #${machine.job.orderId} is taken off the machine and must be moved to another one.`}
            </span>
          </p>
        ) : (
          <p className="rounded-lg bg-field px-3 py-2 text-xs text-muted sm:col-span-2">
            A {severity.toLowerCase()} fault is logged for the technician; the machine stays in service.
          </p>
        )}
      </form>
    </Modal>
  )
}

// ---------- Schedule maintenance ----------

function MaintenanceDialog({ machine, now, onClose, onSubmit }: { machine: Machine; now: number; onClose: () => void; onSubmit: (input: MaintenanceInput) => void }) {
  const today = toDateKey(now)
  const { register, handleSubmit, control } = useForm<MaintenanceInput>({
    defaultValues: { date: today, time: '09:00', type: MAINTENANCE_TYPES[1], technician: machine.technician || TECHNICIANS[0], durationMin: 90, cost: 25_000, description: '' },
  })
  const date = useWatch({ control, name: 'date' })
  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule Maintenance"
      subtitle={`${machine.name} · ${machine.id} · serviced every ${machine.maintenanceEveryDays} days`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="maintenance-form" disabled={!date || date < today} className={primaryButton}>
            Schedule Maintenance
          </button>
        </>
      }
    >
      <form
        id="maintenance-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={handleSubmit((input) => onSubmit({ ...input, description: input.description.trim() || input.type }))}
      >
        <FormField label="Maintenance type" htmlFor="maintenance-type">
          <select id="maintenance-type" {...register('type')} className={fieldClass}>
            <Options items={MAINTENANCE_TYPES} />
          </select>
        </FormField>
        <FormField label="Technician" htmlFor="maintenance-technician">
          <select id="maintenance-technician" {...register('technician')} className={fieldClass}>
            <Options items={TECHNICIANS} />
          </select>
        </FormField>
        <FormField label="Date" htmlFor="maintenance-date">
          <input id="maintenance-date" type="date" min={today} {...register('date', { validate: (value) => value !== '' && value >= today })} className={fieldClass} />
        </FormField>
        <FormField label="Start time" htmlFor="maintenance-time">
          <input id="maintenance-time" type="time" {...register('time')} className={fieldClass} />
        </FormField>
        <FormField label="Expected duration (minutes)" htmlFor="maintenance-duration">
          <input id="maintenance-duration" type="number" min={15} step={15} {...register('durationMin', { setValueAs: (value) => Math.max(15, Number(value)) })} className={fieldClass} />
        </FormField>
        <FormField label="Estimated cost (XAF)" htmlFor="maintenance-cost">
          <input id="maintenance-cost" type="number" min={0} step={500} {...register('cost', { setValueAs: (value) => Math.max(0, Number(value)) })} className={fieldClass} />
        </FormField>
        <FormField label="Notes" htmlFor="maintenance-notes" wide>
          <textarea id="maintenance-notes" rows={2} {...register('description')} className={`${fieldClass} h-auto py-2`} />
        </FormField>
        {machine.queue.length > 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink sm:col-span-2">
            {machine.queue.length} queued {machine.queue.length === 1 ? 'job is' : 'jobs are'} waiting on this machine. Plan the service around them or move them first.
          </p>
        )}
      </form>
    </Modal>
  )
}

// ---------- Assign a job ----------

function AssignJobDialog({
  machines,
  preferredId,
  branchName,
  onClose,
  onSubmit,
}: {
  machines: Machine[]
  preferredId: string
  branchName: (id: string) => string
  onClose: () => void
  onSubmit: (machineId: string, input: JobInput) => void
}) {
  const preferred = machines.find(({ id }) => id === preferredId)!
  const services = MACHINE_TYPES.find(({ value }) => value === preferred.type)!.services
  const [input, setInput] = useState<JobInput>({ orderId: '', customer: '', service: services[0] ?? '', loadKg: Math.round(preferred.specs.capacityKg * 0.5), priority: 'Normal' })
  const [machineId, setMachineId] = useState(preferredId)
  const patch = (change: Partial<JobInput>) => setInput({ ...input, ...change })
  const type = getTypeForService(input.service) ?? preferred.type
  const options = recommendMachines(machines, type, input.loadKg, preferred.branchId)
  const chosen = options.find(({ machine }) => machine.id === machineId)
  const orderId = input.orderId.trim().toUpperCase()

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Assign Machine"
      subtitle={`Compatible ${type.toLowerCase()}s at ${branchName(preferred.branchId)}, soonest start first.`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!orderId || !chosen} onClick={() => onSubmit(machineId, { ...input, orderId, customer: input.customer.trim() || 'Walk-in customer' })} className={primaryButton}>
            {chosen?.machine.job ? 'Add to Queue' : 'Assign and Start'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <FormField label="Order" htmlFor="assign-order">
            <input id="assign-order" autoComplete="off" placeholder="ORD-10542" value={input.orderId} onChange={(event) => patch({ orderId: event.target.value })} className={`${fieldClass} font-mono`} />
          </FormField>
          <FormField label="Customer" htmlFor="assign-customer">
            <input id="assign-customer" autoComplete="off" value={input.customer} onChange={(event) => patch({ customer: event.target.value })} className={fieldClass} />
          </FormField>
          <FormField label="Service" htmlFor="assign-service">
            <select id="assign-service" value={input.service} onChange={(event) => patch({ service: event.target.value })} className={fieldClass}>
              <Options items={services} />
            </select>
          </FormField>
          <FormField label="Load (kg)" htmlFor="assign-load">
            <input id="assign-load" type="number" min={0.5} step={0.5} value={input.loadKg} onChange={(event) => patch({ loadKg: Math.max(0.5, Number(event.target.value)) })} className={fieldClass} />
          </FormField>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-ink">
          <input type="checkbox" checked={input.priority === 'High'} onChange={(event) => patch({ priority: event.target.checked ? 'High' : 'Normal' })} className="size-4 accent-brand" />
          High priority: goes to the front of the queue
        </label>
        <div>
          <p className={sectionTitle}>Recommended machines</p>
          {options.length === 0 ? (
            <p className="mt-2 rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
              No {type.toLowerCase()} in service at this branch can take {input.loadKg} kg.
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Machine" className="mt-2 space-y-1.5">
              {options.map(({ machine, waitMin }, index) => {
                const selected = machine.id === machineId
                return (
                  <li key={machine.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMachineId(machine.id)}
                      className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                        selected ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-bold text-ink">{machine.name}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-muted">{machine.id}</span>
                        {index === 0 && <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">Best match</span>}
                        <span className="block text-[11px] text-muted">
                          {machine.specs.capacityKg} kg capacity · {machine.utilization}% utilization · {machine.queue.length} queued
                        </span>
                      </span>
                      <MachineStatusBadge status={machine.status} />
                      <span className="w-24 text-right font-semibold text-ink tabular-nums">
                        {waitMin === 0 ? 'Starts now' : `In ${formatRuntime(waitMin)}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------- Transfer ----------

function TransferDialog({
  machine,
  branches,
  now,
  onClose,
  onSubmit,
}: {
  machine: Machine
  branches: { id: string; name: string }[]
  now: number
  onClose: () => void
  onSubmit: (branchId: string, reason: string) => void
}) {
  const others = branches.filter(({ id }) => id !== machine.branchId)
  const [branchId, setBranchId] = useState(others[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const busy = machine.job !== null || machine.queue.length > 0
  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer Machine"
      subtitle={`${machine.name} · ${machine.id}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={busy || !branchId || !reason.trim() || !confirmed} onClick={() => onSubmit(branchId, reason.trim())} className={primaryButton}>
            Transfer Machine
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Current branch" htmlFor="transfer-from">
          <input id="transfer-from" disabled value={branches.find(({ id }) => id === machine.branchId)?.name ?? machine.branchId} className={`${fieldClass} disabled:opacity-60`} />
        </FormField>
        <FormField label="Destination branch" htmlFor="transfer-to">
          <select id="transfer-to" value={branchId} onChange={(event) => setBranchId(event.target.value)} className={fieldClass}>
            {others.map(({ id, name }) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Reason" htmlFor="transfer-reason" wide>
          <input id="transfer-reason" placeholder="e.g. Rebalancing dryer capacity" value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} />
        </FormField>
        <p className="text-[11px] text-muted sm:col-span-2">
          Transfer date {formatDay(toDateKey(now), true)} · responsible: <CurrentUserName />. The move is kept in the machine’s transfer history.
        </p>
        {busy ? (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink sm:col-span-2" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            This machine has a running or queued job. Finish or move its work before transferring it.
          </p>
        ) : (
          <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-ink sm:col-span-2">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-brand" />
            I confirm the machine is physically moving and should leave this branch’s floor plan.
          </label>
        )}
      </div>
    </Modal>
  )
}

// ---------- Retire ----------

function RetireDialog({ machine, onClose, onSubmit }: { machine: Machine; onClose: () => void; onSubmit: (reason: string, condition: string) => void }) {
  const [reason, setReason] = useState('')
  const [condition, setCondition] = useState('Working')
  const busy = machine.job !== null
  return (
    <Modal
      open
      onClose={onClose}
      title="Retire Machine"
      subtitle={`${machine.name} · ${machine.id} · ${machine.totalCycles.toLocaleString('en-US')} cycles on record`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Keep in service
          </button>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim(), condition)} className={dangerButton}>
            Retire Machine
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Retirement reason" htmlFor="retire-reason" wide>
          <input id="retire-reason" placeholder="e.g. Beyond economical repair" value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} />
        </FormField>
        <FormField label="Final condition" htmlFor="retire-condition">
          <select id="retire-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className={fieldClass}>
            <Options items={['Working', 'Needs repair', 'Not working', 'Scrapped']} />
          </select>
        </FormField>
        <p className="rounded-lg bg-field px-3 py-2 text-xs text-muted sm:col-span-2">
          The machine is removed from job assignment and scheduling.
          {machine.queue.length > 0 && ` Its ${machine.queue.length} queued ${machine.queue.length === 1 ? 'job is' : 'jobs are'} cleared and must be reassigned.`}{' '}
          Its history, costs and maintenance records are kept for reporting. Retired machines are not deleted.
        </p>
        {busy && (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink sm:col-span-2" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            This machine is running order #{machine.job!.orderId}. Wait for the cycle to finish first.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Compare ----------

function CompareDialog({ machines, showCosts, onClose }: { machines: Machine[]; showCosts: boolean; onClose: () => void }) {
  const active = machines.filter(({ status }) => status !== 'retired')
  const [type, setType] = useState(active[0]?.type ?? 'Washing Machine')
  const pool = active.filter((machine) => machine.type === type)
  const [selectedIds, setSelectedIds] = useState(() => pool.slice(0, 3).map(({ id }) => id))
  const selected = pool.filter(({ id }) => selectedIds.includes(id))
  const metrics = COMPARE_MACHINE_METRICS.filter(({ financial }) => !financial || showCosts)
  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Compare Machines"
      subtitle={`Select ${MIN_COMPARE_MACHINES}–${MAX_COMPARE_MACHINES} machines of the same type. ${selected.length} selected.`}
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Done
        </button>
      }
    >
      <div className="max-w-xs">
        <label htmlFor="compare-type" className={labelClass}>Machine type</label>
        <select
          id="compare-type"
          value={type}
          onChange={(event) => {
            const next = event.target.value as Machine['type']
            setType(next)
            setSelectedIds(active.filter((machine) => machine.type === next).slice(0, 3).map(({ id }) => id))
          }}
          className={fieldClass}
        >
          <Options items={[...new Set(active.map((machine) => machine.type))]} />
        </select>
      </div>
      <ul className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {pool.map((machine) => {
          const checked = selectedIds.includes(machine.id)
          return (
            <li key={machine.id}>
              <button
                type="button"
                aria-pressed={checked}
                disabled={!checked && selectedIds.length >= MAX_COMPARE_MACHINES}
                onClick={() => setSelectedIds(checked ? selectedIds.filter((id) => id !== machine.id) : [...selectedIds, machine.id])}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                  checked ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-line'
                }`}
              >
                {machine.id}
              </button>
            </li>
          )
        })}
      </ul>
      {selected.length < MIN_COMPARE_MACHINES ? (
        <p className="mt-4 rounded-lg bg-field px-3 py-8 text-center text-xs text-muted">Select at least {MIN_COMPARE_MACHINES} machines to compare.</p>
      ) : (
        <>
          <div className="relative mt-4 overflow-x-auto rounded-lg ring-1 ring-line">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Metric</th>
                  {selected.map((machine) => (
                    <th key={machine.id} scope="col" className="px-3 py-2 text-right font-bold text-ink">
                      {machine.name}
                      <span className="block font-mono text-[10px] font-normal text-muted">{machine.id}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map(({ label, get, format, higherIsBetter }) => {
                  const values = selected.map(get)
                  const [low, high] = [Math.min(...values), Math.max(...values)]
                  const [best, worst] = higherIsBetter ? [high, low] : [low, high]
                  return (
                    <tr key={label}>
                      <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-ink">{label}</th>
                      {values.map((value, index) => {
                        const isBest = low !== high && value === best
                        const isWorst = low !== high && value === worst
                        return (
                          <td key={selected[index].id} className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${isBest ? 'bg-success/10 font-bold text-success' : isWorst ? 'bg-danger/10 font-bold text-danger' : 'text-ink'}`}>
                            <span className="inline-flex items-center gap-1">
                              {isBest && <ArrowUp className="size-3" aria-label="Strongest" />}
                              {isWorst && <ArrowDown className="size-3" aria-label="Weakest" />}
                              {format(value)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1 text-success"><ArrowUp className="size-3" aria-hidden="true" /> Strongest in the row</span>
            <span className="inline-flex items-center gap-1 text-danger"><ArrowDown className="size-3" aria-hidden="true" /> Weakest in the row</span>
            <span>For downtime, energy, water, faults and cost, lower is stronger.</span>
          </p>
        </>
      )}
    </Modal>
  )
}

// ---------- Host shared by the list and detail pages ----------

export type MachineDialogState =
  | { name: MachineDialogName; machineId: string }
  | { name: 'add' }
  | { name: 'compare' }

export function MachineDialogHost({
  dialog,
  branches,
  permissions,
  onClose,
  onToast,
}: {
  dialog: MachineDialogState | null
  branches: { id: string; name: string }[]
  permissions: MachinePermissions
  onClose: () => void
  onToast: (message: string) => void
}) {
  const machines = useMachines()
  const now = useNow()
  const actions = useMachineActions()
  const [createMachine] = useCreateMachineMutation()
  const [updateMachine] = useUpdateMachineMutation()
  if (!dialog) return null
  const failure = (error: unknown, rejected: string) =>
    serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected) ?? NETWORK_ERROR_MESSAGE
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? id
  const done = (message: string) => {
    onToast(message)
    onClose()
  }

  if (dialog.name === 'compare') return <CompareDialog machines={machines} showCosts={permissions.financials} onClose={onClose} />

  if (dialog.name === 'add') {
    return (
      <MachineWizard
        mode="create"
        initial={emptyProfile(nextMachineId('Washing Machine', machines), branches[0]?.id ?? '')}
        takenIds={machines.map(({ id }) => id)}
        branches={branches}
        onClose={onClose}
        onSave={async (profile: MachineProfile) => {
          try {
            await createMachine(toMachineRequest(profile, true)).unwrap()
            done(`${profile.name} registered as ${profile.id}`)
          } catch (error) {
            onToast(failure(error, `Couldn’t register ${profile.name}.`))
          }
        }}
      />
    )
  }

  const machine = machines.find(({ id }) => id === dialog.machineId)
  if (!machine) return null
  // Runs a call on the server; the dialog closes only when it was accepted
  const attempt = async (call: () => Promise<unknown>, message: string, fallback: string) => {
    try {
      await call()
      done(message)
    } catch (error) {
      onToast(failure(error, fallback))
    }
  }

  switch (dialog.name) {
    case 'edit':
      return (
        <MachineWizard
          mode="edit"
          initial={toProfile(machine)}
          takenIds={[]}
          branches={branches}
          onClose={onClose}
          onSave={async (profile) => {
            try {
              await updateMachine({ id: machine.uuid, changes: toMachineRequest(profile, false) }).unwrap()
              done(`${profile.name} updated`)
            } catch (error) {
              onToast(failure(error, `Couldn’t update ${profile.name}.`))
            }
          }}
        />
      )
    case 'fault':
      return (
        <FaultDialog
          machine={machine}
          onClose={onClose}
          onSubmit={(input) =>
            void attempt(
              () =>
                actions.reportFault(machine.uuid, {
                  type: input.type,
                  severity: input.severity.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
                  description: input.description,
                  technician: input.technician || undefined,
                  downtimeMin: input.downtimeMin,
                }),
              input.severity === 'Critical' || input.severity === 'High' ? `${machine.name} taken out of service` : `Fault logged for ${machine.name}`,
              'The fault wasn’t reported.',
            )
          }
        />
      )
    case 'maintenance':
      return (
        <MaintenanceDialog
          machine={machine}
          now={now}
          onClose={onClose}
          onSubmit={(input) =>
            void attempt(
              () => actions.scheduleMaintenance(machine.uuid, input),
              `${input.type} scheduled for ${machine.name} on ${formatDay(input.date, true)}`,
              'The maintenance wasn’t scheduled.',
            )
          }
        />
      )
    case 'assign':
      return (
        <AssignJobDialog
          machines={machines}
          preferredId={machine.id}
          branchName={branchName}
          onClose={onClose}
          onSubmit={(machineId, input) => {
            const target = machines.find(({ id }) => id === machineId)
            if (!target) return
            void attempt(
              () =>
                actions.assignJob(target.uuid, {
                  order: input.orderId,
                  service: input.service,
                  loadKg: input.loadKg,
                  priority: input.priority === 'High' ? 'HIGH' : 'NORMAL',
                }),
              target.job ? `${input.orderId} queued on ${target.name}` : `${input.orderId} started on ${target.name}`,
              'The job wasn’t assigned.',
            )
          }}
        />
      )
    case 'transfer':
      return (
        <TransferDialog
          machine={machine}
          branches={branches}
          now={now}
          onClose={onClose}
          onSubmit={(branchId, reason) =>
            void attempt(
              () => actions.transfer(machine.uuid, branchId, reason),
              `${machine.name} transferred to ${branchName(branchId)}`,
              'The machine wasn’t transferred.',
            )
          }
        />
      )
    case 'retire':
      return (
        <RetireDialog
          machine={machine}
          onClose={onClose}
          onSubmit={(reason, condition) =>
            void attempt(() => actions.retire(machine.uuid, reason, condition), `${machine.name} retired`, 'The machine wasn’t retired.')
          }
        />
      )
  }
}
