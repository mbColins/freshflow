# 10. Customer subscriptions (recurring laundry plans)

Priority P3. Status: **Missing**.

Not to be confused with the **platform** plans (what a laundry business pays
the platform: `/subscription-plans` and `/subscriptions`, which exist). This
module is what a laundry business sells to **its own customers**, for example
"30 kg a month for 25 000 XAF".

## What the screen does

`pages/SubscriptionPlansPage.tsx` (menu: Pricing → Subscription Plans) runs on
an in-memory store (`hooks/useSubscriptionPlans.ts`, `constants/subscriptions.ts`,
`// TODO: replace with the subscriptions API`). It creates, edits, duplicates,
archives and deletes plans and shows KPIs (plans, subscribers, monthly
recurring revenue). A plan has:

| Field | Meaning |
|---|---|
| `name`, `description` | Shown to customers |
| `status` | `ACTIVE`, `DRAFT`, `ARCHIVED` |
| `price`, `cycle` | Price per billing cycle: `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY` |
| `allowance`, `allowanceUnit` | Included amount per cycle (`KG`, `ITEMS`, `ORDERS`); empty = unlimited |
| `overageRate` | Price per unit beyond the allowance |
| `rollover` | Unused allowance carries into the next cycle |
| `services` | The services the allowance covers |
| `freePickups` | Free pickup and delivery trips per cycle |
| `extrasDiscountPercent` | Percent off services outside the plan |
| `branches` | Where it is sold (empty = every branch) |
| `trialDays`, `minCycles`, `setupFee`, `autoRenew`, `featured` | Terms |
| `subscribers` | Current subscriber count |

The module is only offered to tenants whose platform plan includes the
`CUSTOMER_SUBSCRIPTIONS` module (`Modules` enum).

## Data model

```
customer_plan(id, uuid, tenant_id, code,      -- PLN-001, per-tenant sequence
              name, description, status,
              price, cycle,
              allowance NULL, allowance_unit, overage_rate,
              rollover, free_pickups, extras_discount_percent,
              trial_days, min_cycles, setup_fee, auto_renew, featured,
              created_by, updated_by, created_at, updated_at)

customer_plan_service(plan_id, service_id)
customer_plan_branch(plan_id, branch_id)       -- no rows = every branch

customer_subscription(id, uuid, tenant_id, branch_id, customer_id, plan_id,
                      status,       -- TRIAL, ACTIVE, PAUSED, PAST_DUE, CANCELLED, EXPIRED
                      started_at, trial_ends_at NULL,
                      current_period_start, current_period_end,
                      cycles_completed, cancel_at_period_end BOOLEAN,
                      paused_at NULL, cancelled_at NULL, cancel_reason NULL,
                      price_snapshot, plan_snapshot_json,   -- terms when subscribed
                      created_by, created_at)

subscription_period(id, subscription_id, period_start, period_end,
                    allowance, carried_over, used, free_pickups_used,
                    overage_units, overage_amount, status)   -- OPEN, CLOSED, INVOICED

subscription_usage(id, period_id, order_id, units, source,   -- ORDER, MANUAL
                   created_at)
```

Plan terms are snapshotted on the subscription so later edits to the plan don't
change existing subscribers.

## Endpoints: plans

| Method | Path | Purpose |
|---|---|---|
| POST | `/customer-plans` | Create |
| GET | `/customer-plans` | List (`status`, `cycle`, `search`, `branch`) |
| GET | `/customer-plans/{uuid}` | One |
| PATCH | `/customer-plans/{uuid}` | Edit |
| POST | `/customer-plans/{uuid}/duplicate` | Copy as a draft |
| PATCH | `/customer-plans/{uuid}/status` | Activate, archive |
| DELETE | `/customer-plans/{uuid}` | Delete (only with no subscriptions ever) |
| GET | `/customer-plans/summary` | KPIs |

```json
{
  "name": "Family 30 kg",
  "description": "30 kg of wash and fold every month",
  "status": "ACTIVE",
  "price": 25000,
  "cycle": "MONTHLY",
  "allowance": 30,
  "allowanceUnit": "KG",
  "overageRate": 900,
  "rollover": false,
  "services": ["service-uuid-1", "service-uuid-2"],
  "freePickups": 4,
  "extrasDiscountPercent": 10,
  "branches": [],
  "trialDays": 7,
  "minCycles": 3,
  "setupFee": 0,
  "autoRenew": true,
  "featured": true
}
```

Rules:

- `name` unique per tenant. `price ≥ 0`, `overageRate ≥ 0`,
  `0 ≤ extrasDiscountPercent ≤ 100`, `minCycles ≥ 0`, `trialDays ≥ 0`.
- `allowanceUnit = KG` only if every selected service is priced per kg;
  `ITEMS` for per-item services; `ORDERS` for any.
- At least one service when `allowance` is set.
- Editing an active plan changes only future subscribers (and renewals when
  `applyToExisting` is sent and the caller is the owner; the customers are
  notified).
- Archiving stops new subscriptions; existing ones continue.
- Deleting with subscriptions is 409 `plan_has_subscribers`.
- `featured`: only one featured plan per branch scope.
- Response adds `subscribers` (active and trial count), `monthlyRevenue`
  (monthly-equivalent of active subscribers' prices), `code`.

`GET /customer-plans/summary`:

```json
{ "plans": 5, "active": 3, "draft": 1, "archived": 1, "subscribers": 142, "monthlyRecurringRevenue": 3480000, "churnLast30Days": 4 }
```

Monthly-equivalent: `WEEKLY × 52/12`, `QUARTERLY ÷ 3`, `YEARLY ÷ 12`.

## Endpoints: subscriptions

| Method | Path | Purpose |
|---|---|---|
| POST | `/customer-subscriptions` | Subscribe a customer |
| GET | `/customer-subscriptions` | List (`plan`, `customer`, `status`, `branch`) |
| GET | `/customer-subscriptions/{uuid}` | One, with the open period and usage |
| PATCH | `/customer-subscriptions/{uuid}/pause` | Pause |
| PATCH | `/customer-subscriptions/{uuid}/resume` | Resume |
| PATCH | `/customer-subscriptions/{uuid}/cancel` | Cancel now or at period end |
| POST | `/customer-subscriptions/{uuid}/usage` | Record usage by hand |
| GET | `/customer/{id}/subscription` | The customer's current subscription (profile tab) |

Subscribe:

```json
{ "customer": "customer-uuid", "plan": "plan-uuid", "branch": "branch-uuid", "startDate": "2026-11-01", "payment": { "amount": 25000, "method": "MOBILE_MONEY", "provider": "MTN_MOMO", "reference": "MP26…" } }
```

- The plan must be `ACTIVE` and sold at that branch; the customer must not
  already have an active subscription to the same plan (409
  `already_subscribed`).
- With a trial, status `TRIAL` until `trial_ends_at`, no charge; otherwise
  `ACTIVE` and the first charge (plus `setupFee`) is taken now, as a `payment`
  record (`01`) tagged with the subscription.
- Opens the first `subscription_period` (allowance, free pickups).

Cancel: `{ "atPeriodEnd": true, "reason": "Moving away" }`. Before `minCycles`
are completed, an immediate cancel needs a manager (the early-cancel fee, if
any, is a tenant setting).

## How usage is counted

- When an order is created or completed for a subscriber at a branch where the
  plan is sold, the lines for the plan's services draw from the open period:
  `units` = kg, items or 1 order, according to `allowanceUnit`. Use the order's
  completion (not creation) so cancelled orders consume nothing.
- Units beyond what is left (`allowance + carried_over − used`) are **overage**:
  `overage_units × overage_rate` is added to the order's total instead of the
  normal service price for those lines.
- A delivery or pickup job (`15`) uses a free trip while
  `free_pickups_used < free_pickups`, else its normal fee.
- Services outside the plan get `extrasDiscountPercent` off, in the quote
  engine (`09`) as an extra discount line.
- Return the draw in the order response: `{ "subscription": "…", "unitsUsed":
  12, "unitsLeft": 18, "overageUnits": 0 }`.

## Renewal (scheduled job, daily)

For every subscription whose period ended:

1. Close the period; if `rollover`, carry the unused allowance (never above
   one extra cycle's allowance).
2. If `cancel_at_period_end` → `CANCELLED`. If `minCycles` reached and not
   `auto_renew` → `EXPIRED`.
3. Otherwise charge the new price (snapshot). A failed or missing payment sets
   `PAST_DUE`; after the tenant's grace period (default 7 days) it becomes
   `EXPIRED`.
4. Open the next period.
5. Send the customer a renewal or payment-failed message (dispatcher, `12`),
   and a reminder 3 days before renewal.

Idempotency: one period row per (subscription, period_start).

## Permissions

| Action | Owner | Manager | Front desk | Others |
|---|---|---|---|---|
| Create, edit, archive plans | ✓ | ✓ | – | – |
| Delete plans | ✓ | – | – | – |
| Subscribe, pause, resume, cancel | ✓ | ✓ | ✓ | – |
| Record manual usage, early cancel | ✓ | ✓ | – | – |
| Read plans | ✓ | ✓ | ✓ | – |
