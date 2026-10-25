# 16. Services: statistics, promotions on a service, audit trail, import

Priority P2. Status: **Partial**.

## What the screens do

`ServicesPage` and `ServiceDetailPage` are connected to `/service`: code,
name, category, description, icon, status and reason, pricing model, base
price, min and max quantity, item prices, standard hours, express settings,
workflow stages, machines, staff skill, consumption, add-ons, options,
visibility, available days and hours, daily capacity, includes, and per-branch
availability with a price override.

Three parts are still local (`hooks/useServices.ts`: "promotions and the local
audit trail stay in the cached list until it reloads"):

| Part | Today |
|---|---|
| **Statistics** on the detail page: orders, revenue, growth %, average hours, satisfaction, quality pass %, reprocess rate, late rate, complaints, current load, and the 12-month order and revenue series | Computed in the browser from sample numbers; the backend returns nothing |
| **Promotions** attached to a service (name, type, value, dates) | Kept in the browser |
| **Audit trail** ("price changed from 1500 to 1800", "status changed") | Built in the browser by `withAudit` and lost on reload |
| **Import** a service list from a file and **export** | The button says "needs an agreed file format and an import endpoint" |

## 1. Statistics: `GET /service/{uuid}/stats` and `GET /service/stats`

Computed from orders and processing data. Nothing is stored.

`GET /service/{uuid}/stats?branch=&months=12`

```json
{
  "asOf": "2026-10-25T10:45:00",
  "orders": 412,
  "revenue": 7416000,
  "growthPercent": 12.4,
  "averageHours": 5.2,
  "satisfaction": 4.6,
  "qualityPass": 96.5,
  "reprocessRate": 3.5,
  "lateRate": 6.1,
  "complaints": 4,
  "currentLoad": 38,
  "capacityUnit": "kg",
  "monthlyOrders":  [30, 34, 36, 40, 38, 41, 44, 47, 50, 52, 55, 61],
  "monthlyRevenue": [540000, 610000, 648000, 720000, 684000, 738000, 792000, 846000, 900000, 936000, 990000, 1098000]
}
```

Definitions (period = this month unless `months` is used for the series):

| Field | Rule |
|---|---|
| `orders`, `revenue` | Order article lines for this service on orders in scope and period (`Σ lineTotal`, orders not cancelled) |
| `growthPercent` | `revenue` vs the same period last month, rounded to one decimal; `null` if last month is 0 |
| `averageHours` | Mean of (`completed_at − created_at`) of orders containing only this service in the period, in hours; from the stage log (`03`) when it exists |
| `satisfaction` | Mean customer rating of orders with this service, `null` until ratings are collected (see below) |
| `qualityPass` | Orders passing QC the first time ÷ orders QC'd (`02`) |
| `reprocessRate` | 100 − `qualityPass` |
| `lateRate` | Completed after `promisedDate` ÷ completed |
| `complaints` | Complaints linked to the service (see below) |
| `currentLoad` | In the unit of `capacityUnit`: Σ open orders' quantity (kg, items, pieces) for this service waiting or in process now; the page compares it with `dailyCapacity` |
| `monthlyOrders`, `monthlyRevenue` | The last 12 months, oldest first, including the current month so far |

`GET /service/stats?branch=` returns the same numbers for every service in one
call (the services list uses `orders`, `revenue`, `growthPercent`, and
`currentLoad`), with only the headline fields and no series. Cache for a minute.

### Ratings and complaints

Two measures need data the system doesn't collect yet:

```
order_rating(id, order_id UNIQUE, customer_id, stars,   -- 1..5
             comment NULL, created_at)

complaint(id, uuid, tenant_id, branch_id, order_id NULL, service_id NULL,
          customer_id NULL, category, description,
          status,   -- OPEN, INVESTIGATING, RESOLVED, REJECTED
          resolution NULL, created_by, created_at, resolved_at NULL)
```

- `POST /order/{orderNumber}/rating { "stars": 5, "comment": "…" }`: for the
  customer (a link in the "order completed" message, using a signed token, no
  login), or staff on the customer's behalf. One per order.
- `POST /complaints`, `GET /complaints?status=&service=`, `PATCH
  /complaints/{uuid}`: small CRUD for front desk and managers.
- Until these exist, return `null` for `satisfaction` and `0` for `complaints`;
  the page already tolerates them.

## 2. Promotions on a service

Do not build a second promotion system. Service promotions are the general
promotions module (`11`) filtered to this service:

- `GET /service/{uuid}/promotions` = `GET /promotions?service=<uuid>&status=ACTIVE,SCHEDULED`
  (return the fields the page shows: name, type, value text, from, to).
- The "Create promotion" button on the service detail should open the
  promotions builder pre-filled with this service (`services: [uuid]`), and
  save through `POST /promotions`.
- The type labels the service page uses (`Percentage discount`, `Fixed
  discount`, `Buy X get Y`, `Free service`, `Free delivery`) map to
  `PERCENTAGE`, `FIXED`, `BUNDLE`, `FIXED` with value = the service price, and
  `FREE_DELIVERY`. Add a `BUY_X_GET_Y` type to `11` (fields `buyQuantity`,
  `getQuantity`) if that offer is wanted; otherwise remove it from the UI.

## 3. Audit trail

Use the shared audit log (README, A) with `entityType = SERVICE`:

- Write an entry from `OfferingService` for every change: price, status,
  availability per branch, branch price override, express settings, capacity,
  workflow, visibility, delete and restore. The `summary` is the sentence the
  page shows ("Base price 1500 → 1800"); `before` and `after` carry the
  values.
- `GET /service/{uuid}/audit?page=&size=` = `GET /audit?entityType=SERVICE&entity=<uuid>`,
  newest first:

```json
{ "at": "2026-10-20T09:12:00", "by": "Marcus Vance", "change": "Base price", "from": "1500", "to": "1800" }
```

- Entries are immutable (no update or delete endpoint). Keep them after the
  service is archived.
- The same entry feeds the price history of `09` when the change is a price.

## 4. Import and export

### Export: `GET /service/export?format=csv&branch=`

Returns a CSV with one row per service and these columns (header row
included, UTF-8 with BOM so spreadsheets open it correctly):

```
code,name,category,description,status,pricingModel,basePrice,minQty,maxQty,standardHours,
expressEnabled,expressSurchargePercent,visibility,dailyCapacity,capacityUnit,branches
```

Item prices as a second file (`format=csv&part=items`):
`serviceCode,item,price,expressPrice`. Respect the caller's scope; needs
`SERVICES:VIEW`.

### Import: `POST /service/import`

`multipart/form-data`: `file` (the same CSV), `mode` (`CREATE_ONLY`,
`UPDATE_ONLY`, `UPSERT`), `dryRun` (boolean).

- Match on `code` within the tenant.
- Validate the whole file first (required fields, enum values, numbers ≥ 0,
  `maxQty ≥ minQty`, duplicate codes in the file). Nothing is written if any row
  is invalid.
- `dryRun=true` returns the report without writing.
- New services are created `DRAFT` unless `status` is given.
- Writes one audit entry per created or changed service (`source: IMPORT`).
- Response:

```json
{ "created": 8, "updated": 3, "unchanged": 1, "errors": [ { "row": 12, "field": "pricingModel", "message": "invalid_pricing_model" } ] }
```

Needs `SERVICES:CREATE` (and `EDIT` when `mode` updates). The price-only import
in `09` stays separate: it changes prices with a reason and history.

## 5. Small gaps in the existing endpoints

| Gap | Change |
|---|---|
| Delete or archive a service in use | `DELETE /service/{uuid}` should refuse when orders reference it (409 `service_in_use`) and offer `PATCH …/status { "status": "INACTIVE", "reason": "…" }` instead. Return `orderCount` in the error |
| Status change with a reason | `statusReason` is required when status goes to `INACTIVE` or `UNAVAILABLE` (400 `reason_required`) and written to the audit log |
| Duplicate a service | `POST /service/{uuid}/duplicate { "name": "…", "code": null }` copies everything as a `DRAFT` with a new code; no history, stats or promotions are copied |
| Category list | `GET /service/categories` returns the categories in use plus the defaults, so the page doesn't keep custom categories in `localStorage` (`services.categories`). `POST /service/categories { "name": "Leather care" }` adds one for the tenant |
| `GET /service` filters | Also `status`, `category`, `branch`, `pricingModel`, `processing` (`SAME_DAY`, `DAY`, `LONGER` from `standardHours`), `express` (`YES`, `NO`), `visibility` |

## Permissions

| Action | Owner | Manager | Front desk | Others |
|---|---|---|---|---|
| View services and statistics | ✓ | ✓ | ✓ (no statistics) | – |
| Create, edit, duplicate | ✓ | ✓ (their branch settings only) | – | – |
| Delete, import | ✓ | – | – | – |
| Export | ✓ | ✓ | – | – |
| View audit trail | ✓ | ✓ | – | – |
