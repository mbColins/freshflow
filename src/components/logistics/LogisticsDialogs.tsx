import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp, Sparkles, X } from 'lucide-react'
import { DEPOT, PRIORITIES, ZONES } from '../../constants/logistics'
import type {
  DispatchJob,
  Driver,
  JobPriority,
  JobType,
} from '../../types/logistics'
import { formatXaf } from '../../utils/orders'
import {
  estimateFee,
  formatClock,
  formatMinutes,
  getRouteSummary,
  optimizeStops,
} from '../../utils/logistics'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'
import { JobPriorityBadge, JobTypeIcon } from './LogisticsBits'
import { toLocalInput } from '../../utils/dates'

const assignable = (driver: Driver) => driver.status !== 'offline'

// ---------- Assign driver ----------

export function AssignDialog({
  candidates,
  drivers,
  initialJobIds,
  initialDriverId,
  onClose,
  onAssign,
}: {
  // Open jobs that can take a driver
  candidates: DispatchJob[]
  drivers: Driver[]
  initialJobIds: string[]
  initialDriverId: string
  onClose: () => void
  onAssign: (jobIds: string[], driverId: string) => void
}) {
  const [jobIds, setJobIds] = useState(initialJobIds)
  const [driverId, setDriverId] = useState(
    initialDriverId || drivers.find(({ status }) => status === 'available')?.id || '',
  )

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign Driver"
      subtitle="Choose a driver and the jobs to put on their manifest."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!driverId || jobIds.length === 0}
            onClick={() => onAssign(jobIds, driverId)}
            className={primaryButton}
          >
            Assign {jobIds.length} {jobIds.length === 1 ? 'job' : 'jobs'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="assign-driver" className={labelClass}>
            Driver
          </label>
          <select
            id="assign-driver"
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose a driver…</option>
            {drivers.filter(assignable).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} · {driver.vehicle.split(' · ')[0]} ·{' '}
                {driver.status === 'available'
                  ? 'available'
                  : driver.status === 'break'
                    ? 'on break'
                    : `${driver.stopsTotal - driver.stopsDone} stops left`}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className={sectionTitle}>Jobs</legend>
          {candidates.length === 0 ? (
            <p className="mt-2 rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
              No open jobs to assign.
            </p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {candidates.map((job) => (
                <li key={job.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-field px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={jobIds.includes(job.id)}
                      onChange={() =>
                        setJobIds(
                          jobIds.includes(job.id)
                            ? jobIds.filter((id) => id !== job.id)
                            : [...jobIds, job.id],
                        )
                      }
                      className="size-4 accent-brand"
                    />
                    <JobTypeIcon job={job} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">
                        {job.id} · {job.customer}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {job.zone} · {formatClock(job.scheduledAt)}
                      </span>
                    </span>
                    <JobPriorityBadge job={job} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </Modal>
  )
}

// ---------- Schedule pickup / delivery ----------

export type NewJobInput = {
  type: JobType
  orderId: string
  customer: string
  phone: string
  address: string
  zone: string
  manifest: string
  priority: JobPriority
  scheduledAt: string
  driverId: string | null
  instructions: string
}

// Form state: the date stays in datetime-local format until submit
type ScheduleValues = Omit<NewJobInput, 'scheduledAt' | 'driverId'> & {
  when: string
  driverId: string
}

type TextField = 'orderId' | 'customer' | 'phone' | 'address' | 'manifest' | 'instructions'

export function ScheduleDialog({
  drivers,
  onClose,
  onCreate,
}: {
  drivers: Driver[]
  onClose: () => void
  onCreate: (input: NewJobInput) => void
}) {
  // Lazy so the default time is read once, not on every render
  const [defaultWhen] = useState(() => toLocalInput(Date.now() + 2 * 3_600_000))
  const { register, handleSubmit, control } = useForm<ScheduleValues>({
    defaultValues: {
      type: 'pickup',
      orderId: '',
      customer: '',
      phone: '',
      address: '',
      zone: ZONES[0].name,
      manifest: '',
      priority: 'standard',
      when: defaultWhen,
      driverId: '',
      instructions: '',
    },
  })
  const [type, customer, phone, address, zone, priority, when] = useWatch({
    control,
    name: ['type', 'customer', 'phone', 'address', 'zone', 'priority', 'when'],
  })
  const valid = customer.trim() !== '' && phone.trim() !== '' && address.trim() !== '' && when !== ''

  function onSubmit(values: ScheduleValues) {
    if (!valid) return
    onCreate({
      type: values.type,
      orderId: values.orderId.trim().toUpperCase(),
      customer: values.customer.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      zone: values.zone,
      manifest: values.manifest.trim(),
      priority: values.priority,
      scheduledAt: new Date(values.when).toISOString(),
      driverId: values.driverId || null,
      instructions: values.instructions.trim(),
    })
  }

  const text = (
    id: string,
    label: string,
    name: TextField,
    options: { wide?: boolean; placeholder?: string; type?: string } = {},
  ) => (
    <div className={options.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={options.type ?? 'text'}
        autoComplete="off"
        placeholder={options.placeholder}
        {...register(name)}
        className={fieldClass}
      />
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Schedule Pickup / Delivery"
      footer={
        <>
          <p className="mr-auto text-xs text-muted">
            Estimated fee:{' '}
            <span className="font-bold text-ink">
              {formatXaf(estimateFee(zone, type, priority))}
            </span>
          </p>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-job"
            disabled={!valid}
            className={primaryButton}
          >
            Schedule {type === 'pickup' ? 'Pickup' : 'Delivery'}
          </button>
        </>
      }
    >
      <form id="schedule-job" onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="job-type" className={labelClass}>
            Type
          </label>
          <select id="job-type" {...register('type')} className={fieldClass}>
            <option value="pickup">Pickup (collect from customer)</option>
            <option value="delivery">Delivery (return to customer)</option>
          </select>
        </div>
        {text('job-order', 'Order number (optional)', 'orderId', {
          placeholder: 'e.g. ORD-10452',
        })}
        {text('job-customer', 'Customer', 'customer')}
        {text('job-phone', 'Phone', 'phone', {
          type: 'tel',
          placeholder: '+237 6XX XXX XXX',
        })}
        {text('job-address', 'Address', 'address', { wide: true })}
        <div>
          <label htmlFor="job-zone" className={labelClass}>
            Delivery zone
          </label>
          <select id="job-zone" {...register('zone')} className={fieldClass}>
            {ZONES.map(({ name, fee }) => (
              <option key={name} value={name}>
                {name} ({formatXaf(fee)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="job-when" className={labelClass}>
            Date and time
          </label>
          <input
            id="job-when"
            type="datetime-local"
            {...register('when')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="job-priority" className={labelClass}>
            Priority
          </label>
          <select id="job-priority" {...register('priority')} className={fieldClass}>
            {PRIORITIES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="job-driver" className={labelClass}>
            Driver (optional)
          </label>
          <select id="job-driver" {...register('driverId')} className={fieldClass}>
            <option value="">Assign later</option>
            {drivers.filter(assignable).map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {text('job-manifest', 'Items / bags', 'manifest', {
          wide: true,
          placeholder: 'e.g. 2 bags, wash & fold',
        })}
        {text('job-instructions', 'Customer instructions', 'instructions', {
          wide: true,
          placeholder: 'e.g. Call before arrival',
        })}
      </form>
    </Modal>
  )
}

// ---------- Route planning ----------

export function RoutePlannerDialog({
  candidates,
  drivers,
  onClose,
  onStart,
}: {
  // Open jobs not yet on the road
  candidates: DispatchJob[]
  drivers: Driver[]
  onClose: () => void
  onStart: (jobIds: string[], driverId: string) => void
}) {
  const [zone, setZone] = useState('')
  const [maxStops, setMaxStops] = useState(6)
  const [driverId, setDriverId] = useState(
    drivers.find(({ status }) => status === 'available')?.id ?? '',
  )
  const [stops, setStops] = useState<DispatchJob[]>([])

  const pool = candidates.filter((job) => !zone || job.zone === zone)
  const available = pool.filter((job) => !stops.some((stop) => stop.id === job.id))
  const summary = getRouteSummary(stops)

  function move(index: number, offset: number) {
    const next = [...stops]
    const [stop] = next.splice(index, 1)
    next.splice(index + offset, 0, stop)
    setStops(next)
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Route Planning"
      subtitle={`${DEPOT.name} → stops → ${DEPOT.name}`}
      footer={
        <>
          <p className="mr-auto text-xs text-muted">
            <span className="font-bold text-ink">{stops.length}</span> stops ·{' '}
            <span className="font-bold text-ink">{summary.km} km</span> · about{' '}
            <span className="font-bold text-ink">{formatMinutes(summary.minutes)}</span> ·{' '}
            {summary.express} priority
          </p>
          <button
            type="button"
            disabled={stops.length < 2}
            onClick={() => setStops(optimizeStops(stops))}
            className={secondaryButton}
          >
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            Optimize Route
          </button>
          <button
            type="button"
            disabled={!driverId || stops.length === 0}
            onClick={() => onStart(stops.map(({ id }) => id), driverId)}
            className={primaryButton}
          >
            Assign Driver & Start
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="route-driver" className={labelClass}>
              Driver
            </label>
            <select
              id="route-driver"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Choose a driver…</option>
              {drivers.filter(assignable).map(({ id, name, vehicle }) => (
                <option key={id} value={id}>
                  {name} · {vehicle.split(' · ')[0]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="route-zone" className={labelClass}>
              Delivery zone
            </label>
            <select
              id="route-zone"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              className={fieldClass}
            >
              <option value="">All zones</option>
              {ZONES.map(({ name }) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="route-max" className={labelClass}>
              Maximum stops
            </label>
            <input
              id="route-max"
              type="number"
              min="1"
              max="20"
              inputMode="numeric"
              value={maxStops}
              onChange={(event) =>
                setMaxStops(Math.max(1, Number(event.target.value) || 1))
              }
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className={sectionTitle}>Available jobs ({available.length})</h3>
              <button
                type="button"
                disabled={available.length === 0 || stops.length >= maxStops}
                onClick={() =>
                  setStops(
                    optimizeStops([...stops, ...available].slice(0, maxStops)),
                  )
                }
                className="rounded-sm text-[11px] font-semibold text-brand hover:underline disabled:text-muted disabled:no-underline"
              >
                Add all & optimize
              </button>
            </div>
            <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {available.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    disabled={stops.length >= maxStops}
                    onClick={() => setStops([...stops, job])}
                    className="flex w-full items-center gap-2.5 rounded-lg bg-field px-3 py-2 text-left text-xs transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
                  >
                    <JobTypeIcon job={job} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">
                        {job.customer}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {job.zone} · {formatClock(job.scheduledAt)}
                      </span>
                    </span>
                    <JobPriorityBadge job={job} />
                  </button>
                </li>
              ))}
              {available.length === 0 && (
                <li className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
                  No more jobs to add.
                </li>
              )}
            </ul>
          </section>

          <section>
            <h3 className={sectionTitle}>
              Route stops ({stops.length} / {maxStops})
            </h3>
            <ol className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {stops.map((job, index) => (
                <li
                  key={job.id}
                  className="flex items-center gap-2 rounded-lg bg-field px-2.5 py-2 text-xs ring-1 ring-line"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">
                      {job.customer}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {job.address}, {job.zone}
                      {job.instructions && ` · ${job.instructions}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${job.customer} earlier`}
                    className={`${iconButton} size-6 disabled:opacity-30`}
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === stops.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${job.customer} later`}
                    className={`${iconButton} size-6 disabled:opacity-30`}
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStops(stops.filter(({ id }) => id !== job.id))}
                    aria-label={`Remove ${job.customer} from route`}
                    className={`${iconButton} size-6 hover:text-danger`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {stops.length === 0 && (
                <li className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
                  Add jobs from the left to build the route.
                </li>
              )}
            </ol>
          </section>
        </div>
        <p className="text-[11px] text-muted">
          Optimize puts express stops first, then orders the rest by nearest
          neighbour from the branch. Distance and duration are rough estimates,
          not live traffic.
        </p>
      </div>
    </Modal>
  )
}
