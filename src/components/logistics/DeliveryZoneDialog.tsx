import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import type { BranchOption } from '../../services/branchApi'
import type { DeliveryZone, DeliveryZoneRequest } from '../../types/deliveryZone'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'delivery-zone-form'
const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

// Fees are typed as text so an empty field reads as missing, not 0
type ZoneFormValues = {
  name: string
  branchId: string
  collectionFee: string
  deliveryFee: string
  neighborhoods: string[]
}

const fee = (label: string) => (value: string) => {
  if (value.trim() === '') return `${label} is required.`
  const amount = Number(value)
  return (Number.isInteger(amount) && amount >= 0) || `${label} must be a whole amount of 0 or more.`
}

type DeliveryZoneDialogProps = {
  // Present when editing
  initial?: DeliveryZone
  branches: BranchOption[]
  // Server error from the last save, shown above the form
  error?: string | null
  onClose: () => void
  onSave: (zone: DeliveryZoneRequest) => Promise<void>
}

function DeliveryZoneDialog({ initial, branches, error, onClose, onSave }: DeliveryZoneDialogProps) {
  const id = useId()
  const editing = initial !== undefined
  const fieldId = (name: keyof ZoneFormValues) => `${id}-${name}`
  const [draft, setDraft] = useState('')
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ZoneFormValues>({
    defaultValues: initial
      ? {
          name: initial.name,
          branchId: initial.branchId,
          collectionFee: String(initial.collectionFee),
          deliveryFee: String(initial.deliveryFee),
          neighborhoods: initial.neighborhoods,
        }
      : { name: '', branchId: branches.length === 1 ? branches[0].uuid : '', collectionFee: '', deliveryFee: '', neighborhoods: [] },
  })

  const describedBy = (name: keyof ZoneFormValues) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${fieldId(name)}-error` } : {}

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name || 'zone'}` : 'New delivery zone'}
      subtitle="The fees charged for pickups and deliveries in these neighborhoods."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Saving…' : editing ? 'Save Zone' : 'Create Zone'}
          </button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit((values) =>
          onSave({
            name: values.name.trim(),
            branchId: values.branchId,
            collectionFee: Number(values.collectionFee),
            deliveryFee: Number(values.deliveryFee),
            neighborhood: values.neighborhoods,
          }),
        )}
        className="grid gap-3 sm:grid-cols-2"
      >
        {error && (
          <div className="sm:col-span-2">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <FormField label="Zone name" htmlFor={fieldId('name')} error={errors.name?.message}>
          <input
            id={fieldId('name')}
            autoComplete="off"
            placeholder="e.g. Bonapriso"
            {...describedBy('name')}
            {...register('name', { validate: (value) => value.trim() !== '' || 'Zone name is required.' })}
            className={`${fieldClass} ${invalidClass}`}
          />
        </FormField>

        <FormField
          label="Branch"
          htmlFor={fieldId('branchId')}
          hint={editing ? 'A zone stays on the branch it was created for.' : undefined}
          error={errors.branchId?.message}
        >
          <select
            id={fieldId('branchId')}
            disabled={editing}
            {...describedBy('branchId')}
            {...register('branchId', { validate: (value) => value !== '' || 'Choose a branch.' })}
            className={`${fieldClass} ${invalidClass}`}
          >
            <option value="">Choose a branch</option>
            {/* Keeps the zone's branch selectable even if the dropdown doesn't list it */}
            {editing && !branches.some(({ uuid }) => uuid === initial.branchId) && (
              <option value={initial.branchId}>{initial.branchName || initial.branchId}</option>
            )}
            {branches.map(({ uuid, name }) => (
              <option key={uuid} value={uuid}>
                {name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Collection fee (XAF)" htmlFor={fieldId('collectionFee')} hint="Charged for a pickup" error={errors.collectionFee?.message}>
          <input
            id={fieldId('collectionFee')}
            type="number"
            inputMode="numeric"
            min={0}
            {...describedBy('collectionFee')}
            {...register('collectionFee', { validate: fee('Collection fee') })}
            className={`${fieldClass} ${invalidClass}`}
          />
        </FormField>

        <FormField label="Delivery fee (XAF)" htmlFor={fieldId('deliveryFee')} hint="Charged for a delivery" error={errors.deliveryFee?.message}>
          <input
            id={fieldId('deliveryFee')}
            type="number"
            inputMode="numeric"
            min={0}
            {...describedBy('deliveryFee')}
            {...register('deliveryFee', { validate: fee('Delivery fee') })}
            className={`${fieldClass} ${invalidClass}`}
          />
        </FormField>

        <Controller
          control={control}
          name="neighborhoods"
          rules={{ validate: (value) => value.length > 0 || 'Add at least one neighborhood.' }}
          render={({ field: { value, onChange } }) => {
            // Adds what was typed; commas split it into several neighborhoods
            const commit = () => {
              const added = draft
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part && !value.some((existing) => existing.toLowerCase() === part.toLowerCase()))
              if (added.length) onChange([...value, ...added])
              setDraft('')
            }
            const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Backspace' && draft === '' && value.length) {
                onChange(value.slice(0, -1))
              }
            }
            return (
              <FormField
                wide
                label="Neighborhoods"
                htmlFor={fieldId('neighborhoods')}
                hint="Press Enter or a comma after each one."
                error={errors.neighborhoods?.message}
              >
                <div
                  className={`flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md bg-field px-3 py-1.5 text-xs font-medium text-ink transition focus-within:bg-white focus-within:ring-2 focus-within:ring-brand ${
                    errors.neighborhoods ? 'ring-2 ring-danger' : ''
                  }`}
                >
                  {value.map((name) => (
                    <span key={name} className="flex items-center gap-1 rounded-full bg-brand/10 py-0.5 pr-1 pl-2 text-[11px] font-semibold text-brand">
                      {name}
                      <button
                        type="button"
                        onClick={() => onChange(value.filter((item) => item !== name))}
                        aria-label={`Remove ${name}`}
                        className="rounded-full p-0.5 hover:bg-brand/20"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    id={fieldId('neighborhoods')}
                    autoComplete="off"
                    value={draft}
                    placeholder={value.length ? '' : 'e.g. Bonapriso, Bonanjo'}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commit}
                    {...describedBy('neighborhoods')}
                    className="min-w-32 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
              </FormField>
            )
          }}
        />
      </form>
    </Modal>
  )
}

export default DeliveryZoneDialog
