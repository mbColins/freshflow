import { useForm } from 'react-hook-form'
import usePlatformPlans from '../../hooks/usePlatformPlans'
import type { AccountRequest } from '../../types/accountRequest'
import { formatXaf } from '../../utils/orders'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'approve-account-request'

type Values = { subscriptionPlan: string; username: string }

// Approving creates the tenant and its owner exactly as the Tenants screen would, and
// emails the owner their sign-in details
function ApproveAccountDialog({
  request,
  error,
  submitting,
  onClose,
  onApprove,
}: {
  request: AccountRequest
  error: string | null
  submitting: boolean
  onClose: () => void
  onApprove: (values: { subscriptionPlan: string; username?: string }) => void
}) {
  const plans = usePlatformPlans().filter(({ active }) => active)
  // Start on the plan the applicant looked at, when it is still on offer
  const preferred = plans.some(({ code }) => code === request.preferredPlan) ? (request.preferredPlan ?? '') : ''
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { subscriptionPlan: preferred, username: '' } })

  const emailName = request.adminEmail.split('@')[0]

  return (
    <Modal
      open
      onClose={onClose}
      variant="md"
      title={`Approve ${request.legalName}?`}
      subtitle="Creates the business’s workspace and its owner account."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton} disabled={submitting}>
            Not yet
          </button>
          <button type="submit" form={FORM_ID} className={primaryButton} disabled={submitting}>
            {submitting ? 'Approving…' : 'Approve & Create Tenant'}
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(({ subscriptionPlan, username }) =>
          onApprove({ subscriptionPlan, username: username.trim() || undefined }),
        )}
      >
        {error && <FormAlert>{error}</FormAlert>}

        <p className="rounded-lg bg-field p-3 text-xs text-ink">
          <span className="font-bold">{request.adminName}</span> ({request.adminEmail}) becomes the owner. Their sign-in
          details are emailed to that address.
        </p>

        <FormField
          label="Plan"
          htmlFor="approve-plan"
          error={errors.subscriptionPlan?.message}
          hint={
            request.preferredPlan
              ? `The applicant looked at ${request.preferredPlan}. The first subscription starts as a trial.`
              : 'The first subscription starts as a trial.'
          }
        >
          <select
            id="approve-plan"
            aria-invalid={errors.subscriptionPlan ? true : undefined}
            aria-describedby={errors.subscriptionPlan ? 'approve-plan-error' : undefined}
            {...register('subscriptionPlan', { validate: (value) => value !== '' || 'Choose the plan the tenant starts on.' })}
            className={`${fieldClass} aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger`}
          >
            <option value="">Choose a plan…</option>
            {plans.map(({ code, name, monthlyPrice }) => (
              <option key={code} value={code}>
                {name} · {formatXaf(monthlyPrice)} / month
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Owner username"
          htmlFor="approve-username"
          hint={`Optional. Defaults to “${emailName}”. Set one if that name is taken.`}
        >
          <input id="approve-username" autoComplete="off" placeholder={emailName} {...register('username')} className={fieldClass} />
        </FormField>
      </form>
    </Modal>
  )
}

export default ApproveAccountDialog
