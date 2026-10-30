import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Printer,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { ARTICLE_TYPES, articleLabel } from '../../constants/articleTypes'
import {
  DELIVERY_FEE,
  EXPRESS_SURCHARGE_RATE,
  ITEM_PRICES,
  PAYMENT_METHODS,
  TAX_RATE,
} from '../../constants/orders'
import useStaff from '../../hooks/useStaff'
import type {
  Customer,
  FulfilmentMethod,
  Order,
  PaymentMethod,
} from '../../types/order'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import { useCreateCustomerMutation, useGetCustomerDropdownQuery } from '../../services/customerApi'
import { useCreateOrderMutation } from '../../services/orderApi'
import { useListPaymentProvidersQuery } from '../../services/paymentApi'
import { saveFailureMessage } from '../../utils/apiErrors'
import { toApiMethod, toApiPaymentMethod, toApiPriority } from '../../utils/orderMapping'
import type { OrderRequest } from '../../utils/orderMapping'
import { useGetServiceDropdownQuery } from '../../services/serviceApi'
import type { ServiceOption } from '../../services/serviceApi'
import { formatXaf } from '../../utils/orders'
import FormAlert from '../ui/FormAlert'
import Modal from '../ui/Modal'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from './styles'
import { toLocalInput } from '../../utils/dates'

const STEPS = ['Customer', 'Services & Items', 'Options', 'Payment', 'Confirm']

export type AfterCreate = 'none' | 'print' | 'send'

// `name` is an ArticleType constant (SHIRT); `serviceId` is the service's uuid
// ('' until the services load)
type Line = { key: number; name: string; qty: string; serviceId: string }

const NO_SERVICES: ServiceOption[] = []

// What a service's price is per, by pricing model
const PRICE_UNITS: Record<string, string> = {
  item: 'item',
  kg: 'kg',
  piece: 'piece',
  fixed: 'order',
  custom: 'item',
}

type NewOrderDialogProps = {
  onClose: () => void
  // Set when the order is started from a customer's profile
  initialCustomer?: Customer
  initialHandling?: string
  // Called once the backend has created the order, with the order it sent
  // back (null when the response carried none)
  onCreated: (order: Order | null, after: AfterCreate) => void
}

function NewOrderDialog({
  onClose,
  initialCustomer,
  initialHandling = '',
  onCreated,
}: NewOrderDialogProps) {
  const [step, setStep] = useState(initialCustomer ? 1 : 0)

  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    initialCustomer ?? null,
  )
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [lines, setLines] = useState<Line[]>([
    { key: 0, name: ARTICLE_TYPES[0].id, qty: '1', serviceId: '' },
  ])
  const [nextLineKey, setNextLineKey] = useState(1)

  // ACTIVE services from GET /service/dropdown: the whole tenant for an owner,
  // their own branch for staff
  const serviceList = useGetServiceDropdownQuery()
  const services = serviceList.data ?? NO_SERVICES
  const firstService = services[0]?.uuid
  // A line with no service yet (added before the services arrived) uses the first one
  const serviceIdOf = (line: Line) => line.serviceId || firstService || ''
  const serviceFor = (line: Line) => services.find(({ uuid }) => uuid === serviceIdOf(line))
  // The service's base price per unit. Item-priced (custom) services have no
  // base price in the dropdown, so the sample item prices stand in for those
  // TODO: price custom services from their item list once the form loads it
  function getUnitPrice(line: Line) {
    const service = serviceFor(line)
    if (!service) return 0
    if (service.pricingModel === 'custom' && service.basePrice <= 0) return ITEM_PRICES[articleLabel(line.name)] ?? 0
    return service.basePrice
  }
  const priceUnit = (line: Line) => PRICE_UNITS[serviceFor(line)?.pricingModel ?? ''] ?? 'item'


  const [express, setExpress] = useState(false)
  const [method, setMethod] = useState<FulfilmentMethod>('pickup')
  const [address, setAddress] = useState('')
  const [dueAt, setDueAt] = useState(() =>
    toLocalInput(Date.now() + 24 * 3_600_000),
  )
  const [customerNotes, setCustomerNotes] = useState('')
  const [handling, setHandling] = useState(initialHandling)

  // The branch the order is taken at (GET /branch/dropdown: the caller's branches)
  const branchList = useGetBranchDropdownQuery()
  const branches = branchList.data ?? []
  const [chosenBranch, setChosenBranch] = useState('')
  const branchId = chosenBranch || branches[0]?.uuid || ''

  const [createOrder, { isLoading: creating }] = useCreateOrderMutation()
  const [createCustomer, { isLoading: creatingCustomer }] = useCreateCustomerMutation()
  const staff = useStaff()
  const [assignee, setAssignee] = useState('')
  const [provider, setProvider] = useState('')
  const [reference, setReference] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash')
  const [amountPaid, setAmountPaid] = useState('')
  // Digital methods name the provider that took the money
  const providerList = useListPaymentProvidersQuery(branchId || undefined, { skip: !branchId })
  const providers = (providerList.data ?? []).filter(
    (item) => item.enabled && item.method === payMethod,
  )

  // Customers come from GET /customer/dropdown, searched on the server as the
  // user types (after a short pause)
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(customerQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [customerQuery])
  const customerList = useGetCustomerDropdownQuery({ search: search || undefined, size: 10 })
  const matches: Customer[] = (customerList.data ?? []).map(({ uuid, name }) => ({
    uuid,
    name,
    // Not in the dropdown response
    phone: '',
    email: '',
    type: 'returning',
    since: '',
    orders: 0,
    spent: 0,
  }))
  const searching = customerList.isFetching || search !== customerQuery.trim()

  const subtotal = lines.reduce(
    (sum, line) => sum + (Number(line.qty) || 0) * getUnitPrice(line),
    0,
  )
  const surcharge = express ? Math.round(subtotal * EXPRESS_SURCHARGE_RATE) : 0
  const discountValue = Math.min(Number(discount) || 0, subtotal + surcharge)
  const tax = Math.round((subtotal + surcharge - discountValue) * TAX_RATE)
  const deliveryFee = method === 'delivery' ? DELIVERY_FEE : 0
  const total = subtotal + surcharge - discountValue + tax + deliveryFee
  const paid = Number(amountPaid) || 0
  const paymentLabel =
    paid <= 0 ? 'Unpaid' : paid >= total ? 'Paid' : 'Partially Paid'

  const customerName = isNewCustomer ? newName.trim() : selectedCustomer?.name
  const stepValid = [
    isNewCustomer
      ? newName.trim() !== '' && newPhone.trim() !== ''
      : selectedCustomer !== null,
    lines.length > 0 && lines.every((line) => Number(line.qty) >= 1 && serviceFor(line) !== undefined),
    branchId !== '' && dueAt !== '' && (method === 'pickup' || address.trim() !== ''),
    paid >= 0 &&
      paid <= total &&
      (paid === 0 || payMethod === 'Cash' || (provider !== '' && reference.trim() !== '')),
    true,
  ][step]

  function updateLine(key: number, patch: Partial<Line>) {
    setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine(serviceId = firstService ?? '') {
    setLines([...lines, { key: nextLineKey, name: ARTICLE_TYPES[0].id, qty: '1', serviceId }])
    setNextLineKey(nextLineKey + 1)
  }

  // The totals shown here are an estimate: the backend prices the order from
  // its own price lists and sends the final figures back
  async function handleCreate(after: AfterCreate) {
    setCreateError(null)
    try {
      // A new customer is stored first; the order then names them
      let customerId = isNewCustomer ? null : (selectedCustomer?.uuid ?? null)
      if (isNewCustomer) {
        const [firstname = '', ...rest] = newName.trim().split(/\s+/)
        customerId = await createCustomer({
          firstname,
          lastname: rest.join(' '),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          homeAddress: '',
          neighbourhood: '',
          branchId,
          referralSource: '',
        }).unwrap()
        if (!customerId) throw new Error('The customer was created but the server didn’t say which one.')
      }
      if (!customerId) throw new Error('Choose a customer.')
      const request: OrderRequest = {
        customerId,
        branchId,
        priority: toApiPriority(express ? 'express' : 'normal'),
        ...(assignee ? { assignedTo: assignee } : {}),
        promisedDate: `${dueAt.slice(0, 16)}:00`,
        deliveryOptions: toApiMethod(method),
        ...(method === 'delivery' ? { deliveryAddress: address.trim() } : {}),
        deliveryFee,
        discountAmount: discountValue,
        surchargeAmount: surcharge,
        taxAmount: tax,
        customerNotes: customerNotes.trim(),
        handlingInstructions: handling.trim(),
        articleLines: lines.map((line) => {
          const perKg = serviceFor(line)?.pricingModel === 'kg'
          return {
            articleType: line.name,
            service: serviceIdOf(line),
            quantity: perKg ? 1 : Number(line.qty),
            weightKg: perKg ? Number(line.qty) : null,
            unitPrice: getUnitPrice(line),
            condition: 'NORMAL',
          }
        }),
        ...(paid > 0
          ? {
              initialPayment: {
                amount: paid,
                method: toApiPaymentMethod(payMethod),
                ...(payMethod === 'Cash'
                  ? { ...(cashReceived ? { cashReceived: Number(cashReceived) } : {}) }
                  : { provider, reference: reference.trim() }),
              },
            }
          : {}),
      }
      onCreated(await createOrder(request).unwrap(), after)
    } catch (error) {
      setCreateError(
        error instanceof Error && !('status' in error)
          ? error.message
          : saveFailureMessage(
              error,
              'The order wasn’t created.',
              'A customer with this phone number already exists. Pick them from the list instead.',
            ),
      )
    }
  }

  const totals: [string, number][] = [
    ['Subtotal', subtotal],
    ['Express surcharge', surcharge],
    ['Discount', -discountValue],
    ['Tax', tax],
    ['Delivery fee', deliveryFee],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="New Order"
      subtitle={`${customerName ? `For ${customerName} · ` : ''}Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      footer={
        <>
          <p className="mr-auto text-xs font-bold text-ink" title="The server sets the final price">
            Estimated total: {formatXaf(total)}
          </p>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={secondaryButton}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!stepValid}
              onClick={() => setStep(step + 1)}
              className={primaryButton}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={creating || creatingCustomer}
                onClick={() => void handleCreate('send')}
                className={secondaryButton}
              >
                <Send className="size-4 text-muted" aria-hidden="true" />
                Create & Send Confirmation
              </button>
              <button
                type="button"
                disabled={creating || creatingCustomer}
                onClick={() => void handleCreate('print')}
                className={secondaryButton}
              >
                <Printer className="size-4 text-muted" aria-hidden="true" />
                Create & Print Receipt
              </button>
              <button
                type="button"
                disabled={creating || creatingCustomer}
                onClick={() => void handleCreate('none')}
                className={primaryButton}
              >
                <Check className="size-4" aria-hidden="true" />
                {creating || creatingCustomer ? 'Creating…' : 'Create Order'}
              </button>
            </>
          )}
        </>
      }
    >
      {createError && (
        <div className="mb-4">
          <FormAlert>{createError}</FormAlert>
        </div>
      )}

      <ol className="mb-5 flex gap-1" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className="flex-1"
          >
            <span
              className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`}
            />
            <span
              className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          {!isNewCustomer ? (
            <>
              <div>
                <label htmlFor="customer-search" className={labelClass}>
                  Find customer
                </label>
                <input
                  id="customer-search"
                  type="search"
                  autoFocus
                  placeholder="Search customer by name, company or phone"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  className={fieldClass}
                />
              </div>
              {customerList.isError && (
                <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-danger/5 px-3 py-2.5 text-xs font-semibold text-danger">
                  Couldn’t load the customers.
                  <button
                    type="button"
                    onClick={() => void customerList.refetch()}
                    disabled={customerList.isFetching}
                    className="rounded-sm text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {customerList.isFetching ? 'Retrying…' : 'Retry'}
                  </button>
                </p>
              )}
              <ul className="max-h-56 space-y-1 overflow-y-auto" aria-busy={searching}>
                {customerList.isLoading &&
                  [0, 1, 2].map((key) => (
                    <li key={key} className="h-11 animate-pulse rounded-lg bg-field" aria-hidden="true" />
                  ))}
                {matches.map((customer) => {
                  const selected =
                    selectedCustomer?.uuid !== undefined
                      ? selectedCustomer.uuid === customer.uuid
                      : selectedCustomer?.name === customer.name
                  return (
                    <li key={customer.uuid}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                          selected
                            ? 'bg-brand/5 ring-2 ring-brand'
                            : 'bg-field hover:bg-brand/10'
                        }`}
                      >
                        <span>
                          <span className="block font-semibold text-ink">
                            {customer.name}
                          </span>
                        </span>
                        {selected && (
                          <span className="shrink-0 text-[11px] font-semibold text-brand">Selected</span>
                        )}
                      </button>
                    </li>
                  )
                })}
                {customerList.isSuccess && !searching && matches.length === 0 && (
                  <li className="rounded-lg bg-field px-3 py-4 text-center text-xs text-muted">
                    {search ? `No customer matches “${search}”.` : 'No customers yet.'}
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setIsNewCustomer(true)}
                className={secondaryButton}
              >
                <UserPlus className="size-4 text-muted" aria-hidden="true" />
                Create New Customer
              </button>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-customer-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="new-customer-name"
                    autoFocus
                    autoComplete="off"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="new-customer-phone" className={labelClass}>
                    Phone
                  </label>
                  <input
                    id="new-customer-phone"
                    type="tel"
                    autoComplete="off"
                    placeholder="+237 6XX XXX XXX"
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-customer-email" className={labelClass}>
                    Email (optional)
                  </label>
                  <input
                    id="new-customer-email"
                    type="email"
                    autoComplete="off"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomer(false)}
                className={secondaryButton}
              >
                <ArrowLeft className="size-4 text-muted" aria-hidden="true" />
                Select existing customer
              </button>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {serviceList.isError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-danger/5 px-3 py-2.5 text-xs font-semibold text-danger">
              Couldn’t load the services.
              <button
                type="button"
                onClick={() => void serviceList.refetch()}
                disabled={serviceList.isFetching}
                className="rounded-sm text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {serviceList.isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </p>
          )}
          {serviceList.isSuccess && services.length === 0 && (
            <p className="rounded-lg bg-field px-3 py-2.5 text-xs text-muted">
              There are no active services to order yet. Publish a service first.
            </p>
          )}
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={line.key}
                className="grid grid-cols-[1fr_4.5rem] items-end gap-2 rounded-lg bg-field p-2 sm:grid-cols-[1fr_4.5rem_1fr_7rem_2rem]"
              >
                <div>
                  <label htmlFor={`line-item-${line.key}`} className={labelClass}>
                    Item
                  </label>
                  <select
                    id={`line-item-${line.key}`}
                    value={line.name}
                    onChange={(event) =>
                      updateLine(line.key, { name: event.target.value })
                    }
                    className={`${fieldClass} bg-white`}
                  >
                    {ARTICLE_TYPES.map(({ id, label }) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`line-qty-${line.key}`} className={labelClass}>
                    Qty
                  </label>
                  <input
                    id={`line-qty-${line.key}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(event) =>
                      updateLine(line.key, { qty: event.target.value })
                    }
                    className={`${fieldClass} bg-white`}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`line-service-${line.key}`}
                    className={labelClass}
                  >
                    Service
                  </label>
                  <select
                    id={`line-service-${line.key}`}
                    value={serviceIdOf(line)}
                    onChange={(event) =>
                      updateLine(line.key, { serviceId: event.target.value })
                    }
                    className={`${fieldClass} bg-white`}
                  >
                    {!serviceFor(line) && (
                      <option value="">{serviceList.isLoading ? 'Loading services…' : 'Choose a service'}</option>
                    )}
                    {services.map(({ uuid, name }) => (
                      <option key={uuid} value={uuid}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="pb-2 text-right text-xs text-muted tabular-nums">
                  {formatXaf(getUnitPrice(line))} / {priceUnit(line)}
                  <span className="block font-bold text-ink">
                    {formatXaf((Number(line.qty) || 0) * getUnitPrice(line))}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setLines(lines.filter(({ key }) => key !== line.key))
                  }
                  disabled={lines.length === 1}
                  aria-label={`Remove ${articleLabel(line.name)}`}
                  className={`${iconButton} disabled:opacity-40`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addLine()}
              className={primaryButton}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Item
            </button>
            <span className="text-[11px] text-muted">Quick add:</span>
            {services.slice(0, 4).map(({ uuid, name }) => (
              <button
                key={uuid}
                type="button"
                onClick={() => addLine(uuid)}
                className={`${secondaryButton} h-8`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="order-branch" className={labelClass}>
              Branch
            </label>
            <select
              id="order-branch"
              value={branchId}
              disabled={branchList.isLoading}
              onChange={(event) => setChosenBranch(event.target.value)}
              className={`${fieldClass} disabled:opacity-60`}
            >
              {branchList.isLoading && <option value="">Loading branches…</option>}
              {!branchList.isLoading && branches.length === 0 && <option value="">No branches</option>}
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
            {branchList.isError && (
              <p role="alert" className="mt-1 text-[11px] font-semibold text-danger">
                Couldn’t load your branches.{' '}
                <button type="button" onClick={() => void branchList.refetch()} className="text-brand hover:underline">
                  Retry
                </button>
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="order-assignee" className={labelClass}>
              Assign to (optional)
            </label>
            <select
              id="order-assignee"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className={fieldClass}
            >
              <option value="">Nobody yet</option>
              {staff.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-field p-3 text-xs font-semibold text-ink sm:col-span-2">
            <input
              type="checkbox"
              checked={express}
              onChange={(event) => setExpress(event.target.checked)}
              className="size-4 accent-brand"
            />
            Express service
            <span className="font-normal text-muted">
              (+{EXPRESS_SURCHARGE_RATE * 100}% surcharge)
            </span>
          </label>
          <div>
            <label htmlFor="order-method" className={labelClass}>
              Handover
            </label>
            <select
              id="order-method"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as FulfilmentMethod)
              }
              className={fieldClass}
            >
              <option value="pickup">Customer pickup</option>
              <option value="delivery">
                Delivery (+{formatXaf(DELIVERY_FEE)})
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="order-due" className={labelClass}>
              Preferred completion time
            </label>
            <input
              id="order-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={fieldClass}
            />
          </div>
          {method === 'delivery' && (
            <div className="sm:col-span-2">
              <label htmlFor="order-address" className={labelClass}>
                Delivery address
              </label>
              <input
                id="order-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={fieldClass}
              />
            </div>
          )}
          <div>
            <label htmlFor="order-notes" className={labelClass}>
              Customer notes
            </label>
            <textarea
              id="order-notes"
              rows={3}
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
              className={`${fieldClass} h-auto py-2`}
            />
          </div>
          <div>
            <label htmlFor="order-handling" className={labelClass}>
              Special handling instructions
            </label>
            <textarea
              id="order-handling"
              rows={3}
              value={handling}
              onChange={(event) => setHandling(event.target.value)}
              className={`${fieldClass} h-auto py-2`}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label htmlFor="order-discount" className={labelClass}>
                Discount (XAF)
              </label>
              <input
                id="order-discount"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="order-pay-method" className={labelClass}>
                Payment method
              </label>
              <select
                id="order-pay-method"
                value={payMethod}
                onChange={(event) =>
                  setPayMethod(event.target.value as PaymentMethod)
                }
                className={fieldClass}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            {paid > 0 && payMethod !== 'Cash' && (
              <>
                <div>
                  <label htmlFor="order-provider" className={labelClass}>
                    Provider
                  </label>
                  <select
                    id="order-provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Choose a provider…</option>
                    {providers.map(({ provider: name }) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                  {providers.length === 0 && (
                    <p className="mt-1 text-[11px] text-danger">
                      No {payMethod.toLowerCase()} provider is enabled for this branch.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="order-reference" className={labelClass}>
                    Transaction / reference number
                  </label>
                  <input
                    id="order-reference"
                    autoComplete="off"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className={`${fieldClass} font-mono`}
                  />
                </div>
              </>
            )}
            {paid > 0 && payMethod === 'Cash' && (
              <div>
                <label htmlFor="order-cash-received" className={labelClass}>
                  Cash handed over (optional, for the change)
                </label>
                <input
                  id="order-cash-received"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  className={fieldClass}
                />
                <p className="mt-1 text-[11px] text-muted">Cash can only be taken while a cash register is open.</p>
              </div>
            )}
            <div>
              <label htmlFor="order-paid" className={labelClass}>
                Amount received now (XAF)
              </label>
              <input
                id="order-paid"
                type="number"
                min="0"
                max={total}
                inputMode="numeric"
                placeholder="0"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className={fieldClass}
              />
              {paid > total && (
                <p className="mt-1 text-[11px] font-semibold text-danger">
                  Amount is more than the order total.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAmountPaid(String(total))}
                className={`${secondaryButton} h-8`}
              >
                Paid in full
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid('')}
                className={`${secondaryButton} h-8`}
              >
                Unpaid
              </button>
            </div>
          </div>

          <dl className="space-y-1.5 self-start rounded-lg bg-field p-3 text-xs">
            {totals
              .filter(([label, value]) => label === 'Subtotal' || value !== 0)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular-nums">{formatXaf(value)}</dd>
                </div>
              ))}
            <div className="flex justify-between gap-4 border-t border-line pt-1.5 text-sm font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatXaf(total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Payment status</dt>
              <dd className="font-semibold">{paymentLabel}</dd>
            </div>
          </dl>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 text-xs">
          <section>
            <h3 className={sectionTitle}>Customer</h3>
            <p className="mt-1 font-semibold text-ink">
              {customerName}
              <span className="font-normal text-muted">
                {' '}
                · {isNewCustomer ? newPhone : selectedCustomer?.phone}
              </span>
            </p>
          </section>
          <section>
            <h3 className={sectionTitle}>Items</h3>
            <ul className="mt-1 space-y-1">
              {lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-4">
                  <span>
                    {articleLabel(line.name)} × {line.qty}
                    <span className="text-muted"> · {serviceFor(line)?.name}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatXaf(Number(line.qty) * getUnitPrice(line))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className={sectionTitle}>Options</h3>
            <p className="mt-1 text-ink">
              {express ? 'Express' : 'Standard'} ·{' '}
              {method === 'delivery' ? `Delivery to ${address}` : 'Customer pickup'}{' '}
              · Due {new Date(dueAt).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {handling && (
              <p className="mt-1 text-warning">Special handling: {handling}</p>
            )}
          </section>
          <section>
            <h3 className={sectionTitle}>Payment</h3>
            <p className="mt-1 text-ink">
              <span className="font-bold">{formatXaf(total)}</span> ·{' '}
              {paymentLabel}
              {paid > 0 && ` (${formatXaf(paid)} by ${payMethod})`}
            </p>
          </section>
        </div>
      )}
    </Modal>
  )
}

export default NewOrderDialog
