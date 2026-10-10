import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ExternalLink, ReceiptText, RotateCcw, ShieldAlert, Undo2 } from 'lucide-react'
import type { PaymentPermissions } from '../../constants/payments'
import type { Transaction } from '../../types/payment'
import { formatDate } from '../../utils/customers'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { getRefundable } from '../../utils/payments'
import { secondaryButton, sectionTitle } from '../orders/styles'
import Modal from '../ui/Modal'
import { MethodLabel, TxnStatusBadge } from './PaymentsTable'

type PaymentDrawerProps = {
  txn: Transaction | null
  permissions: PaymentPermissions
  onClose: () => void
  onReceipt: (id: string) => void
  onRefund: (id: string) => void
  onReverse: (id: string) => void
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
          <dd className="font-semibold break-words text-ink">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function PaymentDrawer({
  txn,
  permissions,
  onClose,
  onReceipt,
  onRefund,
  onReverse,
}: PaymentDrawerProps) {
  return (
    <Modal
      open={txn !== null}
      onClose={onClose}
      variant="drawer"
      title={txn ? `Transaction #${txn.id}` : ''}
      subtitle={txn && <TxnStatusBadge txn={txn} />}
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      {txn && (
        <div className="space-y-5">
          <div>
            <p className="text-3xl font-bold text-ink tabular-nums">{formatXaf(txn.amount)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {txn.fee > 0 && `Fee ${formatXaf(txn.fee)} · net ${formatXaf(txn.amount - txn.fee)}`}
              {txn.fee > 0 && txn.refunded > 0 && ' · '}
              {txn.refunded > 0 && `${formatXaf(txn.refunded)} refunded`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onReceipt(txn.id)} className={secondaryButton}>
              <ReceiptText className="size-4 text-muted" aria-hidden="true" />
              Receipt
            </button>
            {getRefundable(txn) > 0 && (
              <button type="button" onClick={() => onRefund(txn.id)} className={secondaryButton}>
                <RotateCcw className="size-4 text-muted" aria-hidden="true" />
                {permissions.approve ? 'Refund' : 'Request Refund'}
              </button>
            )}
            {permissions.approve && txn.status === 'completed' && (
              <button type="button" onClick={() => onReverse(txn.id)} className={secondaryButton}>
                <Undo2 className="size-4 text-danger" aria-hidden="true" />
                Reverse
              </button>
            )}
            <Link to={`/orders?order=${txn.orderId}`} className={secondaryButton}>
              <ExternalLink className="size-4 text-muted" aria-hidden="true" />
              View Order
            </Link>
          </div>

          {txn.reviewReason && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
              <ShieldAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
              Requires review: {txn.reviewReason}
            </p>
          )}
          {txn.failureReason && (
            <p className="rounded-lg bg-danger/5 p-3 text-xs font-semibold text-danger ring-1 ring-danger/20">
              Payment could not be completed: {txn.failureReason}. Retry, or try another
              payment method.
            </p>
          )}

          <Section title="Payment information">
            <Rows
              rows={[
                ['Amount', formatXaf(txn.amount)],
                ['Payment method', <MethodLabel txn={{ method: txn.method, provider: '' }} />],
                ['Reference', <span className="font-mono">{txn.reference}</span>],
                ['Receipt', <span className="font-mono">{txn.receipt}</span>],
                ['Date', formatDate(txn.at)],
                ['Time', formatClock(txn.at)],
              ]}
            />
          </Section>

          <Section title="Customer & order">
            <Rows
              rows={[
                ['Customer', txn.customer],
                ['Phone', txn.phone],
                ['Order number', txn.orderId],
                ['Branch', txn.branch],
              ]}
            />
          </Section>

          {txn.provider && (
            <Section title="Payment provider">
              <Rows
                rows={[
                  ['Provider', txn.provider],
                  ['Provider reference', <span className="font-mono">{txn.reference}</span>],
                  [
                    'Processing status',
                    txn.status === 'pending'
                      ? 'Awaiting confirmation'
                      : txn.status === 'failed'
                        ? 'Declined'
                        : 'Confirmed',
                  ],
                  ['Reconciliation', txn.reconciled ? 'Matched' : 'Not matched yet'],
                ]}
              />
            </Section>
          )}

          <Section title="Recorded by">
            <Rows
              rows={[
                ['Staff member', txn.cashier],
                ['Register', txn.method === 'Cash' ? 'Drawer #01 · Front Desk' : 'Front desk terminal'],
              ]}
            />
          </Section>

          <Section title="Timeline">
            <ol className="space-y-3 border-l border-line pl-4">
              {txn.timeline.map((entry, index) => (
                <li key={entry.at + index} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
                  <time className="text-muted tabular-nums">{formatClock(entry.at)}</time>{' '}
                  <span className="font-semibold text-ink">{entry.text}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </Modal>
  )
}

export default PaymentDrawer
