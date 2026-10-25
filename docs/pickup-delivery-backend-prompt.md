# Pickup & Delivery (Logistics): data the backend needs to persist

> **Mostly implemented.** Jobs, drivers, zones and settings exist in the backend. What is still missing is in `docs/backend/15-logistics-extensions.md`. Use that file.

The Pickup & Delivery page (`/pickup-delivery`, `src/pages/LogisticsPage.tsx`)
currently runs on in-memory sample data: jobs, drivers, zones, pricing and
analytics. Nothing survives a reload. This document lists what the backend must
store, with request/response JSON, so the page can switch to an API.

Conventions are the same as `/branch`, `/tenant` and `/subscription-plans`:

- Every response uses the `ApiResponse` envelope:
  `{ message, content, timestamp, status, isSuccess }`.
- The tenant is taken from the token.
- Lists are paged as `{ totalPages, totalElements, data }`.
- Enums are uppercase. Money is XAF (`BigDecimal`, no decimals). Times are
  ISO-8601 UTC.
- Every mutation returns the updated object in `content`.

---

## 1. Tables

### `dispatch_job`: one pickup or one delivery

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| uuid | uuid, unique | used in URLs |
| code | varchar, unique per tenant | `PCK-00042` / `DLV-00043`, generated |
| tenant_id | FK tenant | from token |
| branch_id | FK branch | the branch it leaves from / returns to |
| type | enum `PICKUP`, `DELIVERY` | |
| order_id | FK order, **nullable** | a pickup can be booked before the order exists |
| customer_id | FK customer, nullable | |
| customer_name | varchar | snapshot, required |
| customer_phone | varchar | snapshot, required |
| address | varchar | required |
| latitude / longitude | decimal, nullable | replaces the map's fake x/y |
| zone_id | FK delivery_zone | |
| instructions | text | gate code, call on arrival… |
| manifest | text | what is collected / delivered, e.g. "2 bags, 1 duvet" |
| packages | int, default 1 | |
| amount_due | decimal | to collect on delivery (0 if prepaid) |
| payment_status | enum `PREPAID`, `PAY_ON_DELIVERY`, `PAID`, `PARTIAL` | UI shows a badge from this |
| fee | decimal | delivery/pickup fee charged, computed at creation (see §5) |
| priority | enum `STANDARD`, `EXPRESS`, `FLEXIBLE` | |
| status | enum, see below | |
| driver_id | FK driver, nullable | |
| route_id | FK route, nullable | |
| stop_sequence | int, nullable | order within the route |
| scheduled_at | timestamp | required |
| ready_at | timestamp, nullable | deliveries: when the order became ready at the branch (drives "waiting too long", 240 min) |
| eta_min | int, nullable | updated while en route |
| distance_km | decimal | |
| completed_at | timestamp, nullable | |
| created_by, created_at, updated_at | | |

**JobStatus**: `REQUESTED`, `SCHEDULED`, `ASSIGNED`, `EN_ROUTE`, `ARRIVED`,
`DONE`, `RECEIVED`, `FAILED`, `CANCELLED`.

- Pickup flow: `REQUESTED` → `SCHEDULED` → `ASSIGNED` → `EN_ROUTE` → `DONE`
  (picked up) → `RECEIVED` (at branch).
- Delivery flow: `REQUESTED` (ready in staging) → `SCHEDULED` → `ASSIGNED` →
  `EN_ROUTE` → `DONE` (delivered).
- `FAILED` and `CANCELLED` are reachable from any open status. `DONE`,
  `RECEIVED`, `FAILED` and `CANCELLED` are closed.
- Reject transitions outside the flow with a 409.

### `dispatch_job_event`: the timeline shown in the job drawer

| Column | Type |
|---|---|
| id, job_id FK | |
| at | timestamp |
| status | JobStatus, nullable |
| text | varchar, e.g. "Assigned to Jean Mbarga", "Rescheduled to 14:00" |
| by_user_id | FK user |

Write one row on every change: create, assign, status change, reschedule,
proof, failure and cancel.

### `delivery_proof`: one per completed delivery

| Column | Type | Notes |
|---|---|---|
| job_id | FK, unique | |
| recipient | varchar | required |
| method | enum `OTP`, `SIGNATURE`, `PIN`, `PHOTO` | |
| photo_url / signature_url | varchar, nullable | file upload, for later |
| at | timestamp | |

### `delivery_failure`: one per failed attempt (keep history, not just the last)

| Column | Type |
|---|---|
| id, job_id FK | |
| reason | enum `CUSTOMER_UNAVAILABLE`, `INCORRECT_ADDRESS`, `CUSTOMER_REFUSED`, `UNREACHABLE`, `PAYMENT_ISSUE`, `ACCESS_PROBLEM`, `VEHICLE_PROBLEM`, `OTHER` |
| notes | text |
| next_action | enum `RESCHEDULE`, `RETURN_TO_BRANCH`, `CONTACT_CUSTOMER`, `CANCEL` |
| at | timestamp |

### `driver`: a delivery agent's logistics profile

Drivers are users with `userType = DELIVERY_AGENT`. This table adds what
logistics needs:

| Column | Type |
|---|---|
| id, uuid | |
| user_id | FK user, unique (name and phone come from the user) |
| branch_id | FK branch |
| vehicle | varchar, e.g. "Motorbike LT-482-AB" |
| status | enum `AVAILABLE`, `ON_ROUTE`, `BREAK`, `OFFLINE` |
| last_location | varchar / lat, lng, nullable |
| last_seen_at | timestamp |
| score | decimal 0–5, computed from on-time and failure rates |
| note | varchar |

### `route`: a driver's run of stops

| Column | Type |
|---|---|
| id, uuid, code | `RT-0025` |
| driver_id FK | |
| status | enum `PLANNED`, `IN_PROGRESS`, `COMPLETED` |
| started_at, completed_at | |
| stops_total, stops_done | maintained from the jobs |

### `delivery_zone`: zones and fees (currently hardcoded in `constants/logistics.ts`)

| Column | Type |
|---|---|
| id, uuid, tenant_id, branch_id | |
| name | varchar, unique per branch |
| delivery_fee | decimal |
| active | boolean |
| polygon / center lat, lng | optional |

### `logistics_settings`: one row per tenant (or branch)

```json
{
  "pickupFee": 500,
  "expressSurcharge": 1000,
  "sameDaySurcharge": 500,
  "freeDeliveryThreshold": 25000,
  "perKmBeyondZone": 150,
  "delayGraceMin": 15,
  "readyTooLongMin": 240
}
```

### `message_template` (optional, for the "Message customer" panel)

`id, tenant_id, text, active`. Sending is done through the notifications
module. Store only what was sent as a job event.

---

## 2. Requests the page will send

### Schedule a job: `POST /logistics/jobs`

```json
{
  "type": "PICKUP",
  "orderNumber": "ORD-10482",
  "customerName": "Amina Bello",
  "customerPhone": "+237 6 77 12 34 56",
  "address": "Rue Joss, Bonapriso",
  "latitude": null,
  "longitude": null,
  "zone": "zone-uuid",
  "manifest": "2 bags of shirts",
  "priority": "EXPRESS",
  "scheduledAt": "2026-10-20T13:00:00Z",
  "driver": "driver-uuid",
  "instructions": "Call on arrival",
  "packages": 1,
  "amountDue": 0,
  "paymentStatus": "PAY_ON_DELIVERY"
}
```

- `orderNumber`, `driver`, `latitude`, `longitude` and `instructions` are
  optional.
- Status starts as `ASSIGNED` if a driver is given, otherwise `SCHEDULED`.
- Generate `code`. Compute `fee` and `distanceKm`.
- Set `readyAt = now` for deliveries.
- Write the event "Scheduled".

### Assign jobs to a driver: `POST /logistics/jobs/assign`

```json
{ "jobs": ["job-uuid-1", "job-uuid-2"], "driver": "driver-uuid" }
```

`REQUESTED` and `SCHEDULED` jobs move to `ASSIGNED`. Increase the driver's
`stopsTotal`. Event: "Assigned to {driver}".

### Start a route: `POST /logistics/routes`

```json
{ "driver": "driver-uuid", "jobs": ["job-uuid-3", "job-uuid-1", "job-uuid-2"] }
```

The array order is the stop order (the UI's "optimize" puts express stops
first, then nearest-neighbour).

- Create the route.
- Set each job's `route`, `stopSequence`, `driver` and `EN_ROUTE`.
- Set the driver to `ON_ROUTE`, with `stopsDone = 0` and
  `stopsTotal = jobs.length`.
- Event: "Route started with {driver}".

### Move a job forward: `PATCH /logistics/jobs/{uuid}/status`

```json
{ "status": "ARRIVED" }
```

### Complete with proof: `POST /logistics/jobs/{uuid}/complete`

```json
{ "recipient": "Amina Bello", "method": "OTP", "otp": "4821" }
```

- Status becomes `DONE`.
- Save the proof and set `completedAt`.
- Increment the route's `stopsDone`.
- For a delivery, mark the order delivered. If `amountDue > 0`, record the
  payment.
- Event: "Delivered to {recipient} ({method})".

### Mark failed: `POST /logistics/jobs/{uuid}/fail`

```json
{ "reason": "CUSTOMER_UNAVAILABLE", "notes": "No answer at gate", "nextAction": "RESCHEDULE" }
```

Status becomes `FAILED`. Save a `delivery_failure` row. Event: "Attempt
failed: {reason}".

### Reschedule: `POST /logistics/jobs/{uuid}/reschedule`

```json
{ "scheduledAt": "2026-10-21T09:00:00Z", "notifyCustomer": true }
```

- Status goes back to `ASSIGNED` if the job has a driver, otherwise
  `SCHEDULED`.
- Clear `etaMin`.
- If `notifyCustomer` is true, send a notification.
- Event: "Rescheduled to {time}".

### Cancel (one or many): `POST /logistics/jobs/cancel`

```json
{ "jobs": ["job-uuid-1"], "reason": "Customer request" }
```

This cancels only the jobs, never the laundry order. It removes them from the
driver's route.

### Message the customer: `POST /logistics/jobs/{uuid}/message`

```json
{ "text": "Your laundry is on the way. Estimated arrival: 15 minutes.", "channel": "SMS" }
```

### Drivers

- `PATCH /logistics/drivers/{uuid}` with
  `{ "status": "BREAK", "note": "Lunch", "vehicle": "…" }`.
- `POST /logistics/drivers/{uuid}/location` with
  `{ "latitude": 4.03, "longitude": 9.70 }`, sent from the driver app.

### Zones and settings

`GET/POST/PATCH/DELETE /logistics/zones` with
`{ "name": "Akwa", "branch": "branch-uuid", "deliveryFee": 1500, "active": true }`.

`GET/PUT /logistics/settings` with the `logistics_settings` body shown in §1.

---

## 3. Reads the page needs

`GET /logistics/jobs?date=2026-10-20&branch=&type=&status=&zone=&priority=&driver=&search=&page=&size=`

`search` matches the code, order number, customer name and phone. The scan
dialog searches by job code or order number.

`GET /logistics/jobs/{uuid}` returns the job with its timeline, proof and
failures:

```json
{
  "uuid": "…",
  "code": "DLV-00043",
  "type": "DELIVERY",
  "orderNumber": "ORD-10482",
  "customer": { "uuid": "…", "name": "Amina Bello", "phone": "+237 6 77 12 34 56" },
  "address": "Rue Joss, Bonapriso",
  "latitude": 4.03,
  "longitude": 9.69,
  "zone": { "uuid": "…", "name": "Bonapriso" },
  "instructions": "Call on arrival",
  "manifest": "2 bags, 1 duvet",
  "packages": 3,
  "amountDue": 12500,
  "paymentStatus": "PAY_ON_DELIVERY",
  "fee": 1000,
  "priority": "STANDARD",
  "status": "EN_ROUTE",
  "driver": { "uuid": "…", "name": "Jean Mbarga", "phone": "+237 …" },
  "route": { "uuid": "…", "code": "RT-0025", "stopSequence": 2 },
  "scheduledAt": "2026-10-20T13:00:00Z",
  "readyAt": "2026-10-20T09:40:00Z",
  "etaMin": 12,
  "distanceKm": 3.1,
  "timeline": [{ "at": "2026-10-20T12:30:00Z", "status": "EN_ROUTE", "text": "Route started with Jean Mbarga", "by": "Marcus Vance" }],
  "proof": null,
  "failures": []
}
```

`GET /logistics/drivers?branch=` returns each driver with `uuid`, `name`,
`phone`, `vehicle`, `status`, `route` code, `location`, `stopsDone`,
`stopsTotal`, `etaMin`, `score` and `note`.

`GET /logistics/summary?date=&branch=` returns the KPI cards: active, delayed
(more than `delayGraceMin` past `scheduledAt`), failed, completed, ready at the
branch, unassigned, and waiting too long.

`GET /logistics/analytics?from=&to=&branch=` returns what the page currently
hardcodes:

```json
{
  "daily": [{ "day": "2026-10-14", "pickups": 22, "deliveries": 27, "onTimePct": 93 }],
  "zones": [{ "zone": "Akwa", "deliveries": 112, "failed": 4, "avgMin": 22, "avgKm": 4.4, "drivers": 3 }],
  "costs": { "revenue": 412000, "driverCost": 186000, "fuelEstimate": 74000, "kilometres": 1240, "jobs": 430 }
}
```

All of these are computed from `dispatch_job`, `dispatch_job_event` and
`delivery_failure`. Nothing needs to be stored separately.

---

## 4. Links to other modules

- **Orders:** when an order becomes ready and its customer chose delivery,
  create (or offer to create) a `DELIVERY` job with `readyAt` set. When a pickup
  reaches `RECEIVED`, the order can move to "received at branch".
- **Payments:** cash collected on delivery creates a payment on the order.
- **Notifications:** schedule, en route, reschedule, delivered and failed send
  customer notifications.

## 5. Fee calculation (server-side, stored on the job)

- Base: `pickupFee` for a pickup, the zone's `deliveryFee` for a delivery.
- Add `expressSurcharge` if the priority is `EXPRESS`.
- Add `sameDaySurcharge` if the job is scheduled the same day.
- Add `perKmBeyondZone` for each km beyond the zone.
- The delivery fee is 0 when the order total is at least
  `freeDeliveryThreshold`.

## 6. Permissions

| Role | Can do |
|---|---|
| Owner, manager, store manager | Everything, plus zones and settings |
| Front desk | Schedule, assign, reschedule, cancel, message |
| Delivery agent | Reads only their own jobs; can move them `EN_ROUTE` / `ARRIVED`, complete with proof, mark failed, and send their location |
