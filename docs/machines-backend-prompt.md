# Machines API: backend implementation prompt

> **Superseded.** The backend now has the machine profile (`/machines`) with a different shape. The runtime parts (status, jobs, faults, maintenance, transfers) are specified in `docs/backend/04-machines-runtime.md`. Use that file.

Implement the Machines module for the eazy laundry platform (Spring Boot). The
frontend already has the full Machines UI (list, detail, wizard, faults,
maintenance, jobs, transfers, retire) running on in-memory sample data; this
API replaces that store. Follow the conventions already used by `/branch`,
`/tenant` and `/subscription-plans`.

## Conventions (same as the existing modules)

- Every response is wrapped in the usual envelope:
  `{ "message", "content", "timestamp", "status", "isSuccess" }`.
- Machines are addressed by `uuid` in paths. `code` (e.g. `WM-015`) is the
  human reference, unique per tenant.
- The tenant is derived from the token. Never trust a tenant sent in the body.
  A machine's `branch` must belong to the caller's tenant.
- Lists are paged as `{ "totalPages", "totalElements", "data": [...] }` with
  zero-based `page`, `size`, plus `search` and filter params.
- Create returns the created machine in `content`. Please don't return a bare
  status string, because the UI navigates to the new machine. PATCH takes any
  subset of fields.
- Money is XAF as `BigDecimal` with no decimals. Dates are `YYYY-MM-DD`.
  Timestamps are ISO-8601 UTC.
- The "by" fields (`reportedBy`, `operator`, activity `by`) come from the
  authenticated user (display name), not from the request.

## Enums

```
MachineType:   WASHING_MACHINE, DRYER, PRESS, IRONING_MACHINE, STEAM_MACHINE,
               FOLDING_MACHINE, PACKAGING_MACHINE, OTHER
MachineStatus: RUNNING, AVAILABLE, IDLE, MAINTENANCE, FAULT, OFFLINE, RETIRED
FaultSeverity: LOW, MEDIUM, HIGH, CRITICAL
FaultStatus:   OPEN, IN_PROGRESS, RESOLVED
MaintenanceStatus: SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED
JobPriority:   NORMAL, HIGH
```

## 1. Create machine: `POST /machines`

`MachineRequest` (the same body is used for PATCH, with every field optional):

```json
{
  "code": "WM-015",
  "name": "Washer 15",
  "type": "WASHING_MACHINE",
  "manufacturer": "EcoWash",
  "model": "Pro 40kg",
  "serialNumber": "EW-40-2025-0153",
  "yearPurchased": 2025,
  "description": "Front-loading industrial washer",
  "branch": "7f3c2a10-5b1e-4d8a-9c2f-1a2b3c4d5e6f",
  "area": "Washing Area",
  "zone": "Row B",
  "specs": {
    "capacityKg": 40,
    "powerKw": 12,
    "waterL": 150,
    "voltage": 380,
    "maxTemp": 90,
    "cycleMin": 45,
    "warrantyEnd": "2027-06-30"
  },
  "capabilities": ["Wash", "Heavy Wash", "Hot Water", "Spin", "Eco Mode"],
  "purchaseCost": 4500000,
  "maintenanceEveryDays": 30
}
```

Validation (400 with a readable `message`):
- `name`, `manufacturer`, `branch` and `type` are required. `capabilities` must
  have at least one entry.
- `code` must match `^[A-Z]{2,3}-\d{3,}$` and be unique per tenant (409 if
  taken). If `code` is omitted, generate the next one from the type prefix
  (WM, DR, PR, IR, ST, FM, PK, EQ), e.g. `WM-016`.
- `specs.capacityKg > 0` and `specs.cycleMin > 0`.
- `warrantyEnd` is optional (null = out of warranty).

On create, set status `AVAILABLE` and every counter to 0. Set
`nextMaintenanceAt = today + maintenanceEveryDays` and
`energyPerCycle = powerKw * cycleMin / 60`. Add the activity entry
"Machine registered".

`PATCH /machines/{uuid}` edits the profile. `branch` is ignored here because
transfers have their own endpoint. Add the activity entry
"Machine details edited".

## 2. Read machines

`GET /machines?page=0&size=20&search=&branch=&type=&status=&manufacturer=`
(search matches name, code, serial, model), returning `MachineResponse` items.

`GET /machines/{uuid}` returns one `MachineResponse` with its histories:

```json
{
  "uuid": "a1b2c3d4-...",
  "code": "WM-015",
  "name": "Washer 15",
  "type": "WASHING_MACHINE",
  "manufacturer": "EcoWash",
  "model": "Pro 40kg",
  "serialNumber": "EW-40-2025-0153",
  "yearPurchased": 2025,
  "description": "Front-loading industrial washer",
  "branch": { "uuid": "7f3c2a10-...", "name": "Bonapriso" },
  "area": "Washing Area",
  "zone": "Row B",
  "specs": { "capacityKg": 40, "powerKw": 12, "waterL": 150, "voltage": 380, "maxTemp": 90, "cycleMin": 45, "warrantyEnd": "2027-06-30" },
  "capabilities": ["Wash", "Heavy Wash", "Hot Water", "Spin", "Eco Mode"],
  "purchaseCost": 4500000,
  "maintenanceEveryDays": 30,

  "status": "RUNNING",
  "statusNote": "",
  "job": {
    "orderId": "ORD-10482",
    "customer": "Hôtel La Falaise",
    "service": "Wash & Fold",
    "loadKg": 32,
    "cycle": "Standard cycle",
    "progress": 40,
    "remainingMin": 27,
    "operator": "Jean Mbarga",
    "temperature": 45,
    "paused": false,
    "startedAt": "2026-10-20T08:12:00Z"
  },
  "queue": [
    { "id": "q-1", "orderId": "ORD-10490", "service": "Heavy Wash", "loadKg": 20, "durationMin": 45, "priority": "HIGH" }
  ],

  "runtimeTodayMin": 312,
  "cyclesToday": 6,
  "totalCycles": 4821,
  "utilization": 72,
  "availability": 96,
  "efficiency": 88,
  "downtimePct": 4,
  "avgCycleMin": 47,
  "energyKwh": 1840,
  "waterUsedL": 21500,
  "energyPerCycle": 9.0,
  "lastMaintenanceAt": "2026-09-28",
  "nextMaintenanceAt": "2026-10-28",
  "technician": "Paul Ndzi",
  "costs": { "maintenance": 85000, "repairs": 120000, "operating": 40000, "energy": 230000 },
  "revenue": 1650000,

  "maintenanceLog": [
    { "id": "mt-uuid", "date": "2026-10-28", "time": "09:00", "type": "Preventive Maintenance", "technician": "Paul Ndzi", "durationMin": 90, "cost": 25000, "description": "Bearings and seals", "status": "SCHEDULED" }
  ],
  "faults": [
    { "id": "f-uuid", "type": "Mechanical Failure", "severity": "HIGH", "reportedAt": "2026-10-19T14:02:00Z", "reportedBy": "Sarah Mbarga", "description": "Drum noise", "technician": "Paul Ndzi", "downtimeMin": 120, "status": "RESOLVED", "resolution": "Bearing replaced" }
  ],
  "activity": [
    { "at": "2026-10-20T08:12:00Z", "text": "Order assigned and cycle started", "by": "Jean Mbarga", "orderId": "ORD-10482" }
  ],
  "transfers": [
    { "at": "2026-08-01T10:00:00Z", "from": { "uuid": "...", "name": "Akwa" }, "to": { "uuid": "...", "name": "Bonapriso" }, "reason": "Rebalancing", "by": "Marcus Vance" }
  ]
}
```

The list endpoint may omit `maintenanceLog`, `faults`, `activity` and
`transfers` for speed. It must still include `job`, `queue`, the metrics,
`nextMaintenanceAt` and one `openFault` flag or summary. Paginate the histories
later if they grow (`GET /machines/{uuid}/activity?page=`).

Metrics (`utilization`, `availability`, `efficiency`, `downtimePct`, energy and
water use) are computed server-side from job and fault history: today's figures
for the "today" fields, and this month's figures for energy, water and costs.

## 3. Status: `POST /machines/{uuid}/status`

```json
{ "status": "OFFLINE", "note": "Marked unavailable" }
```

Only `AVAILABLE` and `OFFLINE` can be set by hand. Reject the request if a job
is running. Log "Marked unavailable" or "Marked available".

## 4. Jobs

**Assign:** `POST /machines/{uuid}/jobs`

```json
{ "orderId": "ORD-10490", "customer": "Amina Bello", "service": "Heavy Wash", "loadKg": 20, "priority": "NORMAL" }
```

- The machine must be operational (not `FAULT`, `MAINTENANCE`, `OFFLINE` or
  `RETIRED`), and `loadKg` must not exceed `specs.capacityKg`. Otherwise return
  409.
- If there is no current job, start one: status `RUNNING`, `progress 0`,
  `remainingMin = cycleMin`, `operator` set to the caller, and `temperature` at
  half of `maxTemp` for heated types (washer, dryer, press, ironing, steam),
  otherwise null.
- If a job is running, enqueue it. `HIGH` goes to the front, `NORMAL` to the
  back. `durationMin = cycleMin`.
- Customer defaults to "Walk-in customer". Ideally validate `orderId` against
  orders.

**Pause or resume:** `POST /machines/{uuid}/job/pause` and `/job/resume`.

**Stop:** `POST /machines/{uuid}/job/stop`. This clears the job and sets the
status to `AVAILABLE`. Log "Cycle stopped at N%". The order needs reassigning.

**Complete:** `POST /machines/{uuid}/job/complete`, called by the machine or
operator. Increment the cycles and runtime, then start the next queued job if
there is one.

**Queue:** `PUT /machines/{uuid}/queue` with `{ "order": ["q-2","q-1"] }`
reorders it, and `DELETE /machines/{uuid}/queue/{queueId}` removes an entry.

## 5. Faults

**Report:** `POST /machines/{uuid}/faults`

```json
{ "type": "Electrical Failure", "severity": "CRITICAL", "description": "Breaker trips on spin", "technician": "Paul Ndzi", "downtimeMin": 180 }
```

The fault starts as `IN_PROGRESS` if a technician is given, otherwise `OPEN`. A
`HIGH` or `CRITICAL` fault sets the machine to `FAULT` with the description as
`statusNote` and stops the current job. `LOW` and `MEDIUM` faults are logged
without stopping the machine.

**Resolve:** `POST /machines/{uuid}/faults/{faultId}/resolve`

```json
{ "resolution": "Replaced contactor" }
```

When the last unresolved fault closes and the status is `FAULT`, set the status
to `AVAILABLE`. Add the repair cost to `costs.repairs` if you track it.

## 6. Maintenance

**Schedule:** `POST /machines/{uuid}/maintenance`

```json
{ "date": "2026-10-28", "time": "09:00", "type": "Preventive Maintenance", "technician": "Paul Ndzi", "durationMin": 90, "cost": 25000, "description": "Bearings and seals" }
```

The entry starts as `SCHEDULED`. Set the machine `technician`, and set
`nextMaintenanceAt` to the earliest `SCHEDULED` or `OVERDUE` date.

**Complete:** `POST /machines/{uuid}/maintenance/{entryId}/complete`. Set the
status to `COMPLETED` and `date` and `lastMaintenanceAt` to today. Add `cost`
to `costs.maintenance`. Set `nextMaintenanceAt` to the earliest pending date,
or `today + maintenanceEveryDays`. If the machine was `MAINTENANCE`, set it to
`AVAILABLE`.

**Cancel:** `POST /machines/{uuid}/maintenance/{entryId}/cancel` sets the
status to `CANCELLED`. This isn't allowed while `IN_PROGRESS`.

Add a daily job that sets `SCHEDULED` entries in the past to `OVERDUE`.

## 7. Transfer: `POST /machines/{uuid}/transfer`

```json
{ "branch": "uuid-of-target-branch", "reason": "Rebalancing capacity" }
```

The target must be another branch of the same tenant, and the machine must have
no running job. Append a transfer record and log
"Transferred from A to B".

## 8. Retire: `POST /machines/{uuid}/retire`

```json
{ "reason": "End of life", "condition": "Poor" }
```

Set the status to `RETIRED` with the note
`Retired: <reason> (final condition: <condition>)` and clear the queue. A
retired machine refuses jobs, transfers and edits, and it stays in history.
Prefer this over DELETE. If you do add `DELETE /machines/{uuid}`, allow it only
for machines with no cycles.

## 9. Dropdown: `GET /machines/dropdown?branch=&type=`

Returns `[{ "uuid", "code", "name", "type", "status", "capacityKg" }]`, used by
the order assignment picker.

## Permissions

Owner, manager and store manager can create, edit, transfer and retire
machines. Staff (front desk, washer, dry cleaner) can assign jobs,
pause/resume/stop them, report faults and complete maintenance. Everyone in the
tenant can read.

## Every mutation

- Appends an `activity` entry `{ at, text, by, orderId? }`.
- Returns the updated `MachineResponse` in `content`, so the UI can refresh
  without a second GET.
