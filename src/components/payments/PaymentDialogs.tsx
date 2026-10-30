import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Check, CircleCheck, Printer } from 'lucide-react'
import {
  PAY_METHODS,
  REFUND_REASONS,
  REMINDER_CHANNELS,
  VARIANCE_REASONS,
} from '../../constants/payments'
import { useGetReceiptQuery } from '../../services/paymentApi'
import type { PaymentProvider } from '../../services/paymentApi'
import type {
  PayMethod,
  Receivable,
  Transaction,
} from '../../types/payment'
import { formatDate } from '../../utils/customers'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { getOutstanding, getRefundable, getTxnStatus, isDigital } from '../../utils/payments'
import {
  dangerButton,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Modal from '../ui/Modal'

const pickClass =
  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1.5 rounded-lg bg-field p-3 text-xs">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={`flex justify-between gap-4 ${
            index === rows.length - 1 ? 'border-t border-line pt-1.5 text-sm font-bold' : ''
          }`}
        >
          <dt className={index === rows.length - 1 ? '' : 'text-muted'}>{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------- Record payment ----------

export type PaymentInput = {
  receivableId: string
  amount: number
  method: PayMethod
  provider: string
  reference: string
  // Cash only: what the customer handed over, for the change
  cashReceived?: number
}

const RECORD_STEPS = ['Select Order', 'Enter Payment', 'Confirmation', 'Receipt']

export function RecordPaymentDialog({
  receivables,
  providers: configured,
  initialReceivableId,
  onClose,
  onRecord,
  onPrint,
}: {
  receivables: Receivable[]
  // The branch's payment providers, from GET /payment-providers
  providers: PaymentProvider[]
  initialReceivableId: string
  onClose: () => void
  // Resolves with the transaction that was created; rejects with an Error
  // whose message says why the server refused
  onRecord: (input: PaymentInput) => Promise<Transaction>
  onPrint: (txnId: string) => void
}) {
  const open = receivables.filter((receivable) => getOutstanding(receivable) > 0)
  const initial = open.find(({ id }) => id === initialReceivableId)
  const [step, setStep] = useState(initial ? 1 : 0)
  const [receivable, setReceivable] = useState<Receivable | null>(initial ?? null)
  const [amount, setAmount] = useState(initial ? String(getOutstanding(initial)) : '')
  const [method, setMethod] = useState<PayMethod>('Cash')
  const [provider, setProvider] = useState('')
  const [reference, setReference] = useState('')
  const [received, setReceived] = useState('')
  const [result, setResult] = useState<Transaction | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outstanding = receivable ? getOutstanding(receivable) : 0
  const value = Number(amount) || 0
  const providers = configured.filter((item) => item.method === method && item.enabled)
  const needsProvider = isDigital(method)
  const change = method === 'Cash' && received ? Number(received) - value : 0
  const paymentValid =
    value > 0 &&
    value <= outstanding &&
    (!needsProvider || (provider !== '' && reference.trim() !== '')) &&
    change >= 0

  // Picking an order fills in the amount still owed; Continue moves on
  function choose(id: string) {
    const next = open.find((item) => item.id === id) ?? null
    setReceivable(next)
    setAmount(next ? String(getOutstanding(next)) : '')
  }

  async function confirm() {
    if (!receivable) return
    setSaving(true)
    setError(null)
    try {
      setResult(
        await onRecord({
          receivableId: receivable.id,
          amount: value,
          method,
          provider: needsProvider ? provider : '',
          reference: reference.trim(),
          ...(method === 'Cash' && received ? { cashReceived: Number(received) } : {}),
        }),
      )
      setStep(3)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The payment wasn’t recorded.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Payment"
      subtitle={`Step ${step + 1} of ${RECORD_STEPS.length}: ${RECORD_STEPS[step]}`}
      footer={
        step === 3 ? (
          <>
            <button
              type="button"
              onClick={() => result && onPrint(result.id)}
              className={secondaryButton}
            >
              <Printer className="size-4 text-muted" aria-hidden="true" />
              Print Receipt
            </button>
            <button type="button" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </>
        ) : (
          <>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className={`${secondaryButton} mr-auto`}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
            )}
            {step === 0 && (
              <button
                type="button"
                disabled={!receivable}
                onClick={() => setStep(1)}
                className={primaryButton}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                disabled={!paymentValid}
                onClick={() => setStep(2)}
                className={primaryButton}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}
            {step === 2 && (
              <button type="button" onClick={() => void confirm()} disabled={saving} className={primaryButton}>
                <Check className="size-4" aria-hidden="true" />
                {saving ? 'Recording…' : 'Confirm Payment'}
              </button>
            )}
          </>
        )
      }
    >
      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label htmlFor="pay-order" className={labelClass}>
              Order with a balance
            </label>
            <select
              id="pay-order"
              autoFocus
              value={receivable?.id ?? ''}
              onChange={(event) => choose(event.target.value)}
              className={fieldClass}
            >
              <option value="">
                {open.length === 0 ? 'No unpaid or pending orders' : 'Choose an unpaid or pending order…'}
              </option>
              {open.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.orderId} · {item.customer} · {formatXaf(getOutstanding(item))} due
                </option>
              ))}
            </select>
          </div>
          {receivable && (
            <Summary
              rows={[
                ['Customer', receivable.customer],
                ['Order total', formatXaf(receivable.total)],
                ['Paid so far', formatXaf(receivable.paid)],
                ['Outstanding', formatXaf(outstanding)],
              ]}
            />
          )}
        </div>
      )}

      {step === 1 && receivable && (
        <div className="space-y-3">
          <p className="rounded-lg bg-field p-3 text-xs text-muted">
            <span className="font-semibold text-ink">{receivable.customer}</span> ·{' '}
            {receivable.orderId} · outstanding{' '}
            <span className="font-bold text-ink">{formatXaf(outstanding)}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pay-amount" className={labelClass}>
                Amount (XAF)
              </label>
              <input
                id="pay-amount"
                type="number"
                min="1"
                max={outstanding}
                inputMode="numeric"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={fieldClass}
              />
              {value > outstanding && (
                <p className="mt-1 text-[11px] font-semibold text-danger">
                  More than the outstanding balance.
                </p>
              )}
              {value > 0 && value < outstanding && (
                <p className="mt-1 text-[11px] text-muted">
                  Partial payment: {formatXaf(outstanding - value)} will remain.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="pay-method" className={labelClass}>
                Payment method
              </label>
              <select
                id="pay-method"
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value as PayMethod)
                  setProvider('')
                }}
                className={fieldClass}
              >
                {PAY_METHODS.map(({ id }) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </div>
            {method === 'Cash' && (
              <>
                <div>
                  <label htmlFor="pay-received" className={labelClass}>
                    Amount received (optional)
                  </label>
                  <input
                    id="pay-received"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={received}
                    onChange={(event) => setReceived(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <p className={labelClass}>Change</p>
                  <p
                    className={`flex h-9 items-center rounded-md bg-field px-3 text-xs font-bold tabular-nums ${change < 0 ? 'text-danger' : 'text-ink'}`}
                  >
                    {received ? formatXaf(change) : '—'}
                  </p>
                </div>
              </>
            )}
            {needsProvider && (
              <>
                <div>
                  <label htmlFor="pay-provider" className={labelClass}>
                    Provider
                  </label>
                  <select
                    id="pay-provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Choose a provider…</option>
                    {providers.map(({ provider: name, status }) => (
                      <option key={name} value={name}>
                        {name}
                        {status !== 'OPERATIONAL' ? ' (degraded)' : ''}
                      </option>
                    ))}
                  </select>
                  {providers.length === 0 && (
                    <p className="mt-1 text-[11px] text-danger">
                      No {method.toLowerCase()} provider is enabled for this branch. The owner or a manager can set them up.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="pay-reference" className={labelClass}>
                    Transaction / reference number
                  </label>
                  <input
                    id="pay-reference"
                    autoComplete="off"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className={`${fieldClass} font-mono`}
                  />
                </div>
              </>
            )}
          </div>
          {providers.find((item) => item.provider === provider)?.status === 'DEGRADED' && (
            <p className="rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
              This provider is degraded right now. Confirm the customer received a
              success message, or use another payment method.
            </p>
          )}
        </div>
      )}

      {step === 2 && receivable && (
        <div className="space-y-3">
          <Summary
            rows={[
              ['Order total', formatXaf(receivable.total)],
              ['Previously paid', formatXaf(receivable.paid)],
              [`New payment (${method}${provider ? `, ${provider}` : ''})`, formatXaf(value)],
              ['Remaining', formatXaf(outstanding - value)],
            ]}
          />
          <p className="text-[11px] text-muted">
            {receivable.customer} · {receivable.orderId}
            {reference && ` · reference ${reference}`}
          </p>
        </div>
      )}

      {error && step === 2 && (
        <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      {step === 3 && result && (
        <div className="space-y-3 text-center">
          <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
          <p className="text-base font-bold text-ink">Payment Successful</p>
          <p className="text-2xl font-bold text-ink tabular-nums">{formatXaf(result.amount)}</p>
          <p className="text-xs text-muted">
            Transaction <span className="font-mono font-semibold text-ink">{result.id}</span> ·
            Receipt <span className="font-mono font-semibold text-ink">{result.receipt}</span>
          </p>
        </div>
      )}
    </Modal>
  )
}

// ---------- Refund ----------

export function RefundDialog({
  transactions,
  initialTxnId,
  canApprove,
  onClose,
  onSubmit,
}: {
  transactions: Transaction[]
  initialTxnId: string
  canApprove: boolean
  onClose: () => void
  onSubmit: (txnId: string, amount: number, reason: string) => void
}) {
  const refundable = transactions.filter((txn) => getRefundable(txn) > 0)
  const initial = refundable.find(({ id }) => id === initialTxnId)
  const [step, setStep] = useState(initial ? 1 : 0)
  const [query, setQuery] = useState('')
  const [txn, setTxn] = useState<Transaction | null>(initial ?? null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState(REFUND_REASONS[0])

  const needle = query.trim().toLowerCase()
  const matches = refundable.filter(
    ({ id, customer, orderId }) =>
      !needle || [id, customer, orderId].some((field) => field.toLowerCase().includes(needle)),
  )
  const available = txn ? getRefundable(txn) : 0
  const value = Number(amount) || 0
  const valid = value > 0 && value <= available

  return (
    <Modal
      open
      onClose={onClose}
      title={canApprove ? 'Issue Refund' : 'Request Refund'}
      subtitle={
        canApprove
          ? 'The refund is completed as soon as you confirm.'
          : 'Your request goes to a manager for approval.'
      }
      footer={
        <>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`${secondaryButton} mr-auto`}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              disabled={!valid}
              onClick={() => setStep(2)}
              className={primaryButton}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
          {step === 2 && txn && (
            <button
              type="button"
              onClick={() => onSubmit(txn.id, value, reason)}
              className={dangerButton}
            >
              {canApprove ? `Refund ${formatXaf(value)}` : 'Send for Approval'}
            </button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label htmlFor="refund-search" className={labelClass}>
              Find the payment to refund
            </label>
            <input
              id="refund-search"
              type="search"
              autoFocus
              placeholder="Transaction / customer / order"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={fieldClass}
            />
          </div>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {matches.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTxn(item)
                    setStep(1)
                  }}
                  className={`${pickClass} bg-field hover:bg-brand/10`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {item.customer}
                    </span>
                    <span className="block font-mono text-[11px] text-muted">
                      {item.id} · {item.orderId} · {item.method}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-ink tabular-nums">
                    {formatXaf(getRefundable(item))}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
                No refundable payment matches.
              </li>
            )}
          </ul>
        </div>
      )}

      {step === 1 && txn && (
        <div className="space-y-3">
          <Summary
            rows={[
              ['Original payment', formatXaf(txn.amount)],
              ['Already refunded', formatXaf(txn.refunded)],
              ['Available', formatXaf(available)],
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="refund-amount" className={labelClass}>
                Refund amount (XAF)
              </label>
              <input
                id="refund-amount"
                type="number"
                min="1"
                max={available}
                inputMode="numeric"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={fieldClass}
              />
              {value > available && (
                <p className="mt-1 text-[11px] font-semibold text-danger">
                  More than the amount available to refund.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="refund-reason" className={labelClass}>
                Reason
              </label>
              <select
                id="refund-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={fieldClass}
              >
                {REFUND_REASONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 2 && txn && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-ink">
            Refund {formatXaf(value)} to {txn.customer}?
          </p>
          <p className="text-xs text-muted">
            {txn.id} · {txn.orderId} · back to {txn.method} · reason: {reason}.
            {value === available
              ? ' This refunds the whole remaining payment.'
              : ` ${formatXaf(available - value)} of the payment stays collected.`}
          </p>
        </div>
      )}
    </Modal>
  )
}

// ---------- Reminder ----------

export function ReminderDialog({
  receivable,
  onClose,
  onSend,
}: {
  receivable: Receivable
  onClose: () => void
  // `scheduledFor` is a datetime-local value, empty to send now. Rejects with
  // an Error whose message says why the server refused
  onSend: (channel: string, message: string, scheduledFor: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState(REMINDER_CHANNELS[0])
  const [sendAt, setSendAt] = useState('')
  const [message, setMessage] = useState(
    `Your FreshFlow order #${receivable.orderId} has an outstanding balance of ${formatXaf(getOutstanding(receivable))}. Please complete your payment to finalize your order.`,
  )

  return (
    <Modal
      open
      onClose={onClose}
      title="Send Payment Reminder"
      subtitle={`${receivable.customer} · ${receivable.phone}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!message.trim() || saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await onSend(channel, message.trim(), sendAt)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'The reminder wasn’t sent.')
              } finally {
                setSaving(false)
              }
            }}
            className={primaryButton}
          >
            {saving ? 'Sending…' : sendAt ? 'Schedule Reminder' : 'Send Now'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="reminder-channel" className={labelClass}>
              Channel
            </label>
            <select
              id="reminder-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className={fieldClass}
            >
              {REMINDER_CHANNELS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reminder-when" className={labelClass}>
              Schedule for later (optional)
            </label>
            <input
              id="reminder-when"
              type="datetime-local"
              value={sendAt}
              onChange={(event) => setSendAt(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="reminder-message" className={labelClass}>
            Message preview
          </label>
          <textarea
            id="reminder-message"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${fieldClass} h-auto py-2`}
          />
        </div>
      </div>
    </Modal>
  )
}

// ---------- Cash register ----------

export function CashAdjustDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (amount: number, reason: string) => void
}) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: { amount: '', reason: '' },
  })
  const [amount, reason] = useWatch({ control, name: ['amount', 'reason'] })
  const value = Math.trunc(Number(amount))
  const valid = value !== 0 && reason.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Cash Adjustment"
      subtitle="Add float or record a payout. Recorded in the audit trail."
    >
      <form
        onSubmit={handleSubmit((values) => {
          if (valid) onSave(Math.trunc(Number(values.amount)), values.reason.trim())
        })}
        className="space-y-3"
      >
        <div>
          <label htmlFor="adjust-amount" className={labelClass}>
            Amount in XAF (negative for a payout)
          </label>
          <input
            id="adjust-amount"
            type="number"
            autoFocus
            placeholder="e.g. 50000 or -35000"
            {...register('amount')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="adjust-reason" className={labelClass}>
            Reason
          </label>
          <input id="adjust-reason" {...register('reason')} className={fieldClass} />
        </div>
        <button type="submit" disabled={!valid} className={`${primaryButton} w-full`}>
          Save Adjustment
        </button>
      </form>
    </Modal>
  )
}

export function CloseSessionDialog({
  expected,
  onClose,
  onConfirm,
}: {
  expected: number
  onClose: () => void
  onConfirm: (counted: number, reason: string) => void
}) {
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const value = counted === '' ? null : Number(counted)
  const difference = value === null ? 0 : value - expected
  const valid = value !== null && value >= 0 && (difference === 0 || reason !== '')

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Count & Close Session"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => value !== null && onConfirm(value, reason)}
            className={difference === 0 ? primaryButton : dangerButton}
          >
            Close Session
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Summary
          rows={[
            ['Expected balance', formatXaf(expected)],
            ['Counted', value === null ? '—' : formatXaf(value)],
            [
              'Difference',
              value === null
                ? '—'
                : `${difference > 0 ? '+' : ''}${formatXaf(difference).replace('XAF ', '')} XAF`,
            ],
          ]}
        />
        <div>
          <label htmlFor="close-counted" className={labelClass}>
            Cash counted in the drawer (XAF)
          </label>
          <input
            id="close-counted"
            type="number"
            min="0"
            inputMode="numeric"
            autoFocus
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            className={fieldClass}
          />
        </div>
        {value !== null && difference !== 0 && (
          <div>
            <label htmlFor="close-reason" className={labelClass}>
              Variance detected: reason (required)
            </label>
            <select
              id="close-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={fieldClass}
            >
              <option value="">Choose a reason…</option>
              {VARIANCE_REASONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        )}
        {value !== null && difference === 0 && (
          <p className="flex items-center gap-2 text-xs font-semibold text-success">
            <CircleCheck className="size-4" aria-hidden="true" />
            Balanced
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Open the register ----------

export function OpenSessionDialog({
  suggestedFloat,
  onClose,
  onOpen,
}: {
  // What the last session was counted at, if any
  suggestedFloat: number
  onClose: () => void
  onOpen: (register: string, openingFloat: number) => Promise<void>
}) {
  const [register, setRegister] = useState('Main register')
  const [float, setFloat] = useState(suggestedFloat > 0 ? String(suggestedFloat) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = float === '' ? null : Number(float)
  const valid = register.trim() !== '' && value !== null && value >= 0

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Open Cash Register"
      subtitle="Cash payments can only be recorded while a register is open."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={async () => {
              if (value === null) return
              setSaving(true)
              setError(null)
              try {
                await onOpen(register.trim(), value)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'The register wasn’t opened.')
              } finally {
                setSaving(false)
              }
            }}
            className={primaryButton}
          >
            {saving ? 'Opening…' : 'Open Register'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="open-register" className={labelClass}>
            Register
          </label>
          <input id="open-register" autoFocus value={register} onChange={(event) => setRegister(event.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="open-float" className={labelClass}>
            Opening float in the drawer (XAF)
          </label>
          <input
            id="open-float"
            type="number"
            min="0"
            inputMode="numeric"
            value={float}
            onChange={(event) => setFloat(event.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
    </Modal>
  )
}

// ---------- Resolve an exception ----------

export function ResolveExceptionDialog({
  reason,
  onClose,
  onResolve,
}: {
  reason: string
  onClose: () => void
  onResolve: (resolution: string) => Promise<void>
}) {
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Resolve Exception"
      subtitle={reason}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!resolution.trim() || saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await onResolve(resolution.trim())
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'The exception wasn’t resolved.')
              } finally {
                setSaving(false)
              }
            }}
            className={primaryButton}
          >
            {saving ? 'Saving…' : 'Mark Resolved'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="resolve-note" className={labelClass}>
            What was done
          </label>
          <textarea
            id="resolve-note"
            rows={3}
            autoFocus
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className={`${fieldClass} h-auto py-2`}
          />
        </div>
      </div>
    </Modal>
  )
}

// ---------- Receipt ----------

// The receipt as the server prints it: business, lines, totals, change
export function TxnReceiptDialog({
  txn,
  onClose,
}: {
  txn: Transaction
  onClose: () => void
}) {
  const { data: receipt, isLoading, isError, refetch } = useGetReceiptQuery(txn.uuid)
  const money = (value: number) => formatXaf(value)

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Receipt"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          <button type="button" onClick={() => window.print()} disabled={!receipt} className={primaryButton}>
            <Printer className="size-4" aria-hidden="true" />
            Print Receipt
          </button>
        </>
      }
    >
      {isLoading ? (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <p className="sr-only" role="status">Loading the receipt…</p>
          <div className="mx-auto h-4 w-32 rounded bg-field" />
          <div className="h-28 rounded bg-field" />
          <div className="h-8 rounded bg-field" />
        </div>
      ) : isError || !receipt ? (
        <div role="alert" className="space-y-2 text-center text-xs">
          <p className="font-semibold text-danger">Couldn’t load the receipt.</p>
          <button type="button" onClick={() => void refetch()} className={secondaryButton}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="print-area space-y-3 bg-white text-xs text-ink">
          <div className="text-center">
            {receipt.logo && (
              <img src={`data:image/png;base64,${receipt.logo}`} alt="" className="mx-auto mb-1 max-h-12" />
            )}
            <p className="text-sm font-bold">{receipt.businessName}</p>
            <p className="text-[11px] text-muted">
              {[receipt.slogan, receipt.branchName].filter(Boolean).join(' · ')}
            </p>
            {(receipt.branchAddress || receipt.phone) && (
              <p className="text-[11px] text-muted">{[receipt.branchAddress, receipt.phone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <dl className="space-y-1 border-y border-dashed border-line py-2">
            {(
              [
                ['Receipt', receipt.receipt],
                ['Transaction', receipt.code],
                ['Date', `${formatDate(receipt.at)}, ${formatClock(receipt.at)}`],
                ['Customer', receipt.customer],
                ['Order', receipt.order],
                ['Payment method', receipt.provider ? `${receipt.method} (${receipt.provider})` : receipt.method],
                ['Reference', receipt.reference],
                ['Cashier', receipt.cashier],
              ] as [string, string][]
            )
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
          </dl>
          {receipt.lines.length > 0 && (
            <ul className="space-y-1 border-b border-dashed border-line pb-2">
              {receipt.lines.map((line, index) => (
                <li key={index} className="flex justify-between gap-4">
                  <span className="min-w-0 truncate">
                    {line.quantity} × {line.description}
                  </span>
                  <span className="tabular-nums">{money(line.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="space-y-1">
            {(
              [
                ['Subtotal', receipt.subtotal, false],
                ['Discount', -receipt.discount, receipt.discount === 0],
                ['Surcharge', receipt.surcharge, receipt.surcharge === 0],
                ['Tax', receipt.tax, receipt.tax === 0],
                ['Delivery', receipt.deliveryFee, receipt.deliveryFee === 0],
                ['Order total', receipt.total, false],
              ] as [string, number, boolean][]
            )
              .filter(([, , hidden]) => !hidden)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular-nums">{money(value)}</dd>
                </div>
              ))}
          </dl>
          <div className="flex justify-between gap-4 border-t border-dashed border-line pt-2 text-sm font-bold">
            <span>Paid</span>
            <span className="tabular-nums">{money(receipt.amount)}</span>
          </div>
          {receipt.cashReceived !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted">Cash received · change</span>
              <span className="tabular-nums">
                {money(receipt.cashReceived)} · {money(receipt.change ?? 0)}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted">Balance after this payment</span>
            <span className="tabular-nums">{money(receipt.balanceAfter)}</span>
          </div>
          <p className="border-t border-dashed border-line pt-2 text-center text-sm font-bold tracking-widest uppercase">
            {getTxnStatus(txn.status).label}
          </p>
        </div>
      )}
    </Modal>
  )
}
