import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, LocateFixed, MapPin, Plus, Trash2, TriangleAlert } from 'lucide-react'
import {
  BRANCH_SERVICES,
  BRANCH_TYPES,
  CITY_CENTRES,
  DAYS,
  MAP_SPAN,
  PAYMENT_METHODS,
  REGIONS,
  SETUP_TASKS,
  WIZARD_STEPS,
} from '../../constants/branches'
import type { BranchProfile, BranchType, DayHours, SpecialDay } from '../../types/branch'
import { formatHoursSummary } from '../../utils/branches'
import { formatXaf } from '../../utils/orders'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'

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

type TextKey =
  | 'name' | 'id' | 'description' | 'country' | 'district' | 'address' | 'postalCode'
  | 'phone' | 'phone2' | 'email' | 'whatsapp' | 'website' | 'manager'

const CAPACITY_FIELDS: [keyof BranchProfile['capacity'], string, string][] = [
  ['dailyOrders', 'Daily order capacity', 'orders'],
  ['maxItems', 'Maximum items per day', 'items'],
  ['processingHours', 'Average processing time', 'hours'],
  ['pickups', 'Pickup capacity', 'per day'],
  ['deliveries', 'Delivery capacity', 'per day'],
  ['machines', 'Machine capacity', 'machines'],
]

const clamp = (value: number) => Math.min(1, Math.max(0, value))

function getProblems(draft: BranchProfile, takenCodes: string[]) {
  const problems: string[] = []
  if (!draft.name.trim()) problems.push('Branch name is required (Basic Info).')
  if (!/^BR-\d{3,}$/.test(draft.id)) problems.push('Branch code must look like BR-009 (Basic Info).')
  else if (takenCodes.includes(draft.id)) problems.push(`Branch code ${draft.id} is already in use (Basic Info).`)
  if (!draft.address.trim()) problems.push('Street address is required (Location).')
  if (!draft.phone.trim()) problems.push('Phone number is required (Contact).')
  if (draft.hours.some((day) => !day.closed && day.close <= day.open)) {
    problems.push('Closing time must be after opening time on every open day (Hours).')
  }
  if (draft.hours.every((day) => day.closed)) problems.push('The branch must open at least one day (Hours).')
  if (!draft.services.some(({ enabled }) => enabled)) problems.push('Select at least one service (Services).')
  if (draft.closure && (!draft.closure.from || !draft.closure.to || draft.closure.to < draft.closure.from)) {
    problems.push('Temporary closure needs a start date and a later end date (Hours).')
  }
  return problems
}

function BranchWizard({
  initial,
  mode,
  takenCodes,
  initialStep = 0,
  onClose,
  onSave,
}: {
  initial: BranchProfile
  mode: 'create' | 'edit'
  takenCodes: string[]
  initialStep?: number
  onClose: () => void
  onSave: (profile: BranchProfile) => void
}) {
  const [step, setStep] = useState(initialStep)
  const [draft, setDraft] = useState(initial)
  const [special, setSpecial] = useState<SpecialDay>({ date: '', label: '', closed: true, open: '09:00', close: '14:00' })
  const [geoMessage, setGeoMessage] = useState('')
  const patch = (change: Partial<BranchProfile>) => setDraft((current) => ({ ...current, ...change }))
  const problems = getProblems(draft, takenCodes)
  const last = WIZARD_STEPS.length - 1

  const text = (
    id: string,
    label: string,
    key: TextKey,
    options: { type?: string; placeholder?: string; wide?: boolean; disabled?: boolean } = {},
  ) => (
    <Field label={label} htmlFor={id} wide={options.wide}>
      <input
        id={id}
        type={options.type ?? 'text'}
        autoComplete="off"
        disabled={options.disabled}
        placeholder={options.placeholder}
        value={draft[key]}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={`${fieldClass} disabled:opacity-60`}
      />
    </Field>
  )

  const setDay = (index: number, change: Partial<DayHours>) =>
    patch({ hours: draft.hours.map((day, current) => (current === index ? { ...day, ...change } : day)) })

  const centre = CITY_CENTRES[draft.city]
  const pin =
    draft.lat !== null && draft.lng !== null && centre
      ? {
          left: clamp(0.5 + (draft.lng - centre.lng) / MAP_SPAN.lng),
          top: clamp(0.5 - (draft.lat - centre.lat) / MAP_SPAN.lat),
        }
      : null

  function pickOnMap(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    // Keyboard activation has no pointer position, so drop the pin on the city centre
    const x = event.detail === 0 ? 0.5 : (event.clientX - rect.left) / rect.width
    const y = event.detail === 0 ? 0.5 : (event.clientY - rect.top) / rect.height
    patch({
      lat: Number((centre.lat + (0.5 - y) * MAP_SPAN.lat).toFixed(5)),
      lng: Number((centre.lng + (x - 0.5) * MAP_SPAN.lng).toFixed(5)),
    })
    setGeoMessage('')
  }

  function locateDevice() {
    if (!navigator.geolocation) {
      setGeoMessage('This browser can’t share a location.')
      return
    }
    setGeoMessage('Locating…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        patch({ lat: Number(coords.latitude.toFixed(5)), lng: Number(coords.longitude.toFixed(5)) })
        setGeoMessage('Location set from this device.')
      },
      () => setGeoMessage('Couldn’t get a location. Check the browser’s location permission.'),
    )
  }

  const coordinate = (id: string, label: string, key: 'lat' | 'lng') => (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        step="0.00001"
        value={draft[key] ?? ''}
        onChange={(event) => patch({ [key]: event.target.value === '' ? null : Number(event.target.value) })}
        className={fieldClass}
      />
    </Field>
  )

  const review: [string, string][] = [
    ['Branch', `${draft.name || 'Unnamed'} · ${draft.id} · ${draft.type}`],
    ['Location', [draft.address, draft.district, draft.city, draft.region, draft.country].filter(Boolean).join(', ')],
    ['GPS', draft.lat !== null && draft.lng !== null ? `${draft.lat}, ${draft.lng}` : 'Not set'],
    ['Contact', [draft.phone, draft.email, draft.whatsapp && `WhatsApp ${draft.whatsapp}`].filter(Boolean).join(' · ') || 'Not set'],
    ['Manager', draft.manager || 'Not assigned'],
    ['Opening hours', formatHoursSummary(draft.hours)],
    ['Services', draft.services.filter(({ enabled }) => enabled).map(({ name }) => name).join(', ') || 'None'],
    ['Capacity', `${draft.capacity.dailyOrders} orders / day · ${draft.capacity.maxItems} items · ${draft.capacity.processingHours} h processing`],
    ['Payment methods', draft.paymentMethods.join(', ') || 'None'],
    ['Setup still to do', draft.pendingSetup.join(', ') || 'Nothing pending'],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={mode === 'create' ? 'Add Branch' : `Edit ${initial.name}`}
      subtitle={`Step ${step + 1} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={`${secondaryButton} mr-auto`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {mode === 'edit' && step < last && (
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={() => onSave(draft)}
              className={secondaryButton}
            >
              Save Changes
            </button>
          )}
          {step < last ? (
            <button type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={() => onSave(draft)}
              className={primaryButton}
            >
              <Check className="size-4" aria-hidden="true" />
              {mode === 'create' ? 'Create Branch' : 'Save Changes'}
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Wizard steps">
        {WIZARD_STEPS.map((label, index) => (
          <li key={label} className="min-w-16 flex-1">
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => setStep(index)}
              className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`} />
              <span className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}>
                {index + 1} {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('branch-name', 'Branch name', 'name', { placeholder: 'e.g. Deido Branch' })}
          {text('branch-code', 'Branch code', 'id', { disabled: mode === 'edit' })}
          <Field label="Branch type" htmlFor="branch-type">
            <select
              id="branch-type"
              value={draft.type}
              onChange={(event) => patch({ type: event.target.value as BranchType })}
              className={fieldClass}
            >
              {BRANCH_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" htmlFor="branch-description" wide>
            <textarea
              id="branch-description"
              rows={3}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              className={`${fieldClass} h-auto py-2`}
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('branch-country', 'Country', 'country')}
          <Field label="Region" htmlFor="branch-region">
            <select
              id="branch-region"
              value={draft.region}
              onChange={(event) => patch({ region: event.target.value, city: REGIONS[event.target.value][0] })}
              className={fieldClass}
            >
              {Object.keys(REGIONS).map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </Field>
          <Field label="City" htmlFor="branch-city">
            <select
              id="branch-city"
              value={draft.city}
              onChange={(event) => patch({ city: event.target.value })}
              className={fieldClass}
            >
              {(REGIONS[draft.region] ?? [draft.city]).map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </Field>
          {text('branch-district', 'District', 'district')}
          {text('branch-address', 'Street address', 'address')}
          {text('branch-postal', 'Postal code (optional)', 'postalCode')}
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={labelClass}>GPS location</p>
              <button type="button" onClick={locateDevice} className={`${secondaryButton} h-8`}>
                <LocateFixed className="size-3.5 text-muted" aria-hidden="true" />
                Use current location
              </button>
            </div>
            {centre && (
              <button
                type="button"
                onClick={pickOnMap}
                aria-label={`Select location on the ${draft.city} map`}
                className="relative mt-1 block h-40 w-full cursor-crosshair overflow-hidden rounded-lg bg-field bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-size-[32px_32px] ring-1 ring-line focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <span className="absolute top-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {draft.city} · click to place the pin
                </span>
                {pin && (
                  <MapPin
                    className="absolute size-6 -translate-x-1/2 -translate-y-full fill-brand/20 text-brand"
                    style={{ left: `${pin.left * 100}%`, top: `${pin.top * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </button>
            )}
            <p className="mt-1 text-[11px] text-muted" role="status">
              {geoMessage || 'The grid is a placeholder for a map: it sets approximate coordinates around the city centre.'}
            </p>
          </div>
          {coordinate('branch-lat', 'Latitude', 'lat')}
          {coordinate('branch-lng', 'Longitude', 'lng')}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {text('branch-phone', 'Phone', 'phone', { type: 'tel', placeholder: '+237 6XX XXX XXX' })}
          {text('branch-phone2', 'Secondary phone (optional)', 'phone2', { type: 'tel' })}
          {text('branch-email', 'Email', 'email', { type: 'email' })}
          {text('branch-whatsapp', 'WhatsApp', 'whatsapp', { type: 'tel' })}
          {text('branch-website', 'Website (optional)', 'website', { type: 'url' })}
          {text('branch-manager', 'Branch manager', 'manager', { placeholder: 'Full name' })}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={sectionTitle}>Weekly opening hours</p>
              <button
                type="button"
                onClick={() =>
                  patch({ hours: draft.hours.map((day, index) => (index < 5 ? { ...draft.hours[0] } : day)) })
                }
                className={`${secondaryButton} h-8`}
              >
                <Copy className="size-3.5 text-muted" aria-hidden="true" />
                Copy Monday to all weekdays
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {draft.hours.map((day, index) => (
                <li key={DAYS[index]} className="flex flex-wrap items-center gap-2 rounded-lg bg-field px-3 py-1.5">
                  <span className="w-24 text-xs font-semibold text-ink">{DAYS[index]}</span>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={!day.closed}
                      onChange={(event) => setDay(index, { closed: !event.target.checked })}
                      className="size-4 accent-brand"
                    />
                    Open
                  </label>
                  {day.closed ? (
                    <span className="ml-auto text-xs text-muted">Closed</span>
                  ) : (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="time"
                        aria-label={`${DAYS[index]} opens`}
                        value={day.open}
                        onChange={(event) => setDay(index, { open: event.target.value })}
                        className={`${fieldClass} h-8 w-28! bg-white`}
                      />
                      –
                      <input
                        type="time"
                        aria-label={`${DAYS[index]} closes`}
                        value={day.close}
                        onChange={(event) => setDay(index, { close: event.target.value })}
                        className={`${fieldClass} h-8 w-28! bg-white`}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={sectionTitle}>Holidays and special opening hours</p>
            {draft.specialDays.length > 0 && (
              <ul className="mt-2 space-y-1">
                {draft.specialDays.map((day) => (
                  <li key={day.date} className="flex items-center gap-2 rounded-lg bg-field px-3 py-1.5 text-xs">
                    <span className="font-semibold text-ink tabular-nums">{day.date}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {day.label} · {day.closed ? 'Closed' : `${day.open}–${day.close}`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${day.label}`}
                      onClick={() => patch({ specialDays: draft.specialDays.filter(({ date }) => date !== day.date) })}
                      className={iconButton}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <input
                type="date"
                aria-label="Special day date"
                value={special.date}
                onChange={(event) => setSpecial({ ...special, date: event.target.value })}
                className={`${fieldClass} w-36!`}
              />
              <input
                type="text"
                aria-label="Special day name"
                placeholder="e.g. National Day"
                value={special.label}
                onChange={(event) => setSpecial({ ...special, label: event.target.value })}
                className={`${fieldClass} min-w-32 flex-1`}
              />
              <select
                aria-label="Special day hours"
                value={special.closed ? 'closed' : 'short'}
                onChange={(event) => setSpecial({ ...special, closed: event.target.value === 'closed' })}
                className={`${fieldClass} w-auto!`}
              >
                <option value="closed">Closed</option>
                <option value="short">Open 09:00–14:00</option>
              </select>
              <button
                type="button"
                disabled={!special.date || !special.label.trim() || draft.specialDays.some(({ date }) => date === special.date)}
                onClick={() => {
                  patch({ specialDays: [...draft.specialDays, { ...special, label: special.label.trim() }].sort((a, b) => a.date.localeCompare(b.date)) })
                  setSpecial({ ...special, date: '', label: '' })
                }}
                className={secondaryButton}
              >
                <Plus className="size-3.5 text-muted" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={draft.closure !== null}
                onChange={(event) => patch({ closure: event.target.checked ? { from: '', to: '', reason: '' } : null })}
                className="size-4 accent-brand"
              />
              Schedule a temporary closure
            </label>
            {draft.closure && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  type="date"
                  aria-label="Closure starts"
                  value={draft.closure.from}
                  onChange={(event) => patch({ closure: { ...draft.closure!, from: event.target.value } })}
                  className={fieldClass}
                />
                <input
                  type="date"
                  aria-label="Closure ends"
                  value={draft.closure.to}
                  onChange={(event) => patch({ closure: { ...draft.closure!, to: event.target.value } })}
                  className={fieldClass}
                />
                <input
                  type="text"
                  aria-label="Closure reason"
                  placeholder="Reason"
                  value={draft.closure.reason}
                  onChange={(event) => patch({ closure: { ...draft.closure!, reason: event.target.value } })}
                  className={fieldClass}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="mb-2 text-[11px] text-muted">
            Tick the services this branch offers. Leave the price empty to use the catalog price.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {draft.services.map((service) => {
              const catalog = BRANCH_SERVICES.find(({ name }) => name === service.name)
              const change = (next: Partial<typeof service>) =>
                patch({
                  services: draft.services.map((current) =>
                    current.name === service.name ? { ...current, ...next } : current,
                  ),
                })
              return (
                <li key={service.name} className="flex items-center gap-2 rounded-lg bg-field px-3 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={service.enabled}
                      onChange={(event) => change({ enabled: event.target.checked })}
                      className="size-4 shrink-0 accent-brand"
                    />
                    <span className="truncate">{service.name}</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    disabled={!service.enabled}
                    aria-label={`${service.name} branch price in XAF`}
                    placeholder={catalog ? `${catalog.price} / ${catalog.unit}` : 'XAF'}
                    value={service.price ?? ''}
                    onChange={(event) => change({ price: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })}
                    className={`${fieldClass} h-8 w-28! bg-white disabled:opacity-50`}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {step === 5 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {CAPACITY_FIELDS.map(([key, label, unit]) => (
            <Field key={key} label={`${label} (${unit})`} htmlFor={`capacity-${key}`}>
              <input
                id={`capacity-${key}`}
                type="number"
                min={0}
                value={draft.capacity[key]}
                onChange={(event) =>
                  patch({ capacity: { ...draft.capacity, [key]: Math.max(0, Number(event.target.value)) } })
                }
                className={fieldClass}
              />
            </Field>
          ))}
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <div>
            <p className={sectionTitle}>Payment methods accepted</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {PAYMENT_METHODS.map((method) => (
                <li key={method}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={draft.paymentMethods.includes(method)}
                      onChange={(event) =>
                        patch({
                          paymentMethods: event.target.checked
                            ? PAYMENT_METHODS.filter((item) => item === method || draft.paymentMethods.includes(item))
                            : draft.paymentMethods.filter((item) => item !== method),
                        })
                      }
                      className="size-4 accent-brand"
                    />
                    {method}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={sectionTitle}>Setup checklist: tick what is already in place</p>
              <button
                type="button"
                onClick={() => {
                  patch({ pendingSetup: SETUP_TASKS })
                  setStep(last)
                }}
                className={`${secondaryButton} h-8`}
              >
                Complete setup later
              </button>
            </div>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {SETUP_TASKS.map((task) => (
                <li key={task}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={!draft.pendingSetup.includes(task)}
                      onChange={(event) =>
                        patch({
                          pendingSetup: event.target.checked
                            ? draft.pendingSetup.filter((item) => item !== task)
                            : SETUP_TASKS.filter((item) => item === task || draft.pendingSetup.includes(item)),
                        })
                      }
                      className="size-4 accent-brand"
                    />
                    {task}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">
              Unticked items appear as pending setup on the branch page, where staff, machines and stock are added.
            </p>
          </div>
        </div>
      )}

      {step === last && (
        <div className="space-y-3">
          <dl className="divide-y divide-line rounded-lg bg-field px-3 text-xs">
            {review.map(([label, value]) => (
              <div key={label} className="flex gap-3 py-2">
                <dt className="w-32 shrink-0 font-semibold text-ink">{label}</dt>
                <dd className="min-w-0 break-words text-muted">{value}</dd>
              </div>
            ))}
            {draft.services.some(({ enabled, price }) => enabled && price !== null) && (
              <div className="flex gap-3 py-2">
                <dt className="w-32 shrink-0 font-semibold text-ink">Branch prices</dt>
                <dd className="min-w-0 text-muted">
                  {draft.services
                    .filter(({ enabled, price }) => enabled && price !== null)
                    .map(({ name, price }) => `${name} ${formatXaf(price!)}`)
                    .join(' · ')}
                </dd>
              </div>
            )}
          </dl>
          {mode === 'create' && (
            <Field label="Status when created" htmlFor="branch-status">
              <select
                id="branch-status"
                value={draft.status}
                onChange={(event) => patch({ status: event.target.value as BranchProfile['status'] })}
                className={`${fieldClass} sm:w-60!`}
              >
                <option value="active">Active: open for orders</option>
                <option value="inactive">Inactive: activate when ready</option>
              </select>
            </Field>
          )}
          {problems.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {problem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

export default BranchWizard
