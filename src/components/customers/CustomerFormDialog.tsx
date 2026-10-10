import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TAGS,
  LAUNDRY_OPTIONS,
} from '../../constants/customers'
import { BRANCHES, CURRENT_USER, SERVICES } from '../../constants/orders'
import { customerStore } from '../../hooks/useCustomers'
import type {
  Consent,
  CrmCustomer,
  CustomerKind,
  CustomerStatus,
} from '../../types/customer'
import type { FulfilmentMethod } from '../../types/order'
import {
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'

const FORM_ID = 'customer-form'

type CustomerFormDialogProps = {
  // Present when editing an existing customer
  customer?: CrmCustomer
  canManage: boolean
  onClose: () => void
  onSave: (customer: CrmCustomer, createOrder: boolean) => void
}

function Field({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}

function CustomerFormDialog({
  customer,
  canManage,
  onClose,
  onSave,
}: CustomerFormDialogProps) {
  const defaultAddress = customer?.addresses.find(({ isDefault }) => isDefault)
  const [kind, setKind] = useState<CustomerKind>(customer?.kind ?? 'individual')
  const [firstName, setFirstName] = useState(
    customer?.kind === 'individual' ? customer.name.split(' ')[0] : '',
  )
  const [lastName, setLastName] = useState(
    customer?.kind === 'individual'
      ? customer.name.split(' ').slice(1).join(' ')
      : '',
  )
  const [company, setCompany] = useState(
    customer?.kind === 'corporate' ? customer.name : '',
  )
  const [contact, setContact] = useState(customer?.corporate?.contact ?? '')
  const [taxId, setTaxId] = useState(customer?.corporate?.taxId ?? '')
  const [terms, setTerms] = useState(customer?.corporate?.terms ?? 'Net 30')
  const [creditLimit, setCreditLimit] = useState(
    String(customer?.corporate?.creditLimit ?? ''),
  )
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [branch, setBranch] = useState(customer?.branch ?? BRANCHES[0])
  const [status, setStatus] = useState<CustomerStatus>(customer?.status ?? 'new')
  const [street, setStreet] = useState(defaultAddress?.street ?? '')
  const [city, setCity] = useState(defaultAddress?.city ?? 'Douala')
  const [region, setRegion] = useState(defaultAddress?.region ?? 'Littoral')
  const [landmark, setLandmark] = useState(defaultAddress?.landmark ?? '')
  const [service, setService] = useState(
    customer?.preferredService ?? SERVICES[0],
  )
  const [method, setMethod] = useState<FulfilmentMethod>(
    customer?.delivery.method ?? 'pickup',
  )
  const [detergent, setDetergent] = useState(
    customer?.laundry.detergent ?? LAUNDRY_OPTIONS.detergent[0],
  )
  const [softener, setSoftener] = useState(
    customer?.laundry.softener ?? LAUNDRY_OPTIONS.softener[0],
  )
  const [instructions, setInstructions] = useState(
    customer?.laundry.instructions ?? '',
  )
  const [consent, setConsent] = useState<Consent>(
    customer?.consent ?? {
      sms: true,
      email: false,
      whatsapp: true,
      marketing: false,
    },
  )
  const [tags, setTags] = useState<string[]>(customer?.tags ?? [])
  const [note, setNote] = useState('')

  const name =
    kind === 'corporate' ? company.trim() : `${firstName} ${lastName}`.trim()
  const valid = name !== '' && phone.trim() !== ''

  function buildCustomer(): CrmCustomer {
    const now = new Date().toISOString()
    const address = {
      id: defaultAddress?.id ?? 'address-1',
      label: defaultAddress?.label ?? (kind === 'corporate' ? 'Main site' : 'Home'),
      street: street.trim(),
      city: city.trim(),
      region: region.trim(),
      landmark: landmark.trim(),
      instructions: defaultAddress?.instructions ?? '',
      isDefault: true,
    }
    const otherAddresses =
      customer?.addresses.filter(({ isDefault }) => !isDefault) ?? []
    const newNote = note.trim()
      ? [{ id: `note-${Date.now()}`, text: note.trim(), by: CURRENT_USER, at: now }]
      : []

    return {
      id: customer?.id ?? customerStore.nextId(),
      name,
      kind,
      phone: phone.trim(),
      email: email.trim(),
      status,
      points: customer?.points ?? 0,
      branch,
      registeredAt: customer?.registeredAt ?? now,
      lastOrderAt: customer?.lastOrderAt ?? null,
      orders: customer?.orders ?? 0,
      spent: customer?.spent ?? 0,
      outstanding: customer?.outstanding ?? 0,
      outstandingOrders: customer?.outstandingOrders ?? 0,
      preferredService: service,
      cadenceDays: customer?.cadenceDays ?? 30,
      tags,
      addresses: street.trim() ? [address, ...otherAddresses] : otherAddresses,
      laundry: {
        detergent,
        softener,
        folding: customer?.laundry.folding ?? LAUNDRY_OPTIONS.folding[0],
        packaging: customer?.laundry.packaging ?? LAUNDRY_OPTIONS.packaging[0],
        ironing: customer?.laundry.ironing ?? false,
        instructions: instructions.trim(),
      },
      delivery: {
        method,
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
      consent,
      corporate:
        kind === 'corporate'
          ? {
              contact: contact.trim(),
              taxId: taxId.trim(),
              billingAddress:
                customer?.corporate?.billingAddress ??
                [street, city].filter(Boolean).join(', '),
              terms,
              creditLimit: Number(creditLimit) || 0,
              contract: customer?.corporate?.contract ?? '',
            }
          : undefined,
      archived: false,
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    onSave(buildCustomer(), submitter?.getAttribute('value') === 'order')
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
              disabled={!valid}
              className={secondaryButton}
            >
              Save & Create Order
            </button>
          )}
          <button
            type="submit"
            form={FORM_ID}
            value="save"
            disabled={!valid}
            className={primaryButton}
          >
            Save Customer
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <section>
          <h3 className={sectionTitle}>Basic information</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Customer type" htmlFor="customer-kind">
              <select
                id="customer-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as CustomerKind)}
                className={fieldClass}
              >
                <option value="individual">Individual</option>
                <option value="corporate">Corporate</option>
              </select>
            </Field>
            {kind === 'corporate' ? (
              <>
                <Field label="Company name" htmlFor="customer-company">
                  <input
                    id="customer-company"
                    required
                    autoComplete="off"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Contact person" htmlFor="customer-contact">
                  <input
                    id="customer-contact"
                    autoComplete="off"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Tax / business ID" htmlFor="customer-tax">
                  <input
                    id="customer-tax"
                    autoComplete="off"
                    value={taxId}
                    onChange={(event) => setTaxId(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Payment terms" htmlFor="customer-terms">
                  <select
                    id="customer-terms"
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                    className={fieldClass}
                  >
                    {['Due on receipt', 'Net 15', 'Net 30'].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Credit limit (XAF)" htmlFor="customer-credit">
                  <input
                    id="customer-credit"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={creditLimit}
                    onChange={(event) => setCreditLimit(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </>
            ) : (
              <>
                <span className="max-sm:hidden" />
                <Field label="First name" htmlFor="customer-first-name">
                  <input
                    id="customer-first-name"
                    required
                    autoComplete="off"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Last name" htmlFor="customer-last-name">
                  <input
                    id="customer-last-name"
                    autoComplete="off"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </>
            )}
            <Field label="Phone number" htmlFor="customer-phone">
              <input
                id="customer-phone"
                type="tel"
                required
                autoComplete="off"
                placeholder="+237 6XX XXX XXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Email (optional)" htmlFor="customer-email">
              <input
                id="customer-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Account</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Branch" htmlFor="customer-branch">
              <select
                id="customer-branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className={fieldClass}
              >
                {BRANCHES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Customer status" htmlFor="customer-status">
              <select
                id="customer-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CustomerStatus)
                }
                className={fieldClass}
              >
                {CUSTOMER_STATUSES.filter(
                  ({ id }) => id !== 'suspended' || canManage,
                ).map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Address</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Address" htmlFor="customer-street" wide>
              <input
                id="customer-street"
                autoComplete="off"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="City" htmlFor="customer-city">
              <input
                id="customer-city"
                autoComplete="off"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Region" htmlFor="customer-region">
              <input
                id="customer-region"
                autoComplete="off"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Landmark" htmlFor="customer-landmark" wide>
              <input
                id="customer-landmark"
                autoComplete="off"
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Preferences</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Preferred service" htmlFor="customer-service">
              <select
                id="customer-service"
                value={service}
                onChange={(event) => setService(event.target.value)}
                className={fieldClass}
              >
                {SERVICES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Preferred handover" htmlFor="customer-method">
              <select
                id="customer-method"
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as FulfilmentMethod)
                }
                className={fieldClass}
              >
                <option value="pickup">Customer pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </Field>
            <Field label="Detergent" htmlFor="customer-detergent">
              <select
                id="customer-detergent"
                value={detergent}
                onChange={(event) => setDetergent(event.target.value)}
                className={fieldClass}
              >
                {LAUNDRY_OPTIONS.detergent.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Fabric softener" htmlFor="customer-softener">
              <select
                id="customer-softener"
                value={softener}
                onChange={(event) => setSoftener(event.target.value)}
                className={fieldClass}
              >
                {LAUNDRY_OPTIONS.softener.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Special laundry instructions" htmlFor="customer-instructions" wide>
              <input
                id="customer-instructions"
                placeholder="e.g. Do not use bleach."
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        <fieldset>
          <legend className={sectionTitle}>Communication</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['sms', 'SMS'],
                ['email', 'Email'],
                ['whatsapp', 'WhatsApp'],
                ['marketing', 'Consents to marketing messages'],
              ] as [keyof Consent, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink"
              >
                <input
                  type="checkbox"
                  checked={consent[key]}
                  onChange={(event) =>
                    setConsent({ ...consent, [key]: event.target.checked })
                  }
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={sectionTitle}>Tags</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CUSTOMER_TAGS.map((tag) => {
              const selected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setTags(
                      selected
                        ? tags.filter((current) => current !== tag)
                        : [...tags, tag],
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
        </fieldset>

        {!customer && (
          <Field label="Notes" htmlFor="customer-note">
            <textarea
              id="customer-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={`${fieldClass} h-auto py-2`}
            />
          </Field>
        )}
      </form>
    </Modal>
  )
}

export default CustomerFormDialog
