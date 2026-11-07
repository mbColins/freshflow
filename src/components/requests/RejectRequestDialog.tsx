import { useForm } from 'react-hook-form'
import { dangerButton, fieldClass, labelClass, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import Modal from '../ui/Modal'

const FORM_ID = 'reject-account-request'
const MAX_REASON = 1000

// The reason is shown to the applicant when they track their application
function RejectRequestDialog({
  businessName,
  error,
  submitting,
  onClose,
  onReject,
}: {
  businessName: string
  error: string | null
  submitting: boolean
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { reason: '' } })

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title={`Reject ${businessName}?`}
      subtitle="The applicant sees the reason when they track their application."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton} disabled={submitting}>
            Keep pending
          </button>
          <button type="submit" form={FORM_ID} className={dangerButton} disabled={submitting}>
            {submitting ? 'Rejecting…' : 'Reject Request'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate className="space-y-3" onSubmit={handleSubmit(({ reason }) => onReject(reason.trim()))}>
        {error && <FormAlert>{error}</FormAlert>}
        <div>
          <label htmlFor="reject-reason" className={labelClass}>
            Reason
          </label>
          <textarea
            id="reject-reason"
            rows={4}
            autoFocus
            maxLength={MAX_REASON}
            placeholder="e.g. We couldn’t verify the registration number."
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={errors.reason ? 'reject-reason-error' : undefined}
            {...register('reason', { validate: (value) => value.trim() !== '' || 'Give a reason for the rejection.' })}
            className={`${fieldClass} h-auto py-2 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger`}
          />
          {errors.reason && (
            <p id="reject-reason-error" className="mt-1 text-[11px] font-semibold text-danger">
              {errors.reason.message}
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default RejectRequestDialog
