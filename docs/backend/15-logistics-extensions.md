# 15. Pickup and delivery: what the job record still lacks

Priority P2. Status: **Partial**.

## What the screen does

`pages/LogisticsPage.tsx` is connected to `/logistics/jobs`, `/jobs/{id}/assign`,
`/jobs/{id}/status`, `/logistics/drivers`, `/delivery-zones` and
`/logistics/settings/{branch}`. Parts of it still work around gaps:

| Action | Today |
|---|---|
| **Reschedule** a failed or scheduled job to a new time | The status endpoint only takes `status` and `note`, so the new time is written into the timeline note and `scheduledAt` doesn't change (`LogisticsPage.tsx:484`) |
| **Proof of delivery** (who received it, how verified) | Packed into the status note as text, and read back by pattern |
| **Failure details** (reason, notes, next action) | Packed into the status note as text |
| **Cancel with a reason** | Note only |
| Change **priority** of a job | No endpoint, so the page hides the bulk action |
| **Message the customer** ("on the way, 15 minutes") | Not connected |
| **Packages**, **distance**, **ETA** | Not stored; the page shows `1`, `0`, `—` |
| **Routes** (a driver's ordered list of stops) | Not stored; "Create Route" assigns each stop and starts it one by one |
| Map pins | The page spreads jobs around a drawn map by zone, because jobs and drivers have coordinates only when someone sets them |
| **Analytics** (volume per day, on-time rate, cost) | Hardcoded sample figures |
| Link between the **order** and the **job** | The job keeps an `orderNumber` string; neither side updates the other |

## What the backend has

`DispatchJob` (type, order number, customer name and phone, address,
coordinates, zone, manifest, amount due, fee, priority, status, driver,
instructions, scheduled and ready times), `DispatchJobEvent` (status, note,
actor, time), transitions `SCHEDULED → ASSIGNED → EN_ROUTE → ARRIVED →
COMPLETED` with `FAILED` and `CANCELLED`, and `FAILED → SCHEDULED`.
Drivers with status, location and score. Zones and settings.

## 1. Edit a job, including reschedule

`PATCH /logistics/jobs/{jobId}`

```json
{
  "scheduledAt": "2026-10-26T09:00:00",
  "priority": "EXPRESS",
  "address": "Rue Joss, Bonapriso",
  "latitude": 4.0302,
  "longitude": 9.6911,
  "instructions": "Call on arrival",
  "manifest": "2 bags and a duvet",
  "packages": 3,
  "amountDue": 12500
}
```

All fields optional; only those sent change.

Rules:

- Allowed while the job is `SCHEDULED`, `ASSIGNED` or `FAILED` (409
  `job_not_editable` otherwise). `scheduledAt` must be in the future.
- Changing `priority` or the address recomputes `fee` (same rules as creation:
  zone fee plus express or same-day surcharge, free above the threshold).
- Each change writes a timeline event with a readable note
  ("Rescheduled from 14:00 to 09:00 on 26 Oct").
- Rescheduling a `FAILED` job: send `scheduledAt` together with
  `PATCH …/status { "status": "SCHEDULED" }`, or accept the shortcut
  `POST /logistics/jobs/{jobId}/reschedule { "scheduledAt": "…", "notifyCustomer": true }`
  that does both in one transaction (status back to `SCHEDULED`, driver kept as
  *preferred* but cleared from the job as it is today, event written, customer
  notified when `notifyCustomer`).
- Bulk priority change for the table's bulk action:
  `PATCH /logistics/jobs/priority { "jobs": ["…"], "priority": "EXPRESS" }`, all
  or none.

## 2. Structured proof and failure

Extend the status call so the page doesn't have to encode text:

`PATCH /logistics/jobs/{jobId}/status`

```json
{ "status": "COMPLETED", "note": null,
  "proof": { "recipient": "Amina Bello", "method": "OTP", "reference": "4821" } }
```

```json
{ "status": "FAILED", "note": "Gate was closed",
  "failure": { "reason": "CUSTOMER_UNAVAILABLE", "nextAction": "RESCHEDULE" } }
```

```
delivery_proof(job_id UNIQUE, recipient, method,   -- OTP, SIGNATURE, PIN, PHOTO
               reference NULL, photo_url NULL, signature_url NULL, at)

delivery_failure(id, job_id, reason,   -- CUSTOMER_UNAVAILABLE, INCORRECT_ADDRESS, CUSTOMER_REFUSED,
                                       -- UNREACHABLE, PAYMENT_ISSUE, ACCESS_PROBLEM, VEHICLE_PROBLEM, OTHER
                 notes, next_action,   -- RESCHEDULE, RETURN_TO_BRANCH, CONTACT_CUSTOMER, CANCEL
                 at, by)
```

- `COMPLETED` requires `proof` for deliveries (400 `proof_required`); a pickup
  doesn't. `method = OTP` verifies against a code sent to the customer when
  the job went `EN_ROUTE` (generate a 4-digit code with the dispatcher's
  `DELIVERY_OTP` event; 403 `invalid_otp` on mismatch). Photo and signature
  uploads: `POST /logistics/jobs/{jobId}/proof-file` (`multipart`, png or jpeg,
  max 2 MB) returns the URL to put in `proof`.
- `FAILED` requires `failure.reason` and `nextAction`. Keep every failed
  attempt (not just the last).
- `nextAction = CANCEL` also cancels the job; `RETURN_TO_BRANCH` leaves it
  `FAILED` with a flag so the branch sees it needs collecting.
- The job response gains `proof` and `failures`, and the events carry the
  structured data too.

Cancel with a reason: `PATCH …/status { "status": "CANCELLED", "note": "Customer request" }`
already works; make `note` required for `CANCELLED` (400 `reason_required`)
and add a bulk form `POST /logistics/jobs/cancel { "jobs": [...], "reason": "…" }`
(each job is cancelled independently; the response lists the ones refused).

## 3. Money and order links

When a job reaches `COMPLETED`:

- **Delivery:** the order status becomes `COMPLETED` if its balance is 0, or
  stays `HANDOVER` with `amountDue` still to collect. If `amountDue > 0`,
  accept `{ "collected": { "amount": 12500, "method": "CASH" } }` and create a
  `payment` (`01`) tagged with the job and the driver as cashier, attached to
  the driver's cash handling (count it in the branch's cash session when the
  driver hands the cash over: `POST /cash-sessions/{uuid}/adjustments`).
- **Pickup:** the order moves to `RECEIVED` at the branch when the job is
  `COMPLETED` and the driver hands the items over (a second step: the branch
  confirms with `PATCH /logistics/jobs/{jobId}/received`, which writes the
  intake count into the order's article lines, `02`).
- A `COMPLETED` delivery sends the customer a thank-you message and, with
  loyalty on, awards points (`08`).

Create the job from the order: when an order's `deliveryOptions` is `DELIVERY`
and it reaches `READY`, create the `DispatchJob` automatically (address and
coordinates from the order, `readyAt` = now, `amountDue` = the balance) unless
one already exists. Likewise a pickup request creates a pickup job. Store the
`order_id` foreign key on the job (keep `orderNumber` for display).

## 4. Packages, distance, ETA, routes

Add to `dispatch_job`: `packages INT DEFAULT 1`, `distance_km DECIMAL NULL`,
`eta_minutes INT NULL`, `sequence INT NULL`, `route_id NULL`.

```
dispatch_route(id, uuid, tenant_id, branch_id, driver_id, code,     -- RT-0025
               status,            -- PLANNED, IN_PROGRESS, COMPLETED
               started_at NULL, completed_at NULL, created_by, created_at)
```

- `POST /logistics/routes`

```json
{ "driver": "driver-uuid", "jobs": ["job-uuid-3", "job-uuid-1", "job-uuid-2"] }
```

  The array order is the stop order. In one transaction: create the route; set
  each job's `route`, `sequence` and driver (assigning the unassigned ones),
  move them to `EN_ROUTE` when `start: true` is sent (default `false`: a
  planned route); set the driver `ON_ROUTE`. Rules: every job in the driver's
  branch and `SCHEDULED` or `ASSIGNED`; a driver can have one active route
  (409 `driver_busy`).
- `GET /logistics/routes?driver=&status=&date=`, `GET /logistics/routes/{uuid}`
  (with ordered stops), `PATCH /logistics/routes/{uuid}/start`,
  `/complete`.
- Completing the last stop completes the route and sets the driver
  `AVAILABLE`.
- `distance_km`: straight-line (haversine) from the branch to the job's
  coordinates when both are known; allow a driver or a routing service to
  overwrite it. `eta_minutes`: estimated from the driver's location and the
  stops before it (assume an average speed from tenant settings), refreshed
  whenever the driver's location is reported.
- The job response includes `packages`, `distanceKm`, `etaMinutes`, `route {
  code, sequence }`.
- Optimise the stop order on request:
  `POST /logistics/routes/optimize { "jobs": [...], "start": "branch" }`
  returns the suggested order (express first, then nearest neighbour; the
  frontend has this logic in `utils/logistics.ts` and can keep it until a
  routing service is available).

## 5. Messages to the customer

`POST /logistics/jobs/{jobId}/message`

```json
{ "template": "ON_THE_WAY", "channel": "SMS", "text": null }
```

Templates: `ON_THE_WAY` ("Your laundry is on the way. Estimated arrival: %eta%
minutes."), `PICKUP_SCHEDULED`, `RESCHEDULED`, `FAILED_ATTEMPT`. Uses the
dispatcher (`12`); a custom `text` is allowed for managers. Also send these
automatically at the matching status changes, controlled by the tenant's
rules. Returns the `message_log` entry.

## 6. Analytics

`GET /logistics/analytics?from=&to=&branch=`

```json
{
  "daily": [ { "date": "2026-10-19", "pickups": 22, "deliveries": 27, "onTimePercent": 93 } ],
  "zones": [ { "zone": { "uuid": "…", "name": "Akwa" }, "jobs": 112, "failed": 4, "averageMinutes": 22, "averageKm": 4.4, "drivers": 3 } ],
  "drivers": [ { "driver": { "uuid": "…", "name": "Jean Mbarga" }, "completed": 31, "failed": 1, "onTimePercent": 96, "averageMinutes": 24 } ],
  "costs": { "revenue": 412000, "driverCost": 186000, "fuelEstimate": 74000, "kilometres": 1240, "jobs": 430 }
}
```

- `onTimePercent`: jobs completed at or before `scheduledAt + delayLimitMinutes`.
- `averageMinutes`: `EN_ROUTE → COMPLETED` from the events.
- `revenue`: Σ `fee` of completed jobs. `driverCost`: Σ driver pay, from a new
  per-driver `rate_per_job` (add to `driver`) or the tenant's average;
  `fuelEstimate`: `kilometres × fuelCostPerKm` (tenant setting).
- `zones[].averageKm` needs `distance_km`; return `null` until stored.

This replaces the hardcoded `WEEKLY_VOLUME`, `COST_SUMMARY` and the zone
statistics the page used to fake.

## 7. Coordinates for the map

The page draws an illustrative map. A real map needs coordinates on every job
and driver:

- Geocode the address when a job is created without coordinates (use the
  configured geocoding provider; store the result; leave `null` and flag
  `geocodeFailed` on failure rather than blocking).
- Zones: add optional `centerLatitude`, `centerLongitude` and `radiusKm` to
  `DeliveryZone` so jobs without coordinates can be placed at the zone centre.
- Drivers already report `latitude`/`longitude`; stream updates on the SSE feed
  (`/events/stream`, event `DRIVER_LOCATION`) so the map moves without
  polling.

## Permissions

| Action | Owner | Manager | Front desk | Driver |
|---|---|---|---|---|
| Create, edit, reschedule, cancel jobs | ✓ | ✓ | ✓ | – |
| Assign, create routes | ✓ | ✓ | ✓ | – |
| Move own jobs (`EN_ROUTE`, `ARRIVED`), complete with proof, fail | ✓ | ✓ | – | ✓ (own jobs only) |
| Message the customer | ✓ | ✓ | ✓ | ✓ (templates only) |
| Analytics | ✓ | ✓ | – | – |
