import { useForm } from 'react-hook-form'
import type { Tenant } from '../../types/tenant'
import { dangerButton, fieldClass, labelClass, secondaryButton } from '../orders/styles'
import Modal from '../ui/Modal'

const FORM_ID = 'suspend-tenant'

// Suspending blocks the tenant's staff from signing in; the reason is shown
// to platform admins and kept with the tenant
function SuspendTenantDialog({
  tenant,
  onClose,
  onConfirm,
}: {
  tenant: Tenant
  onClose: () => void
  onConfirm: (reason: string) => void
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
      title={`Suspend ${tenant.name}?`}
      subtitle="Staff can't sign in until the tenant is reactivated. Data is kept."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Keep active
          </button>
          <button type="submit" form={FORM_ID} className={dangerButton}>
            Suspend Tenant
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit(({ reason }) => onConfirm(reason.trim()))}
      >
        <label htmlFor="suspend-reason" className={labelClass}>
          Reason
        </label>
        <textarea
          id="suspend-reason"
          rows={3}
          autoFocus
          placeholder="e.g. Invoice overdue by 30 days"
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? 'suspend-reason-error' : undefined}
          {...register('reason', {
            validate: (value) => value.trim() !== '' || 'Give a reason for the suspension.',
          })}
          className={`${fieldClass} h-auto py-2 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger`}
        />
        {errors.reason && (
          <p id="suspend-reason-error" className="mt-1 text-[11px] font-semibold text-danger">
            {errors.reason.message}
          </p>
        )}
      </form>
    </Modal>
  )
}

export default SuspendTenantDialog
