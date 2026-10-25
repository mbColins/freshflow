# 01. Payments

Priority P1. Status: **Missing**.

## What the screen does

The Payments page (`pages/PaymentsPage.tsx`) is entirely sample data:

- A register of transactions with filters (status, method, cashier, minimum
  amount, quick views: digital, needs review, unreconciled) and a detail
  drawer with a timeline and a printable receipt.
- **Record Payment**: pick an order with a balance, enter the amount, choose a
  method (cash, mobile money, card, bank transfer, account credit), provider
  and reference, optional "amount received" for cash change, then confirm and
  print a receipt.
- **Refunds**: request a refund on a transaction with a reason, an approval
  queue for managers, approve or reject.
- **Exceptions**: payments needing a human look (failed, mismatched,
  unreconciled), with an assignee and a resolved flag.
- **Reconciliation**: mark digital payments as matched to the provider.
- **Cash session**: open a till with an opening float, record adjustments,
  close with a counted amount and a variance reason.
- **Receivables**: orders with an outstanding balance, and payment reminders.
- Provider health (Mobile Money, Orange Money…), branch comparison, KPIs, an
  audit trail.

## What the backend has

`orders.amount_paid`, `orders.payment_status` and `orders.payment_method`
(one value per order), and `PATCH /order/{orderNumber}` to overwrite them. There
is no payment record, so there is no receipt, refund or reconciliation, and a
part-cash, part-mobile-money payment can't be stored.

## Data model

```
payment(id, uuid, tenant_id, branch_id, order_id, customer_id NULL,
        code,                 -- TXN-000123, unique per tenant
        receipt_number,       -- REC-000123, unique per tenant
        amount, fee,          -- fee = provider fee taken out of the amount
        method,               -- CASH, MOBILE_MONEY, CARD, BANK_TRANSFER, ACCOUNT_CREDIT
        provider NULL,        -- MTN_MOMO, ORANGE_MONEY, … (digital only)
        reference NULL,       -- provider transaction id
        status,               -- COMPLETED, PENDING, FAILED, REFUNDED,
                              -- PARTIALLY_REFUNDED, CANCELLED, REVERSED
        cashier_id, cash_session_id NULL,
        refunded_amount DEFAULT 0,
        reconciled BOOLEAN, reconciled_at NULL, reconciled_by NULL,
        review_reason NULL, failure_reason NULL,
        cash_received NULL,   -- cash only, for the change shown on the receipt
        created_at)

refund(id, uuid, payment_id, amount, reason, method,
       status,                -- PENDING_APPROVAL, COMPLETED, REJECTED
       requested_by, approved_by NULL, decided_at NULL, decision_note NULL,
       created_at)

payment_exception(id, uuid, payment_id, severity,   -- CRITICAL, WARNING
                  reason, assignee_id NULL, resolved BOOLEAN,
                  resolution NULL, resolved_by NULL, resolved_at NULL, created_at)

cash_session(id, uuid, tenant_id, branch_id, cashier_id, register,
             opened_at, opening_float,
             closed_at NULL, counted_amount NULL, expected_amount NULL,
             variance NULL, variance_reason NULL)

cash_adjustment(id, cash_session_id, amount,        -- signed
                reason, by_user_id, at)

payment_provider_setting(id, tenant_id, branch_id NULL, provider, method,
                         enabled, status,           -- OPERATIONAL, DEGRADED, DOWN
                         fee_percent, updated_at)
```

Keep `orders.amount_paid` and `orders.payment_status` as a cache, recomputed in
the same transaction from `payment` and `refund`:

```
amount_paid    = Σ payment.amount (status COMPLETED or PARTIALLY_REFUNDED)
                 − Σ refund.amount (status COMPLETED)
payment_status = amount_paid = 0           → PENDING
                 amount_paid < total_price → PARTIALLY_PAID
                 otherwise                 → COMPLETELY_PAID
orders.payment_method = method of the latest payment
```

Once payments exist, change `DashboardService.getRevenueOverview` to sum
`payment.created_at` by `payment.method` instead of the order's `amountPaid`.
This fixes two limits of the current chart: money is counted on the day it was
received, and a mixed payment is split between its methods.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/payments` | Record a payment on an order |
| GET | `/payments` | Register, with filters |
| GET | `/payments/{uuid}` | One payment with its timeline and refunds |
| GET | `/payments/{uuid}/receipt` | Data for the printed receipt |
| GET | `/payments/summary` | KPI cards, method split, overview series |
| PATCH | `/payments/{uuid}/reconcile` | Mark one digital payment reconciled |
| POST | `/payments/reconcile` | Mark several reconciled |
| POST | `/payments/{uuid}/refunds` | Request a refund |
| GET | `/payments/refunds` | Refund list (approval queue) |
| PATCH | `/payments/refunds/{uuid}/decision` | Approve or reject |
| GET | `/payments/exceptions` | Exceptions queue |
| PATCH | `/payments/exceptions/{uuid}` | Assign or resolve |
| GET | `/payments/receivables` | Orders with a balance |
| POST | `/payments/receivables/{orderNumber}/reminder` | Send or schedule a reminder |
| POST | `/cash-sessions` | Open a session |
| GET | `/cash-sessions/current` | The caller's open session |
| POST | `/cash-sessions/{uuid}/adjustments` | Add or remove cash |
| POST | `/cash-sessions/{uuid}/close` | Count and close |
| GET | `/cash-sessions` | History |
| GET/PUT | `/payment-providers` | Provider settings per branch |

Audit trail: `GET /audit?entityType=PAYMENT` (see the README).

### Record a payment: `POST /payments`

```json
{
  "order": "ORD-10452",
  "amount": 12500,
  "method": "MOBILE_MONEY",
  "provider": "MTN_MOMO",
  "reference": "MP260125.1432.A8812",
  "cashReceived": null
}
```

Rules:

- `order` is the order number. The order must belong to the caller's scope and
  not be `CANCELLED`. The branch comes from the order.
- `0 < amount ≤ outstanding balance` (`total_price − amount_paid`), otherwise
  409 `amount_exceeds_balance`.
- `CASH`:
  - needs an open cash session for the cashier (409 `no_open_cash_session`)
  - the payment is attached to it
  - if `cashReceived` is sent it must be ≥ `amount`
  - the receipt shows the change
- `MOBILE_MONEY`, `CARD`, `BANK_TRANSFER`: `provider` and `reference` are
  required, and the pair `(provider, reference)` must be unique per tenant (409
  `duplicate_reference`). Status starts `COMPLETED` with `reconciled = false`.
  If the provider is `DOWN` in `payment_provider_setting`, reject with 409
  `provider_unavailable`.
- `ACCOUNT_CREDIT`: only for customers with a credit terms profile; reduces the
  customer's available credit.
- Compute `fee = amount × provider.fee_percent / 100`.
- Assign `code` and `receipt_number` from a per-tenant sequence (use a database
  sequence, not `MAX()+1`).
- Recompute the order's cache fields in the same transaction.
- Audit entry: `PAYMENT_RECORDED`.
- Create a `payment_exception` automatically when a digital payment stays
  unreconciled for more than 24 hours (scheduled job) or when the provider
  reports a failure.

Response (also one row of the list):

```json
{
  "uuid": "…",
  "code": "TXN-000231",
  "receipt": "REC-000231",
  "at": "2026-10-25T10:35:00",
  "order": "ORD-10452",
  "customer": { "uuid": "…", "name": "Sarah K.", "phone": "+237 694 112 883" },
  "branch": { "uuid": "…", "name": "Bonapriso" },
  "amount": 12500,
  "fee": 125,
  "method": "MOBILE_MONEY",
  "provider": "MTN_MOMO",
  "reference": "MP260125.1432.A8812",
  "status": "COMPLETED",
  "cashier": "Jean Mbarga",
  "refunded": 0,
  "reconciled": false,
  "reviewReason": null,
  "failureReason": null,
  "timeline": [
    { "at": "2026-10-25T10:35:00", "text": "Payment recorded, receipt generated", "by": "Jean Mbarga" }
  ]
}
```

### Register: `GET /payments`

Params: `search` (code, receipt, order number, customer name or phone,
reference), `status`, `method`, `cashier` (user uuid), `minAmount`, `from`,
`to` (dates), `branch`, `view` (`DIGITAL`, `NEEDS_REVIEW`, `UNRECONCILED`),
`page`, `size`. Newest first.

### Summary: `GET /payments/summary?from=&to=&branch=`

```json
{
  "currency": "XAF",
  "collected": 6420000,
  "transactions": 231,
  "pending": 4,
  "failed": 2,
  "refunded": 85000,
  "needsReview": 3,
  "unreconciled": 7,
  "outstanding": { "amount": 1240000, "orders": 18 },
  "byMethod": [
    { "method": "CASH", "amount": 2311200, "count": 120 },
    { "method": "MOBILE_MONEY", "amount": 4108800, "count": 105 }
  ],
  "series": [
    { "date": "2026-10-19", "amount": 820000 }
  ],
  "byBranch": [
    { "branch": { "uuid": "…", "name": "Bonapriso" }, "collected": 3100000, "outstanding": 400000 }
  ]
}
```

### Receipt: `GET /payments/{uuid}/receipt`

Returns everything a printed receipt shows: business name, logo and receipt
template from `TenantConfiguration`, branch address and phone, the order's lines
(`articleLines`), totals, this payment, the balance after it, cashier, time, and
a QR value holding the order number.

### Refund: `POST /payments/{uuid}/refunds`

```json
{ "amount": 5000, "reason": "Customer unhappy with stain removal" }
```

Rules:

- `amount ≤ payment.amount − payment.refunded_amount` (409 `refund_exceeds_payment`).
- The refund goes back to the original method.
- **Approval:** the status starts `PENDING_APPROVAL` unless the requester is a
  manager or the owner and the amount is at or below the tenant's
  `refund_auto_approve_limit`. A pending refund changes nothing yet.
- The payment must be `COMPLETED` or `PARTIALLY_REFUNDED`.

Decision: `PATCH /payments/refunds/{uuid}/decision`

```json
{ "approve": true, "note": "Approved after QC review" }
```

- Only a manager or the owner, and not the person who requested it (403
  `cannot_approve_own_refund`).
- Approving sets the refund `COMPLETED`, increases `payment.refunded_amount`,
  sets the payment `REFUNDED` (fully refunded) or `PARTIALLY_REFUNDED`,
  recomputes the order, and writes audit entries.
- Rejecting sets `REJECTED` with the note.

### Exceptions: `PATCH /payments/exceptions/{uuid}`

```json
{ "assignee": "user-uuid", "resolved": true, "resolution": "Matched manually to MTN statement" }
```

`resolution` is required when `resolved` is true. Resolving an exception on a
digital payment also sets `reconciled = true` when the resolution says so.

### Reminder: `POST /payments/receivables/{orderNumber}/reminder`

```json
{ "channel": "SMS", "scheduledFor": null, "message": null }
```

Uses the message dispatcher (README, block B) with the event
`PAYMENT_REMINDER` (`%orderNumber%`, `%balance%`, `%firstname%`). A `null`
`message` uses the template. Writes an audit entry and sets
`lastReminderAt` on the receivable.

Receivables response (`GET /payments/receivables?search=&overdue=true&branch=`):

```json
{
  "order": "ORD-10431",
  "customer": { "uuid": "…", "name": "Grand Palace Hotel", "phone": "…" },
  "total": 185000,
  "paid": 100000,
  "outstanding": 85000,
  "dueAt": "2026-10-27T17:00:00",
  "lastReminderAt": "2026-10-24T09:00:00"
}
```

### Cash session

Open: `POST /cash-sessions`

```json
{ "register": "Front counter 1", "openingFloat": 50000 }
```

One open session per cashier (409 `session_already_open`).

Adjust: `POST /cash-sessions/{uuid}/adjustments`

```json
{ "amount": -10000, "reason": "Paid supplier for hangers" }
```

Close: `POST /cash-sessions/{uuid}/close`

```json
{ "counted": 463500, "varianceReason": "5000 short, change given twice" }
```

Rules:

- `expected = openingFloat + Σ cash payments in the session − Σ cash refunds in
  the session + Σ adjustments`.
- `variance = counted − expected`.
- A non-zero variance needs `varianceReason` (400 `variance_reason_required`).
- Closing blocks further cash payments for this session.
- A variance beyond the tenant's threshold creates a `payment_exception`.

### Providers: `PUT /payment-providers`

```json
{
  "branch": "branch-uuid",
  "providers": [
    { "provider": "MTN_MOMO", "method": "MOBILE_MONEY", "enabled": true, "status": "OPERATIONAL", "feePercent": 1.5 },
    { "provider": "ORANGE_MONEY", "method": "MOBILE_MONEY", "enabled": true, "status": "DEGRADED", "feePercent": 1.5 }
  ]
}
```

Only the owner or a manager can change it. `GET /payment-providers?branch=`
feeds the provider dropdown in the Record Payment form.

## Permissions

| Action | Owner | Manager / store manager | Front desk (cashier) | Others |
|---|---|---|---|---|
| Record payments, open and close own session | ✓ | ✓ | ✓ | – |
| Request refunds | ✓ | ✓ | ✓ | – |
| Approve refunds | ✓ | ✓ | – | – |
| Reconcile, resolve exceptions | ✓ | ✓ | – | – |
| Provider settings | ✓ | ✓ | – | – |
| Read the register | ✓ | ✓ | own branch | – |

## Links to other areas

- **Orders (02):** the order's payment cache fields come from here.
- **Dashboard (14):** the revenue chart should switch to payment dates.
- **Customers (08):** the customer profile's Payments tab is `GET /payments?customer=<uuid>`.
- **Notifications (12):** reminders use the dispatcher.
