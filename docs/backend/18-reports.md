# 18. Reports

Priority P3. Status: **Missing** (and no page yet).

## Context

The sidebar has a **Reports** entry with no route (`components/layout/Sidebar.tsx`,
`{ label: 'Reports', icon: ChartColumn }`). The permission preview already lists
a Reports module with `View` and `Export`. Platform plans have modules
`BASIC_REPORTING`, `ADVANCED_ANALYTICS`, `DATA_EXPORT`, `REVENUE_FORECASTING` and
`CUSTOM_DASHBOARDS`. The only report-like endpoints are the dashboard revenue
chart and the stored revenue snapshots (`/revenue`).

This file defines a **small, uniform reports API**, so one generic Reports
page (filters, a table, a chart, an export button) can serve every report. It
is built on the data the other modules create; each report says which module it
needs.

## Design

One endpoint shape for all reports, so the frontend needs one page:

| Method | Path | Purpose |
|---|---|---|
| GET | `/reports/catalog` | The reports the caller may run, with their parameters |
| GET | `/reports/{code}` | Run a report (JSON: columns, rows, totals, chart series) |
| GET | `/reports/{code}/export?format=csv\|xlsx` | The same, as a file |

Common parameters: `from`, `to` (dates, required, max 366 days), `branch`
(uuid, optional, scope as usual), `groupBy` where listed, `page` and `size`
(for row-level reports). Reports are computed on demand from live tables; add
read-replica or materialised views only when needed.

Response:

```json
{
  "code": "SALES_BY_SERVICE",
  "title": "Sales by service",
  "from": "2026-10-01", "to": "2026-10-25",
  "currency": "XAF",
  "generatedAt": "2026-10-25T10:45:00",
  "columns": [
    { "key": "service", "label": "Service", "type": "TEXT" },
    { "key": "orders", "label": "Orders", "type": "NUMBER" },
    { "key": "revenue", "label": "Revenue", "type": "MONEY" }
  ],
  "rows": [ { "service": "Wash & Fold", "orders": 412, "revenue": 7416000 } ],
  "totals": { "orders": 1248, "revenue": 18500000 },
  "chart": { "type": "BAR", "x": "service", "y": ["revenue"] },
  "page": 0, "totalPages": 1, "totalElements": 12
}
```

`type` is `TEXT`, `NUMBER`, `MONEY`, `PERCENT`, `DATE`, `DATETIME`. The
frontend formats from `type`, so the backend returns raw numbers.

Exports use the same rows with the column labels as headers (UTF-8 with BOM for
CSV). The `xlsx` format needs a library such as Apache POI.

Permissions: `REPORTS:VIEW` to run, `REPORTS:EXPORT` to export (`07`). A report
that needs a module the plan lacks is not in the catalog (`07`, plan modules).
Branch users only ever see their own branch; managers see sales and operations
reports, the owner sees all. Each export writes an audit entry (who, which
report, which filters). Rate-limit exports (10 a minute per user).

Catalog entry:

```json
{ "code": "SALES_BY_SERVICE", "title": "Sales by service", "group": "SALES",
  "module": "BASIC_REPORTING", "permission": "REPORTS:VIEW",
  "parameters": [ { "key": "groupBy", "type": "ENUM", "options": ["SERVICE", "CATEGORY"], "default": "SERVICE" } ] }
```

## The reports

| Code | Group | Content | Needs |
|---|---|---|---|
| `SALES_SUMMARY` | Sales | Orders, revenue, average ticket, discounts, tax, by day, week or month (`groupBy`) | Orders; `09` for discounts and tax |
| `SALES_BY_SERVICE` | Sales | Orders and revenue per service or category | Orders |
| `SALES_BY_BRANCH` | Sales | The same per branch, with growth vs the previous period (owner only) | Orders |
| `SALES_BY_CUSTOMER` | Sales | Top customers by spend, orders, last order | Orders, customers |
| `PAYMENTS_BY_METHOD` | Finance | Collected per method and provider, fees, refunds | `01` |
| `CASH_SESSIONS` | Finance | Each cash session with expected, counted, variance | `01` |
| `OUTSTANDING_BALANCES` | Finance | Orders and customers with a balance, age in days (0–7, 8–30, 31+) | Orders, `01` |
| `REFUNDS` | Finance | Refunds with reason, approver, amount | `01` |
| `DISCOUNTS_AND_PROMOTIONS` | Finance | Discount given by promotion or code, uses, revenue | `11` |
| `ORDER_TURNAROUND` | Operations | Created → completed time by service and stage; late rate | `03` |
| `STAGE_DURATIONS` | Operations | Average time per stage, by staff | `03` |
| `QUALITY` | Operations | QC pass rate, reprocess, reasons | `02` |
| `MACHINE_UTILIZATION` | Operations | Utilisation, downtime, cycles, energy, faults by machine | `04` |
| `MAINTENANCE_LOG` | Operations | Maintenance and faults with cost and downtime | `04` |
| `INVENTORY_VALUATION` | Inventory | Stock, value, days left by item | Inventory |
| `STOCK_MOVEMENTS` | Inventory | Movements by item, type, user | Inventory |
| `STOCK_USAGE_BY_SERVICE` | Inventory | Consumption per service and per unit | `05` (automatic usage) |
| `PURCHASES` | Inventory | Purchase orders by supplier, status, total, lead time | `05` |
| `DELIVERY_PERFORMANCE` | Logistics | Jobs, on-time rate, failures by zone and driver | `15` |
| `DRIVER_PERFORMANCE` | Logistics | Per driver: jobs, completed, failed, average minutes, cash collected | `15` |
| `STAFF_ATTENDANCE` | People | Days present, late, absent, leave per person | `06` |
| `STAFF_PERFORMANCE` | People | Tasks, on-time, quality, score per person (managers only) | `06` |
| `CUSTOMER_GROWTH` | Customers | New, returning, inactive, retention by month | Customers |
| `LOYALTY` | Customers | Points earned and redeemed, tiers | `08` |
| `SUBSCRIPTIONS` | Customers | Customer plans: subscribers, MRR, churn | `10` |

Build them in this order, because the first few only need data that exists:
`SALES_SUMMARY`, `SALES_BY_SERVICE`, `SALES_BY_BRANCH`, `SALES_BY_CUSTOMER`,
`OUTSTANDING_BALANCES`, `INVENTORY_VALUATION`, `STOCK_MOVEMENTS`,
`CUSTOMER_GROWTH`; the rest as their modules land.

## Implementation notes

- Implement each report as a class `Report` with `code`, `columns()`,
  `parameters()`, `run(ReportRequest, Scope)`; register them in a Spring map so
  the catalog and the two endpoints are generic.
- Use JPQL or SQL with `GROUP BY` and the same scope specification as the
  lists; never load entities into memory to aggregate.
- Money in `BigDecimal`; percentages with one decimal; dates in the server's
  business time zone (`TenantConfiguration.defaultTimezone`).
- Row-level reports must page (max 500 rows a page for JSON; exports stream
  the whole result without loading it all in memory).
- Add indexes as the dashboard spec lists (`14`), plus `(branch_id, created_at)`
  on `stock_movement` and `(branch_id, status, scheduled_at)` on `dispatch_job`.

## Forecasting and custom dashboards (later)

`REVENUE_FORECASTING` and `CUSTOM_DASHBOARDS` are plan modules but have no
UI or API yet. When they are wanted:

- `GET /reports/forecast/revenue?horizonDays=30` returns the history and a
  projected series (a simple seasonal average is enough to start).
- `custom_dashboard(id, tenant_id, owner_id, name, layout_json, shared)` with
  CRUD under `/dashboards`, where `layout_json` lists card ids from the
  dashboard endpoints (`14`) and their positions.
