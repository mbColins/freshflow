# 04. Machines: runtime state, jobs, faults, maintenance

Priority P1. Status: **Partial** (the profile exists).

## What the screens do

The Machines list and detail pages (`MachinesPage`, `MachineDetailPage`,
`components/machines/*`) run on `constants/sampleMachines.ts` and an in-memory
store (`hooks/useMachines.ts`). They show and change:

- **Status:** running, available, idle, maintenance, fault, offline, retired,
  with a note.
- **Current job** (order, customer, service, load kg, cycle, progress %,
  remaining minutes, operator, temperature, paused) and a **queue** of waiting
  jobs with priority.
- **Metrics:** runtime today, cycles today and in total, utilisation,
  availability, efficiency, downtime %, average cycle, energy and water used,
  energy per cycle, revenue, costs (maintenance, repairs, operating, energy).
- **Maintenance:** a log (scheduled, in progress, completed, overdue,
  cancelled), last and next maintenance date, technician.
- **Faults:** a log with type, severity, description, technician, downtime,
  resolution.
- **Activity and transfers** between branches.
- Actions: assign a job, pause, resume, stop, reorder or remove queue entries,
  report a fault, resolve a fault, schedule or complete or cancel maintenance,
  mark offline or available, transfer to another branch, retire, edit details.

## What the backend has

`/machines` (create, read, list, `branch`, `tenant`, update, delete) with
`MachineRequest { code, name, type, manufacturer, model, serialNumber,
yearPurchased, description, branch, area, zone, specs (free map),
capabilities, purchaseCost, maintenanceEveryDays }`. No status, no jobs, no
history.

## Data model (additions)

```
machine                       -- add columns
  status            AVAILABLE | RUNNING | IDLE | MAINTENANCE | FAULT | OFFLINE | RETIRED   DEFAULT AVAILABLE
  status_note       VARCHAR NULL
  technician        VARCHAR NULL
  last_maintenance_at DATE NULL
  next_maintenance_at DATE NULL          -- set on create: today + maintenance_every_days
  total_cycles      INT DEFAULT 0
  retired_at NULL, retired_reason NULL, retired_condition NULL

machine_job(id, uuid, machine_id, order_id NULL, order_number, customer_name,
            service, load_kg, cycle_name, priority,          -- NORMAL, HIGH
            status,                  -- QUEUED, RUNNING, PAUSED, COMPLETED, STOPPED
            queued_position NULL,
            started_at NULL, ended_at NULL, duration_min NULL,
            expected_min,            -- from specs.cycleMin
            progress_percent,        -- computed from time, see below
            operator_id NULL, temperature NULL,
            energy_kwh NULL, water_l NULL)

machine_maintenance(id, uuid, machine_id, scheduled_date, scheduled_time,
                    type, technician, duration_min, cost, description,
                    status,         -- SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED
                    completed_at NULL, created_by)

machine_fault(id, uuid, machine_id, type, severity,      -- LOW, MEDIUM, HIGH, CRITICAL
              description, technician NULL, reported_by, reported_at,
              downtime_min,          -- estimate while open, actual once resolved
              status,                -- OPEN, IN_PROGRESS, RESOLVED
              resolution NULL, resolved_by NULL, resolved_at NULL, repair_cost NULL)

machine_transfer(id, machine_id, from_branch_id, to_branch_id, reason, by_user_id, at)
```

Activity comes from the audit log (README, A) with `entityType = MACHINE`.

`specs` stays a free map but the server must read these keys: `capacityKg`,
`cycleMin`, `powerKw`, `waterL`, `maxTemp`, `warrantyEnd`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/machines/{uuid}` | Profile plus runtime (extend the existing response) |
| GET | `/machines` | List with filters (extend) |
| PATCH | `/machines/{uuid}/status` | Mark offline or available |
| POST | `/machines/{uuid}/jobs` | Assign an order (start or queue) |
| POST | `/machines/{uuid}/job/pause` | Pause |
| POST | `/machines/{uuid}/job/resume` | Resume |
| POST | `/machines/{uuid}/job/stop` | Stop early |
| POST | `/machines/{uuid}/job/complete` | Finish the cycle |
| PUT | `/machines/{uuid}/queue` | Reorder the queue |
| DELETE | `/machines/{uuid}/queue/{jobUuid}` | Remove a queued job |
| POST | `/machines/{uuid}/faults` | Report a fault |
| POST | `/machines/{uuid}/faults/{faultUuid}/resolve` | Resolve |
| POST | `/machines/{uuid}/maintenance` | Schedule |
| POST | `/machines/{uuid}/maintenance/{uuid}/complete` | Complete |
| POST | `/machines/{uuid}/maintenance/{uuid}/cancel` | Cancel |
| POST | `/machines/{uuid}/transfer` | Move to another branch |
| POST | `/machines/{uuid}/retire` | Retire |
| GET | `/machines/summary` | Fleet KPIs for the list header |

Every mutation returns the updated machine, and writes an audit entry
(`MACHINE`) with the text shown in the activity tab.

### Extended machine response

The existing `MachineResponse` fields, plus:

```json
{
  "status": "RUNNING",
  "statusNote": "",
  "technician": "Paul Ndzi",
  "lastMaintenanceAt": "2026-09-28",
  "nextMaintenanceAt": "2026-10-28",
  "totalCycles": 4821,
  "job": {
    "uuid": "…", "order": "ORD-10482", "customer": "Hôtel La Falaise",
    "service": "Wash & Fold", "loadKg": 32, "cycle": "Standard cycle",
    "progress": 40, "remainingMin": 27, "operator": "Jean Mbarga",
    "temperature": 45, "paused": false, "startedAt": "2026-10-25T08:12:00"
  },
  "queue": [
    { "uuid": "…", "order": "ORD-10490", "service": "Heavy Wash", "loadKg": 20, "durationMin": 45, "priority": "HIGH" }
  ],
  "metrics": {
    "runtimeTodayMin": 312, "cyclesToday": 6,
    "utilization": 72, "availability": 96, "efficiency": 88, "downtimePct": 4,
    "avgCycleMin": 47, "energyKwh": 1840, "waterUsedL": 21500, "energyPerCycle": 9.0,
    "revenue": 1650000
  },
  "costs": { "maintenance": 85000, "repairs": 120000, "operating": 40000, "energy": 230000 },
  "maintenanceLog": [ { "uuid": "…", "date": "2026-10-28", "time": "09:00", "type": "Preventive Maintenance", "technician": "Paul Ndzi", "durationMin": 90, "cost": 25000, "description": "Bearings and seals", "status": "SCHEDULED" } ],
  "faults": [ { "uuid": "…", "type": "Mechanical Failure", "severity": "HIGH", "reportedAt": "2026-10-24T14:02:00", "reportedBy": "Sarah Mbarga", "description": "Drum noise", "technician": "Paul Ndzi", "downtimeMin": 120, "status": "RESOLVED", "resolution": "Bearing replaced" } ],
  "transfers": [ { "at": "2026-08-01T10:00:00", "from": { "uuid": "…", "name": "Akwa" }, "to": { "uuid": "…", "name": "Bonapriso" }, "reason": "Rebalancing", "by": "Marcus Vance" } ]
}
```

The list endpoint may leave out `maintenanceLog`, `faults`, `transfers`, and
the activity. List filters: `branch`, `type`, `status`, `manufacturer`,
`maintenance` (`OK`, `DUE_SOON` within `MAINTENANCE_DUE_SOON_DAYS` = 7,
`OVERDUE`), `utilization` (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`), `search`.

### Metrics, computed (never stored)

- `progress` of a running job = `elapsed / expected × 100`, capped at 100
  (paused time doesn't count). `remainingMin = expected − elapsed`.
- `utilization` = running minutes in the period ÷ available minutes (shift
  length from the branch's operating hours).
- `availability` = 100 − downtime %, where downtime = minutes in `FAULT`,
  `MAINTENANCE` or `OFFLINE` during operating hours.
- `efficiency` = Σ `load_kg` ÷ (`capacityKg` × cycles) × 100.
- `energyKwh` = Σ `specs.powerKw × duration_min / 60` over the month; water
  likewise from `specs.waterL` per cycle.
- `revenue` = share of order line totals for orders processed on this machine
  (split by load kg).
- Costs: maintenance and repair costs of completed entries this month;
  operating and energy from rates in tenant settings.

### Assign a job: `POST /machines/{uuid}/jobs`

```json
{ "order": "ORD-10490", "service": "Heavy Wash", "loadKg": 20, "priority": "NORMAL" }
```

- The machine must be operational (not `FAULT`, `MAINTENANCE`, `OFFLINE`,
  `RETIRED`), 409 `machine_not_operational`.
- `loadKg ≤ specs.capacityKg` (409 `machine_over_capacity`).
- No running job → start now: status `RUNNING`, `progress 0`, operator =
  caller, temperature = half of `specs.maxTemp` for heated types (washer,
  dryer, press, ironing, steam).
- A running job → queue it (`HIGH` goes to the front).
- The Laundry Operations module (`03`) calls this when a floor job starts.

### Pause, resume, stop, complete

- `pause` / `resume` need a running job; they only toggle `PAUSED`.
- `stop` ends the job early (`STOPPED`), status `AVAILABLE`, body
  `{ "reason": "Wrong cycle" }`; the order must be reassigned (409 from the
  next start if left unassigned is not needed; the floor job returns to
  waiting).
- `complete` closes the cycle: increments `total_cycles`, records the
  duration, energy and water, then starts the next queued job automatically.
  When the cycle runs out its expected time, a scheduled job should flag it
  `READY_TO_COMPLETE` and send a floor event.

### Faults

`POST /machines/{uuid}/faults`:

```json
{ "type": "Electrical Failure", "severity": "CRITICAL", "description": "Breaker trips on spin", "technician": "Paul Ndzi", "downtimeMin": 180 }
```

- `HIGH` or `CRITICAL`: status `FAULT`, `status_note` = description, the
  running job is stopped (and the floor job returned to waiting).
- `LOW` / `MEDIUM`: logged only.
- Starts `IN_PROGRESS` if a technician is given, otherwise `OPEN`.
- Creates an in-app notification for the branch's managers.

`POST …/faults/{uuid}/resolve` with `{ "resolution": "Replaced contactor",
"repairCost": 45000 }`: sets `RESOLVED`, computes actual downtime, adds the cost
to repairs, and when the last open fault of a machine in `FAULT` closes, sets it
`AVAILABLE`.

### Maintenance

`POST /machines/{uuid}/maintenance`:

```json
{ "date": "2026-10-28", "time": "09:00", "type": "Preventive Maintenance", "technician": "Paul Ndzi", "durationMin": 90, "cost": 25000, "description": "Bearings and seals" }
```

- `next_maintenance_at` = the earliest `SCHEDULED` or `OVERDUE` date.
- `complete`: status `COMPLETED`, date = today, `last_maintenance_at` = today,
  adds the cost, sets `next_maintenance_at` to the earliest pending date or
  `today + maintenance_every_days`; a machine in `MAINTENANCE` becomes
  `AVAILABLE`.
- `cancel`: not while `IN_PROGRESS`.
- A daily job turns past `SCHEDULED` entries into `OVERDUE` and notifies the
  branch's managers.

### Transfer and retire

- `POST …/transfer { "branch": "uuid", "reason": "…" }`: target in the same
  tenant, no running job. Updates `branch`, appends a `machine_transfer`.
- `POST …/retire { "reason": "End of life", "condition": "Poor" }`: status
  `RETIRED`, clears the queue. A retired machine refuses jobs, transfers and
  edits. Keep `DELETE` only for machines with no cycles.

## Fleet summary: `GET /machines/summary?branch=`

```json
{ "total": 40, "running": 14, "available": 12, "idle": 4, "maintenance": 3, "fault": 3, "offline": 2, "retired": 2,
  "avgUtilization": 68, "maintenanceDue": 5, "maintenanceOverdue": 2, "openFaults": 3 }
```

## Permissions

| Action | Owner | Manager / store manager | Floor staff | Others |
|---|---|---|---|---|
| Create, edit, transfer, retire | ✓ | ✓ (own branch) | – | – |
| Assign, pause, resume, stop, complete | ✓ | ✓ | ✓ | – |
| Report faults | ✓ | ✓ | ✓ | – |
| Resolve faults, maintenance | ✓ | ✓ | – | – |
| Read | ✓ | ✓ | ✓ | – |
