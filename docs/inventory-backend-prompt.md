# Stock management: request and response JSON

> **Superseded.** The backend now has inventory items and stock movements with different movement types. Transfers, purchase orders and the other gaps are in `docs/backend/05-inventory-transfers-purchasing.md`. Use that file.

The Inventory page (`src/pages/InventoryPage.tsx`) still runs on sample data.
This document lists what it sends and needs back, so the backend can store it.

Conventions are the same as the other modules:

- Every response is wrapped in the `ApiResponse` envelope.
- Items are addressed by `uuid` in paths.
- Lists are paged as `{ totalPages, totalElements, data }` with `filter`,
  `search`, `page` and `size`.
- The tenant comes from the token.
- Stock is kept **per branch**. A branch user works on their own branch; a
  tenant owner passes `branch=<uuid>`.
- Quantities are decimals, in the item's unit (e.g. 2.5 L).
- Money is XAF.

---

## 1. Inventory item: `POST /inventory/items`, `PATCH /inventory/items/{uuid}`

```json
{
  "sku": "CHEM-DET-020",
  "name": "Liquid Detergent 20L",
  "category": "LAUNDRY_CHEMICALS",
  "description": "Concentrated detergent for washers",
  "unit": "L",
  "branch": "7f3c2a10-5b1e-4d8a-9c2f-1a2b3c4d5e6f",
  "location": "Store room A, shelf 2",
  "openingStock": 40,
  "reorderLevel": 15,
  "safetyStock": 8,
  "maxStock": 120,
  "unitCost": 18500,
  "supplier": "ChemPro Douala",
  "batch": "LOT-2026-114",
  "expiresAt": "2027-06-30",
  "services": ["service-uuid-1", "service-uuid-2"]
}
```

| Field | Rules |
|---|---|
| `sku` | Unique per tenant. Generated when left out. |
| `name`, `unit`, `branch` | Required. |
| `category` | `LAUNDRY_CHEMICALS`, `PACKAGING`, `CLEANING_SUPPLIES`, `SPARE_PARTS` or `CONSUMABLES`. |
| `unit` | `PIECE`, `BOTTLE`, `L`, `KG`, `G`, `BOX`, `PACK`, `ROLL`, `METER` or `BAG`. |
| `openingStock` | Create only. If above 0, write a `STOCK_RECEIVED` movement with the reference `Opening stock`. |
| `reorderLevel`, `safetyStock`, `maxStock` | Must satisfy `0 ≤ safety ≤ reorder ≤ max`. |
| `expiresAt` | Optional `yyyy-MM-dd`. |
| `services` | Services that can't run without this item. Optional. |

PATCH changes any of these fields **except stock**. Stock only changes through
movements (§2).

### Item response (also what `GET /inventory/items?branch=&category=&status=&search=` returns per row)

```json
{
  "uuid": "…",
  "sku": "CHEM-DET-020",
  "name": "Liquid Detergent 20L",
  "category": "LAUNDRY_CHEMICALS",
  "description": "…",
  "unit": "L",
  "branch": { "uuid": "…", "name": "Bonapriso" },
  "location": "Store room A, shelf 2",
  "stock": 34.5,
  "reserved": 6,
  "reorderLevel": 15,
  "safetyStock": 8,
  "maxStock": 120,
  "unitCost": 18500,
  "supplier": "ChemPro Douala",
  "dailyUse": 2.4,
  "batch": "LOT-2026-114",
  "expiresAt": "2027-06-30",
  "lastMovementAt": "2026-10-21T16:05:00",
  "services": [{ "uuid": "…", "name": "Wash & Fold" }],
  "status": "HEALTHY"
}
```

- **`dailyUse`:** the average daily consumption over the last 30 days,
  computed from the movements. The UI uses it for the "runs out in N days"
  forecast.
- **`status`:** computed by the backend, checked in this order:
  1. `EXPIRED`
  2. `OUT` (stock is 0)
  3. `CRITICAL` (at or below safety stock)
  4. `LOW` (at or below the reorder level)
  5. `EXPIRING` (within 30 days of expiry)
  6. `OVERSTOCKED` (above the maximum)
  7. otherwise `HEALTHY`

---

## 2. Stock movement: `POST /inventory/movements`

This one endpoint covers the page's three actions: **Add Stock**, **Record
Consumption** and **Adjust Stock**.

```json
{
  "item": "item-uuid",
  "type": "CONSUMPTION",
  "quantity": 2.5,
  "reason": "Laundry processing",
  "reference": "ORD-10521",
  "unitCost": null,
  "batch": null,
  "expiresAt": null,
  "notes": "Washer W02 morning load"
}
```

| `type` | Used by | `quantity` means | Stock change |
|---|---|---|---|
| `STOCK_RECEIVED` | Add Stock | units received (> 0) | `+quantity` |
| `CONSUMPTION` | Record Consumption, reason Laundry processing / Cleaning / Maintenance | units used (> 0) | `−quantity` |
| `DAMAGE` | Record Consumption, reason Damaged | units lost (> 0) | `−quantity` |
| `EXPIRY` | Record Consumption, reason Expired | units lost (> 0) | `−quantity` |
| `LOSS` | Record Consumption, reason Lost | units lost (> 0) | `−quantity` |
| `ADJUSTMENT` | Adjust Stock | **the counted quantity**, i.e. the new stock level (≥ 0) | `quantity − current stock` |

Rules:

- **Not enough stock:** reject an outgoing movement larger than the available
  stock with 409 `insufficient_stock`.
- **Adjustments:**
  - `reason` is required. Allowed values: Stock count correction, Damage,
    Loss, Theft, Expiry, Data correction, Other.
  - A change bigger than **20 %** of the current stock needs a manager or the
    owner. Reject anyone else with 403 `adjustment_needs_approval`.
- **Receiving stock:**
  - `unitCost`, `batch` and `expiresAt` are optional.
  - When given, they update the item's latest unit cost, batch and expiry.
- **`reference`:** free text, e.g. an order number, PO number or invoice.

### Movement response (also each row of `GET /inventory/movements?item=&type=&from=&to=&branch=`)

```json
{
  "uuid": "…",
  "at": "2026-10-21T16:05:00",
  "item": { "uuid": "…", "sku": "CHEM-DET-020", "name": "Liquid Detergent 20L", "unit": "L" },
  "type": "CONSUMPTION",
  "change": -2.5,
  "before": 37,
  "after": 34.5,
  "reason": "Laundry processing",
  "reference": "ORD-10521",
  "user": "Jean Mbarga"
}
```

`change` is signed: negative means stock left.

---

## 3. Transfer between branches

### Request a transfer: `POST /inventory/transfers`

```json
{
  "item": "item-uuid",
  "quantity": 10,
  "fromBranch": "branch-uuid-A",
  "toBranch": "branch-uuid-B",
  "notes": "Akwa is short for the weekend"
}
```

- The status starts at `IN_TRANSIT`.
- It immediately writes a `TRANSFER` movement of `−quantity` on the
  `fromBranch` stock.
- It fails with 409 `insufficient_stock` if the source doesn't have enough.

### Receive it: `PATCH /inventory/transfers/{uuid}/receive`

No request body.

- The status becomes `RECEIVED`.
- It writes a `TRANSFER` movement of `+quantity` on the `toBranch` stock. If
  the item doesn't exist there yet, it creates the item with the same SKU.

### Cancel it: `PATCH /inventory/transfers/{uuid}/cancel`

Only while the transfer is `IN_TRANSIT`. It puts the stock back on the source
branch.

### Transfer response

```json
{
  "uuid": "…",
  "code": "TRF-0042",
  "item": { "uuid": "…", "name": "Liquid Detergent 20L", "unit": "L" },
  "quantity": 10,
  "fromBranch": { "uuid": "…", "name": "Bonapriso" },
  "toBranch": { "uuid": "…", "name": "Akwa" },
  "status": "IN_TRANSIT",
  "requestedBy": "Marcus Vance",
  "requestedAt": "2026-10-21T10:00:00",
  "receivedAt": null
}
```

The status is one of `REQUESTED`, `IN_TRANSIT`, `RECEIVED` or `CANCELLED`.

---

## 4. Purchase order

### Create it: `POST /inventory/purchase-orders`

```json
{
  "supplier": "ChemPro Douala",
  "branch": "branch-uuid",
  "expectedAt": "2026-10-28",
  "notes": "Monthly chemicals",
  "lines": [
    { "item": "item-uuid-1", "quantity": 40, "unitCost": 18500 },
    { "item": "item-uuid-2", "quantity": 200, "unitCost": 150 }
  ]
}
```

The status starts at `DRAFT`, and `total` is the sum of `quantity × unitCost`.

### Change its status: `PATCH /inventory/purchase-orders/{uuid}/status`

```json
{ "status": "APPROVED" }
```

Allowed moves:

- `DRAFT` → `APPROVED` → `ORDERED`
- `CANCELLED` from any status before the PO is received

### Receive it: `POST /inventory/purchase-orders/{uuid}/receive`

```json
{
  "lines": [
    { "item": "item-uuid-1", "quantityReceived": 40, "unitCost": 18500, "batch": "LOT-2026-131", "expiresAt": "2027-09-30" },
    { "item": "item-uuid-2", "quantityReceived": 150 }
  ]
}
```

- Each line writes a `STOCK_RECEIVED` movement, with the PO code as its
  `reference`.
- When every line has been fully received, the status becomes `RECEIVED`.
  Otherwise it becomes `PARTIALLY_RECEIVED`.
- Leaving the body out receives everything that was ordered.

### Purchase order response

```json
{
  "uuid": "…",
  "code": "PO-2026-0018",
  "supplier": "ChemPro Douala",
  "branch": { "uuid": "…", "name": "Bonapriso" },
  "status": "ORDERED",
  "createdAt": "2026-10-21T09:00:00",
  "expectedAt": "2026-10-28",
  "createdBy": "Marcus Vance",
  "total": 770000,
  "lines": [
    { "item": { "uuid": "…", "name": "Liquid Detergent 20L", "unit": "L" }, "quantity": 40, "received": 0, "unitCost": 18500 }
  ]
}
```

---

## 5. Who can do what

| Action | Owner | Manager / store manager | Front desk, washer, other staff |
|---|---|---|---|
| Create or edit items | ✓ | ✓ (their branch) | – |
| Add stock, record consumption | ✓ | ✓ | ✓ |
| Adjust stock (≤ 20 %) | ✓ | ✓ | ✓ |
| Adjust stock (> 20 %), transfers, purchase orders | ✓ | ✓ | – |
| Approve purchase orders | ✓ | – | – |
