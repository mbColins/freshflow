# 14. Dashboard aggregates

Priority P1. Status: **Partial**.

## What the screen does

`pages/DashboardPage.tsx` shows cards. Which of them are real:

| Card | Component | State |
|---|---|---|
| Revenue & Cashflow Overview | `RevenueChart` | **Connected** (`GET /dashboard/revenue`) |
| Laundry Orders table | `OrdersTable` | **Connected** (`GET /order`) |
| Order Distribution (donut) | `OrderDistribution` | Backend ready (`GET /dashboard/orders/distribution`), UI not connected |
| KPI strip (6 tiles) | `KpiStrip` | Sample data |
| Live Laundry Operations Pipeline | `OperationsPipeline` | Sample data |
| Needs Attention & Escalations | `NeedsAttention` | Sample data |
| Pickup & Delivery Logistics | `LogisticsCard` | Sample data |
| Equipment telemetry | `EquipmentTelemetry` | Sample data |
| Chemical & Supplies Stock | `SupplyStock` | Sample data |
| Staff & Shift QA Metrics | `StaffMetrics` | Sample data |
| AI Plant Insights | `InsightsCard` | Sample data |
| Event stream | `EventStream` | Sample data |

The dashboard is scoped like the order list: a branch user sees their branch, a
tenant owner sees every branch and can narrow to one with `?branch=<uuid>`
(the picker already exists in the top bar of the page). The sections shown
depend on the user type (see `components/dashboard/dashboardState.ts`).

## Design

Do not build one giant call. One small endpoint per card, so a slow card
doesn't block the others and each can be cached for a few seconds. All of them:

- are under `/api/v1/dashboard`
- take the optional `branch` (uuid) and resolve the scope with the same
  `resolveScope` that `DashboardService` uses for revenue
- return `asOf` (server time)
- are read-only and need the `DASHBOARD:VIEW` permission (`07`); each also
  requires the permission of what it shows (e.g. supplies need `INVENTORY:VIEW`)

Build most of them from the tables the other specs create. Until those exist,
the cards that need them can return data built from what is there (noted per
card).

## 1. KPI strip: `GET /dashboard/kpis`

```json
{
  "asOf": "2026-10-25T10:45:00",
  "currency": "XAF",
  "totalOrders":   { "value": 1248, "previous": 1106, "changePercent": 12.8, "compareTo": "YESTERDAY", "trend": [38, 42, 40, 47, 45, 52, 50, 56, 54, 60, 63, 68] },
  "revenue":       { "value": 4850000, "previous": 4474000, "changePercent": 8.4, "compareTo": "PREVIOUS_CYCLE", "trend": [30, 34, 33, 38, 41, 39, 44, 47, 46, 51, 53, 57] },
  "pending":       { "value": 86, "urgent": 12, "trend": [60, 58, 62, 57, 55, 59, 54, 52, 56, 51, 49, 50] },
  "completed":     { "value": 1042, "onTimePercent": 94.2, "trend": [] },
  "customers":     { "value": 2438, "newToday": 18, "trend": [] },
  "averageTicket": { "value": 18500, "previous": 17930, "changePercent": 3.2, "compareTo": "PREVIOUS_WEEK", "trend": [] }
}
```

Definitions (period = `period` param: `TODAY` (default), `WEEK`, `MONTH`):

- `totalOrders`: orders created in the period; `previous` = the previous period
  of the same length. `trend` = 12 evenly spaced buckets across the period
  (counts).
- `revenue`: `Σ payment.amount` received in the period (`01`; until payments
  exist, `Σ amountPaid` of orders created in the period, as the revenue chart
  does today).
- `pending`: orders not `COMPLETED` or `CANCELLED`; `urgent` = those with
  priority `EXPRESS` or past their promised date.
- `completed`: orders completed in the period; `onTimePercent` = completed on or
  before `promisedDate` ÷ completed.
- `customers`: all active customers in scope; `newToday` = registered today.
- `averageTicket`: `Σ totalPrice ÷ orders` over completed orders in the period;
  compare with the previous week.
- `changePercent` rounded to one decimal, `null` when `previous` is 0.
- The `trend` arrays are only for the sparkline; return up to 12 numbers.

## 2. Order distribution: `GET /dashboard/orders/distribution`

Exists. The UI just needs to call it. (Stage ids are the order `Status` names.)

## 3. Pipeline: `GET /dashboard/pipeline`

The seven tiles in "Live Laundry Operations Pipeline". Requires the floor
module (`03`); until then, count orders by `status`.

```json
{
  "asOf": "2026-10-25T10:45:00",
  "inFlight": 281,
  "plantSpeedKgPerHour": 32,
  "stages": [
    { "id": "RECEIVED", "count": 14, "share": 12, "load": 35, "items": 82, "averageWaitMinutes": 25, "detail": "82 items · ~25m wait" },
    { "id": "WASHING",  "count": 32, "share": 18, "load": 80, "items": 194, "machinesBusy": 8, "machinesTotal": 10, "detail": "194 items · 8 washers" }
  ]
}
```

- `count`: active orders (or processing jobs) in the stage. `share` as in the
  distribution (largest remainder, sums to 100).
- `load`: 0–100, the stage's utilisation: for machine stages, running machines
  ÷ machines available (`04`); for others, `count ÷ staff on duty for that
  department ÷ staffDailyCapacity`.
- `items`: Σ article line quantities of those orders.
- `averageWaitMinutes`: from `processing_stage_log` (`03`).
- `plantSpeedKgPerHour`: kg that reached `READY` in the last 3 hours ÷ 3.
- The frontend builds the `detail` text itself from the numbers; return it only
  as a convenience.
- Clicking a stage filters the orders table by that stage (client side).

## 4. Needs attention: `GET /dashboard/attention?limit=8`

A prioritised list of things a manager should act on. Built by rules, from the
other modules:

| Rule | Severity | Action offered |
|---|---|---|
| Order past its due time (more than 60 minutes: critical) | `CRITICAL` / `WARNING` | View order |
| Unpaid orders waiting for collection (count and total) | `WARNING` | Send reminder (`01`) |
| Machine in `FAULT` or with an overdue maintenance | `CRITICAL` | Open machine |
| Order failed QC | `WARNING` | Open order / re-wash |
| Item at `CRITICAL` or `OUT` stock | `WARNING` | Create purchase order (`05`) |
| Failed delivery job | `WARNING` | Open job |
| Open payment exception | `WARNING` | Open exception |
| Customer plan or platform subscription expiring | `WARNING` | Open |

```json
[
  {
    "id": "ORDER_OVERDUE:ORD-10428",
    "severity": "CRITICAL",
    "kind": "ORDER_OVERDUE",
    "title": "Order #ORD-10428 is 2h overdue (Hospital Linen)",
    "body": "Scheduled for 08:00 AM delivery. Client: St. Jude Clinic.",
    "action": { "label": "View Order", "to": "/orders?order=ORD-10428" },
    "since": "2026-10-25T08:00:00",
    "branch": { "uuid": "…", "name": "Bonapriso" }
  }
]
```

- Sorted critical first, then oldest `since`.
- `id` is stable (kind + subject) so the UI can remember what a user dismissed.
- Dismissal: `POST /dashboard/attention/{id}/dismiss` stores
  `(user, id, until)`; a dismissed item stays hidden for 24 hours or until its
  condition changes.
- `count` header: `GET` returns `{ "total": 14, "items": [...] }`.

## 5. Logistics card: `GET /dashboard/logistics`

```json
{
  "asOf": "2026-10-25T10:45:00",
  "pickups": 18, "deliveries": 24, "inTransit": 7, "delivered": 15,
  "activeRuns": 3,
  "vehicles": [
    { "driver": { "uuid": "…", "name": "Carlos M." }, "vehicle": "Motorbike LT-482-AB", "status": "ON_ROUTE",
      "latitude": 4.0511, "longitude": 9.7679, "locationUpdatedAt": "2026-10-25T10:44:00",
      "stopsDone": 3, "stopsTotal": 9, "currentStop": "Akwa North", "etaMinutes": 8 }
  ]
}
```

- Counts are today's `dispatch_job` rows: `pickups` / `deliveries` by type,
  `inTransit` = `EN_ROUTE` + `ARRIVED`, `delivered` = `COMPLETED` deliveries.
- `activeRuns` = drivers with status `ON_ROUTE`.
- `vehicles` come from `driver` (position from `PATCH …/location`), stops from
  their open jobs, ETA from `15` once it is stored.

## 6. Equipment: `GET /dashboard/equipment?limit=8`

```json
{
  "asOf": "…",
  "summary": { "running": 14, "available": 12, "fault": 3, "maintenance": 3 },
  "machines": [
    { "uuid": "…", "code": "WM-001", "name": "Washer #01 (EcoWash 40kg)", "type": "WASHING_MACHINE",
      "status": "RUNNING", "detail": "Cotton cycle · 34m left", "remainingMinutes": 34, "loadPercent": 92 }
  ]
}
```

From `04`. Order: faults first, then maintenance, then running (longest remaining
first), then the rest. `loadPercent` = job `loadKg ÷ capacityKg × 100`.

## 7. Supplies: `GET /dashboard/supplies?limit=6`

```json
{
  "asOf": "…",
  "critical": 2,
  "items": [
    { "uuid": "…", "name": "Industrial Detergent EcoClean", "stock": 18, "max": 50, "unit": "L", "level": "LOW", "daysLeft": 6 }
  ]
}
```

From the inventory items that already exist: the lowest `available ÷ max`
first, with `level` as the item already reports it (`OK`, `LOW`, `CRITICAL`,
`OUT`). The UI draws the bar from `stock ÷ max`.

## 8. Staff metrics: `GET /dashboard/staff?limit=6`

```json
{
  "asOf": "…",
  "shift": { "name": "Day", "from": "07:00", "to": "15:00" },
  "staff": [
    { "user": { "uuid": "…", "name": "Marcus Vance", "role": "Operations Lead" },
      "headline": { "label": "QA", "value": 99.2, "unit": "%" },
      "note": "14 orders audited" }
  ]
}
```

- Today's best performers on duty, from `06` (`performance.*` and today's task
  counts), with the headline chosen by role: QA pass rate for floor staff,
  on-time rate for drivers, orders handled for front desk.
- The shift name comes from the branch's operating hours (split into day and
  evening if the branch defines them).
- Visible to managers and the owner only.

## 9. Insights: `GET /dashboard/insights`

The card is labelled "AI Plant Insights", but it needs no AI model for a first
version: compute a few facts and phrase them with templates.

```json
[
  { "id": "TOP_SERVICE", "icon": "CHART_PIE",
    "title": "Wash & Fold generated 42% of this month's revenue (XAF 2.1M)",
    "body": "Hotel contracts raised the average load by 18.5%." },
  { "id": "PEAK_WINDOW", "icon": "CLOCK",
    "title": "Peak counter intake window: 10:00 – 12:00",
    "body": "Averaging 34 orders per hour." }
]
```

Candidates and how to compute them (this month, scoped):

| Id | Fact |
|---|---|
| `TOP_SERVICE` | Service with the largest share of revenue |
| `PEAK_WINDOW` | Two-hour window with the most orders created |
| `PAYMENT_MIX` | Mobile Money share this month vs last month |
| `TURNAROUND` | Average created → completed time vs last month |
| `STOCK_RUNWAY` | Item with the fewest days left |
| `MACHINE_DOWNTIME` | Machine with the most downtime this month |

Return the top three or four that have enough data, each with the numbers that
back it (`values` object) so the UI can translate the sentence. Use the
tenant's language for the text. If an LLM is added later, keep the same
response shape.

## 10. Events: `GET /dashboard/events?limit=20` and SSE

The same feed as the operations floor timeline (`03`), widened to payments,
logistics and stock:

```json
{ "at": "2026-10-25T10:42:00", "type": "ORDER_STARTED", "title": "Order #ORD-10452 started wash cycle",
  "body": "Elena R. assigned the 40kg drum in Washer #02.", "alert": false,
  "related": { "kind": "ORDER", "id": "ORD-10452" } }
```

Sources: stage changes, payments received, drivers leaving or finishing runs,
low-stock alerts, shift handovers, machine faults. `alert: true` for faults,
failures and low stock. `GET /events/stream` pushes new ones.

## Caching and cost

- Each endpoint computes from indexed columns (`created_at`, `status`,
  `branch_id`); add composite indexes `(branch_id, status)` and
  `(branch_id, created_at)` on `orders`, `dispatch_job`, `payment`.
- Cache responses per (tenant, branch, user scope) for 15–30 seconds.
- The page refreshes on demand ("Refresh dashboard" button) and every 60
  seconds; the SSE stream covers the event card.

## Also: remove the "Dashboard state preview" switch

`Normal / Skeleton / Empty / Error` on the dashboard is a layout preview tool.
Once the cards call these endpoints, loading, empty and error states come from
the real requests, so that switch can go. (Frontend change, listed here so it
isn't forgotten.)
