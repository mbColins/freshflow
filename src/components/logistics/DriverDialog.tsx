import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { DRIVER_AVAILABILITY, VEHICLE_TYPES } from '../../constants/drivers'
import type { BranchOption } from '../../services/branchApi'
import type { AppUser } from '../../types/user'
import type { DeliveryDriver, DriverAvailability, DriverRequest } from '../../types/driver'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'driver-form'
const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type DriverFormValues = {
  name: string
  phoneNumber: string
  email: string
  // 'all' serves every branch of the tenant
  scope: 'branch' | 'all'
  branch: string
  user: string
  vehicleType: string
  vehiclePlate: string
  vehicleModel: string
  status: DriverAvailability
}

const agentName = (agent: AppUser) => `${agent.firstName} ${agent.lastName}`.trim() || agent.username

type DriverDialogProps = {
  // Present when editing
  initial?: DeliveryDriver
  branches: BranchOption[]
  // Delivery agents that can be linked as the driver's login
  agents: AppUser[]
  agentsLoading: boolean
  // A platform admin has no tenant, so the driver needs a branch
  requireBranch: boolean
  // Server error from the last save, shown above the form
  error?: string | null
  onClose: () => void
  onSave: (driver: DriverRequest) => Promise<void>
}

function DriverDialog({ initial, branches, agents, agentsLoading, requireBranch, error, onClose, onSave }: DriverDialogProps) {
  const id = useId()
  const editing = initial !== undefined
  const fieldId = (name: keyof DriverFormValues) => `${id}-${name}`
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues>({
    defaultValues: initial
      ? {
          name: initial.name,
          phoneNumber: initial.phone,
          email: initial.email,
          scope: initial.allBranches ? 'all' : 'branch',
          branch: initial.branchId,
          user: initial.userId,
          vehicleType: initial.vehicleType,
          vehiclePlate: initial.vehiclePlate,
          vehicleModel: initial.vehicleModel,
          status: initial.status,
        }
      : {
          name: '',
          phoneNumber: '',
          email: '',
          scope: requireBranch ? 'branch' : 'all',
          branch: branches.length === 1 ? branches[0].uuid : '',
          user: '',
          vehicleType: 'Motorbike',
          vehiclePlate: '',
          vehicleModel: '',
          status: 'AVAILABLE',
        },
  })
  const scope = useWatch({ control, name: 'scope' })

  const describedBy = (name: keyof DriverFormValues) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${fieldId(name)}-error` } : {}
  const required = (label: string) => (value: string) => value.trim() !== '' || `${label} is required.`

  // Picking a login fills the contact fields that are still empty
  function linkAgent(uuid: string) {
    const agent = agents.find((item) => item.uuid === uuid)
    if (!agent) return
    const fill = (name: 'name' | 'phoneNumber' | 'email', value: string) => {
      if (value && !getValues(name).trim()) setValue(name, value, { shouldValidate: true })
    }
    fill('name', agentName(agent))
    fill('phoneNumber', agent.phone)
    fill('email', agent.email)
  }

  function toRequest(values: DriverFormValues): DriverRequest {
    const email = values.email.trim()
    return {
      name: values.name.trim(),
      phoneNumber: values.phoneNumber.trim(),
      // The backend keeps a value for a field left out, so an empty email is skipped
      ...(email ? { email } : {}),
      // Only sent when it changes; the backend re-checks the user
      ...(values.user && values.user !== initial?.userId ? { user: values.user } : {}),
      ...(values.scope === 'all' ? { allBranches: true } : { branch: values.branch }),
      vehicleType: values.vehicleType.trim(),
      vehiclePlate: values.vehiclePlate.trim().toUpperCase(),
      vehicleModel: values.vehicleModel.trim(),
      status: values.status,
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name || 'driver'}` : 'New driver'}
      subtitle="The person who does pickups and deliveries, and the vehicle they use."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Saving…' : editing ? 'Save Driver' : 'Create Driver'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((values) => onSave(toRequest(values)))} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}

        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className={`${sectionTitle} sm:col-span-2`}>Driver</h3>
          <FormField label="Full name" htmlFor={fieldId('name')} error={errors.name?.message}>
            <input
              id={fieldId('name')}
              autoComplete="off"
              {...describedBy('name')}
              {...register('name', { validate: required('Full name') })}
              className={`${fieldClass} ${invalidClass}`}
            />
          </FormField>
          <FormField label="Phone number" htmlFor={fieldId('phoneNumber')} error={errors.phoneNumber?.message}>
            <input
              id={fieldId('phoneNumber')}
              type="tel"
              autoComplete="off"
              placeholder="+237 6 …"
              {...describedBy('phoneNumber')}
              {...register('phoneNumber', { validate: required('Phone number') })}
              className={`${fieldClass} ${invalidClass}`}
            />
          </FormField>
          <FormField label="Email" htmlFor={fieldId('email')} hint="Optional" error={errors.email?.message}>
            <input
              id={fieldId('email')}
              type="email"
              autoComplete="off"
              {...describedBy('email')}
              {...register('email', {
                validate: (value) => !value.trim() || EMAIL_PATTERN.test(value.trim()) || 'Enter a valid email address.',
              })}
              className={`${fieldClass} ${invalidClass}`}
            />
          </FormField>
          <FormField
            label="App login"
            htmlFor={fieldId('user')}
            hint={
              agentsLoading
                ? 'Loading delivery agents…'
                : editing && initial.userId
                  ? 'Linked. Pick another delivery agent to change it.'
                  : 'Optional. Link a Delivery agent user so the driver can use the app.'
            }
          >
            <select
              id={fieldId('user')}
              disabled={agentsLoading}
              {...register('user', { onChange: (event) => linkAgent(event.target.value) })}
              className={fieldClass}
            >
              {/* A linked login can be changed but not removed */}
              {!(editing && initial.userId) && <option value="">No login</option>}
              {editing && initial.userId && !agents.some(({ uuid }) => uuid === initial.userId) && (
                <option value={initial.userId}>Current login</option>
              )}
              {agents.map((agent) => (
                <option key={agent.uuid} value={agent.uuid}>
                  {agentName(agent)}
                  {agent.branch ? ` · ${agent.branch}` : ''}
                </option>
              ))}
            </select>
          </FormField>
        </section>

        <section className="space-y-2">
          <h3 className={sectionTitle}>Works for</h3>
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Branches the driver serves">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink">
              <input type="radio" value="branch" {...register('scope')} className="size-4 accent-brand" />
              One branch
            </label>
            <label className={`flex items-center gap-2 text-xs font-semibold ${requireBranch ? 'text-muted' : 'text-ink'}`}>
              <input type="radio" value="all" disabled={requireBranch} {...register('scope')} className="size-4 accent-brand" />
              Every branch
            </label>
          </div>
          {scope === 'branch' ? (
            <FormField label="Branch" htmlFor={fieldId('branch')} error={errors.branch?.message}>
              <select
                id={fieldId('branch')}
                {...describedBy('branch')}
                {...register('branch', {
                  validate: (value, values) => values.scope === 'all' || value !== '' || 'Choose a branch.',
                })}
                className={`${fieldClass} ${invalidClass}`}
              >
                <option value="">Choose a branch</option>
                {editing && initial.branchId && !branches.some(({ uuid }) => uuid === initial.branchId) && (
                  <option value={initial.branchId}>{initial.branchName || 'Current branch'}</option>
                )}
                {branches.map(({ uuid, name }) => (
                  <option key={uuid} value={uuid}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <p className="text-[11px] text-muted">The driver can be given jobs from any branch of the business.</p>
          )}
          {requireBranch && <p className="text-[11px] text-muted">As a platform admin, choose the branch the driver works for.</p>}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className={`${sectionTitle} sm:col-span-2`}>Vehicle</h3>
          <FormField label="Vehicle type" htmlFor={fieldId('vehicleType')}>
            <input id={fieldId('vehicleType')} list={`${id}-vehicle-types`} autoComplete="off" {...register('vehicleType')} className={fieldClass} />
            <datalist id={`${id}-vehicle-types`}>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Plate number" htmlFor={fieldId('vehiclePlate')}>
            <input
              id={fieldId('vehiclePlate')}
              autoComplete="off"
              placeholder="e.g. LT-482-AB"
              {...register('vehiclePlate')}
              className={`${fieldClass} uppercase`}
            />
          </FormField>
          <FormField label="Vehicle model" htmlFor={fieldId('vehicleModel')}>
            <input id={fieldId('vehicleModel')} autoComplete="off" placeholder="e.g. Honda CG 125" {...register('vehicleModel')} className={fieldClass} />
          </FormField>
          <FormField label="Status" htmlFor={fieldId('status')}>
            <select id={fieldId('status')} {...register('status')} className={fieldClass}>
              {DRIVER_AVAILABILITY.map(({ id: value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
        </section>
      </form>
    </Modal>
  )
}

export default DriverDialog
