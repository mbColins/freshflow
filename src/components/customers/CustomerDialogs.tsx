import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { CircleAlert, CircleCheck, Upload } from 'lucide-react'
import { CAMPAIGN_TEMPLATES, SEGMENTS } from '../../constants/customers'
import { PAYMENT_METHODS, SERVICES } from '../../constants/orders'
import useBranchNames from '../../hooks/useBranchNames'
import type {
  Address,
  Consent,
  CrmCustomer,
  SegmentId,
} from '../../types/customer'
import type { PaymentMethod } from '../../types/order'
import { createCustomer, inSegment, parseCsv } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import {
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Modal from '../ui/Modal'

// ---------- Import ----------

const IMPORT_FIELDS = [
  { key: 'first_name', label: 'First Name', match: ['first', 'prenom', 'name'] },
  { key: 'last_name', label: 'Last Name', match: ['last', 'surname', 'nom'] },
  { key: 'phone', label: 'Phone', match: ['phone', 'tel', 'mobile'] },
  { key: 'email', label: 'Email', match: ['mail'] },
  { key: 'address', label: 'Address', match: ['address', 'adresse', 'street'] },
] as const

type ImportKey = (typeof IMPORT_FIELDS)[number]['key']
type Mapping = Record<ImportKey, number>

const IMPORT_STEPS = ['Upload File', 'Map Columns', 'Preview & Validate']

function guessMapping(headers: string[]): Mapping {
  const taken = new Set<number>()
  const mapping = {} as Mapping
  for (const { key, match } of IMPORT_FIELDS) {
    const index = headers.findIndex(
      (header, position) =>
        !taken.has(position) &&
        match.some((word) => header.toLowerCase().includes(word)),
    )
    mapping[key] = index
    if (index >= 0) taken.add(index)
  }
  return mapping
}

export function CustomerImportDialog({
  existing,
  onClose,
  onImport,
}: {
  existing: CrmCustomer[]
  onClose: () => void
  onImport: (customers: CrmCustomer[]) => void
}) {
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>(() => guessMapping([]))
  // Imported customers go to the first of the connected user's branches
  const firstBranch = useBranchNames().names[0] ?? ''

  async function handleFile(file: File | undefined) {
    if (!file) return
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) {
      setFileError('This file has no data rows. Use a CSV with a header row.')
      return
    }
    setFileError('')
    setFileName(file.name)
    setHeaders(parsed[0])
    setRows(parsed.slice(1))
    setMapping(guessMapping(parsed[0]))
    setStep(1)
  }

  const cell = (row: string[], key: ImportKey) =>
    mapping[key] >= 0 ? (row[mapping[key]] ?? '') : ''
  const digits = (value: string) => value.replace(/\D/g, '')
  const knownPhones = new Set(existing.map(({ phone }) => digits(phone)))
  const seenPhones = new Set<string>()

  const checked = rows.map((row) => {
    const name = `${cell(row, 'first_name')} ${cell(row, 'last_name')}`.trim()
    const phone = cell(row, 'phone')
    const phoneDigits = digits(phone)
    let error = ''
    if (!name) error = 'Missing name'
    else if (phoneDigits.length < 8) error = 'Missing or invalid phone'
    else if (knownPhones.has(phoneDigits)) error = 'Phone already registered'
    else if (seenPhones.has(phoneDigits)) error = 'Duplicate phone in file'
    seenPhones.add(phoneDigits)
    return {
      name,
      phone,
      email: cell(row, 'email'),
      street: cell(row, 'address'),
      error,
    }
  })
  const valid = checked.filter(({ error }) => !error)
  const mappingReady = mapping.first_name >= 0 && mapping.phone >= 0

  function handleImport() {
    // Placeholder ids: the backend assigns the real ones on POST
    onImport(
      valid.map((fields, index) =>
        createCustomer(
          `import-${index + 1}`,
          fields,
          firstBranch,
          SERVICES[0],
        ),
      ),
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Import Customers"
      subtitle={`Step ${step + 1} of ${IMPORT_STEPS.length}: ${IMPORT_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={secondaryButton}
            >
              Back
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              disabled={!mappingReady}
              onClick={() => setStep(2)}
              className={primaryButton}
            >
              Preview Data
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={valid.length === 0}
              onClick={handleImport}
              className={primaryButton}
            >
              Import {valid.length} {valid.length === 1 ? 'customer' : 'customers'}
            </button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-10 text-center transition hover:border-brand hover:bg-brand/5 focus-within:border-brand">
            <Upload className="size-6 text-muted" aria-hidden="true" />
            <span className="text-sm font-bold text-ink">Choose a CSV file</span>
            <span className="text-xs text-muted">
              First row must be column headers. Excel files: use “Save as CSV”
              first.
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>
          {fileError && (
            <p role="alert" className="text-xs font-semibold text-danger">
              {fileError}
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">{fileName}</span> ·{' '}
            {rows.length} rows. Match each customer field to a column in your
            file.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={`map-${key}`} className={labelClass}>
                  {label}
                  {(key === 'first_name' || key === 'phone') && ' (required)'}
                  <span className="font-mono font-normal text-muted"> → {key}</span>
                </label>
                <select
                  id={`map-${key}`}
                  value={mapping[key]}
                  onChange={(event) =>
                    setMapping({ ...mapping, [key]: Number(event.target.value) })
                  }
                  className={fieldClass}
                >
                  <option value={-1}>Not in file</option>
                  {headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-success">
              <CircleCheck className="size-4" aria-hidden="true" />
              {valid.length} ready to import
            </span>
            {checked.length > valid.length && (
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert className="size-4" aria-hidden="true" />
                {checked.length - valid.length} with errors (will be skipped)
              </span>
            )}
          </p>
          <div className="max-h-72 overflow-auto rounded-lg ring-1 ring-line">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="bg-field text-[9px] font-bold tracking-wider text-muted uppercase">
                  <th scope="col" className="px-3 py-2">Name</th>
                  <th scope="col" className="px-3 py-2">Phone</th>
                  <th scope="col" className="px-3 py-2">Email</th>
                  <th scope="col" className="px-3 py-2">Validation</th>
                </tr>
              </thead>
              <tbody>
                {checked.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">{row.name || '—'}</td>
                    <td className="px-3 py-2">{row.phone || '—'}</td>
                    <td className="px-3 py-2">{row.email || '—'}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${row.error ? 'text-danger' : 'text-success'}`}
                    >
                      {row.error || 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {checked.length > 100 && (
            <p className="text-[11px] text-muted">
              Showing the first 100 of {checked.length} rows.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

// ---------- Campaign ----------

const CHANNELS: { label: string; consent: keyof Consent }[] = [
  { label: 'SMS', consent: 'sms' },
  { label: 'WhatsApp', consent: 'whatsapp' },
  { label: 'Email', consent: 'email' },
]

export function CampaignDialog({
  customers,
  selected,
  onClose,
  onSend,
}: {
  customers: CrmCustomer[]
  selected: CrmCustomer[]
  onClose: () => void
  onSend: (recipients: number, channel: string, scheduled: boolean) => void
}) {
  const [audience, setAudience] = useState(selected.length > 0 ? 'selected' : 'all')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [message, setMessage] = useState('')
  const [sendAt, setSendAt] = useState('')

  const pool =
    audience === 'selected'
      ? selected
      : audience === 'all'
        ? customers
        : customers.filter((customer) => inSegment(customer, audience as SegmentId))
  // Only customers who accepted this channel and marketing messages
  const recipients = pool.filter(
    (customer) =>
      customer.status !== 'suspended' &&
      customer.consent.marketing &&
      customer.consent[channel.consent],
  )
  const canSend = recipients.length > 0 && message.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      title="Send Campaign"
      subtitle="Message a customer segment by SMS, WhatsApp or email."
      footer={
        <>
          <p className="mr-auto text-xs text-muted">
            Estimated recipients:{' '}
            <span className="font-bold text-ink">{recipients.length}</span> of{' '}
            {pool.length}
          </p>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onSend(recipients.length, channel.label, sendAt !== '')}
            className={primaryButton}
          >
            {sendAt ? 'Schedule' : 'Send Now'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="campaign-audience" className={labelClass}>
              Recipients
            </label>
            <select
              id="campaign-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className={fieldClass}
            >
              {selected.length > 0 && (
                <option value="selected">
                  Selected customers ({selected.length})
                </option>
              )}
              <option value="all">All customers in view</option>
              {SEGMENTS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="campaign-channel" className={labelClass}>
              Channel
            </label>
            <select
              id="campaign-channel"
              value={channel.label}
              onChange={(event) =>
                setChannel(
                  CHANNELS.find(({ label }) => label === event.target.value)!,
                )
              }
              className={fieldClass}
            >
              {CHANNELS.map(({ label }) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="campaign-message" className={labelClass}>
            Message
          </label>
          <textarea
            id="campaign-message"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${fieldClass} h-auto py-2`}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CAMPAIGN_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setMessage(template)}
                className="rounded-full bg-field px-3 py-1 text-[11px] font-medium text-ink hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {template}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="campaign-send-at" className={labelClass}>
            Schedule for later (optional)
          </label>
          <input
            id="campaign-send-at"
            type="datetime-local"
            value={sendAt}
            onChange={(event) => setSendAt(event.target.value)}
            className={`${fieldClass} sm:w-64`}
          />
        </div>
        <p className="text-[11px] text-muted">
          Customers who have not consented to marketing on this channel, and
          suspended accounts, are left out.
        </p>
      </div>
    </Modal>
  )
}

// ---------- Small profile dialogs ----------

export function CustomerPaymentDialog({
  customer,
  onClose,
  onSubmit,
}: {
  customer: CrmCustomer
  onClose: () => void
  onSubmit: (amount: number, method: PaymentMethod, reference: string) => void
}) {
  const { register, handleSubmit, control } = useForm<{
    amount: string
    method: PaymentMethod
    reference: string
  }>({ defaultValues: { amount: String(customer.outstanding), method: 'Cash', reference: '' } })
  const value = Number(useWatch({ control, name: 'amount' }))
  const valid = value > 0 && value <= customer.outstanding

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Record Payment"
      subtitle={`${customer.name} · ${formatXaf(customer.outstanding)} outstanding`}
    >
      <form
        onSubmit={handleSubmit(({ amount, method, reference }) => {
          if (valid) onSubmit(Number(amount), method, reference.trim())
        })}
        className="space-y-3"
      >
        <div>
          <label htmlFor="customer-payment-amount" className={labelClass}>
            Amount (XAF)
          </label>
          <input
            id="customer-payment-amount"
            type="number"
            min="1"
            max={customer.outstanding}
            inputMode="numeric"
            autoFocus
            {...register('amount')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="customer-payment-method" className={labelClass}>
            Method
          </label>
          <select id="customer-payment-method" {...register('method')} className={fieldClass}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="customer-payment-reference" className={labelClass}>
            Reference (optional)
          </label>
          <input id="customer-payment-reference" {...register('reference')} className={fieldClass} />
        </div>
        <button type="submit" disabled={!valid} className={`${primaryButton} w-full`}>
          Record Payment
        </button>
      </form>
    </Modal>
  )
}

const ADDRESS_FIELDS: { key: keyof Address & string; label: string; wide?: boolean }[] = [
  { key: 'label', label: 'Label (Home, Work…)' },
  { key: 'street', label: 'Street', wide: true },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'landmark', label: 'Landmark', wide: true },
  { key: 'instructions', label: 'Delivery instructions', wide: true },
]

export function AddressDialog({
  address,
  onClose,
  onSave,
}: {
  address?: Address
  onClose: () => void
  onSave: (address: Address) => void
}) {
  const [defaults] = useState<Address>(
    () =>
      address ?? {
        id: `address-${Date.now()}`,
        label: '',
        street: '',
        city: 'Douala',
        region: 'Littoral',
        landmark: '',
        instructions: '',
        isDefault: false,
      },
  )
  const { register, handleSubmit, control } = useForm<Address>({ defaultValues: defaults })
  const [label, street] = useWatch({ control, name: ['label', 'street'] })
  const valid = label.trim() !== '' && street.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      title={address ? 'Edit Address' : 'Add Address'}
    >
      <form
        onSubmit={handleSubmit((draft) => {
          if (valid) onSave(draft)
        })}
        className="grid gap-3 sm:grid-cols-2"
      >
        {ADDRESS_FIELDS.map(({ key, label, wide }) => (
          <div key={key} className={wide ? 'sm:col-span-2' : ''}>
            <label htmlFor={`address-${key}`} className={labelClass}>
              {label}
            </label>
            <input
              id={`address-${key}`}
              autoComplete="off"
              {...register(key)}
              className={fieldClass}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={!valid}
          className={`${primaryButton} sm:col-span-2`}
        >
          Save Address
        </button>
      </form>
    </Modal>
  )
}

export function NoteDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (text: string) => void
}) {
  const { register, handleSubmit, control } = useForm({ defaultValues: { text: '' } })
  const text = useWatch({ control, name: 'text' })

  return (
    <Modal open onClose={onClose} variant="sm" title="Add Note">
      <form
        onSubmit={handleSubmit((values) => onSave(values.text.trim()))}
        className="space-y-3"
      >
        <label htmlFor="customer-note-text" className={labelClass}>
          Note
        </label>
        <textarea
          id="customer-note-text"
          rows={4}
          autoFocus
          placeholder="e.g. Customer prefers clothes folded individually."
          {...register('text', { validate: (value) => value.trim() !== '' })}
          className={`${fieldClass} h-auto py-2`}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className={`${primaryButton} w-full`}
        >
          Save Note
        </button>
      </form>
    </Modal>
  )
}

export function PointsDialog({
  customer,
  onClose,
  onSave,
}: {
  customer: CrmCustomer
  onClose: () => void
  onSave: (delta: number, reason: string) => void
}) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: { delta: '', reason: '' },
  })
  const [delta, reason] = useWatch({ control, name: ['delta', 'reason'] })
  const value = Math.trunc(Number(delta))
  const valid =
    value !== 0 && customer.points + value >= 0 && reason.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Adjust Loyalty Points"
      subtitle={`${customer.name} · ${customer.points.toLocaleString('en-US')} points`}
    >
      <form
        onSubmit={handleSubmit((values) => {
          if (valid) onSave(Math.trunc(Number(values.delta)), values.reason.trim())
        })}
        className="space-y-3"
      >
        <div>
          <label htmlFor="points-delta" className={labelClass}>
            Points to add (negative to remove)
          </label>
          <input
            id="points-delta"
            type="number"
            autoFocus
            placeholder="e.g. 250 or -100"
            {...register('delta')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="points-reason" className={labelClass}>
            Reason
          </label>
          <input id="points-reason" {...register('reason')} className={fieldClass} />
        </div>
        <button type="submit" disabled={!valid} className={`${primaryButton} w-full`}>
          Save Adjustment
        </button>
      </form>
    </Modal>
  )
}
