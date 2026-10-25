import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { BranchOption } from '../../services/branchApi'
import { useGetLogisticsSettingsQuery, useUpdateLogisticsSettingsMutation } from '../../services/dispatchApi'
import type { LogisticsSettings } from '../../services/dispatchApi'
import { errorMessage, serverMessage } from '../../utils/apiErrors'
import { fieldClass, primaryButton, sectionTitle } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'

type SettingsField = keyof LogisticsSettings
// Typed as text so an empty field reads as missing, not 0
type SettingsForm = Record<SettingsField, string>

const FIELDS: { name: SettingsField; label: string; hint: string }[] = [
  { name: 'pickupFee', label: 'Pickup fee (XAF)', hint: 'Used when a zone has no collection fee' },
  { name: 'expressSurcharge', label: 'Express surcharge (XAF)', hint: 'Added to express jobs' },
  { name: 'sameDaySurcharge', label: 'Same-day surcharge (XAF)', hint: 'Added to same-day jobs' },
  { name: 'freeDeliveryThreshold', label: 'Free delivery from (XAF)', hint: 'No delivery fee when the amount due reaches this' },
  { name: 'delayLimitMinutes', label: 'Delay limit (minutes)', hint: 'How late a job can run before it counts as delayed' },
]

const toForm = (settings: LogisticsSettings): SettingsForm =>
  Object.fromEntries(FIELDS.map(({ name }) => [name, String(settings[name])])) as SettingsForm

const wholeNumber = (label: string) => (value: string) => {
  if (value.trim() === '') return `${label} is required.`
  const amount = Number(value)
  return (Number.isInteger(amount) && amount >= 0) || `${label} must be a whole number of 0 or more.`
}

// The form for one branch; remounted (by key) when the branch changes
function SettingsEditor({ branchId, initial }: { branchId: string; initial: LogisticsSettings }) {
  const id = useId()
  const [updateSettings, { error, reset, isSuccess }] = useUpdateLogisticsSettingsMutation()
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsForm>({ defaultValues: toForm(initial) })

  const saveError =
    error && (serverMessage(error) ?? errorMessage(error, 'Only the business owner can change delivery pricing.'))

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        reset()
        try {
          await updateSettings({
            branchId,
            settings: Object.fromEntries(FIELDS.map(({ name }) => [name, Number(values[name])])) as LogisticsSettings,
          }).unwrap()
          // The saved values become the new baseline
          resetForm(values)
        } catch {
          // The mutation's error drives the message above the form
        }
      })}
      className="space-y-3"
    >
      {saveError && <FormAlert>{saveError}</FormAlert>}
      {isSuccess && !isDirty && <FormAlert tone="success">Delivery pricing saved.</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FIELDS.map(({ name, label, hint }) => (
          <FormField key={name} label={label} htmlFor={`${id}-${name}`} hint={hint} error={errors[name]?.message}>
            <input
              id={`${id}-${name}`}
              type="number"
              inputMode="numeric"
              min={0}
              {...(errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${id}-${name}-error` } : {})}
              {...register(name, { validate: wholeNumber(label.replace(/ \(.*\)$/, '')) })}
              className={`${fieldClass} aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger`}
            />
          </FormField>
        ))}
      </div>
      <button type="submit" disabled={isSubmitting || !isDirty} className={primaryButton}>
        {isSubmitting ? 'Saving…' : 'Save Pricing'}
      </button>
    </form>
  )
}

// Delivery Zones page: the branch-wide fees and limits behind every job's price
function LogisticsSettingsPanel({ branches }: { branches: BranchOption[] }) {
  const id = useId()
  const [picked, setPicked] = useState('')
  const branchId = picked || branches[0]?.uuid || ''
  const { data, isLoading, isError } = useGetLogisticsSettingsQuery(branchId, { skip: !branchId })

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>Branch delivery pricing</h2>
          <p className="mt-1 text-xs text-muted">
            A job’s fee is the zone’s fee plus these surcharges. Only the business owner can change them.
          </p>
        </div>
        {branches.length > 1 && (
          <div className="w-full sm:w-56">
            <label htmlFor={`${id}-branch`} className="sr-only">
              Branch
            </label>
            <select id={`${id}-branch`} value={branchId} onChange={(event) => setPicked(event.target.value)} className={fieldClass}>
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {!branchId ? (
        <p className="text-xs text-muted">No branch to set pricing for.</p>
      ) : isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-field" aria-busy="true" />
      ) : isError || !data ? (
        <p role="alert" className="text-xs text-danger">Couldn’t load this branch’s delivery pricing.</p>
      ) : (
        <SettingsEditor key={branchId} branchId={branchId} initial={data} />
      )}
    </section>
  )
}

export default LogisticsSettingsPanel
