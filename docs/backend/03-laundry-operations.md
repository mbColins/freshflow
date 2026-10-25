# 03. Laundry Operations (the floor)

Priority P1. Status: **Missing**.

## What the screen does

`pages/OperationsPage.tsx` is the production-floor board. All of it runs on
`constants/sampleOperations.ts`:

- A queue of **jobs**, one per order being processed, with a stage, whether it
  is being worked on right now, the staff member, the machine, how long it has
  been in the stage, the due time, express or normal, pickup or delivery,
  special instructions, how many items were counted at intake and how many were
  found later, the weight after washing, QC failures and whether the customer
  was told it is ready.
- Eight stages: `RECEIVED`, `SORTING`, `WASHING`, `DRYING`, `IRONING`, `QC`,
  `PACKAGING`, `READY`. Table and kanban views.
- Actions: advance to the next stage (asking for a machine when the stage needs
  one), move to any stage (with a confirmation when it skips or goes
  backwards), assign staff, record a QC result (pass, or fail and send back to
  washing or ironing), notify the customer, scan an order.
- KPIs, a capacity panel (machines against the queue), stage-time statistics,
  kilograms finished per two-hour block, an overall health badge, a "my work"
  view for floor staff, and a live timeline of floor events.

## What the backend has

Only `WorkflowStatusLog` (order, status, time, user, delay reason), written but
not readable. The `Status` enum has `RECEIVED, WASHING, DRYING, IRONING, QA,
READY, HANDOVER, COMPLETED, CANCELLED`: no sorting or packaging stage, no
queue, no machine or staff assignment.

## Design

Keep the order's `status` as the customer-facing state (`02`) and add a
**processing job** that tracks the detailed floor state. The two are kept in
step by the server:

| Floor stage | `orders.status` |
|---|---|
| `RECEIVED`, `SORTING` | `RECEIVED` |
| `WASHING` | `WASHING` |
| `DRYING` | `DRYING` |
| `IRONING` | `IRONING` |
| `QC`, `PACKAGING` | `QA` |
| `READY` | `READY` |

(`HANDOVER`, `COMPLETED`, `CANCELLED` stay with the order and the logistics
module.)

```
processing_job(id, uuid, tenant_id, branch_id, order_id UNIQUE,
               stage,                 -- RECEIVED, SORTING, WASHING, DRYING, IRONING, QC, PACKAGING, READY
               active BOOLEAN,        -- being worked on now, vs waiting in the queue
               staff_id NULL, machine_id NULL,
               stage_started_at,
               items_expected INT,    -- Σ article line quantity, set at intake
               items_found INT NULL,  -- counted again before packaging
               weight_kg NULL, post_wash_kg NULL,
               instructions JSON,     -- ["Delicate cycle", "No tumble dry"]
               qc_failures INT DEFAULT 0,
               customer_notified BOOLEAN, customer_notified_at NULL,
               created_at, updated_at)

processing_stage_log(id, job_id, stage, staff_id NULL, machine_id NULL,
                     started_at, ended_at NULL, duration_min NULL,
                     outcome)         -- COMPLETED, SENT_BACK, SKIPPED
```

A job is created automatically when an order is created (stage `RECEIVED`).
`instructions` come from the order's `handling_instructions` and any
`STAINED`/`DAMAGED` article line.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/operations/jobs` | The queue |
| GET | `/operations/jobs/{orderNumber}` | One job with its history |
| POST | `/operations/jobs/{orderNumber}/start` | Start work on the current stage |
| POST | `/operations/jobs/{orderNumber}/advance` | Finish the stage, move to the next |
| POST | `/operations/jobs/{orderNumber}/move` | Move to any stage |
| PATCH | `/operations/jobs/{orderNumber}/assign` | Change the staff member |
| PATCH | `/operations/jobs/{orderNumber}/counts` | Record items found and post-wash weight |
| POST | `/operations/jobs/{orderNumber}/notify-customer` | Tell the customer it is ready |
| POST | `/order/{orderNumber}/quality-check` | QC result (defined in `02`) |
| GET | `/operations/summary` | KPIs, health, capacity, statistics |
| GET | `/operations/events` | Recent floor events |
| GET | `/events/stream` | SSE (README, block D) |

### The queue: `GET /operations/jobs`

Params: `branch`, `stage`, `staff` (user uuid), `service`, `method`
(`PICKUP`, `DELIVERY`), `view` (`DELAYED`, `EXPRESS`, `WAITING`, `SPECIAL`),
`search` (order number, customer), `page`, `size`.

`view` definitions: `DELAYED` = `due_at` has passed and the job isn't `READY`;
`EXPRESS` = order priority `EXPRESS`; `WAITING` = `active = false` and stage not
`READY`; `SPECIAL` = has instructions or a QC failure.

```json
{
  "order": "ORD-10452",
  "customer": "John Doe",
  "service": "Wash & Fold",
  "items": 8,
  "itemsFound": 8,
  "weightKg": 4.2,
  "postWashKg": null,
  "stage": "WASHING",
  "active": true,
  "staff": { "uuid": "…", "name": "Elena Rostova" },
  "machine": { "uuid": "…", "code": "WM-002", "name": "Washer 2" },
  "stageSince": "2026-10-25T09:05:00",
  "dueAt": "2026-10-25T17:00:00",
  "priority": "NORMAL",
  "method": "PICKUP",
  "instructions": ["Delicate cycle"],
  "qcFailures": 0,
  "customerNotified": false,
  "delayed": false,
  "history": [
    { "at": "2026-10-25T09:05:00", "text": "Started washing on WM-002", "by": "Elena Rostova" }
  ]
}
```

`history` is only filled for the single-job read.

### Start: `POST …/start`

```json
{ "staff": "user-uuid", "machine": "machine-uuid" }
```

- `machine` is required for stages that use one (`WASHING`, `DRYING`,
  `IRONING`; `SORTING`, `QC`, `PACKAGING` don't).
- The machine must be in the job's branch, `AVAILABLE`, of a suitable
  `MachineType` for the stage (washing machine, dryer, press or ironing
  machine), and `capacityKg ≥ weightKg` (409 `machine_unsuitable`,
  `machine_busy`, `machine_over_capacity`).
- Starting calls the machine job logic of `04` (the machine becomes `RUNNING`
  with this order), sets `active = true`, writes a `processing_stage_log` row
  and a floor event.
- `staff` must be an active user working that day; default to the caller.

### Advance: `POST …/advance`

```json
{ "note": "Cycle finished, 4.0 kg after washing", "postWashKg": 4.0 }
```

- Closes the current `processing_stage_log` row (`COMPLETED`), releases the
  machine (`04` completes its job), moves to the next stage with
  `active = false` (waiting in that stage's queue), sets `stage_started_at`,
  updates `orders.status` using the mapping above, and writes the order
  timeline (`02`).
- `postWashKg` is only read after `WASHING`.
- `QC → PACKAGING` is only allowed through `quality-check` with `PASSED`.
- `PACKAGING → READY` requires `itemsFound = itemsExpected` (409
  `item_count_mismatch`). A manager can force it with `"resolution":
  "Customer confirmed one item left behind"`, recorded in the history.
- Reaching `READY` triggers the `ORDER_READY` message to the customer through
  the dispatcher (set `customer_notified` from the result).

### Move: `POST …/move`

```json
{ "stage": "WASHING", "reason": "Wrong cycle used" }
```

Used for the drag-and-drop on the kanban board. Rules:

- One step forward: allowed for anyone who may process.
- Skipping forward, going backwards, or `→ READY` without QC: manager or owner
  only (403 `manager_required`), and `reason` is required.
- Going backwards logs the old stage with outcome `SENT_BACK` and releases the
  machine.

### Counts: `PATCH …/counts`

```json
{ "itemsFound": 7, "postWashKg": 3.9 }
```

Writes the values and a history line. A difference from `itemsExpected` raises
a floor event of severity warning ("Item count mismatch").

### Notify: `POST …/notify-customer`

```json
{ "channel": "SMS" }
```

Sends `ORDER_READY` for pickup or `ORDER_OUT_FOR_DELIVERY` as appropriate and
returns the `message_log` entry. If the customer has no consent for the channel,
409 `no_consent`.

## Summary: `GET /operations/summary?branch=`

```json
{
  "asOf": "2026-10-25T10:45:00",
  "health": "WARNING",
  "healthReason": "3 jobs are past their due time",
  "kpis": {
    "inQueue": 41, "inProgress": 12, "delayed": 3, "express": 5,
    "readyToday": 18, "waitingTooLong": 2
  },
  "stages": [
    { "stage": "WASHING", "waiting": 6, "active": 4, "avgMinutes": 47 }
  ],
  "capacity": [
    { "machineType": "WASHING_MACHINE", "machines": 8, "running": 5, "available": 2, "down": 1, "queuedKg": 120, "capacityKg": 320 }
  ],
  "kgByBlock": [
    { "from": "08:00", "to": "10:00", "kg": 64 }
  ]
}
```

- `avgMinutes` per stage is the mean `duration_min` of
  `processing_stage_log` rows closed in the last 7 days.
- `kgByBlock` is the weight of jobs that reached `READY` today, per two-hour
  block.
- `health`: `CRITICAL` if delayed jobs ≥ 20 % of open jobs or any express job
  is overdue by more than 60 minutes; `WARNING` if ≥ 10 % or a machine is
  `FAULT`; otherwise `GOOD`. The thresholds are tenant settings with these
  defaults.

## Floor events

`GET /operations/events?since=&limit=` returns the day's timeline:
`{ at, text, by, order, type, alert }`. They are produced by the same code
paths as above (start, advance, move, QC, mismatch, machine fault, customer
notified), so no extra writes are needed. The SSE stream pushes new ones.

## Permissions

| Action | Owner / manager | Floor staff (washer, dry cleaner, staff member) | Front desk |
|---|---|---|---|
| See the queue | ✓ | ✓ | ✓ |
| Start, advance (their stage) | ✓ | ✓ | – |
| Move out of order, force a stage | ✓ | – | – |
| QC | ✓ | QC staff only | – |
| Notify customer | ✓ | – | ✓ |
| See the summary and capacity | ✓ | – | – |

## Links

- `02`: status mapping, QC, timeline.
- `04`: machine jobs are started and completed from here.
- `06`: staff attendance decides who can be assigned.
- `14`: the dashboard pipeline, attention feed and event stream read this module.
