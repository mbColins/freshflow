import { useEffect, useRef, useState } from 'react'
import { Lock, Plus, RotateCcw, ScanLine } from 'lucide-react'
import { ConfirmDialog, ScanOrderDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import { MethodsDonut, OverviewChart } from '../components/payments/PaymentCharts'
import {
  CashAdjustDialog,
  CloseSessionDialog,
  RecordPaymentDialog,
  RefundDialog,
  ReminderDialog,
  TxnReceiptDialog,
} from '../components/payments/PaymentDialogs'
import type { PaymentInput } from '../components/payments/PaymentDialogs'
import PaymentDrawer from '../components/payments/PaymentDrawer'
import {
  AuditTrail,
  BranchComparison,
  CashRegisterBar,
  ExceptionsPanel,
  PaymentKpis,
  PerformanceAndRisk,
  ProvidersPanel,
  ReceivablesPanel,
  ReconciliationPanel,
  RefundsPanel,
} from '../components/payments/PaymentPanels'
import PaymentsTable from '../components/payments/PaymentsTable'
import { BRANCHES, CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import {
  EMPTY_PAYMENT_FILTERS,
  PAYMENT_PERMISSIONS,
} from '../constants/payments'
import {
  SAMPLE_AUDIT,
  SAMPLE_EXCEPTIONS,
  SAMPLE_RECEIVABLES,
  SAMPLE_REFUNDS,
  SAMPLE_SESSION,
  SAMPLE_TRANSACTIONS,
} from '../constants/samplePayments'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type { OrderRole } from '../types/order'
import type {
  AuditEntry,
  CashSession,
  PaymentFilters,
  Refund,
  Transaction,
} from '../types/payment'
import { downloadFile, formatXaf } from '../utils/orders'
import {
  getCashSummary,
  getOutstanding,
  isCollected,
  isDigital,
  matchesPaymentFilters,
  transactionsToCsv,
} from '../utils/payments'

const TOAST_MS = 4000
// Who the Receptionist / Cashier perspective acts as
const CASHIER_USER = 'Jean Mbarga'

type DialogState =
  | { name: 'record'; receivableId: string }
  | { name: 'refund'; txnId: string }
  | { name: 'remind'; receivableId: string }
  | { name: 'adjust' | 'close' | 'scan' }

function PaymentsPage() {
  const now = useNow()
  // TODO: replace these in-memory lists with the payments API
  const [transactions, setTransactions] = useState(SAMPLE_TRANSACTIONS)
  const [receivables, setReceivables] = useState(SAMPLE_RECEIVABLES)
  const [refunds, setRefunds] = useState(SAMPLE_REFUNDS)
  const [exceptions, setExceptions] = useState(SAMPLE_EXCEPTIONS)
  const [session, setSession] = useState<CashSession>(SAMPLE_SESSION)
  const [audit, setAudit] = useState<AuditEntry[]>(SAMPLE_AUDIT)
  const [filters, setFilters] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openTxnId, setOpenTxnId] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('payments.role', 'manager')
  const searchRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const receivablesRef = useRef<HTMLDivElement>(null)

  const permissions = PAYMENT_PERMISSIONS[role]
  const actor = role === 'receptionist' ? CASHIER_USER : CURRENT_USER
  const filtered = transactions.filter((txn) => matchesPaymentFilters(txn, filters))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openTxn = transactions.find(({ id }) => id === openTxnId) ?? null
  const receiptTxn = transactions.find(({ id }) => id === receiptId)
  const cashiers = [...new Set(transactions.map(({ cashier }) => cashier))]
  const cash = getCashSummary(session, transactions)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function log(action: string, to?: string, from?: string) {
    setAudit((current) => [
      { at: new Date().toISOString(), user: actor, action, to, from },
      ...current,
    ])
  }

  function replaceFilters(next: PaymentFilters) {
    setFilters(next)
    setSelectedIds([])
  }

  function showInTable(patch: Partial<PaymentFilters>) {
    replaceFilters({ ...EMPTY_PAYMENT_FILTERS, ...patch })
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateTransactions(
    ids: string[],
    change: (txn: Transaction) => Transaction,
    event?: string,
  ) {
    const at = new Date().toISOString()
    setTransactions((current) =>
      current.map((txn) => {
        if (!ids.includes(txn.id)) return txn
        const next = change(txn)
        return event ? { ...next, timeline: [...next.timeline, { at, text: event }] } : next
      }),
    )
  }

  function handleRecord(input: PaymentInput): Transaction {
    const receivable = receivables.find(({ id }) => id === input.receivableId)!
    const at = new Date().toISOString()
    const number =
      Math.max(...transactions.map(({ id }) => Number(id.replace(/\D/g, '')))) + 1
    const padded = String(number).padStart(6, '0')
    const txn: Transaction = {
      id: `TXN-${padded}`,
      receipt: `REC-${padded}`,
      at,
      orderId: receivable.orderId,
      customer: receivable.customer,
      phone: receivable.phone,
      branch: BRANCHES[0],
      amount: input.amount,
      fee: 0,
      method: input.method,
      provider: input.provider,
      reference: input.reference || `CS-${padded}`,
      status: 'completed',
      cashier: actor,
      refunded: 0,
      // Digital payments wait for provider reconciliation
      reconciled: !isDigital(input.method),
      reviewReason: '',
      failureReason: '',
      timeline: [{ at, text: 'Payment recorded, receipt generated' }],
    }
    setTransactions([txn, ...transactions])
    setReceivables(
      receivables.map((item) =>
        item.id === receivable.id ? { ...item, paid: item.paid + input.amount } : item,
      ),
    )
    log(`Payment recorded (${txn.id})`, formatXaf(input.amount))
    return txn
  }

  function applyRefund(txnId: string, amount: number) {
    updateTransactions(
      [txnId],
      (txn) => {
        const refunded = txn.refunded + amount
        return {
          ...txn,
          refunded,
          status: refunded >= txn.amount ? 'refunded' : 'partialRefund',
        }
      },
      `Refunded ${formatXaf(amount)}`,
    )
  }

  function handleRefund(txnId: string, amount: number, reason: string) {
    const txn = transactions.find(({ id }) => id === txnId)!
    const refund: Refund = {
      id: `RFD-${String(61 + refunds.length).padStart(4, '0')}`,
      txnId,
      customer: txn.customer,
      orderId: txn.orderId,
      original: txn.amount,
      amount,
      reason,
      method: txn.method,
      at: new Date().toISOString(),
      requestedBy: actor,
      approvedBy: permissions.approve ? actor : '',
      status: permissions.approve ? 'Completed' : 'Pending Approval',
    }
    setRefunds([refund, ...refunds])
    if (permissions.approve) applyRefund(txnId, amount)
    log(
      permissions.approve
        ? `Refund completed (${refund.id})`
        : `Refund requested (${refund.id})`,
      formatXaf(amount),
    )
    setDialog(null)
    setToast(
      permissions.approve
        ? `${formatXaf(amount)} refunded to ${txn.customer}`
        : 'Refund request sent for manager approval',
    )
  }

  function handleRefundDecision(id: string, approve: boolean) {
    const refund = refunds.find((item) => item.id === id)!
    setRefunds(
      refunds.map((item) =>
        item.id === id
          ? { ...item, status: approve ? 'Completed' : 'Rejected', approvedBy: actor }
          : item,
      ),
    )
    if (approve) applyRefund(refund.txnId, refund.amount)
    log(`Refund ${approve ? 'approved' : 'rejected'} (${id})`, formatXaf(refund.amount))
    setToast(approve ? `Refund ${id} approved` : `Refund ${id} rejected`)
  }

  function requestReverse(id: string) {
    const txn = transactions.find((item) => item.id === id)!
    setConfirm({
      title: `Reverse ${id}?`,
      body: `This cancels the ${formatXaf(txn.amount)} payment from ${txn.customer} as if it never settled. The order’s balance becomes outstanding again. Use a refund instead if the money was actually received.`,
      confirmLabel: 'Reverse Payment',
      destructive: true,
      onConfirm: () => {
        updateTransactions(
          [id],
          (item) => ({ ...item, status: 'reversed', reconciled: false }),
          `Reversed by ${actor}`,
        )
        log(`Payment reversed (${id})`, 'Reversed', 'Completed')
        setToast(`${id} reversed`)
      },
    })
  }

  function handleReconcile(ids: string[]) {
    const settled = transactions.filter(
      (txn) => ids.includes(txn.id) && isCollected(txn) && !txn.reconciled,
    )
    updateTransactions(
      settled.map(({ id }) => id),
      (txn) => ({ ...txn, reconciled: true }),
      'Reconciled',
    )
    setSelectedIds([])
    log('Reconciliation', `${settled.length} transactions matched`)
    setToast(
      settled.length === 0
        ? 'Nothing to reconcile: only settled payments can be matched'
        : `${settled.length} transactions reconciled`,
    )
  }

  function handleScan(code: string) {
    const digits = code.replace(/\D/g, '')
    if (!digits) return false
    const receivable = receivables.find(
      (item) => item.orderId.replace(/\D/g, '') === digits && getOutstanding(item) > 0,
    )
    if (receivable && permissions.record) {
      setDialog({ name: 'record', receivableId: receivable.id })
      return true
    }
    const txn = transactions.find(
      (item) =>
        item.orderId.replace(/\D/g, '') === digits ||
        item.id.replace(/\D/g, '').endsWith(digits),
    )
    if (!txn) return false
    setDialog(null)
    setOpenTxnId(txn.id)
    return true
  }

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Payments</h1>
          <p className="text-xs text-muted">
            Manage transactions, collections, balances, refunds, and payment
            reconciliation.
          </p>
        </div>
        {permissions.view && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDialog({ name: 'scan' })}
              className={secondaryButton}
            >
              <ScanLine className="size-4 text-muted" aria-hidden="true" />
              Scan Order
            </button>
            <button
              type="button"
              onClick={() => setDialog({ name: 'refund', txnId: '' })}
              className={secondaryButton}
            >
              <RotateCcw className="size-4 text-muted" aria-hidden="true" />
              {permissions.approve ? 'Issue Refund' : 'Request Refund'}
            </button>
            <button
              type="button"
              onClick={() => setDialog({ name: 'record', receivableId: '' })}
              className={`${primaryButton} max-md:hidden`}
            >
              <Plus className="size-4" aria-hidden="true" />
              Record Payment
            </button>
          </div>
        )}
      </div>
      <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
        Viewing as
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value as OrderRole)
            setSelectedIds([])
          }}
          className={`${fieldClass} h-8 w-auto!`}
        >
          {ORDER_ROLES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )

  if (!permissions.view) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <Lock className="size-8 text-muted/60" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">No financial access</h2>
          <p className="max-w-sm text-xs text-muted">
            Laundry staff can’t view payments unless a manager grants access.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      {header}

      <PaymentKpis
        transactions={transactions}
        receivables={receivables}
        filters={filters}
        onSelect={(patch) => showInTable(patch)}
        onShowOutstanding={() =>
          receivablesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      />

      <CashRegisterBar
        session={session}
        transactions={transactions}
        canManage={permissions.reconcile}
        onAdjust={() => setDialog({ name: 'adjust' })}
        onClose={() => setDialog({ name: 'close' })}
        onOpen={() => {
          const opening = session.counted ?? cash.expected
          setSession({
            ...session,
            cashier: actor,
            openedAt: new Date().toISOString(),
            opening,
            adjustments: [],
            closedAt: null,
            counted: null,
            varianceReason: '',
          })
          log('Cash register opened', formatXaf(opening))
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewChart />
        <MethodsDonut
          transactions={transactions}
          selected={filters.method}
          onSelect={(method) => showInTable({ method })}
        />
      </div>

      <div ref={tableRef} className="scroll-mt-20">
        <PaymentsTable
          searchRef={searchRef}
          transactions={filtered}
          totalCount={transactions.length}
          cashiers={cashiers}
          filters={filters}
          filtersActive={filtersActive}
          onChange={(patch) => replaceFilters({ ...filters, ...patch })}
          onReset={() => replaceFilters(EMPTY_PAYMENT_FILTERS)}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds(
              selectedIds.includes(id)
                ? selectedIds.filter((current) => current !== id)
                : [...selectedIds, id],
            )
          }
          onToggleAll={(checked) =>
            setSelectedIds(checked ? filtered.map(({ id }) => id) : [])
          }
          onClearSelection={() => setSelectedIds([])}
          canApprove={permissions.approve}
          canReconcile={permissions.reconcile}
          onOpen={setOpenTxnId}
          onReceipt={setReceiptId}
          onRefund={(txnId) => setDialog({ name: 'refund', txnId })}
          onReconcile={handleReconcile}
          onFlag={(ids) => {
            updateTransactions(ids, (txn) => ({
              ...txn,
              reviewReason: txn.reviewReason || `Marked for investigation by ${actor}`,
            }))
            setSelectedIds([])
            log('Marked for investigation', `${ids.length} transactions`)
            setToast(`${ids.length} transactions marked for investigation`)
          }}
          onExport={(list) => {
            downloadFile('transactions.csv', transactionsToCsv(list), 'text/csv;charset=utf-8')
            setToast(`Exported ${list.length} transactions`)
          }}
        />
      </div>

      <div ref={receivablesRef} className="scroll-mt-20">
        <ReceivablesPanel
          receivables={receivables}
          now={now}
          canRecord={permissions.record}
          onCollect={(receivableId) => setDialog({ name: 'record', receivableId })}
          onRemind={(receivableId) => setDialog({ name: 'remind', receivableId })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReconciliationPanel
          transactions={transactions}
          canReconcile={permissions.reconcile}
          onReconcileDigital={() =>
            handleReconcile(
              transactions.filter(({ method }) => isDigital(method)).map(({ id }) => id),
            )
          }
        />
        <ExceptionsPanel
          exceptions={exceptions}
          canResolve={permissions.reconcile}
          onOpen={setOpenTxnId}
          onResolve={(id) => {
            setExceptions(
              exceptions.map((item) => (item.id === id ? { ...item, resolved: true } : item)),
            )
            log(`Exception resolved (${id})`)
            setToast('Exception resolved')
          }}
        />
      </div>

      <RefundsPanel
        refunds={refunds}
        canApprove={permissions.approve}
        onDecide={handleRefundDecision}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProvidersPanel />
        <PerformanceAndRisk
          transactions={transactions}
          onReview={() => showInTable({ view: 'review' })}
        />
        <AuditTrail entries={audit} />
      </div>

      <BranchComparison transactions={transactions} receivables={receivables} />

      {permissions.record && (
        <button
          type="button"
          onClick={() => setDialog({ name: 'record', receivableId: '' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Record Payment
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      <PaymentDrawer
        txn={openTxn}
        permissions={permissions}
        onClose={() => setOpenTxnId(null)}
        onReceipt={setReceiptId}
        onRefund={(txnId) => setDialog({ name: 'refund', txnId })}
        onReverse={requestReverse}
      />
      {dialog?.name === 'record' && (
        <RecordPaymentDialog
          receivables={receivables}
          initialReceivableId={dialog.receivableId}
          onClose={() => setDialog(null)}
          onRecord={handleRecord}
          onPrint={setReceiptId}
        />
      )}
      {dialog?.name === 'refund' && (
        <RefundDialog
          transactions={transactions}
          initialTxnId={dialog.txnId}
          canApprove={permissions.approve}
          onClose={() => setDialog(null)}
          onSubmit={handleRefund}
        />
      )}
      {dialog?.name === 'remind' && (
        <ReminderDialog
          receivable={receivables.find(({ id }) => id === dialog.receivableId)!}
          onClose={() => setDialog(null)}
          onSend={(channel, scheduled) => {
            setReceivables(
              receivables.map((item) =>
                item.id === dialog.receivableId
                  ? { ...item, lastReminderAt: new Date().toISOString() }
                  : item,
              ),
            )
            setDialog(null)
            setToast(
              `${channel} reminder ${scheduled ? 'scheduled' : 'prepared'}. Sending isn’t connected yet.`,
            )
          }}
        />
      )}
      {dialog?.name === 'adjust' && (
        <CashAdjustDialog
          onClose={() => setDialog(null)}
          onSave={(amount, reason) => {
            setSession({
              ...session,
              adjustments: [
                ...session.adjustments,
                { at: new Date().toISOString(), amount, reason, by: actor },
              ],
            })
            log(`Cash adjustment: ${reason}`, formatXaf(amount))
            setDialog(null)
            setToast('Cash adjustment recorded')
          }}
        />
      )}
      {dialog?.name === 'close' && (
        <CloseSessionDialog
          expected={cash.expected}
          onClose={() => setDialog(null)}
          onConfirm={(counted, reason) => {
            setSession({
              ...session,
              closedAt: new Date().toISOString(),
              counted,
              varianceReason: reason,
            })
            log(
              'Cash register closed',
              formatXaf(counted),
              `expected ${formatXaf(cash.expected)}`,
            )
            setDialog(null)
            setToast(
              counted === cash.expected
                ? 'Session closed: balanced'
                : 'Session closed with a variance',
            )
          }}
        />
      )}
      {dialog?.name === 'scan' && (
        <ScanOrderDialog onClose={() => setDialog(null)} onFind={handleScan} />
      )}
      {receiptTxn && (
        <TxnReceiptDialog txn={receiptTxn} onClose={() => setReceiptId(null)} />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default PaymentsPage
