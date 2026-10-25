# Backend work still needed: outline

Audited on 2026-10-25: the frontend (`D:\Me\eazyFront\src`) against the backend
(`D:\Me\eazyPressing`, every controller and DTO). This file is the outline. Each
area has its own spec in this folder, with the data model, endpoints, request
and response JSON, and the rules the backend must enforce.

## How the audit was done

1. Every frontend page, service and hook was checked for sample data
   (`constants/sample*.ts`, in-memory stores, `useState(SAMPLE_…)`) and for
   `TODO` notes about missing endpoints.
2. Every backend controller, request DTO, response DTO and entity was read, so
   nothing below asks for something that already exists.
3. Where the backend already has part of an area, the spec says what exists and
   lists only the gap.

---

## Conventions (every new endpoint follows these)

| Topic | Rule |
|---|---|
| Base path | `/api/v1/...` |
| Response | The existing `ResponseHandler` envelope: `{ message, content, timestamp, status, isSuccess }` |
| Lists | `DataTable { totalPages, totalElements, data }`. Params `filter`, `search`, `page` (0-based), `size`. Make `filter` and `search` `required = false`: `DeliveryZone`, `Driver` and `Machine` lists currently reject a call without them |
| Ids | The record's `uuid` in paths. Orders use `orderNumber` |
| Scope | The same three tiers as `OrderService.scopeToConnectedUser`: `SYSTEM_ADMIN` sees everything, `TENANT` the tenant's branches, anyone else their own branch. A tenant owner may narrow with `branch=<uuid>`. Reuse one helper for every new module |
| Actor | "created by", "approved by", "performed by" always come from the authenticated user (first and last name), never from the request body |
| Enums | `UPPER_SNAKE_CASE` strings. The frontend converts them to labels |
| Money | `BigDecimal`, no decimals, in the branch currency (XAF by default). Never `double` |
| Dates | `LocalDate` as `yyyy-MM-dd`, `LocalDateTime` as ISO local time, clock times as `HH:mm` |
| Mutations | Return the updated resource in `content`, not only a message string, so the UI refreshes without a second call |
| Errors | Message keys through `MessageSource`, with 400 (validation), 403 (forbidden), 404 (not found), 409 (conflict, e.g. `insufficient_stock`). Add every new key to the message bundles |
| Concurrency | Records edited by several people at once (stock, payments, orders) use an atomic update or `@Version`, not read-modify-write |

---

## Cross-cutting building blocks (build these first)

Several areas share the same four needs. Building them once avoids four
different versions.

### A. Audit log

Many screens show an "activity" or "audit trail" (services, pricing, payments,
staff, machines, promotions, notification log).

```
audit_log(id, uuid, tenant_id, branch_id NULL, entity_type, entity_uuid,
          action, summary, before_json NULL, after_json NULL,
          actor_id, actor_name, created_at)
```

`AuditService.record(entityType, entityUuid, action, summary, before, after)`
is called from the service layer of each module.

`GET /audit?entityType=PAYMENT&entity=<uuid>&from=&to=&page=&size=` returns the
entries, scoped like any other list. `entityType` is one of `SERVICE`, `PRICE`,
`PAYMENT`, `REFUND`, `STAFF`, `MACHINE`, `PROMOTION`, `MESSAGE`, `ORDER`,
`CUSTOMER`, `INVENTORY`.

```json
{
  "uuid": "…", "entityType": "SERVICE", "entity": "…",
  "action": "PRICE_CHANGED",
  "summary": "Base price 1500 → 1800",
  "before": { "basePrice": 1500 }, "after": { "basePrice": 1800 },
  "actor": "Marcus Vance", "at": "2026-10-25T09:12:00"
}
```

### B. Notification dispatcher and message log

Payment reminders, "your order is ready", reschedules, leave decisions,
low-stock alerts and campaigns all send messages.

```
message_log(id, uuid, tenant_id, branch_id NULL, channel, audience, recipient,
            title, body, event_code NULL, template_id NULL,
            status,            -- QUEUED, SCHEDULED, DELIVERED, FAILED, CANCELLED
            scheduled_for NULL, sent_at NULL, delivered_at NULL, read_at NULL,
            attempts, last_error NULL, provider_ref NULL,
            related_type NULL, related_uuid NULL, created_by, created_at)
```

One `MessageDispatcher.send(...)` entry point:

1. Resolve the template (event code + channel + language).
2. Apply the recipient's channel preferences, consent and quiet hours.
3. Write a `message_log` row.
4. Hand it to the channel adapter: email (exists in `MessageService`), SMS
   (`AppConfig` already holds the keys), WhatsApp and push (later).
5. Update the row's status from the provider callback or the send result.

Failed sends are retried by a scheduled job (3 attempts, back-off).
`InAppNotification` rows are created through the same call for staff
recipients. Details are in `12-notification-center.md`.

### C. Scheduled jobs

`Jobs` already exists for revenue snapshots. Areas below add jobs: sending
scheduled messages, flagging overdue maintenance, certificate-expiry alerts,
low-stock alerts, applying scheduled price changes, starting and stopping
promotions, and renewing customer subscriptions. Each job must be idempotent
(safe to run twice).

### D. Live feed

`InAppNotificationCreatedEvent` plus the SSE stream is the pattern. The
dashboard event stream and the operations floor timeline reuse it:
`GET /events/stream` (SSE) pushes `{ at, type, title, body, related, alert }`
for the caller's scope.

---

## Status matrix

Status values: **Missing** = no backend at all. **Partial** = some endpoints or
fields exist. **Ready** = the backend exists and only the UI isn't connected
(no backend work).

| # | Area | Screen | Backend today | Gap | Priority | Spec |
|---|---|---|---|---|---|---|
| 1 | Payments | Payments | Order has one `amountPaid`, `paymentMethod`, `paymentStatus` | Missing: payment records, receipts, refunds, exceptions, reconciliation, cash sessions, providers | P1 | `01-payments.md` |
| 2 | Orders extensions | Orders | Order CRUD, complete, collect | Partial: assignee, QC, delivery address, cancel reason, status history, per-payment detail, import | P1 | `02-orders-extensions.md` |
| 3 | Laundry operations | Laundry Operations | `WorkflowStatusLog` (write only) | Missing: stage queue, machine and staff assignment, QC loop, item counts, floor events, capacity | P1 | `03-laundry-operations.md` |
| 4 | Machines runtime | Machines list and detail | Machine profile CRUD | Partial: status, jobs, queue, faults, maintenance, transfers, retire, metrics | P1 | `04-machines-runtime.md` |
| 5 | Inventory | Inventory | Items and stock movements | Partial: transfers, purchase orders, suppliers, alerts | P1 | `05-inventory-transfers-purchasing.md` |
| 6 | Staff operations | Staff | Employment details on the user | Missing: attendance, shifts, tasks, leave, performance, training | P2 | `06-staff-operations.md` |
| 7 | Roles and permissions | Roles, access control | Role name and scope; `Menu` entity unused | Missing: permissions per role, effective permissions on `/users/me` | P1 | `07-roles-permissions.md` |
| 8 | Customers extensions | Customers, customer profile | Customer CRUD with tags, addresses, notes, preferences | Partial: communications, payments, activity, loyalty, merge, import | P2 | `08-customers-extensions.md` |
| 9 | Pricing | Pricing | Service prices, `PriceConfig` | Missing: customer groups, surcharges, taxes, tiers, price history, scheduled changes, bulk adjustment, quote engine | P2 | `09-pricing-engine.md` |
| 10 | Customer subscriptions | Pricing → Subscription Plans | Platform plans only (for tenants) | Missing: recurring laundry plans and customer subscriptions | P3 | `10-customer-subscriptions.md` |
| 11 | Promotions | Promotions | Empty `Discount` entity | Missing: the whole module | P3 | `11-promotions.md` |
| 12 | Notification centre | Notifications | In-app inbox and SSE; seeded email templates | Missing: compose, templates CRUD, rules, preferences, delivery log, channel health | P2 | `12-notification-center.md` |
| 13 | Settings and profile | Settings | `TenantConfiguration` CRUD | Missing: per-user preferences. Tenant branding is Ready | P2 | `13-settings-and-profile.md` |
| 14 | Dashboard aggregates | Dashboard | Revenue, order distribution, order total | Partial: KPIs, pipeline detail, attention feed, logistics, equipment, supplies, staff metrics, insights, events | P1 | `14-dashboard-aggregates.md` |
| 15 | Logistics extensions | Pickup & Delivery | Jobs, drivers, zones, settings | Partial: reschedule time, structured proof and failure, cancel reason, customer message, analytics | P2 | `15-logistics-extensions.md` |
| 16 | Services extensions | Services, service detail | Service CRUD | Partial: promotions on a service, audit trail, import and export | P2 | `16-services-extensions.md` |
| 17 | Tenants, branches, platform subscription, sign-in | Tenants, Branches, Platform Plans, sign-in | Tenant, branch and auth CRUD | Partial: suspension reason and usage, plan-limit enforcement, branch overview stats, voice OTP, sign out other devices, sessions | P2 | `17-tenant-branch-auth-gaps.md` |
| 18 | Reports | Reports (menu entry, no page yet) | Revenue only | Missing: report endpoints and exports | P3 | `18-reports.md` |

Priority: **P1** blocks a daily workflow (taking money, running the floor,
access control, dashboard). **P2** is needed for a complete product. **P3** is
a separate feature that can wait.

### Recommended build order

1. Cross-cutting A and B (audit log, dispatcher).
2. `07` roles and permissions (the rest of the UI is gated by it).
3. `02` orders extensions, then `01` payments.
4. `03` operations together with `04` machines runtime (they share jobs and machines).
5. `05` inventory transfers and purchasing, then `14` dashboard aggregates (they read all of the above).
6. P2 areas, then P3.

---

## Defects in the existing backend

Not new features: bugs that affect screens that are already connected.

| Where | Problem | Fix |
|---|---|---|
| `mapper/DeliveryZoneMapper.toDto` | Never sets `.name(...)`, so every zone returns without a name | Add `.name(deliveryZone.getName())` |
| `mapper/DeliveryZoneMapper.forModelUpdate` | Editing `deliveryFee` calls `setCollectionFee(...)`, overwriting the collection fee | Call `setDeliveryFee(...)` |
| `mapper/DeliveryZoneMapper.forModelUpdate` | Checks `deliveryZone.getNeighborhood() != null` (the stored zone) instead of the request's list | Check `deliveryZoneRequest.getNeighborhood() != null` |
| List endpoints of `DeliveryZone`, `Driver`, `Machine` | `filter` and `search` are required parameters | `required = false` |
| `CustomerResponse` | `communications`, `payments`, `activity` are always empty | See `08-customers-extensions.md` |

---

## Ready on the backend, not connected in the UI

No backend work. These are frontend tasks, listed so they aren't mistaken for
gaps:

| Backend | Used by the UI? | Notes |
|---|---|---|
| `GET/POST/PATCH/DELETE /machines` (profile) | No: the Machines pages use sample data | Connect for the profile; runtime needs `04` |
| `/inventory` items and `/movements` | No: Inventory uses sample data | Connect for items and stock changes; transfers and purchasing need `05` |
| `/price-configs` | No | Article-type price rows; see `09` for how they relate to the Pricing page |
| `/subscriptions` (tenant plan subscription) | No | The "Subscribe" button on Platform Plans; `POST /subscriptions { tenant, plan }` |
| `/tenant-configuration/{tenantId}` | No | Logo, colour, receipt template, currency, language, time zone, channels |
| `/tenant/{tenantId}/domain` | No | Custom domains and verification |
| `/article-lines` | No | Order article lines, with picture upload |
| `GET /dashboard/orders/distribution`, `/dashboard/orders/total` | No | Wire the Order Distribution card and the total-orders KPI |
| `GET /logistics/drivers/me`, `PATCH …/location` | No | For a driver app |

---

## Earlier prompts that are now superseded

These were written before the backend implemented part of the work. Treat the
files in this folder as current:

- `docs/machines-backend-prompt.md`: the machine profile exists with a different shape (`specs` is a free map, no status). Runtime parts are now in `04-machines-runtime.md`.
- `docs/inventory-backend-prompt.md`: items and movements exist with different movement types (`RECEIPT`, `USAGE`, `WASTE`, `ADJUSTMENT`, `RESERVE`, `RELEASE`). Transfers and purchase orders are now in `05-inventory-transfers-purchasing.md`.
- `docs/pickup-delivery-backend-prompt.md`: jobs, drivers, zones and settings exist. Remaining gaps are in `15-logistics-extensions.md`.
- `docs/dashboard-charts-backend-prompt.md`: both endpoints exist. Remaining dashboard work is in `14-dashboard-aggregates.md`.
