# 02. Orders: what the order record still lacks

Priority P1. Status: **Partial**.

## What the screen does

The Orders page (`pages/OrdersPage.tsx`) is connected to `/order`, but a number
of actions only change what is on screen, and are lost on reload (see the
`TODO`s in that file):

| Action | Today |
|---|---|
| Assign an order to a staff member | Kept in the browser only |
| Set priority (normal, high, express) | Kept in the browser only |
| Delivery address for a delivery order | No field to store it |
| Cancel an order with a reason | Reason kept in the browser only |
| Quality check (checklist, pass or fail with a reason) | Kept in the browser only; a pass moves the order to `READY`, a fail can't send it back |
| Payment detail (method, reference, who, when) | Only the total `amountPaid` is saved (see `01-payments.md`) |
| Discount, surcharge, tax lines | Not stored; only `totalPrice` |
| Order timeline (who did what, when) | `WorkflowStatusLog` is written but never read back |
| Staff notes and handling instructions | Only one `notes` field |
| Import orders from a file | No endpoint |

## What the backend has

`/order` create, read, list, `by tenant`, `by customer`, update, `complete`,
`collect`, delete. `OrderRequest` carries `orderNumber`, `customerId`,
`branchId`, `promisedDate`, `deliveryOptions`, `deliveryFee`, `totalPrice`,
`amountPaid`, `paymentStatus`, `paymentMethod`, `status`, `notes`,
`articleLines`. `WorkflowStatusService.createStatus` writes
`WorkflowStatusLog(order, status, changedAt, changedBy, delayReason)`.

## Fields to add to `orders`

```
priority            NORMAL | HIGH | EXPRESS   DEFAULT NORMAL
assigned_to_id      FK users NULL
delivery_address    VARCHAR NULL              -- required when delivery_options is DELIVERY / HOME_DELIVERY
delivery_latitude   DOUBLE NULL
delivery_longitude  DOUBLE NULL
subtotal            DECIMAL                   -- Σ article line totals
discount_amount     DECIMAL DEFAULT 0
surcharge_amount    DECIMAL DEFAULT 0
tax_amount          DECIMAL DEFAULT 0
customer_notes      TEXT                      -- what the customer asked for (the existing `notes`)
staff_notes         TEXT                      -- internal
handling_instructions TEXT
cancel_reason       TEXT NULL
cancelled_at        TIMESTAMP NULL
cancelled_by        VARCHAR NULL
qc_result           PENDING | PASSED | FAILED DEFAULT PENDING
qc_failure_reason   TEXT NULL
qc_checks_json      JSON                      -- { "Colour intact": true, … }
qc_by               VARCHAR NULL
qc_at               TIMESTAMP NULL
completed_at        TIMESTAMP NULL            -- set by /complete
collected_at        TIMESTAMP NULL            -- set by /collect
```

Invariant: `total_price = subtotal − discount_amount + surcharge_amount +
tax_amount + delivery_fee`. Compute it on the server; don't trust a
`totalPrice` sent by the client (accept it only for backward compatibility and
ignore it when article lines are present).

Add to `article_line`: `condition` (`NORMAL`, `STAINED`, `DAMAGED`, `WORN`),
`tag` (the garment tag code printed at intake), `weight_kg NULL` (needed for
services priced per kg), `item_type` is the existing `articleType`.

## Create and update: extended bodies

`POST /order` and `PATCH /order/{orderNumber}` accept the existing fields plus:

```json
{
  "branchId": "branch-uuid",
  "customerId": "customer-uuid",
  "priority": "EXPRESS",
  "assignedTo": "user-uuid",
  "promisedDate": "2026-10-26T17:00:00",
  "deliveryOptions": "DELIVERY",
  "deliveryAddress": "Rue Joss, Bonapriso, near the pharmacy",
  "deliveryLatitude": 4.0302,
  "deliveryLongitude": 9.6911,
  "discountAmount": 2000,
  "customerNotes": "No starch on shirts",
  "staffNotes": "Customer is a hotel contact",
  "handlingInstructions": "Delicate cycle for the silk blouse",
  "articleLines": [
    {
      "articleType": "SHIRT",
      "service": "service-uuid",
      "quantity": 3,
      "weightKg": null,
      "unitPrice": 1500,
      "condition": "STAINED",
      "tag": "T-10452-1",
      "notes": "Coffee stain on the collar"
    }
  ],
  "initialPayment": { "amount": 5000, "method": "CASH", "reference": null }
}
```

Rules:

- `deliveryAddress` is required for `DELIVERY` / `HOME_DELIVERY` (400
  `delivery_address_required`). When the order is delivered, creating the
  `DispatchJob` should default its address and coordinates from here.
- `assignedTo` must be an active user of the same tenant (and, for a branch
  order, of the same branch or a tenant-wide user).
- `initialPayment`: when present, create the first `payment` record inside the
  same transaction (`01-payments.md`). The order's `amount_paid` follows from
  that. Do not accept `amountPaid` directly once payments exist.
- `PATCH` changes only the fields sent. Changing article lines after the order
  has left `RECEIVED` is blocked (409 `order_in_progress`) unless the caller is
  a manager.
- Responses include every field above, plus `customer { uuid, name, phone }`,
  `assignedTo { uuid, name }`, and `paid`, `balance`, computed.

## Status changes

The order's `status` is `RECEIVED → WASHING → DRYING → IRONING → QA → READY →
HANDOVER → COMPLETED`, with `CANCELLED` possible before `COMPLETED`.
Enforce this in one place (`OrderStatusMachine`):

- Forward by one step, or skip forward only for a manager (and then log the
  skip).
- Backward only through a failed QC (`QA → WASHING` or `QA → IRONING`) or by a
  manager (409 `invalid_status_transition` otherwise).
- `COMPLETED` only through `PATCH /order/{orderNumber}/complete`, which also
  requires the balance to be 0 unless the caller is a manager (409
  `balance_outstanding`).
- Every change writes a `WorkflowStatusLog` row **and** an audit entry.
- Moving to `READY` sends the customer the `ORDER_READY` message (README, B).

### Cancel: `PATCH /order/{orderNumber}/cancel`

```json
{ "reason": "Customer changed their mind" }
```

- Sets `CANCELLED`, `cancel_reason`, `cancelled_at`, `cancelled_by`.
- Not allowed after `COMPLETED` (409).
- If money was paid, the response includes `refundDue` and the UI offers the
  refund flow (`01-payments.md`). The server does not refund automatically.
- Cancels any open `DispatchJob` of the order.

## Quality check: `POST /order/{orderNumber}/quality-check`

```json
{
  "checks": { "Stains removed": true, "Colour intact": true, "Pressed neatly": false },
  "result": "FAILED",
  "reason": "Collar still creased",
  "sendBackTo": "IRONING"
}
```

Rules:

- The order must be in `QA` (409 otherwise).
- `result: PASSED` → status `READY`; every check must be `true`, otherwise
  400.
- `result: FAILED` → `reason` and `sendBackTo` (`WASHING` or `IRONING`) are
  required; status goes back to that stage; increment
  `orders.qc_failure_count`.
- Stores `qc_checks_json`, `qc_result`, `qc_by`, `qc_at`, and writes a
  timeline entry and an audit entry.
- The same endpoint is used by the Laundry Operations page (`03`). Keep one
  implementation.

Response: the updated order.

## Timeline: `GET /order/{orderNumber}/timeline`

Reads `WorkflowStatusLog` plus the audit entries for the order, newest first:

```json
[
  { "at": "2026-10-25T09:05:00", "action": "Status changed to WASHING", "by": "Elena Rostova", "note": null },
  { "at": "2026-10-25T08:40:00", "action": "Assigned to Elena Rostova", "by": "Jean Mbarga", "note": null },
  { "at": "2026-10-25T08:30:00", "action": "Order created", "by": "Jean Mbarga", "note": null }
]
```

Also embed `timeline` in `GET /order/{orderNumber}` (the single-order read) so
the drawer needs one call.

## Assign: `PATCH /order/{orderNumber}/assign`

```json
{ "assignedTo": "user-uuid" }
```

Also accepted by `PATCH /order/{orderNumber}`. A bulk form,
`PATCH /order/assign { "orders": ["ORD-1","ORD-2"], "assignedTo": "…" }`, is
used by the bulk action on the Orders table; apply all or none.

## List filters: `GET /order`

Add server-side filters so the page can stop loading 200 orders: `status`
(one or several), `priority`, `payment` (`PENDING`, `PARTIALLY_PAID`,
`COMPLETELY_PAID`), `assignedTo`, `branch`, `delivery` (`PICKUP`, `DELIVERY`),
`dueFrom`, `dueTo`, `overdue=true`, `minAmount`, `maxAmount`, `search`
(order number, customer name or phone), `sort` (`createdAt`, `dueAt`,
`total`). Keep paging.

## Import: `POST /order/import`

`multipart/form-data` with a `file` (CSV) and a `branch`. Columns:
`customerPhone,customerName,service,quantity,unitPrice,promisedDate,notes`.
Returns `{ created, skipped, errors: [{ row, message }] }`. Validate the whole
file first (all or none); rows for unknown customers create the customer.

## Permissions

| Action | Owner | Manager | Front desk | Washer / others |
|---|---|---|---|---|
| Create, edit, assign | ✓ | ✓ | ✓ | – |
| Move forward one step | ✓ | ✓ | ✓ | ✓ (their stage) |
| Skip or move backward | ✓ | ✓ | – | – |
| Quality check | ✓ | ✓ | – | ✓ (QC staff) |
| Cancel | ✓ | ✓ | ✓ before `WASHING` | – |
| Import | ✓ | ✓ | – | – |
