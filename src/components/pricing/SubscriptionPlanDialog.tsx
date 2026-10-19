import { useId } from 'react'
import type { BaseSyntheticEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldError } from 'react-hook-form'
import { CURRENT_USER } from '../../constants/orders'
import { ALLOWANCE_UNITS, BILLING_CYCLES } from '../../constants/subscriptions'
import type { LaundryService } from '../../types/service'
import type { AllowanceUnit, BillingCycle, SubscriptionPlan } from '../../types/subscription'
import { formatXaf } from '../../utils/orders'
import { listValue, monthlyPrice } from '../../utils/subscriptions'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'
import StatTile from '../ui/StatTile'

const FORM_ID = 'subscription-plan-form'

const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'
const checkboxClass = 'size-4 rounded accent-brand'
const checkLabelClass = 'flex items-center gap-2 text-xs font-semibold text-ink'

type PlanFormValues = {
  name: string
  description: string
  featured: boolean
  price: string
  cycle: BillingCycle
  setupFee: string
  trialDays: string
  minCycles: string
  autoRenew: boolean
  allowanceUnit: AllowanceUnit
  unlimited: boolean
  allowance: string
  overageRate: string
  rollover: boolean
  serviceIds: string[]
  freePickups: string
  extrasDiscountPct: string
  allBranches: boolean
  branches: string[]
}

type SubscriptionPlanDialogProps = {
  // Present when editing
  plan?: SubscriptionPlan
  // Present when duplicating: a starting point for a new plan
  template?: SubscriptionPlan
  nextId: string
  services: LaundryService[]
  branches: string[]
  takenNames: string[]
  onClose: () => void
  onSave: (plan: SubscriptionPlan, publish: boolean) => void
}

function defaultValues(plan?: SubscriptionPlan): PlanFormValues {
  return {
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    featured: plan?.featured ?? false,
    price: plan ? String(plan.price) : '',
    cycle: plan?.cycle ?? 'monthly',
    setupFee: String(plan?.setupFee ?? 0),
    trialDays: String(plan?.trialDays ?? 0),
    minCycles: String(plan?.minCycles ?? 0),
    autoRenew: plan?.autoRenew ?? true,
    allowanceUnit: plan?.allowanceUnit ?? 'kg',
    unlimited: plan ? plan.allowance === null : false,
    allowance: plan?.allowance != null ? String(plan.allowance) : '',
    overageRate: String(plan?.overageRate ?? 0),
    rollover: plan?.rollover ?? false,
    serviceIds: plan?.serviceIds ?? [],
    freePickups: String(plan?.freePickups ?? 0),
    extrasDiscountPct: String(plan?.extrasDiscountPct ?? 0),
    allBranches: plan ? plan.branches.length === 0 : true,
    branches: plan?.branches ?? [],
  }
}

const wholeNumber = (label: string, { min = 0, max }: { min?: number; max?: number } = {}) =>
  (value: string) => {
    if (value.trim() === '') return `${label} is required.`
    const number = Number(value)
    if (!Number.isInteger(number) || number < min) return `${label} must be a whole number of at least ${min}.`
    if (max !== undefined && number > max) return `${label} can't be more than ${max}.`
    return true
  }

function SubscriptionPlanDialog({
  plan,
  template,
  nextId,
  services,
  branches,
  takenNames,
  onClose,
  onSave,
}: SubscriptionPlanDialogProps) {
  const id = useId()
  const editing = plan !== undefined
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PlanFormValues>({
    defaultValues: defaultValues(
      plan ?? (template && { ...template, name: `${template.name} (copy)` }),
    ),
  })
  const values = useWatch({ control })
  const fieldId = (name: string) => `${id}-${name}`
  const describedBy = (name: string, error?: FieldError) =>
    error ? `${fieldId(name)}-error` : undefined

  // Live summary of what customers would pay
  const price = Number(values.price) || 0
  const allowance = values.unlimited ? null : Number(values.allowance) || 0
  const unit = ALLOWANCE_UNITS[values.allowanceUnit ?? 'kg'].short
  const atListPrice = listValue(
    { allowance, allowanceUnit: values.allowanceUnit ?? 'kg', serviceIds: values.serviceIds ?? [] },
    services,
  )
  const saving = atListPrice && price ? Math.round((1 - price / atListPrice) * 100) : null

  function onValid(form: PlanFormValues, event?: BaseSyntheticEvent) {
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter
    const now = new Date().toISOString()
    onSave(
      {
        id: plan?.id ?? nextId,
        name: form.name.trim(),
        description: form.description.trim(),
        status: plan?.status ?? 'draft',
        price: Number(form.price),
        cycle: form.cycle,
        allowance: form.unlimited ? null : Number(form.allowance),
        allowanceUnit: form.allowanceUnit,
        overageRate: form.unlimited ? 0 : Number(form.overageRate),
        rollover: !form.unlimited && form.rollover,
        serviceIds: form.serviceIds,
        freePickups: Number(form.freePickups),
        extrasDiscountPct: Number(form.extrasDiscountPct),
        branches: form.allBranches ? [] : form.branches,
        trialDays: Number(form.trialDays),
        minCycles: Number(form.minCycles),
        setupFee: Number(form.setupFee),
        autoRenew: form.autoRenew,
        featured: form.featured,
        subscribers: plan?.subscribers ?? 0,
        createdAt: plan?.createdAt ?? now,
        updatedAt: now,
        updatedBy: CURRENT_USER,
      },
      submitter?.getAttribute('value') === 'publish',
    )
  }

  const numberInput = (
    name: 'price' | 'setupFee' | 'trialDays' | 'minCycles' | 'allowance' | 'overageRate' | 'freePickups' | 'extrasDiscountPct',
    validate: (value: string) => true | string,
    disabled = false,
  ) => (
    <input
      id={fieldId(name)}
      type="number"
      inputMode="numeric"
      min={0}
      disabled={disabled}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={describedBy(name, errors[name])}
      {...register(name, { validate: (value) => disabled || validate(value) })}
      className={`${fieldClass} tabular-nums disabled:opacity-50 ${invalidClass}`}
    />
  )

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={editing ? `Edit ${plan.name}` : 'New Subscription Plan'}
      subtitle={editing ? plan.id : 'A recurring laundry package customers subscribe to'}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          {editing && plan.status !== 'draft' ? (
            <button type="submit" form={FORM_ID} value="save" className={primaryButton}>
              Save Changes
            </button>
          ) : (
            <>
              <button type="submit" form={FORM_ID} value="draft" className={secondaryButton}>
                Save as Draft
              </button>
              <button type="submit" form={FORM_ID} value="publish" className={primaryButton}>
                Publish Plan
              </button>
            </>
          )}
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit(onValid)} className="space-y-5">
        <section>
          <h3 className={sectionTitle}>Plan</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Plan name" htmlFor={fieldId('name')} error={errors.name?.message}>
              <input
                id={fieldId('name')}
                autoComplete="off"
                autoFocus
                placeholder="e.g. Family Monthly"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy('name', errors.name)}
                {...register('name', {
                  validate: (value) => {
                    const name = value.trim()
                    if (!name) return 'Plan name is required.'
                    if (takenNames.some((taken) => taken.toLowerCase() === name.toLowerCase())) {
                      return 'Another plan already uses this name.'
                    }
                    return true
                  },
                })}
                className={`${fieldClass} ${invalidClass}`}
              />
            </FormField>
            <div className="flex items-end pb-2">
              <label className={checkLabelClass}>
                <input type="checkbox" {...register('featured')} className={checkboxClass} />
                Highlight as “Most popular”
              </label>
            </div>
            <FormField label="Description" htmlFor={fieldId('description')} wide hint="Shown to customers when they choose a plan">
              <textarea
                id={fieldId('description')}
                rows={2}
                {...register('description')}
                className={`${fieldClass} h-auto py-2`}
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Billing</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Price (XAF)" htmlFor={fieldId('price')} error={errors.price?.message}>
              {numberInput('price', wholeNumber('Price', { min: 1 }))}
            </FormField>
            <FormField label="Billing cycle" htmlFor={fieldId('cycle')}>
              <select id={fieldId('cycle')} {...register('cycle')} className={fieldClass}>
                {(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {BILLING_CYCLES[cycle].label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Setup fee (XAF)" htmlFor={fieldId('setupFee')} error={errors.setupFee?.message} hint="Charged once, on the first invoice">
              {numberInput('setupFee', wholeNumber('Setup fee'))}
            </FormField>
            <FormField label="Free trial (days)" htmlFor={fieldId('trialDays')} error={errors.trialDays?.message}>
              {numberInput('trialDays', wholeNumber('Free trial', { max: 90 }))}
            </FormField>
            <FormField
              label="Minimum commitment (cycles)"
              htmlFor={fieldId('minCycles')}
              error={errors.minCycles?.message}
              hint="0 lets customers cancel anytime"
            >
              {numberInput('minCycles', wholeNumber('Minimum commitment', { max: 36 }))}
            </FormField>
            <div className="flex items-center">
              <label className={checkLabelClass}>
                <input type="checkbox" {...register('autoRenew')} className={checkboxClass} />
                Renew automatically at the end of each cycle
              </label>
            </div>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Allowance</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Measured in" htmlFor={fieldId('allowanceUnit')}>
              <select id={fieldId('allowanceUnit')} {...register('allowanceUnit')} className={fieldClass}>
                {(Object.keys(ALLOWANCE_UNITS) as AllowanceUnit[]).map((option) => (
                  <option key={option} value={option}>
                    {ALLOWANCE_UNITS[option].label}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex items-end pb-2">
              <label className={checkLabelClass}>
                <input type="checkbox" {...register('unlimited')} className={checkboxClass} />
                Unlimited (fair use)
              </label>
            </div>
            <FormField
              label={`Included ${unit} per ${BILLING_CYCLES[values.cycle ?? 'monthly'].per}`}
              htmlFor={fieldId('allowance')}
              error={errors.allowance?.message}
            >
              {numberInput('allowance', wholeNumber('Allowance', { min: 1 }), values.unlimited)}
            </FormField>
            <FormField
              label={`Extra ${unit} rate (XAF each)`}
              htmlFor={fieldId('overageRate')}
              error={errors.overageRate?.message}
              hint="Charged for usage beyond the allowance"
            >
              {numberInput('overageRate', wholeNumber('Extra rate'), values.unlimited)}
            </FormField>
            <label className={`${checkLabelClass} sm:col-span-2 ${values.unlimited ? 'opacity-50' : ''}`}>
              <input type="checkbox" disabled={values.unlimited} {...register('rollover')} className={checkboxClass} />
              Carry unused allowance over to the next cycle
            </label>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Included services</h3>
          <fieldset
            aria-describedby={errors.serviceIds ? `${fieldId('services')}-error` : undefined}
            className="mt-2 grid gap-2 sm:grid-cols-2"
          >
            <legend className="sr-only">Included services</legend>
            {services.map((service) => (
              <label key={service.id} className="flex items-center gap-2 rounded-md bg-field px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  value={service.id}
                  {...register('serviceIds', {
                    validate: (ids) => ids.length > 0 || 'Choose at least one service.',
                  })}
                  className={checkboxClass}
                />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{service.name}</span>
                <span className="text-[10px] text-muted">{service.status === 'active' ? service.id : service.status}</span>
              </label>
            ))}
          </fieldset>
          {errors.serviceIds && (
            <p id={`${fieldId('services')}-error`} className="mt-1 text-[11px] font-semibold text-danger">
              {errors.serviceIds.message}
            </p>
          )}
        </section>

        <section>
          <h3 className={sectionTitle}>Perks & availability</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Free pickups per cycle" htmlFor={fieldId('freePickups')} error={errors.freePickups?.message}>
              {numberInput('freePickups', wholeNumber('Free pickups'))}
            </FormField>
            <FormField
              label="Discount on other services (%)"
              htmlFor={fieldId('extrasDiscountPct')}
              error={errors.extrasDiscountPct?.message}
            >
              {numberInput('extrasDiscountPct', wholeNumber('Discount', { max: 100 }))}
            </FormField>
            <label className={`${checkLabelClass} sm:col-span-2`}>
              <input type="checkbox" {...register('allBranches')} className={checkboxClass} />
              Available at every branch
            </label>
            {!values.allBranches && (
              <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
                <legend className="sr-only">Branches</legend>
                {branches.map((branch) => (
                  <label key={branch} className="flex items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-semibold text-ink">
                    <input
                      type="checkbox"
                      value={branch}
                      {...register('branches', {
                        validate: (selected, form) => form.allBranches || selected.length > 0 || 'Choose at least one branch.',
                      })}
                      className={checkboxClass}
                    />
                    {branch}
                  </label>
                ))}
                {errors.branches && (
                  <p className="w-full text-[11px] font-semibold text-danger">{errors.branches.message}</p>
                )}
              </fieldset>
            )}
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <StatTile label="Monthly equivalent" value={formatXaf(monthlyPrice({ price, cycle: values.cycle ?? 'monthly' }))} />
          <StatTile
            label={`Effective rate per ${unit === 'items' ? 'item' : unit === 'orders' ? 'order' : unit}`}
            value={allowance ? formatXaf(price / allowance) : '—'}
            note={allowance === null ? 'Unlimited plan' : undefined}
          />
          <StatTile
            label="Saving vs list price"
            value={saving === null ? '—' : `${saving}%`}
            note={atListPrice ? `${formatXaf(atListPrice)} at list price` : 'No comparable list price'}
          />
        </section>
      </form>
    </Modal>
  )
}

export default SubscriptionPlanDialog
