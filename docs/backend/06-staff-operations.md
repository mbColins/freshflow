# 06. Staff operations: attendance, shifts, tasks, leave, performance

Priority P2. Status: **Missing** (employment details already exist on the
user).

## What the screen does

`pages/StaffPage.tsx` lists staff from `/users`, and the employment details
(job title, department, employment type, hire date, manager, shift times,
working days, skills, salary, leave balance, certification, login access,
two-factor, suspension) are now stored. Everything about **what staff do each
day** is still in the browser:

- **Status today:** working, available, on break, offline, absent, on leave,
  suspended.
- **Attendance:** clock in, clock out, start break, end break, mark absent;
  time of clock-in, break minutes, lateness.
- **Assignment:** give a staff member a task (laundry order, ironing, QC,
  packaging, pickup or delivery, maintenance, front desk) with a reference such
  as an order number; capacity, tasks assigned, done and overdue; an overload
  warning at 85 % of capacity; a recommendation of who to assign.
- **Open shifts:** shifts that need someone, and filling them.
- **Leave:** requests with a type, dates and reason, approved or rejected by a
  manager.
- **Performance:** score, on-time rate, quality rate, rating, attendance rate,
  late count this month, training completed.
- Quick views: on duty, overloaded, late, certification expiring soon.

## What the backend has

`/users` with the staff fields (`jobTitle`, `department`, `employmentType`,
`hiredAt`, `managerId`, `shiftStart`, `shiftEnd`, `workingDays`, `skills`,
`monthlySalary`, `leaveBalance`, `certification`, `loginAccess`,
`twoFactorRequired`, `accountStatus`, `statusReason`). Nothing for the daily
life of a staff member.

## Data model

```
attendance_record(id, uuid, tenant_id, branch_id, user_id, work_date,
                  scheduled_start, scheduled_end,       -- copied from the user's schedule that day
                  clock_in NULL, clock_out NULL,
                  break_minutes DEFAULT 0, break_started_at NULL,
                  status,    -- PRESENT, LATE, ABSENT, ON_LEAVE, DAY_OFF
                  late_minutes DEFAULT 0, absence_reason NULL,
                  recorded_by, UNIQUE(user_id, work_date))

shift(id, uuid, tenant_id, branch_id, title, department, skill NULL,
      work_date, start_time, end_time,
      user_id NULL,          -- NULL = an open shift
      status,                -- OPEN, FILLED, CANCELLED
      filled_by NULL, filled_at NULL, created_by)

staff_task(id, uuid, tenant_id, branch_id, user_id, type, skill,
           reference NULL,    -- order number, job code, machine code
           title, due_at NULL, estimated_min NULL,
           status,            -- ASSIGNED, IN_PROGRESS, DONE, OVERDUE, CANCELLED
           assigned_by, assigned_at, started_at NULL, done_at NULL)

leave_request(id, uuid, tenant_id, user_id, type,    -- ANNUAL, SICK, PERSONAL, PARENTAL, EMERGENCY, OTHER
              from_date, to_date, days, reason,
              status,                                -- PENDING, APPROVED, REJECTED, CANCELLED
              decided_by NULL, decided_at NULL, decision_note NULL, created_at)

training_record(id, user_id, course, completed_at NULL, due_at NULL)
```

`staff_task.reference` links to the order, machine or dispatch job. The
processing job in `03` and the dispatch job in `15` should create their
`staff_task` rows automatically when someone is assigned, so staff doesn't
have to be assigned twice.

## Attendance

| Method | Path | Purpose |
|---|---|---|
| POST | `/staff/{userUuid}/attendance` | Clock in, clock out, break, absent |
| GET | `/staff/attendance?date=&branch=&user=` | A day's attendance |
| GET | `/staff/{userUuid}/attendance?from=&to=` | A person's history |

```json
{ "action": "CLOCK_IN", "time": "08:07" }
```

`action` is `CLOCK_IN`, `CLOCK_OUT`, `START_BREAK`, `END_BREAK` or
`MARK_ABSENT` (with `"reason": "No call"`). `time` defaults to now and can only
be set by a manager.

Rules:

- `CLOCK_IN`: creates or updates today's record. `late_minutes` =
  `max(0, clockIn − scheduledStart − 5 min grace)`; status `LATE` when > 0.
  409 if already clocked in.
- `START_BREAK` needs a clock-in and no open break; `END_BREAK` adds the
  elapsed minutes to `break_minutes`.
- `CLOCK_OUT` closes an open break first. 409 `not_clocked_in` otherwise.
- `MARK_ABSENT`: manager or owner; status `ABSENT`.
- Staff may clock themselves in or out (including from their own device);
  only managers act for someone else. A suspended or login-disabled user can't
  be clocked in.
- If the user has an approved leave for the day, the record is `ON_LEAVE`.

Derived **today status** (returned on each staff member):

| Condition | Status |
|---|---|
| `accountStatus = SUSPENDED` | `SUSPENDED` |
| On approved leave today | `LEAVE` |
| Marked absent, or scheduled and not clocked in 30 minutes after start | `ABSENT` |
| Clocked in, on break | `BREAK` |
| Clocked in with an `IN_PROGRESS` task | `WORKING` |
| Clocked in, no task | `AVAILABLE` |
| Otherwise | `OFFLINE` |

## Staff list with daily state: `GET /users`, `/users/tenant`, `/users/branch/{uuid}`

Add an optional `include=daily` parameter. When set, each user also carries:

```json
{
  "today": {
    "status": "WORKING",
    "clockIn": "08:07", "breakMinutes": 12, "lateMinutes": 7,
    "assignment": "Laundry order (washing)", "assignmentRef": "ORD-10452"
  },
  "workload": { "assigned": 5, "done": 3, "overdue": 1, "capacity": 12 },
  "performance": {
    "score": 92, "onTime": 94, "quality": 96, "rating": 4.6,
    "attendanceRate": 97, "lateThisMonth": 2
  },
  "training": { "done": 7, "total": 10 }
}
```

Definitions (computed, not stored):

- `capacity` = tenant setting `staff_daily_capacity` (default 12 tasks), per
  user override allowed.
- `performance.onTime` = tasks done on time ÷ tasks done in the last 30 days.
- `performance.quality` = 100 − (QC failures on this person's work ÷ jobs
  they processed) × 100, last 30 days.
- `performance.attendanceRate` = days present ÷ days scheduled, last 30 days.
- `performance.score` = 0.4 × onTime + 0.4 × quality + 0.2 × attendanceRate.
  Return `null` for someone with less than 10 tasks in the period.
- `rating` = average QC and customer rating if collected; otherwise `null`.

Performance figures are visible to managers and the owner only (the UI already
hides them for others).

## Tasks

| Method | Path | Purpose |
|---|---|---|
| POST | `/staff/{userUuid}/tasks` | Assign a task |
| GET | `/staff/tasks?user=&status=&date=` | List |
| PATCH | `/staff/tasks/{uuid}` | Start, finish, cancel, reassign |
| GET | `/staff/recommend?skill=&branch=&at=` | Who to assign |

```json
{ "type": "LAUNDRY_ORDER_WASHING", "reference": "ORD-10452", "dueAt": "2026-10-25T14:00:00", "estimatedMin": 45 }
```

- `type` maps to the required skill (`TASK_TYPES`): washing → `WASHING`,
  ironing → `IRONING`, QC → `QUALITY_CONTROL`, packaging → `PACKAGING`,
  pickup or delivery → `DRIVING`, maintenance → `MACHINE_MAINTENANCE`, front
  desk → `CUSTOMER_SERVICE`.
- The person must be clocked in (409 `not_on_duty`), active, and not on leave.
  A skill mismatch is a warning in the response (`warnings: ["skill_missing"]`),
  not an error.
- Assigning beyond `capacity` is allowed for a manager with
  `"force": true`; otherwise 409 `over_capacity`.
- A scheduled job marks tasks past `dueAt` as `OVERDUE`.
- `PATCH` body: `{ "status": "IN_PROGRESS" | "DONE" | "CANCELLED" }` or
  `{ "assignedTo": "user-uuid" }`.

`GET /staff/recommend` returns candidates ordered best first:

```json
[ { "user": { "uuid": "…", "name": "Elena Rostova" }, "skillLevel": "EXPERT", "load": 0.42, "onDuty": true, "reason": "Expert in washing, 42 % loaded" } ]
```

Ranking: on duty, has the skill (higher level first), lowest load.

## Open shifts

| Method | Path | Purpose |
|---|---|---|
| POST | `/staff/shifts` | Create a shift (open or assigned) |
| GET | `/staff/shifts?from=&to=&status=&branch=` | List |
| PATCH | `/staff/shifts/{uuid}/fill` | Assign someone |
| PATCH | `/staff/shifts/{uuid}/cancel` | Cancel |

```json
{ "title": "Evening ironing cover", "department": "FINISHING_PRESS", "skill": "IRONING", "workDate": "2026-10-26", "startTime": "16:00", "endTime": "22:00" }
```

Fill: `{ "user": "user-uuid" }`. The person must not already have an overlapping
shift or approved leave (409 `schedule_conflict`). Filling notifies that person.

## Leave

| Method | Path | Purpose |
|---|---|---|
| POST | `/staff/leave` | Request leave |
| GET | `/staff/leave?status=&user=&from=&to=` | List |
| PATCH | `/staff/leave/{uuid}/decision` | Approve or reject |
| PATCH | `/staff/leave/{uuid}/cancel` | Withdraw (requester only, while pending) |

```json
{ "user": "user-uuid", "type": "ANNUAL", "from": "2026-11-03", "to": "2026-11-07", "reason": "Family event" }
```

- `days` counts working days (the user's `workingDays`) between the dates,
  excluding public holidays if the tenant has configured any.
- `ANNUAL` leave needs `leaveBalance ≥ days` (409 `insufficient_leave_balance`).
  Other types don't use the balance.
- No overlap with an existing approved leave.
- Decision: `{ "approve": true, "note": "" }`, by the user's manager
  (`managerId`), a branch manager or the owner, never the requester.
  Approving an `ANNUAL` leave subtracts `days` from `leaveBalance`; it also
  creates `ON_LEAVE` attendance records for those days.
- The requester gets an in-app notification either way.

## Training

`GET/POST /staff/{userUuid}/training`, `PATCH /staff/training/{uuid}`. Small
CRUD; `training.done` and `total` on the staff list come from it.

## Certification alerts

A daily job notifies the manager and the person when `certification.expiresAt`
is within 30 days (`CERT_WARNING_DAYS`), and again when it expires. The staff
list's "certification expiring" view is `GET /users?...&view=CERT_EXPIRING`.

## Permissions

| Action | Owner | Manager / store manager | The person | Others |
|---|---|---|---|---|
| Clock in or out for self | ✓ | ✓ | ✓ | – |
| Clock others, mark absent | ✓ | ✓ | – | – |
| Assign tasks, shifts | ✓ | ✓ | – | – |
| Request leave | ✓ | ✓ | ✓ | – |
| Approve leave | ✓ | ✓ (their branch) | – | – |
| See performance | ✓ | ✓ | – | – |
