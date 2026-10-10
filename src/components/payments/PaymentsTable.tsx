import type { RefObject } from 'react'
import {
  CheckCheck,
  Download,
  Ellipsis,
  Eye,
  Flag,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { PAY_METHODS, TXN_STATUSES } from '../../constants/payments'
import type {
  PayMethod,
  PaymentFilters,
  Transaction,
  TxnStatus,
} from '../../types/payment'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { getRefundable, getTxnStatus } from '../../utils/payments'
import { fieldClass, iconButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Menu, { MenuItem } from '../ui/Menu'

const cellClass = 'px-2.5 py-3 align-top'
const headClass =
  'sticky top-0 z-10 bg-white px-2.5 py-2.5 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)]'
const bulkActionClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

export function TxnStatusBadge({ txn }: { txn: Transaction }) {
  const { label, tone } = getTxnStatus(txn.status)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={tone}>{label}</Badge>
      {txn.reviewReason && (
        <Badge tone="warning">
          <ShieldAlert className="size-3" aria-hidden="true" />
          Requires Review
        </Badge>
      )}
    </span>
  )
}

export function MethodLabel({ txn }: { txn: Pick<Transaction, 'method' | 'provider'> }) {
  const color = PAY_METHODS.find(({ id }) => id === txn.method)!.color
  return (
    <span className="flex items-start gap-2">
      <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span>
        <span className="block font-semibold whitespace-nowrap text-ink">{txn.method}</span>
        {txn.provider && (
          <span className="block text-[11px] whitespace-nowrap text-muted">{txn.provider}</span>
        )}
      </span>
    </span>
  )
}

type PaymentsTableProps = {
  searchRef: RefObject<HTMLInputElement | null>
  transactions: Transaction[]
  totalCount: number
  cashiers: string[]
  filters: PaymentFilters
  filtersActive: boolean
  onChange: (patch: Partial<PaymentFilters>) => void
  onReset: () => void
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onClearSelection: () => void
  canApprove: boolean
  canReconcile: boolean
  onOpen: (id: string) => void
  onReceipt: (id: string) => void
  onRefund: (id: string) => void
  onReconcile: (ids: string[]) => void
  onFlag: (ids: string[]) => void
  onExport: (transactions: Transaction[]) => void
}

function PaymentsTable({
  searchRef,
  transactions,
  totalCount,
  cashiers,
  filters,
  filtersActive,
  onChange,
  onReset,
  selectedIds,
  onToggle,
  onToggleAll,
  onClearSelection,
  canApprove,
  canReconcile,
  onOpen,
  onReceipt,
  onRefund,
  onReconcile,
  onFlag,
  onExport,
}: PaymentsTableProps) {
  const selected = transactions.filter(({ id }) => selectedIds.includes(id))
  const allSelected = transactions.length > 0 && selected.length === transactions.length
  const select = `${fieldClass} w-auto!`

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Recent Transactions{' '}
            <span className="font-normal text-muted">
              ({transactions.length} of {totalCount})
            </span>
          </h2>
          <button
            type="button"
            onClick={() => onExport(transactions)}
            className={`${secondaryButton} h-8`}
          >
            <Download className="size-3.5 text-muted" aria-hidden="true" />
            Export CSV
          </button>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search transactions"
            placeholder="Search transaction, order, customer, phone, receipt or reference…"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className={`${fieldClass} h-10 pr-10 pl-9`}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted ring-1 ring-line sm:block">
            /
          </kbd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Payment status"
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as TxnStatus | '' })}
            className={select}
          >
            <option value="">All statuses</option>
            {TXN_STATUSES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Payment method"
            value={filters.method}
            onChange={(event) => onChange({ method: event.target.value as PayMethod | '' })}
            className={select}
          >
            <option value="">All methods</option>
            {PAY_METHODS.map(({ id }) => (
              <option key={id}>{id}</option>
            ))}
          </select>
          <select
            aria-label="Cashier"
            value={filters.cashier}
            onChange={(event) => onChange({ cashier: event.target.value })}
            className={select}
          >
            <option value="">All cashiers</option>
            {cashiers.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            aria-label="Quick view"
            value={filters.view}
            onChange={(event) =>
              onChange({ view: event.target.value as PaymentFilters['view'] })
            }
            className={select}
          >
            <option value="">All transactions</option>
            <option value="digital">Digital only</option>
            <option value="unreconciled">Not reconciled</option>
            <option value="review">Requires review</option>
          </select>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="Minimum amount in XAF"
            placeholder="Min amount"
            value={filters.minAmount}
            onChange={(event) => onChange({ minAmount: event.target.value })}
            className={`${fieldClass} w-28!`}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-white"
        >
          <p className="mr-2 text-xs font-bold">Selected: {selected.length}</p>
          <button type="button" onClick={() => onExport(selected)} className={bulkActionClass}>
            <Download className="size-3.5" aria-hidden="true" />
            Export
          </button>
          {canReconcile && (
            <button
              type="button"
              onClick={() => onReconcile(selected.map(({ id }) => id))}
              className={bulkActionClass}
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Reconcile
            </button>
          )}
          <button
            type="button"
            onClick={() => onFlag(selected.map(({ id }) => id))}
            className={bulkActionClass}
          >
            <Flag className="size-3.5" aria-hidden="true" />
            Mark for Investigation
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Clear selection"
            className={`${bulkActionClass} ml-auto w-8 justify-center px-0`}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
          <p className="text-sm font-bold text-ink">No Transactions</p>
          <p className="mt-1 text-xs text-muted">No payments found for these filters.</p>
          {filtersActive && (
            <button type="button" onClick={onReset} className={`${secondaryButton} mt-3`}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative hidden max-h-[70vh] overflow-auto rounded-xl bg-white ring-1 ring-line md:block">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className={`${headClass} w-8`}>
                    <input
                      type="checkbox"
                      aria-label="Select all transactions"
                      checked={allSelected}
                      onChange={(event) => onToggleAll(event.target.checked)}
                      className="size-4 accent-brand"
                    />
                  </th>
                  <th scope="col" className={headClass}>Transaction</th>
                  <th scope="col" className={headClass}>Time</th>
                  <th scope="col" className={headClass}>Customer & order</th>
                  <th scope="col" className={`${headClass} text-right`}>Amount</th>
                  <th scope="col" className={headClass}>Method</th>
                  <th scope="col" className={headClass}>Reference</th>
                  <th scope="col" className={headClass}>Status</th>
                  <th scope="col" className={headClass}>Cashier</th>
                  <th scope="col" className={`${headClass} right-0 z-20`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const checked = selectedIds.includes(txn.id)
                  return (
                    <tr
                      key={txn.id}
                      className={`border-t border-line transition hover:bg-field/60 ${checked ? 'bg-brand/5' : ''} ${
                        txn.status === 'failed' || txn.status === 'reversed'
                          ? 'shadow-[inset_3px_0_0_var(--color-danger)]'
                          : ''
                      }`}
                    >
                      <td className={cellClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${txn.id}`}
                          checked={checked}
                          onChange={() => onToggle(txn.id)}
                          className="size-4 accent-brand"
                        />
                      </td>
                      <td className={cellClass}>
                        <button
                          type="button"
                          onClick={() => onOpen(txn.id)}
                          className="rounded-sm font-bold whitespace-nowrap text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        >
                          {txn.id}
                        </button>
                        <span className="block text-[10px] text-muted">
                          {txn.reconciled ? 'Reconciled' : 'Not reconciled'}
                        </span>
                      </td>
                      <td className={`${cellClass} whitespace-nowrap text-ink tabular-nums`}>
                        {formatClock(txn.at)}
                      </td>
                      <td className={cellClass}>
                        <span className="block font-semibold whitespace-nowrap text-ink">
                          {txn.customer}
                        </span>
                        <span className="block font-mono text-[10px] text-muted">{txn.orderId}</span>
                      </td>
                      <td className={`${cellClass} text-right whitespace-nowrap tabular-nums`}>
                        <span className="block text-sm font-bold text-ink">
                          {formatXaf(txn.amount)}
                        </span>
                        {txn.refunded > 0 && (
                          <span className="block text-[10px] text-danger">
                            −{formatXaf(txn.refunded).replace('XAF ', '')} refunded
                          </span>
                        )}
                        {txn.fee > 0 && (
                          <span className="block text-[10px] text-muted">
                            Fee {formatXaf(txn.fee).replace('XAF ', '')}
                          </span>
                        )}
                      </td>
                      <td className={cellClass}>
                        <MethodLabel txn={txn} />
                      </td>
                      <td className={`${cellClass} font-mono text-[11px] whitespace-nowrap`}>
                        {txn.reference}
                        {txn.failureReason && (
                          <span className="block max-w-36 truncate font-sans text-[10px] text-danger">
                            {txn.failureReason}
                          </span>
                        )}
                      </td>
                      <td className={cellClass}>
                        <TxnStatusBadge txn={txn} />
                      </td>
                      <td className={`${cellClass} whitespace-nowrap text-ink`}>
                        {txn.cashier.split(' ')[0]}
                      </td>
                      <td className={`${cellClass} sticky right-0 bg-white`}>
                        <Menu
                          label={`Actions for ${txn.id}`}
                          trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                          triggerClassName={iconButton}
                        >
                          {(close) => (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onOpen(txn.id)
                                }}
                              >
                                <Eye className="size-4 text-muted" aria-hidden="true" />
                                View
                              </MenuItem>
                              <MenuItem
                                onSelect={() => {
                                  close()
                                  onReceipt(txn.id)
                                }}
                              >
                                <ReceiptText className="size-4 text-muted" aria-hidden="true" />
                                Receipt
                              </MenuItem>
                              {getRefundable(txn) > 0 && (
                                <MenuItem
                                  onSelect={() => {
                                    close()
                                    onRefund(txn.id)
                                  }}
                                >
                                  <RotateCcw className="size-4 text-muted" aria-hidden="true" />
                                  {canApprove ? 'Refund' : 'Request Refund'}
                                </MenuItem>
                              )}
                            </>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per transaction */}
          <ul className="space-y-2 md:hidden">
            {transactions.map((txn) => (
              <li key={txn.id}>
                <button
                  type="button"
                  onClick={() => onOpen(txn.id)}
                  className="block w-full rounded-xl bg-white p-3 text-left ring-1 ring-line focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {txn.customer}
                      </span>
                      <span className="block font-mono text-[10px] text-muted">
                        {txn.id} · {txn.orderId}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                      {formatXaf(txn.amount)}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <TxnStatusBadge txn={txn} />
                    {txn.method} · {formatClock(txn.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default PaymentsTable
