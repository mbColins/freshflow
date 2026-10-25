# Dashboard charts: backend endpoints

> **Implemented.** `GET /dashboard/revenue` and `GET /dashboard/orders/distribution` exist. The remaining dashboard work is in `docs/backend/14-dashboard-aggregates.md`.

Two cards on the dashboard still draw sample data:

- **Revenue & Cashflow Overview** (`src/components/dashboard/RevenueChart.tsx`)
- **Order Distribution** (`src/components/dashboard/OrderDistribution.tsx`)

Add these two endpoints to the existing `DashboardController`
(`/api/v1/dashboard`). They follow the usual conventions:

- Every response is wrapped in the `ApiResponse` envelope:
  `{ message, content, timestamp, status, isSuccess }`.
- Money is XAF as `BigDecimal` with no decimals.

## Scope (both endpoints)

This is the same rule as `GET /order`.

- **Tenant owner (`TENANT`):** sees every branch of their tenant. They can pass
  `branch=<uuid>` to see one branch, which must belong to the tenant
  (403 otherwise).
- **Any other user:** sees only their own branch. A `branch` param is ignored.
- **`SYSTEM_ADMIN`:** sees everything. They can pass `branch`.

---

## 1. Revenue & Cashflow Overview

`GET /api/v1/dashboard/revenue?period=DAILY&branch=<uuid optional>`

`period` is one of `DAILY`, `WEEKLY` or `MONTHLY`. The default is `DAILY`.

| period | buckets | label example |
|---|---|---|
| `DAILY` | the last 7 days, today included | `"Mon 10"` |
| `WEEKLY` | the last 4 ISO weeks, this week included | `"Wk 24"` |
| `MONTHLY` | the last 6 months, this month included | `"Jun"` |

Rules:

- **What counts as revenue:** money received, meaning order **payments**,
  grouped by the payment date. Unpaid order totals are not revenue.
- **Payment methods:**
  - Mobile Money (MTN / Orange) goes in `mobileMoney`.
  - Cash at the counter goes in `cash`.
  - Card, bank transfer and anything else go in `other`.
- **Empty buckets:** return every bucket, even with no payments, using zeros.
  This keeps the chart's x-axis complete.
- **Order:** buckets go oldest first.
- **Month-on-month badge** (`change`): compare this month so far against the
  same days of last month, i.e. day 1 to today's day number in each.
  - `percent` is rounded to one decimal.
  - It is `null` when last month had nothing.

### Response `content`

```json
{
  "period": "DAILY",
  "currency": "XAF",
  "branch": { "uuid": "7f3c2a10-5b1e-4d8a-9c2f-1a2b3c4d5e6f", "name": "Bonapriso" },
  "from": "2026-10-14",
  "to": "2026-10-20",
  "totals": {
    "mobileMoney": 4108800,
    "cash": 2311200,
    "other": 0,
    "total": 6420000
  },
  "change": {
    "comparedTo": "PREVIOUS_MONTH",
    "currentTotal": 17300000,
    "previousTotal": 15390000,
    "percent": 12.4
  },
  "points": [
    { "label": "Mon 14", "start": "2026-10-14", "end": "2026-10-14", "mobileMoney": 520000, "cash": 300000, "other": 0, "total": 820000 },
    { "label": "Tue 15", "start": "2026-10-15", "end": "2026-10-15", "mobileMoney": 480000, "cash": 280000, "other": 0, "total": 760000 },
    { "label": "Wed 16", "start": "2026-10-16", "end": "2026-10-16", "mobileMoney": 560000, "cash": 320000, "other": 0, "total": 880000 },
    { "label": "Thu 17", "start": "2026-10-17", "end": "2026-10-17", "mobileMoney": 610000, "cash": 340000, "other": 0, "total": 950000 },
    { "label": "Fri 18", "start": "2026-10-18", "end": "2026-10-18", "mobileMoney": 640000, "cash": 360000, "other": 0, "total": 1000000 },
    { "label": "Sat 19", "start": "2026-10-19", "end": "2026-10-19", "mobileMoney": 720000, "cash": 400000, "other": 0, "total": 1120000 },
    { "label": "Sun 20", "start": "2026-10-20", "end": "2026-10-20", "mobileMoney": 578800, "cash": 311200, "other": 0, "total": 890000 }
  ]
}
```

- `branch` is `null` when the result covers every branch of the tenant.
- `start` and `end` are the bucket's first and last day, inclusive. For
  `WEEKLY` they span Monday to Sunday; for `MONTHLY`, the 1st to the last day.
- The UI computes the running-average line and the Mobile Money / cash shares
  from `points` and `totals`, so the backend doesn't need to.

---


## 2. Order Distribution

`GET /api/v1/dashboard/orders/distribution?branch=<uuid optional>`

This is a live count of **active** orders (not completed, not cancelled),
grouped by the order's `status`. The order `Status` enum already has the
pipeline stages, so the stage ids are the status values themselves.

### Stages, in display order

| stage `id` (= `orders.status`) | label shown in the UI |
|---|---|
| `RECEIVED` | Received (`PENDING` orders count here too) |
| `WASHING` | Washing |
| `DRYING` | Drying |
| `IRONING` | Ironing & Press |
| `QA` | Quality Check |
| `READY` | Ready for Pickup |
| `HANDOVER` | Out for Delivery / Awaiting Pickup |

Statuses left out of the count:

- **Finished:** `COMPLETED` and `CANCELLED`.
- **Legacy:** `ACTIVE`, `TRIAL` and `INACTIVE`. These aren't order states.

### SQL (PostgreSQL)

Tables use the default Spring naming: `orders.branch_id` → `branch.id` and
`branch.tenant_id` → `tenant.id`.

```sql
-- Tenant owner: every branch of the tenant
SELECT o.status, COUNT(*) AS count
FROM orders o
JOIN branch b ON b.id = o.branch_id
WHERE b.tenant_id = :tenantId
  AND o.status IN ('PENDING','RECEIVED','WASHING','DRYING','IRONING','QA','READY','HANDOVER')
GROUP BY o.status;

-- One branch (a branch user, or a tenant owner who picked a branch)
SELECT o.status, COUNT(*) AS count
FROM orders o
WHERE o.branch_id = :branchId
  AND o.status IN ('PENDING','RECEIVED','WASHING','DRYING','IRONING','QA','READY','HANDOVER')
GROUP BY o.status;

-- Platform admin, no branch: drop the tenant / branch condition
```

### Repository (JPQL, so no native SQL is needed)

```java
public interface StatusCount {
    Status getStatus();
    long getCount();
}

// OrderRepository
@Query("""
       SELECT o.status AS status, COUNT(o) AS count
       FROM Order o
       WHERE o.status IN :statuses
         AND (:branchId IS NULL OR o.branch.id = :branchId)
         AND (:tenantId IS NULL OR o.branch.tenant.id = :tenantId)
       GROUP BY o.status
       """)
List<StatusCount> countActiveByStatus(@Param("statuses") Collection<Status> statuses,
                                      @Param("branchId") Long branchId,
                                      @Param("tenantId") Long tenantId);
```

### Service logic (`DashboardService.getOrderDistribution`)

1. **Resolve the scope** exactly as in `getRevenueOverview`. This gives
   `branchFilter` and `tenantFilter`, one of them set or both null for a
   platform admin.
2. **Count.** Call `countActiveByStatus(ACTIVE_STATUSES, branchFilter, tenantFilter)`,
   where `ACTIVE_STATUSES` is
   `PENDING, RECEIVED, WASHING, DRYING, IRONING, QA, READY, HANDOVER`.
3. **Merge `PENDING` into `RECEIVED`.**
4. **Build all seven stages** in the order above, with `count = 0` for any
   stage that has no orders.
5. **Total:** `totalActive` is the sum of the counts.
6. **Percentages:** whole numbers that add up to exactly 100, using the
   largest-remainder method. When `totalActive` is 0, every percent is 0.
   - `exact = count * 100 / total`
   - `percent = floor(exact)`
   - Hand out the leftover points (`100 - sum`), one each, to the stages with
     the biggest `exact - floor(exact)`.

### Response `content`

```json
{
  "branch": null,
  "asOf": "2026-10-21T09:40:00",
  "totalActive": 1248,
  "stages": [
    { "id": "RECEIVED", "count": 150, "percent": 12 },
    { "id": "WASHING",  "count": 225, "percent": 18 },
    { "id": "DRYING",   "count": 175, "percent": 14 },
    { "id": "IRONING",  "count": 200, "percent": 16 },
    { "id": "QA",       "count": 100, "percent": 8 },
    { "id": "READY",    "count": 273, "percent": 22 },
    { "id": "HANDOVER", "count": 125, "percent": 10 }
  ]
}
```

- **`branch`:** the branch uuid the count is limited to, or `null` for every
  branch the caller can see.
- **`asOf`:** the server time of the count.

### DTO

```java
@Data
@Builder
public class OrderDistributionResponse {
    private String branch;
    private LocalDateTime asOf;
    private long totalActive;
    private List<Stage> stages;

    @Data
    @Builder
    public static class Stage {
        private String id;     // the Status name
        private long count;
        private int percent;
    }
}
```

### Controller

```java
// DashboardController
@GetMapping("/orders/distribution")
public ResponseEntity<Object> getOrderDistribution(@RequestParam(required = false) String branch,
                                                   @AuthenticationPrincipal Users user) throws ResourceNotFoundException, ForbidenException {
    OrderDistributionResponse response = dashboardService.getOrderDistribution(branch, user);
    return ResponseHandler.responseEntity(HttpStatus.OK, false, "success", response);
}
```
