import { PAY_METHODS, TXN_STATUSES } from '../constants/payments'
import type {
  CashSession,
  PayMethod,
  PaymentFilters,
  Receivable,
  Transaction,
  TxnStatus,
} from '../types/payment'
import { toCsv } from './csv'

const DAY_MS = 86_400_000

// Statuses whose money actually arrived (refunds are subtracted separately)
const COLLECTED: TxnStatus[] = ['completed', 'refunded', 'partialRefund']

export function getTxnStatus(id: TxnStatus) {
  return TXN_STATUSES.find((status) => status.id === id)!
}

export function isCollected(txn: Transaction) {
  return COLLECTED.includes(txn.status)
}

export function isDigital(method: PayMethod) {
  return PAY_METHODS.find(({ id }) => id === method)!.digital
}

export function sum<T>(list: T[], read: (item: T) => number) {
  return list.reduce((total, item) => total + read(item), 0)
}

export function getCollected(transactions: Transaction[]) {
  return sum(transactions.filter(isCollected), ({ amount }) => amount)
}

export function getRefundable(txn: Transaction) {
  return isCollected(txn) ? txn.amount - txn.refunded : 0
}

export function getOutstanding(receivable: Receivable) {
  return Math.max(0, receivable.total - receivable.paid)
}

export function getDaysOverdue(receivable: Receivable, now: number) {
  if (getOutstanding(receivable) === 0) return 0
  return Math.max(0, Math.floor((now - new Date(receivable.dueAt).getTime()) / DAY_MS))
}

export function formatDue(receivable: Receivable, now: number) {
  const days = Math.round((new Date(receivable.dueAt).getTime() - now) / DAY_MS)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `In ${days} days`
  return `${-days} ${days === -1 ? 'day' : 'days'} ago`
}

// What the till should hold comes from the server; only the count of cash
// transactions is worked out here
export function getCashSummary(session: CashSession, transactions: Transaction[]) {
  const since = new Date(session.openedAt).getTime()
  const count = transactions.filter(
    (txn) => txn.method === 'Cash' && new Date(txn.at).getTime() >= since,
  ).length
  const { cashPayments, cashRefunds, adjustments, expected } = session.totals
  return { count, collected: cashPayments, refunds: cashRefunds, adjustments, expected }
}

export function matchesPaymentFilters(txn: Transaction, filters: PaymentFilters) {
  const needle = filters.query.trim().toLowerCase().replace(/^#/, '')
  if (
    needle &&
    ![txn.id, txn.receipt, txn.orderId, txn.customer, txn.phone, txn.reference, txn.provider].some(
      (field) => field.toLowerCase().includes(needle),
    )
  ) {
    return false
  }
  if (filters.status && txn.status !== filters.status) return false
  if (filters.method && txn.method !== filters.method) return false
  if (filters.cashier && txn.cashier !== filters.cashier) return false
  if (filters.minAmount && txn.amount < Number(filters.minAmount)) return false
  if (filters.view === 'digital' && !isDigital(txn.method)) return false
  if (filters.view === 'review' && !txn.reviewReason) return false
  if (filters.view === 'unreconciled' && txn.reconciled) return false
  return true
}

export function transactionsToCsv(transactions: Transaction[]) {
  const columns: [string, (txn: Transaction) => string | number][] = [
    ['Transaction ID', (txn) => txn.id],
    ['Date & time', (txn) => new Date(txn.at).toLocaleString('en-GB')],
    ['Order', (txn) => txn.orderId],
    ['Customer', (txn) => txn.customer],
    ['Phone', (txn) => txn.phone],
    ['Branch', (txn) => txn.branch],
    ['Amount (XAF)', (txn) => txn.amount],
    ['Fee (XAF)', (txn) => txn.fee],
    ['Refunded (XAF)', (txn) => txn.refunded],
    ['Method', (txn) => txn.method],
    ['Provider', (txn) => txn.provider],
    ['Reference', (txn) => txn.reference],
    ['Status', (txn) => getTxnStatus(txn.status).label],
    ['Reconciled', (txn) => (txn.reconciled ? 'Yes' : 'No')],
    ['Cashier', (txn) => txn.cashier],
  ]
  return toCsv(columns, transactions)
}
