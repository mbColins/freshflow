import type {
  AuditEntry,
  CashSession,
  PayMethod,
  PaymentException,
  Receivable,
  Refund,
  Transaction,
  TxnStatus,
} from '../types/payment'
import { BRANCHES } from './orders'

// Sample payment data until the payments API exists. Times are relative to
// page load so "today" always has activity.
const MINUTE_MS = 60_000
const loadedAt = Date.now()
const at = (minutes: number) => new Date(loadedAt + minutes * MINUTE_MS).toISOString()
const daysFromNow = (days: number) => at(days * 1_440)

type Seed = {
  n: number
  order: number
  customer: string
  phone: string
  amount: number
  method: PayMethod
  provider?: string
  status?: TxnStatus
  cashier?: string
  minutesAgo: number
  refunded?: number
  reconciled?: boolean
  review?: string
  failure?: string
}

const SEEDS: Seed[] = [
  { n: 8492, order: 10452, customer: 'John Doe', phone: '+237 671 892 104', amount: 18_500, method: 'Mobile Money', provider: 'MTN MoMo', minutesAgo: 18 },
  { n: 8491, order: 10451, customer: 'Grand Imperial Hotel', phone: '+237 699 120 441', amount: 84_200, method: 'Bank Transfer', provider: 'Bank Wire Sync', status: 'pending', minutesAgo: 32, reconciled: false },
  { n: 8490, order: 10428, customer: 'Alain Foning', phone: '+237 699 204 188', amount: 14_800, method: 'Cash', minutesAgo: 46 },
  { n: 8489, order: 10499, customer: 'Marcelle Nguemo', phone: '+237 675 110 394', amount: 15_000, method: 'Card', provider: 'Visa / Mastercard POS', status: 'partialRefund', minutesAgo: 70, refunded: 5_000 },
  { n: 8488, order: 10476, customer: 'Beatrice Eboa', phone: '+237 651 409 881', amount: 12_000, method: 'Mobile Money', provider: 'Orange Money', status: 'failed', minutesAgo: 98, failure: 'Insufficient funds / timeout', reconciled: false },
  { n: 8487, order: 10447, customer: 'Marc Belle', phone: '+237 655 001 928', amount: 17_888, method: 'Card', provider: 'Visa / Mastercard POS', minutesAgo: 121 },
  { n: 8486, order: 10449, customer: 'Dr. Aris', phone: '+237 655 332 901', amount: 32_198, method: 'Cash', minutesAgo: 150 },
  { n: 8485, order: 10444, customer: 'Paul Etoa', phone: '+237 698 214 667', amount: 12_200, method: 'Mobile Money', provider: 'MTN MoMo', minutesAgo: 176 },
  { n: 8484, order: 10444, customer: 'Paul Etoa', phone: '+237 698 214 667', amount: 12_200, method: 'Mobile Money', provider: 'MTN MoMo', minutesAgo: 178, reconciled: false, review: 'Second payment for the same order within two minutes' },
  { n: 8483, order: 10443, customer: 'Linda Fotso', phone: '+237 675 903 221', amount: 11_925, method: 'Mobile Money', provider: 'MTN MoMo', minutesAgo: 205 },
  { n: 8482, order: 10440, customer: 'Ibrahim Sali', phone: '+237 691 556 030', amount: 9_540, method: 'Cash', minutesAgo: 240 },
  { n: 8481, order: 10438, customer: 'Fatima Bello', phone: '+237 653 119 874', amount: 17_291, method: 'Mobile Money', provider: 'Orange Money', status: 'pending', minutesAgo: 262, reconciled: false },
  { n: 8480, order: 10445, customer: 'Grace Ndi', phone: '+237 652 778 340', amount: 4_293, method: 'Cash', minutesAgo: 300 },
  { n: 8479, order: 10442, customer: 'Grand Palace Hotel', phone: '+237 699 120 441', amount: 49_200, method: 'Bank Transfer', provider: 'Bank Wire Sync', minutesAgo: 335 },
  { n: 8478, order: 10439, customer: 'Grace Ndi', phone: '+237 652 778 340', amount: 7_155, method: 'Cash', status: 'refunded', minutesAgo: 360, refunded: 7_155 },
  { n: 8477, order: 10436, customer: 'St. Jude Clinic', phone: '+237 677 440 912', amount: 49_941, method: 'Account Credit', minutesAgo: 395 },
  { n: 8476, order: 10433, customer: 'Sarah Kamdem', phone: '+237 690 334 118', amount: 8_500, method: 'Mobile Money', provider: 'Orange Money', status: 'failed', minutesAgo: 410, failure: 'Provider timeout', reconciled: false },
  { n: 8475, order: 10431, customer: 'Olivier Tchana', phone: '+237 677 628 105', amount: 22_000, method: 'Card', provider: 'Visa / Mastercard POS', status: 'reversed', minutesAgo: 440, review: 'Reversed by the card provider after settlement' },
]

// Card and mobile money take a processing fee; cash and transfers do not
const FEE_RATES: Partial<Record<PayMethod, number>> = { 'Mobile Money': 0.015, Card: 0.018 }
const REFERENCE_PREFIX: Record<PayMethod, string> = {
  Cash: 'CS',
  'Mobile Money': 'MM',
  Card: 'AUTH',
  'Bank Transfer': 'WIRE',
  'Account Credit': 'ACC',
}

function buildTransaction(seed: Seed): Transaction {
  const status = seed.status ?? 'completed'
  const when = -seed.minutesAgo
  const settled = !['pending', 'failed'].includes(status)
  return {
    id: `TXN-00${seed.n}`,
    receipt: `REC-00${seed.n}`,
    at: at(when),
    orderId: `ORD-${seed.order}`,
    customer: seed.customer,
    phone: seed.phone,
    branch: BRANCHES[0],
    amount: seed.amount,
    fee: settled ? Math.round(seed.amount * (FEE_RATES[seed.method] ?? 0)) : 0,
    method: seed.method,
    provider: seed.provider ?? '',
    reference: `${REFERENCE_PREFIX[seed.method]}-${928_000 + seed.n}`,
    status,
    cashier: seed.cashier ?? (seed.n % 3 === 0 ? 'Aisha Tamba' : 'Jean Mbarga'),
    refunded: seed.refunded ?? 0,
    reconciled: seed.reconciled ?? settled,
    reviewReason: seed.review ?? '',
    failureReason: seed.failure ?? '',
    timeline: [
      { at: at(when - 2), text: 'Payment initiated' },
      ...(seed.provider ? [{ at: at(when - 1), text: `${seed.provider} processing` }] : []),
      status === 'failed'
        ? { at: at(when), text: `Payment failed: ${seed.failure}` }
        : status === 'pending'
          ? { at: at(when), text: 'Awaiting provider confirmation' }
          : { at: at(when), text: 'Payment confirmed, receipt generated' },
      ...(seed.refunded ? [{ at: at(when + 20), text: `Refunded XAF ${seed.refunded.toLocaleString('en-US')}` }] : []),
      ...(status === 'reversed' ? [{ at: at(when + 25), text: 'Reversed by payment provider' }] : []),
    ],
  }
}

export const SAMPLE_TRANSACTIONS: Transaction[] = SEEDS.map(buildTransaction)

export const SAMPLE_RECEIVABLES: Receivable[] = [
  { id: 'AR-1', customer: 'Grand Palace Hotel', phone: '+237 699 120 441', orderId: 'ORD-10450', total: 185_000, paid: 0, dueAt: daysFromNow(-5), lastReminderAt: daysFromNow(-2) },
  { id: 'AR-2', customer: 'Akwa Suites Hotel', phone: '+237 699 300 772', orderId: 'ORD-10402', total: 240_000, paid: 115_000, dueAt: daysFromNow(-12), lastReminderAt: daysFromNow(-6) },
  { id: 'AR-3', customer: 'Sarah Kamdem', phone: '+237 690 334 118', orderId: 'ORD-10446', total: 35_784, paid: 0, dueAt: daysFromNow(0.2), lastReminderAt: null },
  { id: 'AR-4', customer: 'Marc Belle', phone: '+237 655 001 928', orderId: 'ORD-10392', total: 30_000, paid: 15_000, dueAt: daysFromNow(-2), lastReminderAt: null },
  { id: 'AR-5', customer: 'John Doe', phone: '+237 671 892 104', orderId: 'ORD-10441', total: 12_500, paid: 0, dueAt: daysFromNow(1), lastReminderAt: null },
  { id: 'AR-6', customer: 'Emmanuel M.', phone: '+237 670 221 504', orderId: 'ORD-10448', total: 17_888, paid: 8_000, dueAt: daysFromNow(2), lastReminderAt: null },
]

export const SAMPLE_REFUNDS: Refund[] = [
  { id: 'RFD-0061', txnId: 'TXN-008478', customer: 'Grace Ndi', orderId: 'ORD-10439', original: 7_155, amount: 7_155, reason: 'Order cancelled', method: 'Cash', at: at(-340), requestedBy: 'Aisha Tamba', approvedBy: 'Marcus Vance', status: 'Completed' },
  { id: 'RFD-0062', txnId: 'TXN-008489', customer: 'Marcelle Nguemo', orderId: 'ORD-10499', original: 15_000, amount: 5_000, reason: 'Service issue', method: 'Card', at: at(-50), requestedBy: 'Jean Mbarga', approvedBy: 'Marcus Vance', status: 'Completed' },
  { id: 'RFD-0063', txnId: 'TXN-008487', customer: 'Marc Belle', orderId: 'ORD-10447', original: 17_888, amount: 3_000, reason: 'Customer request', method: 'Card', at: at(-15), requestedBy: 'Jean Mbarga', approvedBy: '', status: 'Pending Approval' },
]

export const SAMPLE_EXCEPTIONS: PaymentException[] = [
  { id: 'EXC-1', severity: 'critical', txnId: 'TXN-008484', customer: 'Paul Etoa', amount: 12_200, reason: 'Duplicate payment: two MoMo payments for ORD-10444', assignee: 'Marcus Vance', resolved: false },
  { id: 'EXC-2', severity: 'warning', txnId: 'TXN-008481', customer: 'Fatima Bello', amount: 17_291, reason: 'Provider confirmation delayed (Orange Money)', assignee: 'Jean Mbarga', resolved: false },
  { id: 'EXC-3', severity: 'warning', txnId: 'TXN-008475', customer: 'Olivier Tchana', amount: 22_000, reason: 'Reversed by provider after the order was released', assignee: 'Marcus Vance', resolved: false },
]

export const SAMPLE_SESSION: CashSession = {
  cashier: 'Jean Mbarga',
  register: 'Drawer #01 · Front Desk',
  openedAt: at(-520),
  opening: 100_000,
  adjustments: [],
  closedAt: null,
  counted: null,
  varianceReason: '',
}

export const SAMPLE_AUDIT: AuditEntry[] = [
  { at: at(-15), user: 'Jean Mbarga', action: 'Refund requested (RFD-0063)', to: 'XAF 3,000' },
  { at: at(-18), user: 'Jean Mbarga', action: 'Payment recorded (TXN-008492)', to: 'XAF 18,500' },
  { at: at(-50), user: 'Marcus Vance', action: 'Refund approved (RFD-0062)', to: 'XAF 5,000' },
  { at: at(-340), user: 'Marcus Vance', action: 'Refund completed (RFD-0061)', to: 'XAF 7,155' },
  { at: at(-520), user: 'Jean Mbarga', action: 'Cash register opened', to: 'XAF 100,000' },
]
