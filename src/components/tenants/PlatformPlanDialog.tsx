import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { PLATFORM_MODULES } from '../../constants/platformPlans'
import type { PlatformModule, PlatformPlan } from '../../types/platformPlan'
import type { Tenant } from '../../types/tenant'
import { PLAN_CODE_PATTERN } from '../../utils/platformPlans'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'platform-plan-form'
const MODULES = Object.keys(PLATFORM_MODULES) as PlatformModule[]
const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

// Numbers are typed as text so a blank field can mean unlimited / none
type PlanFormValues = {
  code: string
  name: string
  monthlyPrice: string
  annualPrice: string
  maxShops: string
  maxStaff: string
  maxOrdersPerMonth: string
  trialPeriodDays: string
  enabledFeatures: PlatformModule[]
  active: boolean
}
type NumberField = 'monthlyPrice' | 'annualPrice' | 'maxShops' | 'maxStaff' | 'maxOrdersPerMonth' | 'trialPeriodDays'

const EMPTY_FORM: PlanFormValues = {
  code: '',
  name: '',
  monthlyPrice: '',
  annualPrice: '',
  maxShops: '',
  maxStaff: '',
  maxOrdersPerMonth: '',
  trialPeriodDays: '14',
  enabledFeatures: ['ORDERS', 'CUSTOMERS', 'SERVICES', 'PAYMENTS'],
  active: true,
}

const optional = (value: number | null) => (value === null ? '' : String(value))
const toNumber = (value: string) => (value.trim() === '' ? null : Number(value))

function formFromPlan(plan: PlatformPlan): PlanFormValues {
  return {
    code: plan.code,
    name: plan.name,
    monthlyPrice: String(plan.monthlyPrice),
    annualPrice: optional(plan.annualPrice),
    maxShops: optional(plan.maxShops),
    maxStaff: optional(plan.maxStaff),
    maxOrdersPerMonth: optional(plan.maxOrdersPerMonth),
    trialPeriodDays: String(plan.trialPeriodDays),
    enabledFeatures: plan.enabledFeatures,
    active: plan.active,
  }
}

function planFromForm(values: PlanFormValues): PlatformPlan {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    monthlyPrice: Number(values.monthlyPrice),
    annualPrice: toNumber(values.annualPrice),
    maxShops: toNumber(values.maxShops),
    maxStaff: toNumber(values.maxStaff),
    maxOrdersPerMonth: toNumber(values.maxOrdersPerMonth),
    trialPeriodDays: Number(values.trialPeriodDays),
    // Kept in the checklist's order
    enabledFeatures: MODULES.filter((module) => values.enabledFeatures.includes(module)),
    active: values.active,
  }
}

function wholeNumber(label: string, { min, max, required }: { min: number; max?: number; required: boolean }) {
  return (value: string) => {
    if (value.trim() === '') return !required || `${label} is required.`
    const number = Number(value)
    if (!Number.isInteger(number) || number < min) return `${label} must be a whole number of at least ${min}.`
    return max === undefined || number <= max || `${label} can't be more than ${max}.`
  }
}

type PlatformPlanDialogProps = {
  // Present when editing
  initial?: PlatformPlan
  // Codes other plans already use
  takenCodes: string[]
  // Tenants still subscribed to this plan (editing only)
  subscribers: Tenant[]
  // Server error from the last save, shown above the form
  error?: string | null
  onClose: () => void
  onSave: (plan: PlatformPlan) => Promise<void>
}

function PlatformPlanDialog({ initial, takenCodes, subscribers, error, onClose, onSave }: PlatformPlanDialogProps) {
  const id = useId()
  const editing = initial !== undefined
  const fieldId = (name: keyof PlanFormValues) => `${id}-${name}`
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({ defaultValues: initial ? formFromPlan(initial) : EMPTY_FORM })

  const [shopInput, staffInput, active] = useWatch({ control, name: ['maxShops', 'maxStaff', 'active'] })
  const shopLimit = toNumber(shopInput)
  const staffLimit = toNumber(staffInput)
  const overLimit = subscribers.filter(
    (tenant) => (shopLimit !== null && tenant.branches > shopLimit) || (staffLimit !== null && tenant.users > staffLimit),
  )

  const describedBy = (name: keyof PlanFormValues) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${fieldId(name)}-error` } : {}

  function numberField(
    name: NumberField,
    label: string,
    rules: Parameters<typeof wholeNumber>[1],
    { hint, placeholder, step }: { hint?: string; placeholder?: string; step?: number } = {},
  ) {
    return (
      <FormField label={label} htmlFor={fieldId(name)} hint={hint} error={errors[name]?.message}>
        <input
          id={fieldId(name)}
          type="number"
          inputMode="numeric"
          min={rules.min}
          max={rules.max}
          step={step}
          placeholder={placeholder}
          {...describedBy(name)}
          {...register(name, { validate: wholeNumber(label, rules) })}
          className={`${fieldClass} ${invalidClass}`}
        />
      </FormField>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name}` : 'New subscription plan'}
      subtitle={
        editing
          ? `${subscribers.length} ${subscribers.length === 1 ? 'tenant is' : 'tenants are'} on this plan.`
          : 'Tenants can be put on this plan as soon as it is saved and active.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Saving…' : editing ? 'Save Plan' : 'Create Plan'}
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit((values) => onSave(planFromForm(values)))}
        className="space-y-5"
      >
        {error && <FormAlert>{error}</FormAlert>}

        <section>
          <h3 className={sectionTitle}>Plan</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Name" htmlFor={fieldId('name')} error={errors.name?.message}>
              <input
                id={fieldId('name')}
                autoFocus
                placeholder="e.g. Business"
                {...describedBy('name')}
                {...register('name', { validate: (value) => value.trim() !== '' || 'Name is required.' })}
                className={`${fieldClass} ${invalidClass}`}
              />
            </FormField>
            <FormField
              label="Code"
              htmlFor={fieldId('code')}
              hint={editing ? 'Tenants refer to this code, so it can’t change' : 'e.g. BUSINESS. Can’t be changed later'}
              error={errors.code?.message}
            >
              <input
                id={fieldId('code')}
                readOnly={editing}
                placeholder="BUSINESS"
                autoCapitalize="characters"
                {...describedBy('code')}
                {...register('code', {
                  validate: (value) => {
                    if (editing) return true
                    const code = value.trim().toUpperCase()
                    if (!code) return 'Code is required.'
                    if (!PLAN_CODE_PATTERN.test(code)) return 'Use 2–30 capital letters, digits or underscores, starting with a letter.'
                    return !takenCodes.includes(code) || 'Another plan already uses this code.'
                  },
                })}
                className={`${fieldClass} ${invalidClass} font-mono uppercase read-only:cursor-not-allowed read-only:text-muted`}
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Pricing (XAF)</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {numberField('monthlyPrice', 'Monthly price', { min: 0, required: true }, { step: 500 })}
            {numberField('annualPrice', 'Annual price', { min: 0, required: false }, { step: 500, placeholder: 'None', hint: 'Blank = monthly billing only' })}
            {numberField('trialPeriodDays', 'Trial (days)', { min: 0, max: 365, required: true }, { hint: '0 = no trial' })}
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Limits</h3>
          <p className="mt-1 text-[11px] text-muted">Leave a limit blank for unlimited.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {numberField('maxShops', 'Shops', { min: 1, required: false }, { placeholder: 'Unlimited' })}
            {numberField('maxStaff', 'Staff', { min: 1, required: false }, { placeholder: 'Unlimited' })}
            {numberField('maxOrdersPerMonth', 'Orders / month', { min: 1, required: false }, { placeholder: 'Unlimited', step: 100 })}
          </div>
          {overLimit.length > 0 && (
            <p role="status" className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-[11px] font-semibold text-ink">
              {overLimit.length === 1 ? '1 tenant is' : `${overLimit.length} tenants are`} already over these limits:{' '}
              {overLimit.map(({ name }) => name).join(', ')}. They keep what they have but can’t add more.
            </p>
          )}
        </section>

        <section>
          <h3 className={sectionTitle}>Modules</h3>
          <Controller
            control={control}
            name="enabledFeatures"
            rules={{ validate: (value) => value.length > 0 || 'Turn on at least one module.' }}
            render={({ field: { value, onChange } }) => (
              <fieldset aria-describedby={errors.enabledFeatures ? fieldId('enabledFeatures') : undefined}>
                <legend className="sr-only">Modules included in the plan</legend>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {MODULES.map((module) => (
                    <label key={module} className="flex items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={value.includes(module)}
                        onChange={(event) =>
                          onChange(event.target.checked ? [...value, module] : value.filter((item) => item !== module))
                        }
                        className="size-4 accent-brand"
                      />
                      {PLATFORM_MODULES[module]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          />
          {errors.enabledFeatures && (
            <p id={fieldId('enabledFeatures')} className="mt-1 text-[11px] font-semibold text-danger">
              {errors.enabledFeatures.message}
            </p>
          )}
        </section>

        <section>
          <label className="flex items-start gap-2 text-xs font-semibold text-ink">
            <input type="checkbox" {...register('active')} className="mt-0.5 size-4 accent-brand" />
            <span>
              Active
              <span className="block text-[11px] font-normal text-muted">
                {active
                  ? 'Can be chosen for new tenants.'
                  : 'Hidden from new tenants. Tenants already on it keep it.'}
              </span>
            </span>
          </label>
        </section>
      </form>
    </Modal>
  )
}

export default PlatformPlanDialog
