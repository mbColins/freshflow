import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Lock, Plus, RotateCcw, ScanLine } from 'lucide-react'
import { ConfirmDialog, ScanOrderDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import { MethodsDonut, OverviewChart } from '../components/payments/PaymentCharts'
import {
  CashAdjustDialog,
  CloseSessionDialog,
  OpenSessionDialog,
  RecordPaymentDialog,
  RefundDialog,
  ReminderDialog,
  ResolveExceptionDialog,
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
import { EMPTY_PAYMENT_FILTERS } from '../constants/payments'
import type { PaymentPermissions } from '../constants/payments'
import useCurrentUser from '../hooks/useCurrentUser'
import useNow from '../hooks/useNow'
import { useListAuditQuery } from '../services/auditApi'
import {
  METHOD_TO_SERVER,
  useAdjustCashSessionMutation,
  useCloseCashSessionMutation,
  useDecideRefundMutation,
  useGetCurrentCashSessionQuery,
  useGetPaymentSummaryQuery,
  useListPaymentExceptionsQuery,
  useListPaymentProvidersQuery,
  useListPaymentsQuery,
  useListReceivablesQuery,
  useListRefundsQuery,
  useOpenCashSessionMutation,
  useReconcilePaymentsMutation,
  useRecordPaymentMutation,
  useRequestRefundMutation,
  useSendPaymentReminderMutation,
  useUpdatePaymentExceptionMutation,
} from '../services/paymentApi'
import type {
  AuditEntry,
  CashSession,
  PaymentException,
  PaymentFilters,
  Refund,
  Transaction,
} from '../types/payment'
import { describeError } from '../utils/apiReasons'
import { downloadFile, formatXaf } from '../utils/orders'
import {
  getOutstanding,
  isCollected,
  isDigital,
  matchesPaymentFilters,
  transactionsToCsv,
} from '../utils/payments'

const TOAST_MS = 5000
// TODO: page through the lists if a tenant ever has more than this
const RECENT = { page: 0, size: 200 }
const RECENT_AUDIT = { entityType: 'PAYMENT' as const, page: 0, size: 30 }
const NO_TRANSACTIONS: Transaction[] = []

const describe = describeError

const CHANNELS: Record<string, string> = { SMS: 'SMS', WhatsApp: 'WHATSAPP', Email: 'EMAIL' }

type DialogState =
  | { name: 'record'; receivableId: string }
  | { name: 'refund'; txnId: string }
  | { name: 'remind'; receivableId: string }
  | { name: 'resolve'; exceptionId: string }
  | { name: 'adjust' | 'close' | 'open' | 'scan' }

function PaymentsPage() {
  const now = useNow()
  const { can, name: actor } = useCurrentUser()
  const permissions: PaymentPermissions = {
    view: can('PAYMENTS:VIEW'),
    record: can('PAYMENTS:RECORD'),
    approve: can('PAYMENTS:APPROVE_REFUND'),
    reconcile: can('PAYMENTS:RECONCILE'),
  }

  const paymentsQuery = useListPaymentsQuery(RECENT, { skip: !permissions.view })
  const transactions = paymentsQuery.data?.items ?? NO_TRANSACTIONS
  const { data: receivables = [] } = useListReceivablesQuery(RECENT, { skip: !permissions.view })
  const { data: serverRefunds } = useListRefundsQuery(RECENT, { skip: !permissions.view })
  const { data: serverExceptions } = useListPaymentExceptionsQuery(RECENT, { skip: !permissions.view })
  const sessionQuery = useGetCurrentCashSessionQuery(undefined, { skip: !permissions.view })
  const { data: providers = [], isLoading: providersLoading } = useListPaymentProvidersQuery(undefined, { skip: !permissions.view })
  const { data: summary } = useGetPaymentSummaryQuery(undefined, { skip: !permissions.view })
  const { data: auditPage } = useListAuditQuery(RECENT_AUDIT, { skip: !permissions.view })

  const [recordPayment] = useRecordPaymentMutation()
  const [reconcilePayments] = useReconcilePaymentsMutation()
  const [requestRefund] = useRequestRefundMutation()
  const [decideRefund] = useDecideRefundMutation()
  const [updateException] = useUpdatePaymentExceptionMutation()
  const [sendReminder] = useSendPaymentReminderMutation()
  const [openSession] = useOpenCashSessionMutation()
  const [adjustSession] = useAdjustCashSessionMutation()
  const [closeSession] = useCloseCashSessionMutation()

  // The session just counted, shown until the next one is opened
  const [closedSession, setClosedSession] = useState<CashSession | null>(null)
  const session = sessionQuery.data ?? closedSession
  const [filters, setFilters] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openTxnId, setOpenTxnId] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [dialogState, setDialogState] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // The Orders page links here with ?order=<number> to take a payment
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedOrder = searchParams.get('order')
  const requestedReady = requestedOrder !== null && receivables.some(({ id }) => id === requestedOrder)
  const dialog: DialogState | null =
    dialogState ??
    (requestedOrder && requestedReady && permissions.record ? { name: 'record', receivableId: requestedOrder } : null)
  function setDialog(next: DialogState | null) {
    setDialogState(next)
    if (requestedOrder) setSearchParams({}, { replace: true })
  }
  const tableRef = useRef<HTMLDivElement>(null)
  const receivablesRef = useRef<HTMLDivElement>(null)

  // Refunds and exceptions only carry a payment code; the customer and the
  // amounts come from the payment itself when it is in the list
  const refunds = useMemo<Refund[]>(
    () =>
      (serverRefunds ?? []).map((refund) => {
        const payment = transactions.find(({ id }) => id === refund.txnId)
        return { ...refund, customer: payment?.customer ?? '', original: payment?.amount ?? 0 }
      }),
    [serverRefunds, transactions],
  )
  const exceptions = useMemo<PaymentException[]>(
    () =>
      (serverExceptions ?? []).map((item) => {
        const payment = transactions.find(({ id }) => id === item.txnId)
        return { ...item, customer: payment?.customer ?? '', amount: payment?.amount ?? 0 }
      }),
    [serverExceptions, transactions],
  )
  const audit = useMemo<AuditEntry[]>(
    () =>
      (auditPage?.items ?? []).map((entry) => ({
        at: entry.at,
        user: entry.actor || 'System',
        action: entry.action.toLowerCase().replace(/_/g, ' '),
        to: entry.summary || undefined,
      })),
    [auditPage],
  )

  const filtered = transactions.filter((txn) => matchesPaymentFilters(txn, filters))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openTxn = transactions.find(({ id }) => id === openTxnId) ?? null
  const receiptTxn = transactions.find(({ id }) => id === receiptId)
  const cashiers = [...new Set(transactions.map(({ cashier }) => cashier))]

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

  function replaceFilters(next: PaymentFilters) {
    setFilters(next)
    setSelectedIds([])
  }

  function showInTable(patch: Partial<PaymentFilters>) {
    replaceFilters({ ...EMPTY_PAYMENT_FILTERS, ...patch })
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Resolves with the payment so the dialog can show the receipt; a refusal
  // is thrown as an Error the dialog shows
  async function handleRecord(input: PaymentInput): Promise<Transaction> {
    try {
      const txn = await recordPayment({
        order: input.receivableId,
        amount: input.amount,
        method: METHOD_TO_SERVER[input.method],
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
        ...(input.cashReceived !== undefined ? { cashReceived: input.cashReceived } : {}),
      }).unwrap()
      if (!txn) throw new Error('The server sent no payment back.')
      return txn
    } catch (error) {
      throw new Error(describe(error, 'The payment wasn’t recorded.'), { cause: error })
    }
  }

  async function handleRefund(txnId: string, amount: number, reason: string) {
    const txn = transactions.find(({ id }) => id === txnId)
    if (!txn) return
    try {
      const refund = await requestRefund({ payment: txn.uuid, amount, reason }).unwrap()
      setDialog(null)
      setToast(
        refund?.status === 'Completed'
          ? `${formatXaf(amount)} refunded to ${txn.customer}`
          : 'Refund request sent for manager approval',
      )
    } catch (error) {
      setToast(describe(error, 'The refund wasn’t made.'))
    }
  }

  async function handleRefundDecision(id: string, approve: boolean) {
    try {
      await decideRefund({ id, approve }).unwrap()
      setToast(approve ? 'Refund approved' : 'Refund rejected')
    } catch (error) {
      setToast(describe(error, 'The decision wasn’t saved.'))
    }
  }

  async function handleReconcile(ids: string[]) {
    const settled = transactions.filter(
      (txn) => ids.includes(txn.id) && isCollected(txn) && isDigital(txn.method) && !txn.reconciled,
    )
    if (settled.length === 0) {
      setSelectedIds([])
      setToast('Nothing to reconcile: only settled digital payments can be matched')
      return
    }
    try {
      await reconcilePayments(settled.map(({ uuid }) => uuid)).unwrap()
      setSelectedIds([])
      setToast(`${settled.length} ${settled.length === 1 ? 'transaction' : 'transactions'} reconciled`)
    } catch (error) {
      setToast(describe(error, 'The payments weren’t reconciled.'))
    }
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
            {permissions.record && (
              <button
                type="button"
                onClick={() => setDialog({ name: 'record', receivableId: '' })}
                className={`${primaryButton} max-md:hidden`}
              >
                <Plus className="size-4" aria-hidden="true" />
                Record Payment
              </button>
            )}
          </div>
        )}
      </div>
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
            Your role can’t view payments. Ask the business owner for access.
          </p>
        </div>
      </>
    )
  }

  if (paymentsQuery.isLoading) {
    return (
      <>
        {header}
        <div className="animate-pulse space-y-4" aria-busy="true">
          <p className="sr-only" role="status">Loading payments…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
          <div className="h-24 rounded-xl bg-white ring-1 ring-line" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-line" />
          <div className="h-96 rounded-xl bg-white ring-1 ring-line" />
        </div>
      </>
    )
  }

  if (paymentsQuery.isError && transactions.length === 0) {
    return (
      <>
        {header}
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the payments</h2>
          <p className="max-w-md text-xs text-muted">{describe(paymentsQuery.error, 'The server refused the request.')}</p>
          <button type="button" onClick={() => void paymentsQuery.refetch()} disabled={paymentsQuery.isFetching} className={`${secondaryButton} mt-2`}>
            {paymentsQuery.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
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
        canManage={permissions.record || permissions.reconcile}
        onAdjust={() => setDialog({ name: 'adjust' })}
        onClose={() => setDialog({ name: 'close' })}
        onOpen={() => setDialog({ name: 'open' })}
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
          onReconcile={(ids) => void handleReconcile(ids)}
          onFlag={() => {
            setSelectedIds([])
            setToast('Flagging for investigation isn’t stored by the server yet')
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
            void handleReconcile(
              transactions.filter(({ method }) => isDigital(method)).map(({ id }) => id),
            )
          }
        />
        <ExceptionsPanel
          exceptions={exceptions}
          canResolve={permissions.reconcile}
          onOpen={setOpenTxnId}
          onResolve={(id) => setDialog({ name: 'resolve', exceptionId: id })}
        />
      </div>

      <RefundsPanel
        refunds={refunds}
        canApprove={permissions.approve}
        onDecide={(id, approve) => void handleRefundDecision(id, approve)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProvidersPanel providers={providers} loading={providersLoading} />
        <PerformanceAndRisk
          transactions={transactions}
          onReview={() => showInTable({ view: 'review' })}
        />
        <AuditTrail entries={audit} />
      </div>

      <BranchComparison branches={summary?.byBranch ?? []} transactions={transactions} />

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
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
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
      />
      {dialog?.name === 'record' && (
        <RecordPaymentDialog
          receivables={receivables}
          providers={providers}
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
          onSubmit={(txnId, amount, reason) => void handleRefund(txnId, amount, reason)}
        />
      )}
      {dialog?.name === 'remind' && (
        <ReminderDialog
          receivable={receivables.find(({ id }) => id === dialog.receivableId)!}
          onClose={() => setDialog(null)}
          onSend={async (channel, message, scheduledFor) => {
            try {
              await sendReminder({
                order: dialog.receivableId,
                channel: CHANNELS[channel] ?? 'SMS',
                message,
                ...(scheduledFor ? { scheduledFor: `${scheduledFor}:00` } : {}),
              }).unwrap()
            } catch (error) {
              throw new Error(describe(error, 'The reminder wasn’t sent.'), { cause: error })
            }
            setDialog(null)
            setToast(`${channel} reminder ${scheduledFor ? 'scheduled' : 'sent'}`)
          }}
        />
      )}
      {dialog?.name === 'resolve' && (
        <ResolveExceptionDialog
          reason={exceptions.find(({ id }) => id === dialog.exceptionId)?.reason ?? ''}
          onClose={() => setDialog(null)}
          onResolve={async (resolution) => {
            try {
              await updateException({ id: dialog.exceptionId, resolved: true, resolution }).unwrap()
            } catch (error) {
              throw new Error(describe(error, 'The exception wasn’t resolved.'), { cause: error })
            }
            setDialog(null)
            setToast('Exception resolved')
          }}
        />
      )}
      {dialog?.name === 'open' && (
        <OpenSessionDialog
          suggestedFloat={closedSession?.counted ?? 0}
          onClose={() => setDialog(null)}
          onOpen={async (register, openingFloat) => {
            try {
              await openSession({ register, openingFloat }).unwrap()
            } catch (error) {
              throw new Error(describe(error, 'The register wasn’t opened.'), { cause: error })
            }
            setClosedSession(null)
            setDialog(null)
            setToast(`${register} opened with ${formatXaf(openingFloat)}`)
          }}
        />
      )}
      {dialog?.name === 'adjust' && session && (
        <CashAdjustDialog
          onClose={() => setDialog(null)}
          onSave={async (amount, reason) => {
            try {
              await adjustSession({ id: session.uuid, amount, reason }).unwrap()
              setDialog(null)
              setToast('Cash adjustment recorded')
            } catch (error) {
              setToast(describe(error, 'The adjustment wasn’t recorded.'))
            }
          }}
        />
      )}
      {dialog?.name === 'close' && session && (
        <CloseSessionDialog
          expected={session.totals.expected}
          onClose={() => setDialog(null)}
          onConfirm={async (counted, reason) => {
            try {
              const closed = await closeSession({ id: session.uuid, counted, ...(reason ? { varianceReason: reason } : {}) }).unwrap()
              setClosedSession(closed)
              setDialog(null)
              setToast(
                counted === session.totals.expected
                  ? 'Session closed: balanced'
                  : 'Session closed with a variance',
              )
            } catch (error) {
              setToast(describe(error, 'The session wasn’t closed.'))
            }
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
      <span className="sr-only" aria-hidden="true">{actor}</span>
    </>
  )
}

export default PaymentsPage
