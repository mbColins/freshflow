# 08. Customers: the parts of the profile still empty

Priority P2. Status: **Partial**.

## What the screens do

`CustomersPage` and `CustomerProfilePage` are connected to `/customer`, which
now stores kind, name, company, phone, email, status, home address,
neighbourhood, loyalty points, referral source, preferred service, archived,
branch, tags, addresses, notes, laundry and delivery preferences, consent and
the corporate profile. The backend also computes `orders`, `spent`,
`outstanding`, `lastOrderAt` and the monthly series.

What is still missing (and why the page has `// TODO` comments):

| Feature | Today |
|---|---|
| **Communications** tab (SMS, WhatsApp, email, calls sent to or logged for the customer) | The backend returns an empty list (`CustomerResponse` says "no backing data yet") |
| **Payments** tab | Empty list. Comes from `01-payments.md` |
| **Activity** timeline (orders, payments, notes, status changes) | Empty list |
| Saving a payment from the customer profile (`CustomersPage.tsx:554`) | Not saved |
| **Loyalty points** history and automatic tiers | Only a points number that the UI overwrites |
| **Status** rules (new, active, inactive, VIP) | Status is set by hand |
| **Notes**: add one from the profile | Only the whole `notes` list can be sent in a PATCH |
| **Custom segments** (saved filters) | Saved in the browser |
| **Import** customers from a file | The dialog exists, no endpoint |
| Duplicate detection and merge | Not offered yet |
| Bulk message to a segment | Not connected |

## Communications

The message dispatcher (README, B) already writes a `message_log` row for every
message. A customer's communications are those rows, plus calls logged by
hand.

```
customer_communication(id, uuid, tenant_id, customer_id,
                       channel,        -- SMS, WHATSAPP, EMAIL, CALL
                       direction,      -- OUTBOUND, INBOUND
                       message, status,   -- DELIVERED, FAILED, QUEUED, LOGGED
                       message_log_id NULL, created_by, at)
```

In practice, store only manual entries (calls, in-person notes of contact) in
this table, and union it with `message_log` (where `recipient` is this customer)
when reading.

| Method | Path | Purpose |
|---|---|---|
| GET | `/customer/{id}/communications?page=&size=` | Newest first |
| POST | `/customer/{id}/communications` | Log a call or contact |
| POST | `/customer/{id}/message` | Send a message now (dispatcher) |

Log a contact:

```json
{ "channel": "CALL", "message": "Confirmed pickup for Saturday morning", "direction": "OUTBOUND" }
```

Send:

```json
{ "channel": "WHATSAPP", "message": "Your order is ready for pickup.", "template": null }
```

Rules for sending:

- The customer's `consent` must allow the channel (409 `no_consent`). Marketing
  messages also need `consent.marketing`.
- A missing phone or email for the channel is 400 `no_contact_for_channel`.
- Returns the `message_log` entry. A failed send stays in the history.

Response item:

```json
{ "at": "2026-10-24T09:15:00", "channel": "SMS", "direction": "OUTBOUND", "message": "Your order ORD-10452 is ready.", "status": "DELIVERED", "by": "Jean Mbarga" }
```

## Payments tab

`GET /payments?customer=<uuid>&page=&size=` (defined in `01`). The customer
response's `payments` can stay as the latest five for the profile header, but
the tab should page through the full list. Include `status`, `method`,
`reference`, the order number and who recorded it.

Recording a payment from the profile uses `POST /payments` with the order
number picked from the customer's orders (`GET /order/customer/{uuid}`).

## Activity timeline

Derived, not stored: `GET /customer/{id}/activity?page=&size=` merges, newest
first:

- orders created, completed or cancelled
- payments and refunds
- notes added
- status or tier changes
- messages sent
- profile edits (from the audit log, `entityType = CUSTOMER`)

```json
{ "at": "2026-10-24T09:15:00", "type": "ORDER_COMPLETED", "text": "Order ORD-10452 completed", "related": { "kind": "ORDER", "id": "ORD-10452" }, "by": "Jean Mbarga" }
```

The customer response's `activity` field can return the latest ten.

## Notes

Stop replacing the whole list through `PATCH`.

| Method | Path | Body |
|---|---|---|
| POST | `/customer/{id}/notes` | `{ "text": "Prefers evening pickups" }` |
| DELETE | `/customer/{id}/notes/{noteId}` | – |

The note's author is the caller; its time is the server time. Only the author,
a manager or the owner can delete it. Each add or delete writes an audit entry.
Keep accepting `notes` on `PATCH` for compatibility, but ignore it when it is
shorter than what is stored unless the caller is a manager.

## Loyalty

```
loyalty_ledger(id, tenant_id, customer_id, points,      -- signed
               reason,   -- ORDER_COMPLETED, REDEEMED, ADJUSTMENT, EXPIRED, REFERRAL, PROMOTION
               reference NULL, balance_after, created_by, created_at)
```

- `customer.loyalty_points` is the running balance, changed only through the
  ledger.
- Earning: when an order becomes `COMPLETED`, award
  `floor(total_price / tenant.points_per_xaf)` (default 1 point per 100 XAF).
  Make it idempotent (one `ORDER_COMPLETED` row per order).
- Redeeming: `POST /customer/{id}/loyalty/redeem { "points": 200, "order":
  "ORD-10452" }` applies a discount of `points × tenant.xaf_per_point` to the
  order. 409 `insufficient_points`.
- Manual change: `POST /customer/{id}/loyalty/adjust { "points": -50,
  "reason": "Correction" }`, manager or owner, reason required.
- `GET /customer/{id}/loyalty?page=&size=` returns the ledger.
- Tiers are computed from the balance with the thresholds the frontend uses
  (`LOYALTY_TIERS` in `constants/customers.ts`): bronze, silver, gold,
  platinum. Return `tier` and `pointsToNextTier` on the customer. Put the
  thresholds in tenant settings with these as defaults.
- Points that stay unused for 12 months expire (scheduled job, `EXPIRED`
  entries), with a warning message 30 days earlier.

## Status rules

Today status (`new`, `active`, `inactive`, `vip`, `suspended`) is a field.
Suspended stays manual (and blocks new orders: 409 `customer_suspended` from
`POST /order`). The others should be computed by a nightly job and only
overridden by hand:

| Status | Rule |
|---|---|
| `NEW` | Registered in the last 30 days |
| `VIP` | Tier gold or platinum, or spend in the last 12 months above the tenant's VIP threshold |
| `ACTIVE` | Last order within `cadenceDays × 2` (min 60 days) |
| `INACTIVE` | No order for longer than that |

`status_manual` (boolean) records an override, which the job leaves alone.

## Saved segments

```
customer_segment(id, uuid, tenant_id, name, filters_json, created_by, shared BOOLEAN, created_at)
```

`GET/POST /customer/segments`, `DELETE /customer/segments/{uuid}`. `filters`
is the `CustomerFilters` object the page already builds. `shared = false`
means only the creator sees it.

`GET /customer` should accept the filters the page applies on the client today,
so the segments work server-side as the list grows: `kind`, `status`, `tier`,
`branch`, `lastOrder` (`30`, `90`, `OLDER`), `registered`, `minOrders`,
`minSpent`, `balance` (`YES`, `NO`), `service`, `method`, `tag`, `segment`
(`NEW`, `ACTIVE`, `RETURNING`, `FREQUENT`, `VIP`, `INACTIVE`, `HIGH_SPENDERS`,
`DELIVERY`, `CORPORATE`, `BALANCE`).

## Import: `POST /customer/import`

`multipart/form-data`: `file` (CSV) and `branch`. Columns: `kind,
firstname, lastname, companyName, phone, email, address, neighbourhood, tags`.

- Validate all rows first. Phone numbers are normalised to one format.
  Duplicates (same phone in the tenant) are skipped or, with `mode=UPDATE`,
  update the existing record.
- Response: `{ "created": 40, "updated": 3, "skipped": 2, "errors": [{ "row": 7, "message": "invalid_phone" }] }`.

## Duplicates and merge

- `GET /customer/duplicates` returns groups of customers sharing a phone or
  email.
- `POST /customer/{id}/merge { "into": "other-customer-uuid" }` moves orders,
  payments, notes, communications and loyalty to the target, adds the points,
  archives the source, and writes audit entries. Owner or manager only. Not
  reversible; the response lists what moved.

## Bulk message to a segment

`POST /customer/message`:

```json
{ "customers": ["uuid-1", "uuid-2"], "segment": null, "channel": "SMS", "message": "Weekend offer: 20% off", "marketing": true, "scheduledFor": null }
```

Either `customers` or a saved `segment`. Skips customers without consent (the
response counts them). Goes through the dispatcher so it lands in the message
log and the customers' Communications tabs.

## Permissions

| Action | Owner | Manager | Front desk | Others |
|---|---|---|---|---|
| View, create, edit | ✓ | ✓ | ✓ | – |
| Delete, merge, adjust points | ✓ | ✓ | – | – |
| Import, export | ✓ | ✓ | – | – |
| Bulk messages | ✓ | ✓ | – | – |
