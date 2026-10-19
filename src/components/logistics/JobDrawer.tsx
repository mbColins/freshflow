import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  CalendarClock,
  CircleCheck,
  MessageSquare,
  Phone,
  ShieldCheck,
  TriangleAlert,
  UserCog,
} from 'lucide-react'
import {
  DELIVERY_FLOW,
  DELIVERY_TEMPLATES,
  FAILURE_NEXT_ACTIONS,
  FAILURE_REASONS,
  PICKUP_FLOW,
  PROOF_METHODS,
  STATUS_LABELS,
} from '../../constants/logistics'
import type {
  DispatchJob,
  Driver,
  JobStatus,
} from '../../types/logistics'
import { formatXaf } from '../../utils/orders'
import { formatClock, getReadyMinutes, formatMinutes, isClosed } from '../../utils/logistics'
import { dangerButton, fieldClass, labelClass, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { JobPriorityBadge, JobStatusBadge } from './LogisticsBits'
import { DetailBox, DrawerSection } from '../ui/Details'
import { toLocalInput } from '../../utils/dates'

type JobDrawerProps = {
  job: DispatchJob | null
  drivers: Driver[]
  now: number
  onClose: () => void
  onAssign: (jobIds: string[]) => void
  onAdvance: (id: string, status: JobStatus) => void
  onComplete: (id: string, proof: { recipient: string; method: string }) => void
  onFail: (id: string, failure: { reason: string; notes: string; nextAction: string }) => void
  onReschedule: (id: string, when: string, notify: boolean) => void
}

type Mode = 'view' | 'proof' | 'fail' | 'reschedule'

function ProofForm({
  defaultRecipient,
  onBack,
  onSubmit,
}: {
  defaultRecipient: string
  onBack: () => void
  onSubmit: (proof: { recipient: string; method: string }) => void
}) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: { recipient: defaultRecipient, method: PROOF_METHODS[0] },
  })
  const recipient = useWatch({ control, name: 'recipient' })
  return (
    <form
      onSubmit={handleSubmit(({ recipient, method }) => onSubmit({ recipient: recipient.trim(), method }))}
      className="space-y-3 rounded-lg bg-field p-3"
    >
      <p className="text-xs font-bold text-ink">Proof of delivery</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pod-recipient" className={labelClass}>
            Recipient name
          </label>
          <input
            id="pod-recipient"
            {...register('recipient', { validate: (value) => value.trim() !== '' })}
            className={`${fieldClass} bg-white`}
          />
        </div>
        <div>
          <label htmlFor="pod-method" className={labelClass}>
            Verification
          </label>
          <select id="pod-method" {...register('method')} className={`${fieldClass} bg-white`}>
            {PROOF_METHODS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!recipient.trim()} className={primaryButton}>
          <CircleCheck className="size-4" aria-hidden="true" />
          Confirm Delivered
        </button>
        <button type="button" onClick={onBack} className={secondaryButton}>
          Back
        </button>
      </div>
    </form>
  )
}

function FailForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void
  onSubmit: (failure: { reason: string; notes: string; nextAction: string }) => void
}) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: { reason: FAILURE_REASONS[0], notes: '', nextAction: FAILURE_NEXT_ACTIONS[0] },
  })
  const notes = useWatch({ control, name: 'notes' })
  return (
    <form
      onSubmit={handleSubmit((failure) => onSubmit({ ...failure, notes: failure.notes.trim() }))}
      className="space-y-3 rounded-lg bg-danger/5 p-3 ring-1 ring-danger/20"
    >
      <p className="text-xs font-bold text-ink">Report a failed attempt</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="fail-reason" className={labelClass}>
            Reason
          </label>
          <select id="fail-reason" {...register('reason')} className={`${fieldClass} bg-white`}>
            {FAILURE_REASONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fail-next" className={labelClass}>
            Next action
          </label>
          <select id="fail-next" {...register('nextAction')} className={`${fieldClass} bg-white`}>
            {FAILURE_NEXT_ACTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fail-notes" className={labelClass}>
            Driver notes, including contact attempts (required)
          </label>
          <textarea
            id="fail-notes"
            rows={2}
            {...register('notes', { validate: (value) => value.trim() !== '' })}
            className={`${fieldClass} h-auto bg-white py-2`}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!notes.trim()} className={dangerButton}>
          Mark as Failed
        </button>
        <button type="button" onClick={onBack} className={secondaryButton}>
          Back
        </button>
      </div>
    </form>
  )
}

function RescheduleForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void
  // `when` as an ISO timestamp
  onSubmit: (when: string, notify: boolean) => void
}) {
  // Lazy so the default time is read once, not on every render
  const [defaultWhen] = useState(() => toLocalInput(Date.now() + 3 * 3_600_000))
  const { register, handleSubmit, control } = useForm({
    defaultValues: { when: defaultWhen, notify: true },
  })
  const when = useWatch({ control, name: 'when' })
  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(new Date(values.when).toISOString(), values.notify))}
      className="space-y-3 rounded-lg bg-field p-3"
    >
      <p className="text-xs font-bold text-ink">Reschedule</p>
      <div>
        <label htmlFor="reschedule-when" className={labelClass}>
          New date and time
        </label>
        <input
          id="reschedule-when"
          type="datetime-local"
          {...register('when', { required: true })}
          className={`${fieldClass} bg-white sm:w-64`}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
        <input type="checkbox" {...register('notify')} className="size-4 accent-brand" />
        Notify customer about the new time
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!when} className={primaryButton}>
          Save New Time
        </button>
        <button type="button" onClick={onBack} className={secondaryButton}>
          Back
        </button>
      </div>
    </form>
  )
}

function JobActions({
  job,
  hasDriver,
  onAssign,
  onAdvance,
  onComplete,
  onFail,
  onReschedule,
}: Omit<JobDrawerProps, 'job' | 'drivers' | 'now' | 'onClose'> & {
  job: DispatchJob
  hasDriver: boolean
}) {
  const [mode, setMode] = useState<Mode>('view')

  const flow = job.type === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW
  const current = job.status === 'arrived' ? 'enRoute' : job.status
  const next = flow[flow.indexOf(current) + 1] as JobStatus | undefined
  const closed = isClosed(job)
  const onTheRoad = job.status === 'enRoute' || job.status === 'arrived'
  const back = () => setMode('view')

  if (mode === 'proof') {
    return (
      <ProofForm
        defaultRecipient={job.customer}
        onBack={back}
        onSubmit={(proof) => onComplete(job.id, proof)}
      />
    )
  }
  if (mode === 'fail') {
    return <FailForm onBack={back} onSubmit={(failure) => onFail(job.id, failure)} />
  }
  if (mode === 'reschedule') {
    return (
      <RescheduleForm
        onBack={back}
        onSubmit={(when, notify) => onReschedule(job.id, when, notify)}
      />
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!closed && next && job.status !== 'scheduled' && (
        <button
          type="button"
          disabled={next !== 'scheduled' && !hasDriver}
          title={next !== 'scheduled' && !hasDriver ? 'Assign a driver first' : undefined}
          onClick={() =>
            job.type === 'delivery' && next === 'done'
              ? setMode('proof')
              : onAdvance(job.id, next)
          }
          className={primaryButton}
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Mark {STATUS_LABELS[next][job.type]}
        </button>
      )}
      {job.type === 'pickup' && job.status === 'done' && (
        <button
          type="button"
          onClick={() => onAdvance(job.id, 'received')}
          className={primaryButton}
        >
          Mark Received at Branch
        </button>
      )}
      {job.status === 'enRoute' && (
        <button
          type="button"
          onClick={() => onAdvance(job.id, 'arrived')}
          className={secondaryButton}
        >
          Mark Arrived
        </button>
      )}
      {!closed && (
        <button type="button" onClick={() => onAssign([job.id])} className={secondaryButton}>
          <UserCog className="size-4 text-muted" aria-hidden="true" />
          {hasDriver ? 'Reassign' : 'Assign Driver'}
        </button>
      )}
      {(!closed || job.status === 'failed') && (
        <button type="button" onClick={() => setMode('reschedule')} className={secondaryButton}>
          <CalendarClock className="size-4 text-muted" aria-hidden="true" />
          Reschedule
        </button>
      )}
      {onTheRoad && (
        <button type="button" onClick={() => setMode('fail')} className={secondaryButton}>
          <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
          Report Problem
        </button>
      )}
    </div>
  )
}

function JobDrawer({ job, drivers, now, onClose, ...actions }: JobDrawerProps) {
  const [template, setTemplate] = useState(DELIVERY_TEMPLATES[0])
  const driver = drivers.find(({ id }) => id === job?.driverId)
  const phone = job?.phone.replace(/[^\d+]/g, '') ?? ''
  const ready = job ? getReadyMinutes(job, now) : 0

  return (
    <Modal
      open={job !== null}
      onClose={onClose}
      variant="drawer"
      title={job ? `${job.type === 'pickup' ? 'Pickup' : 'Delivery'} #${job.id}` : ''}
      subtitle={
        job && (
          <span className="flex flex-wrap items-center gap-2">
            <JobStatusBadge job={job} now={now} />
            <JobPriorityBadge job={job} />
          </span>
        )
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      {job && (
        <div className="space-y-5">
          <JobActions
            key={`${job.id}-${job.status}`}
            job={job}
            hasDriver={Boolean(driver)}
            {...actions}
          />

          {job.failure && (
            <div className="rounded-lg bg-danger/5 p-3 text-xs ring-1 ring-danger/20">
              <p className="flex items-center gap-2 font-bold text-danger">
                <TriangleAlert className="size-4" aria-hidden="true" />
                Delivery Failed: {job.failure.reason}
              </p>
              <p className="mt-1 text-muted">{job.failure.notes}</p>
              <p className="mt-1 text-muted">
                Next action:{' '}
                <span className="font-semibold text-ink">{job.failure.nextAction}</span>
              </p>
            </div>
          )}

          {job.proof && (
            <div className="rounded-lg bg-success/5 p-3 text-xs ring-1 ring-success/20">
              <p className="flex items-center gap-2 font-bold text-success">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Delivery Completed
              </p>
              <p className="mt-1 text-muted">
                Delivered to{' '}
                <span className="font-semibold text-ink">{job.proof.recipient}</span> at{' '}
                {formatClock(job.proof.at)} · {job.proof.method}
              </p>
            </div>
          )}

          <DrawerSection title="Customer">
            <DetailBox
              rows={[
                ['Name', job.customer],
                ['Phone', job.phone],
              ]}
            />
            <div className="mt-2 space-y-2">
              <select
                aria-label="Message template"
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                className={fieldClass}
              >
                {DELIVERY_TEMPLATES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <a href={`tel:${phone}`} className={`${secondaryButton} h-8`}>
                  <Phone className="size-3.5 text-muted" aria-hidden="true" />
                  Call Customer
                </a>
                <a
                  href={`sms:${phone}?body=${encodeURIComponent(template)}`}
                  className={`${secondaryButton} h-8`}
                >
                  <MessageSquare className="size-3.5 text-muted" aria-hidden="true" />
                  Send SMS
                </a>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Order">
            <DetailBox
              rows={[
                ['Order number', job.orderId],
                ['Manifest', job.manifest],
                ['Packages', job.packages],
                ['Total', job.amount > 0 ? formatXaf(job.amount) : 'Set at intake'],
                ['Payment', <Badge tone={job.paymentTone}>{job.payment}</Badge>],
                ...(ready > 0
                  ? ([['Waiting at branch', formatMinutes(ready)]] as [string, ReactNode][])
                  : []),
              ]}
            />
          </DrawerSection>

          <DrawerSection title={job.type === 'pickup' ? 'Pickup address' : 'Delivery address'}>
            <DetailBox
              rows={[
                ['Address', job.address],
                ['Zone', job.zone],
                ['Distance', `${job.distanceKm} km`],
                ['Customer instructions', job.instructions || 'None'],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Driver & schedule">
            <DetailBox
              rows={[
                ['Driver', driver?.name ?? 'Unassigned'],
                ['Vehicle', driver?.vehicle ?? '—'],
                ['Current location', driver?.location ?? '—'],
                ['Scheduled time', formatClock(job.scheduledAt)],
                [
                  'Estimated arrival',
                  job.etaMin !== null && !isClosed(job) ? `${job.etaMin} min` : '—',
                ],
              ]}
            />
            {driver && (
              <a
                href={`tel:${driver.phone.replace(/[^\d+]/g, '')}`}
                className={`${secondaryButton} mt-2 h-8`}
              >
                <Phone className="size-3.5 text-muted" aria-hidden="true" />
                Call Driver
              </a>
            )}
          </DrawerSection>

          <DrawerSection title="Timeline">
            <ol className="space-y-3 border-l border-line pl-4">
              {job.timeline.map((entry, index) => (
                <li key={entry.at + index} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
                  <time className="text-muted tabular-nums">{formatClock(entry.at)}</time>{' '}
                  <span className="font-semibold text-ink">{entry.text}</span>
                </li>
              ))}
            </ol>
          </DrawerSection>
        </div>
      )}
    </Modal>
  )
}

export default JobDrawer
