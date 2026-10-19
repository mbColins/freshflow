import { useForm, useWatch } from 'react-hook-form'
import { Printer, ScanLine } from 'lucide-react'
import { NOTIFICATION_EVENTS } from '../../constants/orders'
import useLocalStorage from '../../hooks/useLocalStorage'
import type { Order } from '../../types/order'
import {
  formatWhen,
  formatXaf,
  getBalance,
  getPaid,
  getPaymentStatus,
  getSubtotal,
  getTotal,
} from '../../utils/orders'
import Modal from '../ui/Modal'
import {
  dangerButton,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from './styles'

export type ConfirmRequest = {
  title: string
  body: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest
  onClose: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title={request.title}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Keep as is
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              request.onConfirm()
              onClose()
            }}
            className={request.destructive ? dangerButton : primaryButton}
          >
            {request.confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-xs leading-relaxed text-muted">{request.body}</p>
    </Modal>
  )
}

export function ScanOrderDialog({
  onClose,
  onFind,
}: {
  onClose: () => void
  onFind: (code: string) => boolean
}) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ code: string }>({ defaultValues: { code: '' } })
  const code = useWatch({ control, name: 'code' })

  function onSubmit(values: { code: string }) {
    if (!onFind(values.code)) {
      setError('code', { message: `No order found for “${values.code}”.` })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Scan Order"
      subtitle="Scan a tag with a barcode scanner, or type the order number."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label htmlFor="scan-code" className={labelClass}>
            Order reference
          </label>
          <div className="relative">
            <ScanLine
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="scan-code"
              autoFocus
              autoComplete="off"
              placeholder="e.g. ORD-10452"
              {...register('code', {
                validate: (value) => value.trim() !== '',
                onChange: () => clearErrors('code'),
              })}
              aria-invalid={Boolean(errors.code?.message)}
              aria-describedby="scan-error"
              className={`${fieldClass} pl-9 font-mono`}
            />
          </div>
          <p
            id="scan-error"
            role="alert"
            className="mt-1 min-h-4 text-[11px] font-semibold text-danger"
          >
            {errors.code?.message}
          </p>
        </div>
        <button
          type="submit"
          disabled={!code.trim()}
          className={`${primaryButton} w-full`}
        >
          Open Order
        </button>
      </form>
    </Modal>
  )
}

export function NotificationPrefsDialog({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useLocalStorage<string[]>(
    'orders.notifications',
    NOTIFICATION_EVENTS,
  )

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Notification preferences"
      subtitle="Choose which order events notify you."
      footer={
        <button type="button" onClick={onClose} className={primaryButton}>
          Done
        </button>
      }
    >
      <ul className="space-y-1">
        {NOTIFICATION_EVENTS.map((event) => (
          <li key={event}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-xs font-semibold text-ink hover:bg-field">
              {event}
              <input
                type="checkbox"
                checked={enabled.includes(event)}
                onChange={(changeEvent) =>
                  setEnabled(
                    changeEvent.target.checked
                      ? [...enabled, event]
                      : enabled.filter((name) => name !== event),
                  )
                }
                className="size-4 accent-brand"
              />
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function ReceiptDialog({
  order,
  now,
  onClose,
}: {
  order: Order
  now: number
  onClose: () => void
}) {
  const paymentStatus = getPaymentStatus(order)
  const lastPayment = order.payments[order.payments.length - 1]

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
          <button
            type="button"
            onClick={() => window.print()}
            className={primaryButton}
          >
            <Printer className="size-4" aria-hidden="true" />
            Print Receipt
          </button>
        </>
      }
    >
      <div className="print-area space-y-3 bg-white text-xs text-ink">
        <div className="text-center">
          <p className="text-sm font-bold">FreshFlow Laundry</p>
          <p className="text-[11px] text-muted">{order.branch}</p>
        </div>
        <dl className="space-y-1 border-y border-dashed border-line py-2">
          {[
            ['Order', `#${order.id}`],
            ['Invoice', order.invoice],
            ['Date', formatWhen(order.createdAt, now)],
            ['Customer', order.customer.name],
            ['Expected completion', formatWhen(order.dueAt, now)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] text-muted">
              <th scope="col" className="pb-1 font-semibold">Item</th>
              <th scope="col" className="pb-1 font-semibold">Service</th>
              <th scope="col" className="pb-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.tag}>
                <td className="py-0.5">
                  {item.name} × {item.qty}
                </td>
                <td className="py-0.5 text-muted">{item.service}</td>
                <td className="py-0.5 text-right tabular-nums">
                  {formatXaf(item.qty * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 border-t border-dashed border-line pt-2">
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
          <div className="flex justify-between gap-4 text-sm font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatXaf(getTotal(order))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Paid</dt>
            <dd className="tabular-nums">{formatXaf(getPaid(order))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Balance</dt>
            <dd className="tabular-nums">{formatXaf(getBalance(order))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Payment</dt>
            <dd className="font-semibold capitalize">
              {paymentStatus}
              {lastPayment && ` · ${lastPayment.method}`}
            </dd>
          </div>
        </dl>
        <p className="border-t border-dashed border-line pt-2 text-center font-mono text-sm font-bold tracking-widest">
          {order.id}
        </p>
      </div>
    </Modal>
  )
}
