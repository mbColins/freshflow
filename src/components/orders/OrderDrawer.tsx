import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  Ban,
  CircleCheck,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Printer,
  RotateCcw,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import {
  PAYMENT_METHODS,
  PIPELINE_STATUSES,
  MESSAGE_TEMPLATES,
  QC_CHECKS,
  STAFF,
  STATUSES,
} from '../../constants/orders'
import type { Permissions } from '../../constants/orders'
import type {
  Order,
  OrderStatus,
  PaymentMethod,
  QualityCheck,
} from '../../types/order'
import {
  formatTime,
  formatWhen,
  formatXaf,
  getBalance,
  getDueInfo,
  getPaid,
  getStatusLabel,
  getSubtotal,
  getTotal,
} from '../../utils/orders'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { PaymentBadge, PriorityBadge, StatusBadge } from './OrderBadges'
import {
  dangerButton,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from './styles'

type OrderDrawerProps = {
  order: Order | null
  now: number
  permissions: Permissions
  onClose: () => void
  onSetStatus: (id: string, status: OrderStatus) => void
  onAssign: (id: string, staff: string) => void
  onRecordPayment: (
    id: string,
    payment: { amount: number; method: PaymentMethod; reference: string },
  ) => void
  onQualityResult: (id: string, qc: QualityCheck) => void
  onPrint: (id: string) => void
  onCancel: (id: string) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={sectionTitle}>{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-field p-3 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] text-muted">{label}</dt>
          <dd className="font-semibold break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PaymentForm({
  balance,
  onSubmit,
}: {
  balance: number
  onSubmit: (payment: {
    amount: number
    method: PaymentMethod
    reference: string
  }) => void
}) {
  const [amount, setAmount] = useState(String(Math.round(balance)))
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [reference, setReference] = useState('')
  const value = Number(amount)
  const valid = value > 0 && value <= Math.round(balance)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    onSubmit({ amount: value, method, reference: reference.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid gap-2 sm:grid-cols-4">
      <div>
        <label htmlFor="payment-amount" className={labelClass}>
          Amount (XAF)
        </label>
        <input
          id="payment-amount"
          type="number"
          min="1"
          max={Math.round(balance)}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="payment-method" className={labelClass}>
          Method
        </label>
        <select
          id="payment-method"
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          className={fieldClass}
        >
          {PAYMENT_METHODS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="payment-reference" className={labelClass}>
          Reference
        </label>
        <input
          id="payment-reference"
          placeholder="Optional"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className={fieldClass}
        />
      </div>
      <button
        type="submit"
        disabled={!valid}
        className={`${primaryButton} self-end`}
      >
        Record Payment
      </button>
    </form>
  )
}

function QualitySection({
  order,
  canEdit,
  onResult,
}: {
  order: Order
  canEdit: boolean
  onResult: (qc: QualityCheck) => void
}) {
  const [checks, setChecks] = useState(order.qc.checks)
  const [failing, setFailing] = useState(false)
  const [reason, setReason] = useState('')
  const allChecked = QC_CHECKS.every((check) => checks[check])
  const editable = canEdit && order.status === 'qa'

  return (
    <div className="rounded-lg bg-field p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">Inspection</p>
        {order.qc.result === 'passed' && <Badge tone="success">Passed</Badge>}
        {order.qc.result === 'failed' && (
          <Badge tone="danger">Needs Reprocessing</Badge>
        )}
        {order.qc.result === 'pending' && <Badge>Pending</Badge>}
      </div>

      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {QC_CHECKS.map((check) => (
          <li key={check}>
            <label className="flex items-center gap-2 rounded-md bg-white px-2.5 py-2 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={checks[check] ?? false}
                disabled={!editable}
                onChange={(event) =>
                  setChecks({ ...checks, [check]: event.target.checked })
                }
                className="size-4 accent-brand"
              />
              {check}
            </label>
          </li>
        ))}
      </ul>

      {order.qc.result === 'failed' && order.qc.reason && (
        <p className="mt-2 text-[11px] text-danger">
          Reason: {order.qc.reason}
        </p>
      )}

      {!editable && order.qc.result === 'pending' && (
        <p className="mt-2 text-[11px] text-muted">
          Inspection opens when the order reaches Quality Check.
        </p>
      )}

      {editable && !failing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!allChecked}
            onClick={() => onResult({ checks, result: 'passed' })}
            className={primaryButton}
          >
            <CircleCheck className="size-4" aria-hidden="true" />
            Pass & Mark Ready
          </button>
          <button
            type="button"
            onClick={() => setFailing(true)}
            className={secondaryButton}
          >
            <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
            Fail
          </button>
        </div>
      )}

      {editable && failing && (
        <div className="mt-3 space-y-2">
          <label htmlFor="qc-reason" className={labelClass}>
            Reason (required)
          </label>
          <input
            id="qc-reason"
            placeholder="e.g. Stain still visible"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${fieldClass} bg-white`}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() =>
                onResult({ checks, result: 'failed', reason: reason.trim() })
              }
              className={dangerButton}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Send Back to Washing
            </button>
            <button
              type="button"
              onClick={() => setFailing(false)}
              className={secondaryButton}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactActions({ order }: { order: Order }) {
  const [template, setTemplate] = useState(MESSAGE_TEMPLATES[0])
  const phone = order.customer.phone.replace(/[^\d+]/g, '')
  const message = encodeURIComponent(`${template} (Order #${order.id})`)
  const linkClass = `${secondaryButton} h-8`

  return (
    <div className="space-y-2">
      <select
        aria-label="Message template"
        value={template}
        onChange={(event) => setTemplate(event.target.value)}
        className={fieldClass}
      >
        {MESSAGE_TEMPLATES.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${phone}`} className={linkClass}>
          <Phone className="size-3.5 text-muted" aria-hidden="true" />
          Call
        </a>
        <a href={`sms:${phone}?body=${message}`} className={linkClass}>
          <MessageSquare className="size-3.5 text-muted" aria-hidden="true" />
          SMS
        </a>
        <a
          href={`https://wa.me/${phone.replace('+', '')}?text=${message}`}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          <MessageCircle className="size-3.5 text-muted" aria-hidden="true" />
          WhatsApp
        </a>
        <a
          href={`mailto:${order.customer.email}?subject=${encodeURIComponent(`Order #${order.id}`)}&body=${message}`}
          className={linkClass}
        >
          <Mail className="size-3.5 text-muted" aria-hidden="true" />
          Email
        </a>
      </div>
    </div>
  )
}

function OrderDrawer({
  order,
  now,
  permissions,
  onClose,
  onSetStatus,
  onAssign,
  onRecordPayment,
  onQualityResult,
  onPrint,
  onCancel,
}: OrderDrawerProps) {
  const stageIndex = order
    ? PIPELINE_STATUSES.findIndex(({ id }) => id === order.status)
    : -1
  const nextStage =
    order && stageIndex >= 0 && stageIndex < PIPELINE_STATUSES.length - 1
      ? PIPELINE_STATUSES[stageIndex + 1]
      : null
  // Leaving Quality Check goes through the inspection result, not this shortcut
  const canAdvance =
    permissions.updateStatus && nextStage && order?.status !== 'qa'

  return (
    <Modal
      open={order !== null}
      onClose={onClose}
      variant="drawer"
      title={order ? `#${order.id}` : ''}
      subtitle={
        order && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink">
              {order.customer.name}
            </span>
            <StatusBadge order={order} />
            {permissions.financials && <PaymentBadge order={order} />}
            {order.priority !== 'normal' && <PriorityBadge order={order} />}
          </span>
        )
      }
      footer={
        order && (
          <>
            <button type="button" onClick={onClose} className={secondaryButton}>
              Close Drawer
            </button>
            {canAdvance && (
              <button
                type="button"
                onClick={() => onSetStatus(order.id, nextStage.id)}
                className={primaryButton}
              >
                Advance to {nextStage.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}
          </>
        )
      }
    >
      {order && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(order.id)}
              className={secondaryButton}
            >
              <Printer className="size-4 text-muted" aria-hidden="true" />
              Print Receipt
            </button>
            {permissions.updateStatus && (
              <select
                aria-label="Update status"
                value={order.status}
                onChange={(event) => {
                  const status = event.target.value as OrderStatus
                  if (status === 'cancelled') onCancel(order.id)
                  else onSetStatus(order.id, status)
                }}
                className={`${fieldClass} w-auto! bg-white ring-1 ring-line`}
              >
                {STATUSES.filter(
                  ({ id }) =>
                    id !== 'cancelled' ||
                    permissions.cancel ||
                    order.status === 'cancelled',
                ).map(({ id, label }) => (
                  <option key={id} value={id}>
                    {id === order.status ? `Status: ${label}` : label}
                  </option>
                ))}
              </select>
            )}
            {permissions.cancel &&
              !permissions.updateStatus &&
              order.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onCancel(order.id)}
                  className={secondaryButton}
                >
                  <Ban className="size-4 text-danger" aria-hidden="true" />
                  Cancel Order
                </button>
              )}
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted">
              <ScanLine className="size-3.5" aria-hidden="true" />
              {order.id}
            </span>
          </div>

          <Section title="Customer">
            <Rows
              rows={[
                ['Name', order.customer.name],
                ['Phone', order.customer.phone],
                ['Email', order.customer.email],
                ['Customer since', order.customer.since],
                ['Previous orders', order.customer.orders],
                ...(permissions.financials
                  ? ([['Total spent', formatXaf(order.customer.spent)]] as [
                      string,
                      ReactNode,
                    ][])
                  : []),
              ]}
            />
          </Section>

          <Section title="Order information">
            <Rows
              rows={[
                ['Created', formatWhen(order.createdAt, now)],
                [
                  'Expected completion',
                  <>
                    {formatWhen(order.dueAt, now)}
                    <span
                      className={`block text-[11px] font-normal ${getDueInfo(order, now).overdue ? 'font-bold text-danger' : 'text-muted'}`}
                    >
                      {getDueInfo(order, now).relative}
                    </span>
                  </>,
                ],
                [
                  'Actual completion',
                  order.completedAt ? formatWhen(order.completedAt, now) : '—',
                ],
                ['Branch', order.branch],
                ['Created by', order.createdBy],
                [
                  'Assigned staff',
                  permissions.assign ? (
                    <select
                      aria-label="Assigned staff"
                      value={order.assignedTo}
                      onChange={(event) =>
                        onAssign(order.id, event.target.value)
                      }
                      className={`${fieldClass} mt-0.5 h-8 bg-white`}
                    >
                      {STAFF.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    order.assignedTo
                  ),
                ],
                ['Invoice', order.invoice],
                ['Priority', <PriorityBadge order={order} />],
              ]}
            />
          </Section>

          <Section title={`Items (${order.items.length} lines)`}>
            <div className="overflow-x-auto rounded-lg ring-1 ring-line">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead>
                  <tr className="bg-field text-[9px] font-bold tracking-wider text-muted uppercase">
                    <th scope="col" className="px-3 py-2">Item</th>
                    <th scope="col" className="px-3 py-2">Qty</th>
                    <th scope="col" className="px-3 py-2">Service</th>
                    <th scope="col" className="px-3 py-2">Tag</th>
                    <th scope="col" className="px-3 py-2">Stage</th>
                    <th scope="col" className="px-3 py-2">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.tag} className="border-t border-line">
                      <td className="px-3 py-2 font-semibold text-ink">
                        {item.name}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{item.qty}</td>
                      <td className="px-3 py-2">{item.service}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-brand">
                        {item.tag}
                      </td>
                      <td className="px-3 py-2">{getStatusLabel(order)}</td>
                      <td className="px-3 py-2">{item.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {permissions.financials && (
            <Section title="Pricing & payment">
              <dl className="space-y-1.5 rounded-lg bg-field p-3 text-xs">
                {(
                  [
                    ['Subtotal', getSubtotal(order)],
                    ['Express surcharge', order.surcharge],
                    ['Discount', -order.discount],
                    ['Tax', order.tax],
                    ['Delivery fee', order.deliveryFee],
                  ] as [string, number][]
                )
                  .filter(([label, value]) => label === 'Subtotal' || value !== 0)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-muted">{label}</dt>
                      <dd className="tabular-nums">{formatXaf(value)}</dd>
                    </div>
                  ))}
                <div className="flex justify-between gap-4 border-t border-line pt-1.5 text-sm font-bold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatXaf(getTotal(order))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Paid</dt>
                  <dd className="tabular-nums">{formatXaf(getPaid(order))}</dd>
                </div>
                <div className="flex justify-between gap-4 font-bold">
                  <dt>Balance</dt>
                  <dd
                    className={`tabular-nums ${getBalance(order) > 0 ? 'text-danger' : 'text-success'}`}
                  >
                    {formatXaf(getBalance(order))}
                  </dd>
                </div>
              </dl>

              {order.payments.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[11px]">
                    <caption className="sr-only">Payment history</caption>
                    <thead>
                      <tr className="text-[9px] font-bold tracking-wider text-muted uppercase">
                        <th scope="col" className="py-1 pr-3">Date</th>
                        <th scope="col" className="py-1 pr-3">Amount</th>
                        <th scope="col" className="py-1 pr-3">Method</th>
                        <th scope="col" className="py-1 pr-3">Reference</th>
                        <th scope="col" className="py-1">Recorded by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.payments.map((payment) => (
                        <tr key={payment.at + payment.reference} className="border-t border-line">
                          <td className="py-1.5 pr-3">{formatWhen(payment.at, now)}</td>
                          <td className="py-1.5 pr-3 font-semibold tabular-nums">
                            {formatXaf(payment.amount)}
                          </td>
                          <td className="py-1.5 pr-3">{payment.method}</td>
                          <td className="py-1.5 pr-3 font-mono">{payment.reference || '—'}</td>
                          <td className="py-1.5">{payment.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {permissions.payments &&
                getBalance(order) > 0 &&
                order.status !== 'cancelled' && (
                  <PaymentForm
                    key={`${order.id}-${order.payments.length}`}
                    balance={getBalance(order)}
                    onSubmit={(payment) => onRecordPayment(order.id, payment)}
                  />
                )}
            </Section>
          )}

          <Section title="Pickup / delivery">
            <Rows
              rows={
                order.method === 'delivery'
                  ? [
                      ['Type', 'Delivery'],
                      ['Address', order.address ?? '—'],
                      ['Driver', order.driver ?? 'Unassigned'],
                      [
                        'Delivery status',
                        order.status === 'completed'
                          ? 'Delivered'
                          : order.status === 'handover'
                            ? 'Out for delivery'
                            : 'Not dispatched',
                      ],
                    ]
                  : [
                      ['Type', 'Customer pickup'],
                      ['Counter', order.branch],
                    ]
              }
            />
          </Section>

          {(order.customerNotes || order.staffNotes || order.handling) && (
            <Section title="Notes">
              <div className="space-y-2 text-xs">
                {order.handling && (
                  <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 font-semibold text-warning">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    Special handling: {order.handling}
                  </p>
                )}
                {order.customerNotes && (
                  <p className="rounded-lg bg-field p-3 text-ink">
                    <span className="block text-[10px] text-muted">Customer notes</span>
                    {order.customerNotes}
                  </p>
                )}
                {order.staffNotes && (
                  <p className="rounded-lg bg-field p-3 text-ink">
                    <span className="block text-[10px] text-muted">Staff notes</span>
                    {order.staffNotes}
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section title="Quality control">
            <QualitySection
              key={`${order.id}-${order.status}-${order.qc.result}`}
              order={order}
              canEdit={permissions.updateStatus}
              onResult={(qc) => onQualityResult(order.id, qc)}
            />
          </Section>

          <Section title="Contact customer">
            <ContactActions key={order.id} order={order} />
          </Section>

          <Section title="Timeline">
            <ol className="space-y-3 border-l border-line pl-4">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
                  <p className="font-semibold text-ink">
                    <time className="font-normal text-muted tabular-nums">
                      {formatTime(entry.at)}
                    </time>{' '}
                    {entry.action}
                  </p>
                  <p className="text-[11px] text-muted">
                    {entry.by}
                    {entry.note && ` · “${entry.note}”`}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </Modal>
  )
}

export default OrderDrawer
