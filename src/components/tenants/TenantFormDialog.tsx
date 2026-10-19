import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { FieldPath, RegisterOptions } from 'react-hook-form'
import { ImagePlus, Trash2 } from 'lucide-react'
import {
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  TENANT_STATUSES,
  TRIAL_DAYS,
} from '../../constants/tenants'
import usePlatformPlans from '../../hooks/usePlatformPlans'
import { useGetPlanDropdownQuery } from '../../services/platformPlanApi'
import type { PlanOption } from '../../services/platformPlanApi'
import type { Tenant, TenantFormValues, TenantStatus } from '../../types/tenant'
import { formatXaf } from '../../utils/orders'
import {
  HOSTNAME_PATTERN,
  USERNAME_PATTERN,
  cleanTenantForm,
  formFromTenant,
  slugify,
} from '../../utils/tenants'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'tenant-form'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/

const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

// Validators for the text fields (the shared helper types values loosely)
const text = (value: unknown) => String(value ?? '').trim()

const required = (label: string) => (value: unknown) =>
  text(value) !== '' || `${label} is required.`

const email = (label: string) => (value: unknown) =>
  text(value) === ''
    ? `${label} is required.`
    : EMAIL_PATTERN.test(text(value)) || 'Enter a valid email address.'

const phone = (label: string) => (value: unknown) =>
  text(value) === ''
    ? `${label} is required.`
    : PHONE_PATTERN.test(text(value)) || 'Enter a valid phone number.'

const EMPTY_FORM: TenantFormValues = {
  businessName: '',
  phoneNumber: '',
  email: '',
  // The first active plan, filled in by the dialog
  subscriptionPlan: '',
  town: '',
  slogan: '',
  hostname: '',
  status: 'trial',
  logo: null,
  username: '',
  firstName: '',
  lastName: '',
  city: '',
  neighborhood: '',
  oPhoneNumber: '',
  oEmail: '',
  // The account created with a tenant is always its owner
  userType: 'OWNER',
}

type TenantFormDialogProps = {
  // Present when editing
  initial?: Tenant
  // Values other tenants / users already use
  takenHostnames: string[]
  takenUsernames: string[]
  // Server error from the last save, shown above the form
  error?: string | null
  onClose: () => void
  onSave: (values: TenantFormValues) => Promise<void> | void
}

function TenantFormDialog({
  initial,
  takenHostnames,
  takenUsernames,
  error,
  onClose,
  onSave,
}: TenantFormDialogProps) {
  const id = useId()
  const editing = initial !== undefined
  const localPlans = usePlatformPlans()
  // The choices come from the plan dropdown endpoint; if it fails, fall back to
  // the plans the app already knows (active ones only)
  const {
    data: dropdown,
    isLoading: loadingPlans,
    isError: plansFailed,
  } = useGetPlanDropdownQuery(undefined, { refetchOnMountOrArgChange: true })
  const fallbackPlans: PlanOption[] = localPlans
    .filter(({ active }) => active)
    .map(({ code, name, monthlyPrice }) => ({ code, name, monthlyPrice }))
  const offered = dropdown ?? (plansFailed ? fallbackPlans : [])
  // A tenant on a retired plan keeps it as a choice when edited
  const currentPlan = initial && localPlans.find(({ code }) => code === initial.plan)
  const plans: PlanOption[] =
    initial && !offered.some(({ code }) => code === initial.plan)
      ? [
          ...offered,
          {
            code: initial.plan,
            name: currentPlan?.name ?? initial.plan,
            monthlyPrice: currentPlan?.monthlyPrice ?? null,
          },
        ]
      : offered
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormValues>({
    defaultValues: initial ? formFromTenant(initial) : EMPTY_FORM,
  })

  // New tenants start on the first plan once the list has loaded
  const firstPlan = plans[0]?.code
  useEffect(() => {
    if (!initial && firstPlan && !getValues('subscriptionPlan')) setValue('subscriptionPlan', firstPlan)
  }, [initial, firstPlan, getValues, setValue])

  // Preview of the chosen logo, or the current one when editing
  const [preview, setPreview] = useState<string | null>(initial?.logoUrl ?? null)
  const objectUrl = useRef<string | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  // The submit button is at the bottom of a long form, so bring a save error into view
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!error) return
    alertRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    alertRef.current?.focus({ preventScroll: true })
  }, [error])
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  function showPreview(file: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = file ? URL.createObjectURL(file) : null
    setPreview(objectUrl.current ?? (file ? null : initial?.logoUrl ?? null))
  }

  // New tenants only offer the statuses a tenant can start in
  const statuses = (Object.keys(TENANT_STATUSES) as TenantStatus[]).filter(
    (status) => editing || status === 'trial' || status === 'active',
  )
  const fieldId = (name: string) => `${id}-${name}`

  // Label + text input wired to the form, its validation and its error
  function textField(
    name: FieldPath<TenantFormValues>,
    label: string,
    rules: RegisterOptions<TenantFormValues>,
    options: { type?: string; placeholder?: string; hint?: string; wide?: boolean; mono?: boolean; autoFocus?: boolean } = {},
  ) {
    const fieldError = errors[name as keyof TenantFormValues]?.message
    return (
      <FormField label={label} htmlFor={fieldId(name)} error={fieldError} hint={options.hint} wide={options.wide}>
        <input
          id={fieldId(name)}
          type={options.type ?? 'text'}
          autoComplete="off"
          autoFocus={options.autoFocus}
          spellCheck={options.mono ? false : undefined}
          placeholder={options.placeholder}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${fieldId(name)}-error` : undefined}
          {...register(name, rules)}
          className={`${fieldClass} ${options.mono ? 'font-mono' : ''} ${invalidClass}`}
        />
      </FormField>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="xl"
      title={editing ? `Edit ${initial.name}` : 'Add Tenant'}
      subtitle={editing ? initial.hostname : 'Create a workspace and its owner account'}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Tenant'}
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit((values) => onSave(cleanTenantForm(values)))}
        className="space-y-5"
      >
        {error && (
          <div ref={alertRef} tabIndex={-1} className="scroll-mt-4 rounded-md outline-none">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <section>
          <h3 className={sectionTitle}>Business</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="sm:col-span-2 md:col-span-3">
              <Controller
                control={control}
                name="logo"
                rules={{
                  validate: (file) =>
                    !file ||
                    (!LOGO_TYPES.includes(file.type)
                      ? 'Use a PNG, JPEG or WebP image.'
                      : file.size <= LOGO_MAX_BYTES || `The logo must be ${LOGO_MAX_BYTES / 1024 / 1024} MB or smaller.`),
                }}
                render={({ field, fieldState }) => (
                  <FormField
                    label="Logo (optional)"
                    htmlFor={fieldId('logo')}
                    error={fieldState.error?.message}
                    hint={`PNG, JPEG or WebP, up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}
                  >
                    <div className="flex items-center gap-3">
                      {/* The placeholder is the only "choose" control */}
                      <button
                        type="button"
                        onClick={() => logoInput.current?.click()}
                        aria-label={preview ? 'Change logo' : 'Upload logo'}
                        title={preview ? 'Change logo' : 'Upload logo'}
                        aria-invalid={fieldState.error ? true : undefined}
                        aria-describedby={fieldState.error ? `${fieldId('logo')}-error` : undefined}
                        className="flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-field ring-1 ring-line transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger"
                      >
                        {preview ? (
                          <img src={preview} alt="" className="size-full object-contain" />
                        ) : (
                          <ImagePlus className="size-5 text-muted" aria-hidden="true" />
                        )}
                      </button>
                      {/* Native picker kept for the file dialog only; the
                          placeholder replaces its unstyled "Choose File" UI */}
                      <input
                        ref={logoInput}
                        id={fieldId('logo')}
                        type="file"
                        tabIndex={-1}
                        accept={LOGO_TYPES.join(',')}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          field.onChange(file)
                          field.onBlur()
                          showPreview(file)
                        }}
                        className="sr-only"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {field.value && (
                            <button
                              type="button"
                              onClick={() => {
                                field.onChange(null)
                                showPreview(null)
                                if (logoInput.current) logoInput.current.value = ''
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted transition hover:bg-field hover:text-danger focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted">
                          {field.value
                            ? `${field.value.name} · ${Math.max(1, Math.round(field.value.size / 1024))} KB`
                            : preview
                              ? 'Current logo'
                              : 'Click the square to add a logo'}
                        </p>
                      </div>
                    </div>
                  </FormField>
                )}
              />
            </div>
            <FormField
              label="Business name"
              htmlFor={fieldId('businessName')}
              error={errors.businessName?.message}
            >
              <input
                id={fieldId('businessName')}
                autoComplete="off"
                autoFocus
                aria-invalid={errors.businessName ? true : undefined}
                aria-describedby={errors.businessName ? `${fieldId('businessName')}-error` : undefined}
                {...register('businessName', {
                  validate: required('Business name'),
                  // Suggest a hostname until the admin types their own
                  onChange: (event) => {
                    if (!editing && !getFieldState('hostname').isDirty) {
                      setValue('hostname', slugify(event.target.value))
                    }
                  },
                })}
                className={`${fieldClass} ${invalidClass}`}
              />
            </FormField>
            {textField(
              'hostname',
              'Hostname',
              {
                validate: (value) => {
                  const hostname = String(value).trim().toLowerCase()
                  if (!hostname) return 'Hostname is required.'
                  if (!HOSTNAME_PATTERN.test(hostname)) return 'Use lowercase letters, numbers, dashes and dots.'
                  if (takenHostnames.includes(hostname)) return 'Another tenant already uses this hostname.'
                  return true
                },
              },
              { mono: true, hint: 'e.g. clean-express' },
            )}
            {textField('slogan', 'Slogan (optional)', { maxLength: { value: 120, message: 'Keep the slogan under 120 characters.' } }, { placeholder: 'e.g. Fresh clothes, zero hassle' })}
            {textField('town', 'Town', { validate: required('Town') })}
            {textField('phoneNumber', 'Business phone', { validate: phone('Business phone') }, { type: 'tel', placeholder: '+237 6XX XXX XXX' })}
            {textField('email', 'Business email', { validate: email('Business email') }, { type: 'email' })}
          </div>
        </section>

        {!editing && (
          <section>
            <h3 className={sectionTitle}>Owner account</h3>
            <p className="mt-1 text-[11px] text-muted">
              The owner signs in with this username and sets their password on first login.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {textField('firstName', 'First name', { validate: required('First name') })}
              {textField('lastName', 'Last name', { validate: required('Last name') })}
              {textField(
                'username',
                'Username',
                {
                  validate: (value) => {
                    const username = String(value).trim().toLowerCase()
                    if (!username) return 'Username is required.'
                    if (!USERNAME_PATTERN.test(username)) return '3–30 characters: letters, numbers, dots, dashes or underscores.'
                    if (takenUsernames.includes(username)) return 'This username is already taken.'
                    return true
                  },
                },
                { mono: true },
              )}
              {textField('oEmail', 'Email', { validate: email('Owner email') }, { type: 'email' })}
              {textField('oPhoneNumber', 'Phone', { validate: phone('Owner phone') }, { type: 'tel', placeholder: '+237 6XX XXX XXX' })}
              {textField('city', 'City', { validate: required('City') })}
              {textField('neighborhood', 'Neighborhood', { validate: required('Neighborhood') })}
            </div>
          </section>
        )}

        <section>
          <h3 className={sectionTitle}>Subscription</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <FormField label="Plan" htmlFor={fieldId('subscriptionPlan')} error={errors.subscriptionPlan?.message}>
              <select
                id={fieldId('subscriptionPlan')}
                aria-invalid={errors.subscriptionPlan ? true : undefined}
                aria-describedby={errors.subscriptionPlan ? `${fieldId('subscriptionPlan')}-error` : undefined}
                {...register('subscriptionPlan', { validate: required('Plan') })}
                className={`${fieldClass} ${invalidClass}`}
              >
                {loadingPlans ? (
                  <option value="">Loading plans…</option>
                ) : (
                  plans.length === 0 && <option value="">No active plans</option>
                )}
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.monthlyPrice === null ? plan.name : `${plan.name} · ${formatXaf(plan.monthlyPrice)}/month`}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Status"
              htmlFor={fieldId('status')}
              hint={editing ? undefined : `A trial lasts ${TRIAL_DAYS} days`}
            >
              <select id={fieldId('status')} {...register('status')} className={fieldClass}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {TENANT_STATUSES[status].label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </section>
      </form>
    </Modal>
  )
}

export default TenantFormDialog
