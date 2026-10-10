import { useState } from 'react'
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
import {
  BRANCHES,
  CURRENT_USER,
  DELIVERY_FEE,
  EXPRESS_SURCHARGE_RATE,
  ITEM_PRICES,
  PAYMENT_METHODS,
  QC_CHECKS,
  SERVICES,
  SERVICE_MULTIPLIERS,
  STAFF,
  TAX_RATE,
} from '../../constants/orders'
import type {
  Customer,
  FulfilmentMethod,
  Order,
  PaymentMethod,
} from '../../types/order'
import { formatXaf } from '../../utils/orders'
import Modal from '../ui/Modal'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from './styles'

const STEPS = ['Customer', 'Services & Items', 'Options', 'Payment', 'Confirm']
const ITEM_NAMES = Object.keys(ITEM_PRICES)

export type AfterCreate = 'none' | 'print' | 'send'

type Line = { key: number; name: string; qty: string; service: string }

type NewOrderDialogProps = {
  onClose: () => void
  customers: Customer[]
  // Set when the order is started from a customer's profile
  initialCustomer?: Customer
  initialHandling?: string
  nextNumber: number
  onCreate: (order: Order, after: AfterCreate) => void
}

function getUnitPrice(line: Line) {
  return Math.round(ITEM_PRICES[line.name] * SERVICE_MULTIPLIERS[line.service])
}

function toLocalInputValue(time: number) {
  const date = new Date(time)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function NewOrderDialog({
  onClose,
  customers,
  initialCustomer,
  initialHandling = '',
  nextNumber,
  onCreate,
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
    { key: 0, name: ITEM_NAMES[0], qty: '1', service: SERVICES[0] },
  ])
  const [nextLineKey, setNextLineKey] = useState(1)

  const [express, setExpress] = useState(false)
  const [method, setMethod] = useState<FulfilmentMethod>('pickup')
  const [address, setAddress] = useState('')
  const [dueAt, setDueAt] = useState(() =>
    toLocalInputValue(Date.now() + 24 * 3_600_000),
  )
  const [customerNotes, setCustomerNotes] = useState('')
  const [handling, setHandling] = useState(initialHandling)

  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash')
  const [amountPaid, setAmountPaid] = useState('')

  const needle = customerQuery.trim().toLowerCase()
  const matches = customers.filter(
    ({ name, phone }) =>
      !needle ||
      name.toLowerCase().includes(needle) ||
      phone.replace(/\s/g, '').includes(needle.replace(/\s/g, '')),
  )

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
    lines.length > 0 && lines.every((line) => Number(line.qty) >= 1),
    dueAt !== '' && (method === 'pickup' || address.trim() !== ''),
    paid >= 0 && paid <= total,
    true,
  ][step]

  function updateLine(key: number, patch: Partial<Line>) {
    setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine(service = SERVICES[0]) {
    setLines([...lines, { key: nextLineKey, name: ITEM_NAMES[0], qty: '1', service }])
    setNextLineKey(nextLineKey + 1)
  }

  function handleCreate(after: AfterCreate) {
    const createdAt = new Date().toISOString()
    const customer: Customer = isNewCustomer
      ? {
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          type: 'new',
          since: new Date().toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric',
          }),
          orders: 0,
          spent: 0,
        }
      : selectedCustomer!

    onCreate(
      {
        id: `ORD-${nextNumber}`,
        invoice: `INV-${nextNumber}`,
        customer,
        items: lines.map((line, index) => ({
          name: line.name,
          qty: Number(line.qty),
          service: line.service,
          unitPrice: getUnitPrice(line),
          tag: `T-${nextNumber}-${index + 1}`,
          condition: 'Normal',
        })),
        status: 'received',
        priority: express ? 'express' : 'normal',
        createdAt,
        dueAt: new Date(dueAt).toISOString(),
        branch: BRANCHES[0],
        createdBy: CURRENT_USER,
        assignedTo: STAFF[0],
        method,
        address: method === 'delivery' ? address.trim() : undefined,
        surcharge,
        discount: discountValue,
        tax,
        deliveryFee,
        payments:
          paid > 0
            ? [
                {
                  at: createdAt,
                  amount: paid,
                  method: payMethod,
                  reference: '',
                  by: CURRENT_USER,
                },
              ]
            : [],
        customerNotes: customerNotes.trim(),
        staffNotes: '',
        handling: handling.trim(),
        qc: {
          checks: Object.fromEntries(QC_CHECKS.map((check) => [check, false])),
          result: 'pending',
        },
        timeline: [{ at: createdAt, action: 'Order created', by: CURRENT_USER }],
      },
      after,
    )
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
      subtitle={`Order #ORD-${nextNumber}${customerName ? ` for ${customerName}` : ''} · Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      footer={
        <>
          <p className="mr-auto text-xs font-bold text-ink">
            Total: {formatXaf(total)}
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
                onClick={() => handleCreate('send')}
                className={secondaryButton}
              >
                <Send className="size-4 text-muted" aria-hidden="true" />
                Create & Send Confirmation
              </button>
              <button
                type="button"
                onClick={() => handleCreate('print')}
                className={secondaryButton}
              >
                <Printer className="size-4 text-muted" aria-hidden="true" />
                Create & Print Receipt
              </button>
              <button
                type="button"
                onClick={() => handleCreate('none')}
                className={primaryButton}
              >
                <Check className="size-4" aria-hidden="true" />
                Create Order
              </button>
            </>
          )}
        </>
      }
    >
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
                  placeholder="Search customer by name or phone"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {matches.map((customer) => {
                  const selected = selectedCustomer?.phone === customer.phone
                  return (
                    <li key={customer.phone}>
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
                          <span className="text-[11px] text-muted">
                            {customer.phone} · {customer.email}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {customer.orders} previous orders
                        </span>
                      </button>
                    </li>
                  )
                })}
                {matches.length === 0 && (
                  <li className="rounded-lg bg-field px-3 py-4 text-center text-xs text-muted">
                    No customer matches “{customerQuery}”.
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
                    {ITEM_NAMES.map((name) => (
                      <option key={name}>{name}</option>
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
                    value={line.service}
                    onChange={(event) =>
                      updateLine(line.key, { service: event.target.value })
                    }
                    className={`${fieldClass} bg-white`}
                  >
                    {SERVICES.map((service) => (
                      <option key={service}>{service}</option>
                    ))}
                  </select>
                </div>
                <p className="pb-2 text-right text-xs text-muted tabular-nums">
                  {formatXaf(getUnitPrice(line))} each
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
                  aria-label={`Remove ${line.name}`}
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
            {SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => addLine(service)}
                className={`${secondaryButton} h-8`}
              >
                {service}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
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
                    {line.name} × {line.qty}
                    <span className="text-muted"> · {line.service}</span>
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
