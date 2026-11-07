import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { DEMO_ACTION_LABELS } from '../../constants/requests'
import type { DemoRequest, DemoRequestStatus } from '../../types/demoRequest'
import { toLocalInput } from '../../utils/requests'
import { dangerButton, fieldClass, labelClass, primaryButton, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'demo-status'
const MAX_NOTE = 1000

const SUBTITLES: Partial<Record<DemoRequestStatus, string>> = {
  CONTACTED: 'You have been in touch with the visitor.',
  SCHEDULED: 'Pick the date and time of the demo.',
  COMPLETED: 'The demo took place.',
  CANCELLED: 'The demo will not go ahead. This can’t be undone.',
}

// A sensible first guess for the time: the visitor's preferred day and part of the day,
// else tomorrow morning
function suggestedTime(request: DemoRequest) {
  if (request.scheduledFor) return toLocalInput(new Date(request.scheduledFor))
  const start = new Date()
  start.setDate(start.getDate() + 1)
  if (request.preferredDate) {
    const [y, m, d] = request.preferredDate.split('-').map(Number)
    const wanted = new Date(y, m - 1, d)
    if (wanted.getTime() > Date.now()) {
      start.setFullYear(wanted.getFullYear(), wanted.getMonth(), wanted.getDate())
    }
  }
  start.setHours(request.preferredWindow === 'AFTERNOON' ? 15 : 10, 0, 0, 0)
  return toLocalInput(start)
}

type Values = { scheduledFor: string; note: string }

// Moves a demo request to `target`, with an optional note (and a time for SCHEDULED)
function DemoStatusDialog({
  request,
  target,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  request: DemoRequest
  target: DemoRequestStatus
  error: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: { scheduledFor?: string; note?: string }) => void
}) {
  const scheduling = target === 'SCHEDULED'
  const destructive = target === 'CANCELLED'
  // Read once when the dialog opens: the earliest time the picker offers
  const [earliest] = useState(() => toLocalInput(new Date()))
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { scheduledFor: scheduling ? suggestedTime(request) : '', note: request.note ?? '' } })

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title={`${DEMO_ACTION_LABELS[target]}: ${request.company}`}
      subtitle={SUBTITLES[target]}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton} disabled={submitting}>
            Back
          </button>
          <button type="submit" form={FORM_ID} className={destructive ? dangerButton : primaryButton} disabled={submitting}>
            {submitting ? 'Saving…' : DEMO_ACTION_LABELS[target]}
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(({ scheduledFor, note }) => {
          // Both are local "yyyy-MM-ddTHH:mm", so they compare as text. The backend checks again
          // against its own clock and its answer is shown in the dialog.
          if (scheduling && (scheduledFor === '' || scheduledFor <= earliest)) {
            setError('scheduledFor', { message: 'Pick a date and time in the future.' })
            return
          }
          onSubmit({
            // The backend reads a local date-time with seconds
            scheduledFor: scheduling ? `${scheduledFor}:00` : undefined,
            note: note.trim() || undefined,
          })
        })}
      >
        {error && <FormAlert>{error}</FormAlert>}

        {scheduling && (
          <FormField label="Date and time" htmlFor="demo-when" error={errors.scheduledFor?.message}>
            <input
              id="demo-when"
              type="datetime-local"
              min={earliest}
              aria-invalid={errors.scheduledFor ? true : undefined}
              aria-describedby={errors.scheduledFor ? 'demo-when-error' : undefined}
              {...register('scheduledFor')}
              className={`${fieldClass} aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger`}
            />
            {request.timezone && <p className="mt-1 text-[11px] text-muted">The visitor’s time zone is {request.timezone}.</p>}
          </FormField>
        )}

        <div>
          <label htmlFor="demo-note" className={labelClass}>
            Note <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="demo-note"
            rows={3}
            maxLength={MAX_NOTE}
            placeholder="e.g. Called twice, will try again Monday."
            {...register('note')}
            className={`${fieldClass} h-auto py-2`}
          />
        </div>
      </form>
    </Modal>
  )
}

export default DemoStatusDialog
