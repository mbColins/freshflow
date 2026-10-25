# 05. Inventory: transfers, purchasing, alerts, automatic usage

Priority P1. Status: **Partial** (items and movements exist).

## What the screen does

`pages/InventoryPage.tsx` runs on `constants/sampleInventory.ts`. It has:

- An item register with category, unit, location, stock, reserved, reorder
  level, safety stock, maximum, unit cost, supplier, daily use (for a "runs out
  in N days" forecast), batch, expiry, and the services that need the item.
  Statuses: healthy, low, critical, out, overstocked, expiring, expired.
- Stock actions: **Add stock**, **Record consumption** (laundry processing,
  cleaning, maintenance, damaged, expired, lost), **Adjust** (count
  correction, with a rule that large adjustments need a manager).
- **Transfers** between branches (requested, in transit, received, cancelled).
- **Purchase orders** (draft, approved, ordered, partially received, received,
  cancelled), with several lines each, and "receive" to book the stock.
- A movement history, KPIs (reorder list, reserved stock, stock value), a
  reorder suggestion that pre-fills a purchase order.

## What the backend has

`/inventory` (create, read, list, update, delete) and stock movements
(`POST /inventory/{itemId}/movements`, `GET /inventory/{itemId}/movements`,
`GET /inventory/movements`). Movement types: `RECEIPT`, `USAGE`, `WASTE`,
`ADJUSTMENT`, `RESERVE`, `RELEASE` (`OPENING` is automatic). Receipts keep a
weighted-average `unitCost`. Items return `available`, `daysLeft`, `level`
(`OUT`, `CRITICAL`, `LOW`, `OK`), `expired`, `stockValue`.

## Small gaps in what exists

| Gap | Change |
|---|---|
| Statuses `OVERSTOCKED` and `EXPIRING` | Extend `level` (or add `status`) with `OVERSTOCKED` (stock above `max`) and `EXPIRING` (expires within 30 days). Check in this order: `EXPIRED`, `OUT`, `CRITICAL`, `LOW`, `EXPIRING`, `OVERSTOCKED`, `OK` |
| List filters | `GET /inventory` also takes `category`, `status`, `supplier`, `view` (`REORDER` = at or under reorder level, `RESERVED` = reserved > 0, `EXPIRING`) |
| Summary cards | `GET /inventory/summary?branch=` returning `{ items, stockValue, reorderCount, criticalCount, outCount, expiringCount, expiredCount, reservedUnits }` |
| `dailyUse` | Today it is a stored field. Compute it as the average daily `USAGE + WASTE` over the last 30 days; keep the stored value only as a fallback when there is no history |
| Movement list | `GET /inventory/movements` also takes `item`, `from`, `to`, `user`, `reference` |
| Stock actions by role | Adjustments larger than 20 % of current stock need a manager or owner (403 `adjustment_needs_approval`) |
| Service link | `ServiceConsumption` stores a `Material` enum, not an inventory item. See "Automatic usage" below |

## Transfers

```
stock_transfer(id, uuid, code,                 -- TRF-0042
               tenant_id, item_id, quantity,
               from_branch_id, to_branch_id,
               status,                         -- REQUESTED, IN_TRANSIT, RECEIVED, CANCELLED
               notes, requested_by, requested_at,
               shipped_at NULL, received_by NULL, received_at NULL,
               cancelled_by NULL, cancelled_at NULL)
```

The item is per branch. A transfer therefore moves stock between two
`inventory_item` rows with the same name and unit in two branches.

| Method | Path | Purpose |
|---|---|---|
| POST | `/inventory/transfers` | Request or ship a transfer |
| GET | `/inventory/transfers` | List (`status`, `branch`, `item`, `direction=IN|OUT`) |
| PATCH | `/inventory/transfers/{uuid}/receive` | Receive |
| PATCH | `/inventory/transfers/{uuid}/cancel` | Cancel |

`POST /inventory/transfers`:

```json
{ "item": "item-uuid", "quantity": 10, "toBranch": "branch-uuid", "notes": "Akwa is short for the weekend" }
```

- `item` is in the caller's own branch (`fromBranch` is taken from it); the
  caller must be allowed on it. `toBranch` is another branch of the same tenant.
- Status is `IN_TRANSIT` straight away (the page's "request" and "ship" are one
  step). Write an `ADJUSTMENT`-like movement: add a `TRANSFER_OUT` movement type
  that lowers `stock` by `quantity` (409 `insufficient_stock` when `available`
  is smaller; reserved stock can't be transferred).
- `receive`: the destination branch's manager or staff. Finds the destination
  item with the same name and unit (creates it with the source's category,
  unit, supplier, reorder and safety levels, and the transferred batch and
  expiry if it doesn't exist), writes a `TRANSFER_IN` movement, status
  `RECEIVED`. The unit cost becomes the weighted average, as for a receipt.
- `cancel`: only while `IN_TRANSIT`; writes a `TRANSFER_IN` movement back to the
  source (note "Transfer cancelled").
- New movement types: `TRANSFER_OUT`, `TRANSFER_IN`. The reference holds the
  transfer code.
- Notify the destination branch's managers (`InAppNotification`) when one is
  shipped, and the source when it is received.

Response:

```json
{
  "uuid": "…", "code": "TRF-0042",
  "item": { "uuid": "…", "name": "Liquid Detergent 20L", "unit": "L" },
  "quantity": 10,
  "fromBranch": { "uuid": "…", "name": "Bonapriso" },
  "toBranch": { "uuid": "…", "name": "Akwa" },
  "status": "IN_TRANSIT",
  "requestedBy": "Marcus Vance", "requestedAt": "2026-10-25T10:00:00",
  "receivedAt": null, "notes": "Akwa is short for the weekend"
}
```

## Suppliers

The item's `supplier` is a free string. Purchase orders need a proper list.

```
supplier(id, uuid, tenant_id, name, contact_name, phone, email, address,
         payment_terms, lead_time_days, active, notes, created_at)
```

`/inventory/suppliers`: `GET` (list, `search`), `POST`, `PATCH /{uuid}`,
`DELETE /{uuid}` (409 `supplier_has_orders` if it has purchase orders; offer
`active = false`). `InventoryItem` gets an optional `supplier_id`; keep the text
column for existing rows and return both (`supplier` as the name).

```json
{ "name": "ChemPro Douala", "contactName": "Aline Biya", "phone": "+237 6 77 00 11 22", "email": "orders@chempro.cm", "address": "Zone industrielle Bonabéri", "paymentTerms": "Net 30", "leadTimeDays": 5, "notes": "" }
```

## Purchase orders

```
purchase_order(id, uuid, code,                  -- PO-2026-0018, per-tenant sequence
               tenant_id, branch_id, supplier_id,
               status,    -- DRAFT, APPROVED, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
               expected_at DATE, notes, total,
               created_by, created_at, approved_by NULL, approved_at NULL,
               ordered_at NULL, received_at NULL, cancelled_by NULL, cancelled_at NULL)

purchase_order_line(id, purchase_order_id, item_id,
                    quantity, quantity_received DEFAULT 0, unit_cost)
```

| Method | Path | Purpose |
|---|---|---|
| POST | `/inventory/purchase-orders` | Create a draft |
| GET | `/inventory/purchase-orders` | List (`status`, `supplier`, `branch`, `from`, `to`) |
| GET | `/inventory/purchase-orders/{uuid}` | One order with lines |
| PATCH | `/inventory/purchase-orders/{uuid}` | Edit a draft (lines, supplier, date) |
| PATCH | `/inventory/purchase-orders/{uuid}/status` | Approve, mark ordered, cancel |
| POST | `/inventory/purchase-orders/{uuid}/receive` | Book received stock |
| POST | `/inventory/purchase-orders/suggest` | Reorder suggestion |

Create:

```json
{
  "supplier": "supplier-uuid",
  "branch": "branch-uuid",
  "expectedAt": "2026-10-30",
  "notes": "Monthly chemicals",
  "lines": [
    { "item": "item-uuid-1", "quantity": 40, "unitCost": 18500 },
    { "item": "item-uuid-2", "quantity": 200, "unitCost": 150 }
  ]
}
```

- Every line's item belongs to `branch`. `total = Σ quantity × unitCost`.
- Starts `DRAFT`. Only a draft can be edited.
- Status moves: `DRAFT → APPROVED → ORDERED`, and `CANCELLED` from any state
  before a receipt. Approval is the owner only (403 `owner_required`), or a
  manager when `total` is at or below the tenant's
  `po_auto_approve_limit`.
- A `DRAFT` created by a manager needs approval; the owner's drafts can be
  approved by the same call.

Receive:

```json
{
  "lines": [
    { "item": "item-uuid-1", "quantityReceived": 40, "unitCost": 18500, "batch": "LOT-2026-131", "expiresAt": "2027-09-30" },
    { "item": "item-uuid-2", "quantityReceived": 150 }
  ]
}
```

- Each line writes a `RECEIPT` movement (reference = the PO code) through the
  existing movement logic, so the weighted-average cost, batch and expiry are
  handled in one place.
- `quantity_received` is cumulative; received beyond the ordered quantity is
  rejected (409 `received_exceeds_ordered`).
- Status becomes `PARTIALLY_RECEIVED` or, when every line is complete,
  `RECEIVED`. Leaving the body out receives every line in full.
- Allowed only from `ORDERED` or `PARTIALLY_RECEIVED`.

Suggestion (`POST …/suggest { "branch": "uuid" }`) returns lines for every item
at or under its reorder level:
`quantity = max − available − already on open purchase orders`, rounded up to
the supplier's pack size if known, grouped by supplier.

```json
[
  { "supplier": { "uuid": "…", "name": "ChemPro Douala" },
    "lines": [ { "item": { "uuid": "…", "name": "Liquid Detergent 20L" }, "quantity": 60, "unitCost": 18500 } ] }
]
```

## Automatic usage from orders

`ServiceConsumption(material, amount, unit)` describes what one unit of a
service uses, but it is tied to a `Material` enum and not to inventory items,
so nothing is deducted today.

1. Replace `material` by an optional `inventory_item_id`, picked per branch (or
   a "material group" that resolves to the branch's item with that name).
2. When an order is created: `RESERVE` the estimated consumption
   (`amount × quantity` of each article line) for items that exist in the
   order's branch.
3. When the order leaves `WASHING` (or when the processing stage completes, see
   `03`): `USAGE` with `fromReserved = true` and the order number as the
   reference.
4. When an order is cancelled: `RELEASE` what was reserved.
5. If stock is insufficient, do not block the order. Create a low-stock
   notification and a floor event.

## Alerts (scheduled job, daily and after each movement)

- Item reaches `LOW`, `CRITICAL` or `OUT`: in-app notification for the
  branch's managers (once per level change, not on every movement).
- Expiring within 30 days and expired: one notification a day at most.
- These feed the dashboard's Supplies card and the attention list (`14`).

## Permissions

| Action | Owner | Manager / store manager | Front desk | Washer, others |
|---|---|---|---|---|
| Create, edit, delete items | ✓ | ✓ (own branch) | – | – |
| Add stock, record consumption | ✓ | ✓ | ✓ | ✓ |
| Adjust (≤ 20 %) | ✓ | ✓ | ✓ | – |
| Adjust (> 20 %) | ✓ | ✓ | – | – |
| Transfers | ✓ | ✓ | – | – |
| Purchase orders: create | ✓ | ✓ | – | – |
| Purchase orders: approve | ✓ | up to the limit | – | – |
| Receive purchase orders | ✓ | ✓ | ✓ | – |
| Suppliers | ✓ | ✓ | – | – |
