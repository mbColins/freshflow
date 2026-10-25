import { useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  CircleCheck,
  Clock,
  Hourglass,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  Wallet,
  XCircle,
} from 'lucide-react'
import { PAY_METHODS, VARIANCE_REASONS } from '../../constants/payments'
import type { PaymentProvider, PaymentSummary } from '../../services/paymentApi'
import type {
  AuditEntry,
  CashSession,
  PaymentException,
  PaymentFilters,
  Receivable,
  Refund,
  Transaction,
} from '../../types/payment'
import { formatDate } from '../../utils/customers'
import { formatClock } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import {
  formatDue,
  getCashSummary,
  getCollected,
  getDaysOverdue,
  getOutstanding,
  isCollected,
  isDigital,
  sum,
} from '../../utils/payments'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import { PanelEmpty } from '../ui/Panel'

const smallButton = `${secondaryButton} h-7 px-2.5 text-[11px]`
const thClass = 'py-1.5 pr-3 text-left text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase'

export function Panel({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl bg-white p-4 ring-1 ring-line ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
            {Icon && <Icon className="size-4 text-brand" aria-hidden="true" />}
            {title}
            {badge}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// ---------- KPI cards ----------

type KpiPatch = Pick<PaymentFilters, 'status' | 'method' | 'view'>

export function PaymentKpis({
  transactions,
  receivables,
  filters,
  onSelect,
  onShowOutstanding,
}: {
  transactions: Transaction[]
  receivables: Receivable[]
  filters: PaymentFilters
  onSelect: (patch: KpiPatch) => void
  onShowOutstanding: () => void
}) {
  const collected = transactions.filter(isCollected)
  const attempts = transactions.filter(({ status }) => status !== 'cancelled')
  const failed = transactions.filter(({ status }) => status === 'failed')
  const pending = transactions.filter(({ status }) => status === 'pending')
  const refunds = transactions.filter(({ refunded }) => refunded > 0)
  const revenue = getCollected(transactions)
  const digital = getCollected(collected.filter(({ method }) => isDigital(method)))
  const owing = receivables.filter((receivable) => getOutstanding(receivable) > 0)
  const none: KpiPatch = { status: '', method: '', view: '' }

  const cards: {
    label: string
    icon: LucideIcon
    value: string
    note: string
    patch?: KpiPatch
    tone?: 'warning' | 'danger'
  }[] = [
    { label: 'Today’s Revenue', icon: Wallet, value: formatXaf(revenue), note: `${collected.length} settled transactions`, patch: { ...none, status: 'completed' } },
    { label: 'Pending Payments', icon: Hourglass, value: formatXaf(sum(pending, ({ amount }) => amount)), note: `${pending.length} awaiting confirmation`, patch: { ...none, status: 'pending' }, tone: 'warning' },
    { label: 'Outstanding Balance', icon: Clock, value: formatXaf(sum(owing, getOutstanding)), note: `${owing.length} open accounts` },
    { label: 'Successful', icon: CircleCheck, value: `${attempts.length === 0 ? 0 : ((collected.length / attempts.length) * 100).toFixed(1)}%`, note: `${collected.length} / ${attempts.length} transactions`, patch: { ...none, status: 'completed' } },
    { label: 'Failed Payments', icon: XCircle, value: String(failed.length), note: `${attempts.length === 0 ? 0 : ((failed.length / attempts.length) * 100).toFixed(1)}% failure rate`, patch: { ...none, status: 'failed' }, tone: 'danger' },
    { label: 'Refunds', icon: RotateCcw, value: formatXaf(sum(refunds, ({ refunded }) => refunded)), note: `${refunds.length} refunded payments`, patch: { ...none, status: 'refunded' } },
    { label: 'Cash Collected', icon: Banknote, value: formatXaf(getCollected(collected.filter(({ method }) => method === 'Cash'))), note: 'Today', patch: { ...none, method: 'Cash' } },
    { label: 'Digital Payments', icon: Smartphone, value: formatXaf(digital), note: `${revenue === 0 ? 0 : Math.round((digital / revenue) * 100)}% of revenue`, patch: { ...none, view: 'digital' } },
  ]
  const toneClass = { warning: 'text-warning', danger: 'text-danger' }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map(({ label, icon: Icon, value, note, patch, tone }) => {
        const selected =
          patch !== undefined &&
          filters.status === patch.status &&
          filters.method === patch.method &&
          filters.view === patch.view
        const flagged = tone && value !== '0' && value !== 'XAF 0' ? toneClass[tone] : ''
        return (
          <button
            key={label}
            type="button"
            aria-pressed={patch ? selected : undefined}
            onClick={() => (patch ? onSelect(selected ? none : patch) : onShowOutstanding())}
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              selected ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon className={`size-3.5 shrink-0 ${flagged}`} aria-hidden="true" />
            </span>
            <span className={`mt-1 block truncate text-xl font-bold tabular-nums ${flagged || 'text-ink'}`}>
              {value}
            </span>
            <span className="block truncate text-[10px] text-muted">{note}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Cash register ----------

export function CashRegisterBar({
  session,
  transactions,
  canManage,
  onAdjust,
  onClose,
  onOpen,
}: {
  // Null when the person has no register open
  session: CashSession | null
  transactions: Transaction[]
  canManage: boolean
  onAdjust: () => void
  onClose: () => void
  onOpen: () => void
}) {
  if (!session) {
    return (
      <Panel
        title="Cash Register"
        subtitle="No register is open. Cash payments can only be recorded while one is."
        icon={Banknote}
        action={
          <button type="button" onClick={onOpen} className={primaryButton}>
            Open Register
          </button>
        }
      >
        <p className="text-xs text-muted">Open a register with its starting float to take cash.</p>
      </Panel>
    )
  }
  const cash = getCashSummary(session, transactions)
  const closed = session.closedAt !== null
  const difference = (session.counted ?? cash.expected) - cash.expected

  return (
    <Panel
      title={`Cash Register · ${session.register}`}
      subtitle={`Cashier ${session.cashier} · opened ${formatClock(session.openedAt)} · ${cash.count} cash transactions`}
      icon={Banknote}
      badge={
        closed ? (
          <Badge tone={difference === 0 ? 'success' : 'danger'}>
            {difference === 0 ? 'Closed · Balanced' : 'Closed · Variance'}
          </Badge>
        ) : (
          <Badge tone="success">Active Session</Badge>
        )
      }
      action={
        canManage && (
          <div className="flex flex-wrap gap-2">
            {closed ? (
              <button type="button" onClick={onOpen} className={primaryButton}>
                Open Register
              </button>
            ) : (
              <>
                <button type="button" onClick={onAdjust} className={secondaryButton}>
                  Cash Adjustment
                </button>
                <button type="button" onClick={onClose} className={primaryButton}>
                  Count & Close Session
                </button>
              </>
            )}
          </div>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(
          [
            ['Opening balance', formatXaf(session.opening)],
            ['Cash collected', formatXaf(cash.collected)],
            ['Cash refunds', formatXaf(-cash.refunds)],
            ['Adjustments', formatXaf(cash.adjustments)],
            ['Expected balance', formatXaf(cash.expected)],
            [
              'Counted',
              session.counted === null
                ? 'Not counted yet'
                : `${formatXaf(session.counted)} (${difference >= 0 ? '+' : ''}${formatXaf(difference).replace('XAF ', '')})`,
            ],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md bg-field px-3 py-2">
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="truncate text-sm font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {session.varianceReason && (
        <p className="mt-2 text-[11px] font-semibold text-danger">
          Variance reason: {session.varianceReason}
        </p>
      )}
      {session.adjustments.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-muted">
          {session.adjustments.map((adjustment) => (
            <li key={adjustment.at}>
              {formatClock(adjustment.at)} · {adjustment.by} adjusted{' '}
              <span className="font-semibold text-ink">{formatXaf(adjustment.amount)}</span>:{' '}
              {adjustment.reason}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Outstanding payments ----------

export function ReceivablesPanel({
  receivables,
  now,
  canRecord,
  onCollect,
  onRemind,
}: {
  receivables: Receivable[]
  now: number
  canRecord: boolean
  onCollect: (id: string) => void
  onRemind: (id: string) => void
}) {
  const open = receivables
    .filter((receivable) => getOutstanding(receivable) > 0)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  const overdue = open.filter((receivable) => getDaysOverdue(receivable, now) > 0)

  return (
    <Panel
      title="Outstanding Payments"
      subtitle={`${formatXaf(sum(open, getOutstanding))} owed across ${open.length} orders`}
      icon={Clock}
      badge={
        overdue.length > 0 && (
          <Badge tone="danger">
            {overdue.length} overdue · {formatXaf(sum(overdue, getOutstanding))}
          </Badge>
        )
      }
    >
      {open.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-lg bg-success/5 px-3 py-6 text-xs font-semibold text-success">
          <CircleCheck className="size-4" aria-hidden="true" />
          All customer balances are settled.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Customer</th>
                <th scope="col" className={thClass}>Order</th>
                <th scope="col" className={thClass}>Paid of total</th>
                <th scope="col" className={`${thClass} text-right`}>Outstanding</th>
                <th scope="col" className={thClass}>Due</th>
                <th scope="col" className={thClass}>Last reminder</th>
                <th scope="col" className={`${thClass} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {open.map((receivable) => {
                const days = getDaysOverdue(receivable, now)
                return (
                  <tr
                    key={receivable.id}
                    className={`border-t border-line ${days > 0 ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''}`}
                  >
                    <td className="py-2.5 pr-3 pl-2 font-semibold whitespace-nowrap text-ink">
                      {receivable.customer}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">{receivable.orderId}</td>
                    <td className="py-2.5 pr-3">
                      <span className="block text-[11px] text-muted tabular-nums">
                        {formatXaf(receivable.paid)} of {formatXaf(receivable.total)}
                        {receivable.paid > 0 && ' · partially paid'}
                      </span>
                      <span
                        className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-brand/15"
                        role="meter"
                        aria-label={`Paid share for ${receivable.orderId}`}
                        aria-valuenow={receivable.paid}
                        aria-valuemin={0}
                        aria-valuemax={receivable.total}
                      >
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${(receivable.paid / receivable.total) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold whitespace-nowrap text-ink tabular-nums">
                      {formatXaf(getOutstanding(receivable))}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {days > 0 ? (
                        <Badge tone="danger">
                          {days} {days === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      ) : (
                        formatDue(receivable, now)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-muted">
                      {receivable.lastReminderAt ? formatDate(receivable.lastReminderAt) : 'Never'}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        {canRecord && (
                          <button
                            type="button"
                            onClick={() => onCollect(receivable.id)}
                            className={`${smallButton} font-bold`}
                          >
                            Collect Payment
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemind(receivable.id)}
                          className={smallButton}
                        >
                          Send Reminder
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---------- Reconciliation ----------

export function ReconciliationPanel({
  transactions,
  canReconcile,
  onReconcileDigital,
}: {
  transactions: Transaction[]
  canReconcile: boolean
  onReconcileDigital: () => void
}) {
  const [actual, setActual] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const rows = PAY_METHODS.map(({ id }) => {
    const expected = getCollected(transactions.filter(({ method }) => method === id))
    const entered = actual[id]
    const difference = entered === undefined || entered === '' ? null : Number(entered) - expected
    return { id, expected, difference }
  }).filter(({ expected }) => expected > 0)

  const digital = transactions.filter(({ method }) => isDigital(method))
  const matched = digital.filter(({ reconciled }) => reconciled).length
  const pending = digital.filter(
    ({ reconciled, status }) => !reconciled && status === 'pending',
  ).length
  const unmatched = digital.length - matched - pending
  const variance = rows.some(({ difference }) => difference !== null && difference !== 0)

  return (
    <Panel
      title="Reconciliation"
      subtitle="System expected vs what was actually received"
      badge={
        <Badge tone={variance ? 'danger' : 'success'}>
          {variance ? 'Variance Detected' : 'No variance entered'}
        </Badge>
      }
    >
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Method</th>
              <th scope="col" className={`${thClass} text-right`}>Expected</th>
              <th scope="col" className={thClass}>Actual received</th>
              <th scope="col" className={`${thClass} text-right`}>Difference</th>
              <th scope="col" className={thClass}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, expected, difference }) => (
              <tr key={id} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
                  {id}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{formatXaf(expected)}</td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    disabled={!canReconcile}
                    aria-label={`Actual ${id} received in XAF`}
                    placeholder="Enter amount"
                    value={actual[id] ?? ''}
                    onChange={(event) => setActual({ ...actual, [id]: event.target.value })}
                    className={`${fieldClass} h-8 w-36!`}
                  />
                </td>
                <td
                  className={`py-2 pr-3 text-right font-bold tabular-nums ${
                    difference === null
                      ? 'text-muted'
                      : difference === 0
                        ? 'text-success'
                        : 'text-danger'
                  }`}
                >
                  {difference === null
                    ? '—'
                    : `${difference > 0 ? '+' : ''}${formatXaf(difference).replace('XAF ', '')}`}
                </td>
                <td className="py-2">
                  {difference !== null && difference !== 0 && (
                    <select
                      aria-label={`Reason for ${id} variance`}
                      value={reasons[id] ?? ''}
                      onChange={(event) => setReasons({ ...reasons, [id]: event.target.value })}
                      className={`${fieldClass} h-8 w-40!`}
                    >
                      <option value="">Reason required…</option>
                      {VARIANCE_REASONS.map((reason) => (
                        <option key={reason}>{reason}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-field p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-ink">Digital payments: system vs providers</p>
          {canReconcile && (
            <button
              type="button"
              disabled={pending + unmatched === 0}
              onClick={onReconcileDigital}
              className={`${smallButton} font-bold`}
            >
              Reconcile
            </button>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['System', digital.length],
              ['Matched', matched],
              ['Pending', pending],
              ['Unmatched', unmatched],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div key={label} className="rounded-md bg-white px-2 py-1.5">
              <dt className="text-[10px] font-semibold text-muted">{label}</dt>
              <dd
                className={`text-sm font-bold ${label === 'Unmatched' && value > 0 ? 'text-danger' : 'text-ink'}`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] text-muted">
          “Reconcile” marks settled digital payments as matched; pending and failed
          ones stay open until the provider confirms.
        </p>
      </div>
    </Panel>
  )
}

// ---------- Exceptions & refunds ----------

export function ExceptionsPanel({
  exceptions,
  canResolve,
  onOpen,
  onResolve,
}: {
  exceptions: PaymentException[]
  canResolve: boolean
  onOpen: (txnId: string) => void
  onResolve: (id: string) => void
}) {
  const open = exceptions.filter(({ resolved }) => !resolved)
  return (
    <Panel
      title="Exceptions"
      subtitle="Payments that don’t match what the system expects"
      icon={TriangleAlert}
      badge={open.length > 0 && <Badge tone="danger">{open.length} open</Badge>}
    >
      {open.length === 0 ? (
        <PanelEmpty>No open payment exceptions.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {open.map((exception) => (
            <li
              key={exception.id}
              className={`flex flex-wrap items-start gap-3 rounded-lg p-3 ring-1 ${
                exception.severity === 'critical'
                  ? 'bg-danger/5 text-danger ring-danger/20'
                  : 'bg-warning/5 text-warning ring-warning/20'
              }`}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-40 flex-1">
                <p className="text-xs font-semibold text-ink">
                  <span className="sr-only">
                    {exception.severity === 'critical' ? 'Critical: ' : 'Warning: '}
                  </span>
                  {exception.reason}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {exception.txnId} · {exception.customer} · {formatXaf(exception.amount)} ·
                  assigned to {exception.assignee}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => onOpen(exception.txnId)} className={smallButton}>
                  Investigate
                </button>
                {canResolve && (
                  <button
                    type="button"
                    onClick={() => onResolve(exception.id)}
                    className={`${smallButton} font-bold`}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const REFUND_TONES = {
  'Pending Approval': 'warning',
  Completed: 'success',
  Rejected: 'danger',
} as const

export function RefundsPanel({
  refunds,
  canApprove,
  onDecide,
}: {
  refunds: Refund[]
  canApprove: boolean
  onDecide: (id: string, approve: boolean) => void
}) {
  return (
    <Panel title="Refunds" icon={RotateCcw}>
      {refunds.length === 0 ? (
        <PanelEmpty>No refunds today.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Refund</th>
                <th scope="col" className={thClass}>Customer & order</th>
                <th scope="col" className={`${thClass} text-right`}>Original</th>
                <th scope="col" className={`${thClass} text-right`}>Refund</th>
                <th scope="col" className={thClass}>Reason</th>
                <th scope="col" className={thClass}>Requested / approved</th>
                <th scope="col" className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3">
                    <span className="block font-mono text-[11px] font-bold text-ink">
                      RFD-{refund.id.slice(0, 6).toUpperCase()}
                    </span>
                    <span className="block font-mono text-[10px] text-muted">{refund.txnId}</span>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className="block font-semibold text-ink">{refund.customer}</span>
                    <span className="block text-[11px] text-muted">
                      {refund.orderId} · {refund.method}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatXaf(refund.original)}</td>
                  <td className="py-2.5 pr-3 text-right font-bold text-ink tabular-nums">
                    {formatXaf(refund.amount)}
                  </td>
                  <td className="py-2.5 pr-3">{refund.reason}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-muted">
                    {refund.requestedBy} · {formatClock(refund.at)}
                    <span className="block">{refund.approvedBy || 'Not yet approved'}</span>
                  </td>
                  <td className="py-2.5">
                    <Badge tone={REFUND_TONES[refund.status]}>{refund.status}</Badge>
                    {refund.status === 'Pending Approval' &&
                      (canApprove ? (
                        <span className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onDecide(refund.id, true)}
                            className={`${smallButton} font-bold`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onDecide(refund.id, false)}
                            className={smallButton}
                          >
                            Reject
                          </button>
                        </span>
                      ) : (
                        <span className="mt-1 block text-[10px] text-muted">
                          Manager approval required
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---------- Providers, performance, branches, audit ----------

const PROVIDER_STATUS: Record<PaymentProvider['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  OPERATIONAL: { label: 'Operational', tone: 'success' },
  DEGRADED: { label: 'Service Degraded', tone: 'warning' },
  DOWN: { label: 'Down', tone: 'danger' },
}

export function ProvidersPanel({ providers, loading }: { providers: PaymentProvider[]; loading: boolean }) {
  return (
    <Panel title="Payment Providers" subtitle="Configured for this branch">
      {loading ? (
        <ul className="animate-pulse space-y-2" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <li key={key} className="h-14 rounded-lg bg-field" />
          ))}
        </ul>
      ) : providers.length === 0 ? (
        <PanelEmpty>No providers are set up for this branch.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {providers.map((provider) => {
            const status = PROVIDER_STATUS[provider.status] ?? PROVIDER_STATUS.OPERATIONAL
            return (
              <li key={provider.provider + provider.method} className={`rounded-lg bg-field p-2.5 text-xs ${provider.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-ink">
                    {provider.provider}
                    <span className="font-normal text-muted"> · {provider.method}</span>
                  </p>
                  <Badge tone={provider.enabled ? status.tone : 'neutral'}>
                    {provider.enabled && provider.status !== 'OPERATIONAL' && <TriangleAlert className="size-3" aria-hidden="true" />}
                    {provider.enabled ? status.label : 'Disabled'}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">Fee {provider.feePercent}% of each payment</p>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function PerformanceAndRisk({
  transactions,
  onReview,
}: {
  transactions: Transaction[]
  onReview: () => void
}) {
  const attempts = transactions.length || 1
  const collected = transactions.filter(isCollected)
  const revenue = getCollected(transactions) || 1
  const rate = (count: number) => (count / attempts) * 100
  const metrics: [string, number][] = [
    ['Payment success rate', rate(collected.length)],
    ['Payment failure rate', rate(transactions.filter(({ status }) => status === 'failed').length)],
    ['Refund rate', rate(transactions.filter(({ refunded }) => refunded > 0).length)],
    ['Digital share of revenue', (getCollected(collected.filter(({ method }) => isDigital(method))) / revenue) * 100],
    ['Cash share of revenue', (getCollected(collected.filter(({ method }) => method === 'Cash')) / revenue) * 100],
  ]
  const flagged = transactions.filter(({ reviewReason }) => reviewReason)

  return (
    <Panel title="Payment Performance" subtitle="Computed from today’s transactions">
      <ul className="space-y-2.5">
        {metrics.map(([label, value]) => (
          <li key={label} className="text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted">{label}</span>
              <span className="font-bold text-ink tabular-nums">{value.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
              <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg bg-field p-3">
        <p className="flex items-center gap-2 text-xs font-bold text-ink">
          <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
          Risk indicators
        </p>
        {flagged.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted">Nothing flagged for review.</p>
        ) : (
          <>
            <ul className="mt-1.5 space-y-1 text-[11px] text-muted">
              {flagged.map((txn) => (
                <li key={txn.id}>
                  <span className="font-semibold text-ink">{txn.id}</span>: {txn.reviewReason}
                </li>
              ))}
            </ul>
            <button type="button" onClick={onReview} className={`${smallButton} mt-2 font-bold`}>
              Show {flagged.length} requiring review
            </button>
          </>
        )}
      </div>
    </Panel>
  )
}

export function BranchComparison({
  branches,
  transactions,
}: {
  // From GET /payments/summary
  branches: PaymentSummary['byBranch']
  transactions: Transaction[]
}) {
  const rows = branches.map(({ branch, collected, outstanding }) => {
    const own = transactions.filter((txn) => txn.branch === branch)
    return {
      branch,
      revenue: collected,
      transactions: own.filter(isCollected).length,
      outstanding,
      refunds: sum(own, ({ refunded }) => refunded),
    }
  })
  return (
    <Panel title="Branch Financial Comparison" subtitle="Money collected and still owed, by branch">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Branch</th>
              <th scope="col" className={`${thClass} text-right`}>Revenue</th>
              <th scope="col" className={`${thClass} text-right`}>Transactions</th>
              <th scope="col" className={`${thClass} text-right`}>Outstanding</th>
              <th scope="col" className={`${thClass} text-right`}>Refunds</th>
              <th scope="col" className={`${thClass} text-right`}>Avg transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">No branch figures yet.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.branch} className="border-t border-line tabular-nums">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
                  {row.branch}
                </th>
                <td className="py-2 pr-3 text-right font-semibold text-ink">{formatXaf(row.revenue)}</td>
                <td className="py-2 pr-3 text-right">{row.transactions}</td>
                <td className="py-2 pr-3 text-right">{formatXaf(row.outstanding)}</td>
                <td className="py-2 pr-3 text-right">{formatXaf(row.refunds)}</td>
                <td className="py-2 text-right">
                  {row.transactions === 0 ? "—" : formatXaf(row.revenue / row.transactions)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  return (
    <Panel title="Audit Trail" subtitle="Every financial action, newest first">
      <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <li
            key={entry.at + index}
            className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md bg-field px-3 py-2 text-xs"
          >
            <span className="min-w-0">
              <span className="font-semibold text-ink">{entry.user}</span>{' '}
              <span className="text-muted">{entry.action}</span>
              {entry.to && (
                <span className="text-muted">
                  {' '}
                  · {entry.from ? `${entry.from} → ` : ''}
                  <span className="font-semibold text-ink">{entry.to}</span>
                </span>
              )}
            </span>
            <time className="shrink-0 text-[10px] text-muted tabular-nums">
              {formatClock(entry.at)}
            </time>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
