import { useEffect } from 'react'
import type { BaseSyntheticEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TAGS,
  LAUNDRY_OPTIONS,
} from '../../constants/customers'
import { CURRENT_USER, SERVICES } from '../../constants/orders'
import useBranchNames from '../../hooks/useBranchNames'
import useSaveCustomer from '../../hooks/useSaveCustomer'
import type {
  CrmCustomer,
  CustomerKind,
  CustomerStatus,
} from '../../types/customer'
import type { FulfilmentMethod } from '../../types/order'
import { fieldClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'customer-form'

// Customers are contacted on one channel only
type ContactChannel = 'email' | 'sms' | 'whatsapp'

const CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

type CustomerFormDialogProps = {
  // Present when editing an existing customer
  customer?: CrmCustomer
  canManage: boolean
  onClose: () => void
  // Called once the backend has accepted the customer; `id` is the new
  // customer's id when the create response carried it
  onSaved: (customer: CrmCustomer, createOrder: boolean, id: string | null) => void
}

type CustomerFormValues = {
  kind: CustomerKind
  firstName: string
  lastName: string
  company: string
  contact: string
  taxId: string
  terms: string
  creditLimit: string
  phone: string
  email: string
  branch: string
  status: CustomerStatus
  street: string
  city: string
  region: string
  landmark: string
  service: string
  method: FulfilmentMethod
  detergent: string
  softener: string
  instructions: string
  channel: ContactChannel
  marketing: boolean
  tags: string[]
  referralSource: string
  note: string
}

// Suggestions only; any text is accepted
const REFERRAL_SOURCES = ['Walk-in', 'Friend or family', 'Social media', 'Flyer', 'Google', 'Other']

function defaultValues(customer?: CrmCustomer): CustomerFormValues {
  const defaultAddress = customer?.addresses.find(({ isDefault }) => isDefault)
  const individual = customer?.kind === 'individual'
  return {
    kind: customer?.kind ?? 'individual',
    firstName: individual ? customer.name.split(' ')[0] : '',
    lastName: individual ? customer.name.split(' ').slice(1).join(' ') : '',
    company: customer?.kind === 'corporate' ? customer.name : '',
    contact: customer?.corporate?.contact ?? '',
    taxId: customer?.corporate?.taxId ?? '',
    terms: customer?.corporate?.terms ?? 'Net 30',
    creditLimit: String(customer?.corporate?.creditLimit ?? ''),
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    // A new customer gets the first branch once the list loads
    branch: customer?.branch ?? '',
    status: customer?.status ?? 'new',
    street: defaultAddress?.street ?? '',
    city: defaultAddress?.city ?? 'Douala',
    region: defaultAddress?.region ?? 'Littoral',
    landmark: defaultAddress?.landmark ?? '',
    service: customer?.preferredService ?? SERVICES[0],
    method: customer?.delivery.method ?? 'pickup',
    detergent: customer?.laundry.detergent ?? LAUNDRY_OPTIONS.detergent[0],
    softener: customer?.laundry.softener ?? LAUNDRY_OPTIONS.softener[0],
    instructions: customer?.laundry.instructions ?? '',
    // Existing customers may have several channels on; keep the first of them
    channel: CHANNELS.find(({ value }) => customer?.consent[value])?.value ?? 'email',
    marketing: customer?.consent.marketing ?? false,
    tags: customer?.tags ?? [],
    referralSource: customer?.referralSource ?? '',
    note: '',
  }
}

function fullName({ kind, company, firstName, lastName }: Pick<CustomerFormValues, 'kind' | 'company' | 'firstName' | 'lastName'>) {
  return kind === 'corporate' ? company.trim() : `${firstName} ${lastName}`.trim()
}

function buildCustomer(values: CustomerFormValues, customer?: CrmCustomer): CrmCustomer {
  const { kind, street, city } = values
  const defaultAddress = customer?.addresses.find(({ isDefault }) => isDefault)
  const now = new Date().toISOString()
  const address = {
    id: defaultAddress?.id ?? 'address-1',
    label: defaultAddress?.label ?? (kind === 'corporate' ? 'Main site' : 'Home'),
    street: street.trim(),
    city: city.trim(),
    region: values.region.trim(),
    landmark: values.landmark.trim(),
    instructions: defaultAddress?.instructions ?? '',
    isDefault: true,
  }
  const otherAddresses =
    customer?.addresses.filter(({ isDefault }) => !isDefault) ?? []
  const newNote = values.note.trim()
    ? [{ id: `note-${Date.now()}`, text: values.note.trim(), by: CURRENT_USER, at: now }]
    : []

  return {
    // A new customer's id comes from the backend
    id: customer?.id ?? '',
    name: fullName(values),
    kind,
    phone: values.phone.trim(),
    email: values.email.trim(),
    status: values.status,
    points: customer?.points ?? 0,
    branch: values.branch,
    branchId: customer?.branch === values.branch ? customer.branchId : '',
    referralSource: values.referralSource.trim(),
    registeredAt: customer?.registeredAt ?? now,
    lastOrderAt: customer?.lastOrderAt ?? null,
    orders: customer?.orders ?? 0,
    spent: customer?.spent ?? 0,
    outstanding: customer?.outstanding ?? 0,
    outstandingOrders: customer?.outstandingOrders ?? 0,
    preferredService: values.service,
    cadenceDays: customer?.cadenceDays ?? 30,
    tags: values.tags,
    addresses: street.trim() ? [address, ...otherAddresses] : otherAddresses,
    laundry: {
      detergent: values.detergent,
      softener: values.softener,
      folding: customer?.laundry.folding ?? LAUNDRY_OPTIONS.folding[0],
      packaging: customer?.laundry.packaging ?? LAUNDRY_OPTIONS.packaging[0],
      ironing: customer?.laundry.ironing ?? false,
      instructions: values.instructions.trim(),
    },
    delivery: {
      method: values.method,
      window: customer?.delivery.window ?? '',
      instructions: customer?.delivery.instructions ?? '',
    },
    notes: [...newNote, ...(customer?.notes ?? [])],
    communications: customer?.communications ?? [],
    payments: customer?.payments ?? [],
    activity: [
      {
        at: now,
        text: customer ? 'Customer profile updated' : 'Customer registered',
      },
      ...(customer?.activity ?? []),
    ],
    monthlyOrders: customer?.monthlyOrders ?? Array(12).fill(0),
    monthlySpend: customer?.monthlySpend ?? Array(12).fill(0),
    consent: {
      email: values.channel === 'email',
      sms: values.channel === 'sms',
      whatsapp: values.channel === 'whatsapp',
      marketing: values.marketing,
    },
    corporate:
      kind === 'corporate'
        ? {
            contact: values.contact.trim(),
            taxId: values.taxId.trim(),
            billingAddress:
              customer?.corporate?.billingAddress ??
              [street, city].filter(Boolean).join(', '),
            terms: values.terms,
            creditLimit: Number(values.creditLimit) || 0,
            contract: customer?.corporate?.contract ?? '',
          }
        : undefined,
    archived: false,
  }
}

function CustomerFormDialog({
  customer,
  canManage,
  onClose,
  onSaved,
}: CustomerFormDialogProps) {
  const branchNames = useBranchNames()
  const { save, error } = useSaveCustomer()
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { isSubmitting },
  } = useForm<CustomerFormValues>({
    defaultValues: defaultValues(customer),
  })
  const firstBranch = branchNames.names[0]
  useEffect(() => {
    if (!customer && firstBranch && !getValues('branch')) setValue('branch', firstBranch)
  }, [customer, firstBranch, getValues, setValue])
  const [kind, company, firstName, lastName, phone] = useWatch({
    control,
    name: ['kind', 'company', 'firstName', 'lastName', 'phone'],
  })
  const valid =
    fullName({ kind, company, firstName, lastName }) !== '' && phone.trim() !== ''

  // Two submit buttons share this form; the one clicked says whether to go on
  // to a new order
  async function onValid(values: CustomerFormValues, event?: BaseSyntheticEvent) {
    if (!valid) return
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter
    const createOrder = submitter?.getAttribute('value') === 'order'
    const built = buildCustomer(values, customer)
    const result = await save(customer, built)
    if (result.ok) onSaved(built, createOrder, result.id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={customer ? `Edit ${customer.name}` : 'Add Customer'}
      subtitle={customer ? customer.id : 'Register a new customer profile'}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          {!customer && (
            <button
              type="submit"
              form={FORM_ID}
              value="order"
              disabled={!valid || isSubmitting}
              className={secondaryButton}
            >
              Save & Create Order
            </button>
          )}
          <button
            type="submit"
            form={FORM_ID}
            value="save"
            disabled={!valid || isSubmitting}
            className={primaryButton}
          >
            {isSubmitting ? 'Saving…' : 'Save Customer'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onValid)} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}
        <section>
          <h3 className={sectionTitle}>Basic information</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Customer type" htmlFor="customer-kind">
              <select id="customer-kind" {...register('kind')} className={fieldClass}>
                <option value="individual">Individual</option>
                <option value="corporate">Corporate</option>
              </select>
            </FormField>
            {kind === 'corporate' ? (
              <>
                <FormField label="Company name" htmlFor="customer-company">
                  <input
                    id="customer-company"
                    required
                    autoComplete="off"
                    {...register('company')}
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Contact person" htmlFor="customer-contact">
                  <input
                    id="customer-contact"
                    autoComplete="off"
                    {...register('contact')}
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Tax / business ID" htmlFor="customer-tax">
                  <input
                    id="customer-tax"
                    autoComplete="off"
                    {...register('taxId')}
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Payment terms" htmlFor="customer-terms">
                  <select id="customer-terms" {...register('terms')} className={fieldClass}>
                    {['Due on receipt', 'Net 15', 'Net 30'].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Credit limit (XAF)" htmlFor="customer-credit">
                  <input
                    id="customer-credit"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    {...register('creditLimit')}
                    className={fieldClass}
                  />
                </FormField>
              </>
            ) : (
              <>
                <span className="max-sm:hidden" />
                <FormField label="First name" htmlFor="customer-first-name">
                  <input
                    id="customer-first-name"
                    required
                    autoComplete="off"
                    {...register('firstName')}
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Last name" htmlFor="customer-last-name">
                  <input
                    id="customer-last-name"
                    autoComplete="off"
                    {...register('lastName')}
                    className={fieldClass}
                  />
                </FormField>
              </>
            )}
            <FormField label="Phone number" htmlFor="customer-phone">
              <input
                id="customer-phone"
                type="tel"
                required
                autoComplete="off"
                placeholder="+237 6XX XXX XXX"
                {...register('phone')}
                className={fieldClass}
              />
            </FormField>
            <FormField label="Email (optional)" htmlFor="customer-email">
              <input
                id="customer-email"
                type="email"
                autoComplete="off"
                {...register('email')}
                className={fieldClass}
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Account</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField
              label="Branch"
              htmlFor="customer-branch"
              hint={branchNames.isError ? 'Couldn’t load your branches.' : undefined}
            >
              <select id="customer-branch" {...register('branch')} className={fieldClass}>
                {branchNames.isLoading && <option value="">Loading branches…</option>}
                {!branchNames.isLoading && branchNames.names.length === 0 && (
                  <option value="">No branches</option>
                )}
                {branchNames.names.map((option) => (
                  <option key={option}>{option}</option>
                ))}
                {/* Keep an edited customer's branch even if it's no longer listed */}
                {customer?.branch && !branchNames.names.includes(customer.branch) && (
                  <option>{customer.branch}</option>
                )}
              </select>
            </FormField>
            <FormField label="Referral source (optional)" htmlFor="customer-referral" hint="How they heard about you">
              <input
                id="customer-referral"
                list="customer-referral-options"
                autoComplete="off"
                {...register('referralSource')}
                className={fieldClass}
              />
              <datalist id="customer-referral-options">
                {REFERRAL_SOURCES.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Customer status" htmlFor="customer-status">
              <select id="customer-status" {...register('status')} className={fieldClass}>
                {CUSTOMER_STATUSES.filter(
                  ({ id }) => id !== 'suspended' || canManage,
                ).map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Address</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Address" htmlFor="customer-street" wide>
              <input id="customer-street" autoComplete="off" {...register('street')} className={fieldClass} />
            </FormField>
            <FormField label="City" htmlFor="customer-city">
              <input id="customer-city" autoComplete="off" {...register('city')} className={fieldClass} />
            </FormField>
            <FormField label="Region" htmlFor="customer-region">
              <input id="customer-region" autoComplete="off" {...register('region')} className={fieldClass} />
            </FormField>
            <FormField label="Landmark" htmlFor="customer-landmark" wide>
              <input id="customer-landmark" autoComplete="off" {...register('landmark')} className={fieldClass} />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Preferences</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Preferred service" htmlFor="customer-service">
              <select id="customer-service" {...register('service')} className={fieldClass}>
                {SERVICES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Preferred handover" htmlFor="customer-method">
              <select id="customer-method" {...register('method')} className={fieldClass}>
                <option value="pickup">Customer pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </FormField>
            <FormField label="Detergent" htmlFor="customer-detergent">
              <select id="customer-detergent" {...register('detergent')} className={fieldClass}>
                {LAUNDRY_OPTIONS.detergent.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Fabric softener" htmlFor="customer-softener">
              <select id="customer-softener" {...register('softener')} className={fieldClass}>
                {LAUNDRY_OPTIONS.softener.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Special laundry instructions" htmlFor="customer-instructions" wide>
              <input
                id="customer-instructions"
                placeholder="e.g. Do not use bleach."
                {...register('instructions')}
                className={fieldClass}
              />
            </FormField>
          </div>
        </section>

        <fieldset>
          <legend className={sectionTitle}>Communication</legend>
          <p className="mt-1 text-[11px] text-muted">Preferred channel for order updates and receipts</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {CHANNELS.map(({ value, label }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink has-checked:ring-2 has-checked:ring-brand"
              >
                <input
                  type="radio"
                  value={value}
                  {...register('channel')}
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              {...register('marketing')}
              className="size-4 accent-brand"
            />
            Consents to marketing messages
          </label>
        </fieldset>

        <fieldset>
          <legend className={sectionTitle}>Tags</legend>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CUSTOMER_TAGS.map((tag) => {
                  const selected = field.value.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        field.onChange(
                          selected
                            ? field.value.filter((current) => current !== tag)
                            : [...field.value, tag],
                        )
                      }
                      className={`h-7 rounded-full px-3 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                        selected
                          ? 'bg-brand text-white'
                          : 'bg-field text-ink hover:bg-brand/10'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          />
        </fieldset>

        {!customer && (
          <FormField label="Notes" htmlFor="customer-note">
            <textarea
              id="customer-note"
              rows={2}
              {...register('note')}
              className={`${fieldClass} h-auto py-2`}
            />
          </FormField>
        )}
      </form>
    </Modal>
  )
}

export default CustomerFormDialog
