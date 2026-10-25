# 11. Promotions and discount codes

Priority P3. Status: **Missing**. The backend has an empty `Discount` entity
(`branch`, `promoCode`) and nothing else.

## What the screens do

`pages/PromotionsPage.tsx` (`constants/samplePromotions.ts`, `// TODO: replace
this in-memory list with the promotions API`) has a campaign builder, a list
with filters, a detail view with statistics, and stacking settings. A
promotion has:

| Field | Meaning |
|---|---|
| `name`, `description`, `notes`, `banner` | Descriptive |
| `code` / `automatic` | A code customers type, or applied automatically |
| `type` | `PERCENTAGE`, `FIXED`, `FREE_DELIVERY`, `FIRST_ORDER`, `LOYALTY`, `REFERRAL`, `BUNDLE`, `VOLUME`, `SEASONAL` |
| `discountKind`, `value`, `maxDiscount`, `tiers` | `PERCENT`, `AMOUNT`, `FREE_DELIVERY`, `TIERED` (spend tiers: min spend → percent) |
| `bundleNote` | Text for bundle offers |
| `audience` | `ALL`, `NEW`, `LOYALTY`, `VIP`, `CORPORATE`, `REFERRED`, `SPECIFIC` (named customers) |
| `branches`, `services` | Where and on what it applies (empty = all) |
| `minOrder`, `stackable` | Conditions |
| `startAt`, `endAt`, `days` | Dates and the weekdays it runs |
| `usageLimit`, `perCustomerLimit`, `budget` | Caps |
| `channels` | Where it is announced |
| `state` | Stored state: `DRAFT`, `PUBLISHED`, `PAUSED`, `ARCHIVED` |

Derived status shown in the list: `SCHEDULED` (published, not started),
`ACTIVE`, `EXPIRED` (ended, or a cap was reached), plus the stored states.
Stats: uses, revenue generated, discount given, reach; each compared with the
previous period. A history of events (who created, published, paused…). A
stacking policy: none, with delivery only, or all, with a maximum combined
discount.

## Data model

```
promotion(id, uuid, tenant_id, code NULL,          -- unique per tenant when set
          name, description, notes, banner_url NULL,
          automatic BOOLEAN,
          type, discount_kind, value, max_discount NULL,
          bundle_note NULL,
          audience, min_order DEFAULT 0, stackable,
          start_at DATE, end_at DATE NULL,
          usage_limit NULL, per_customer_limit NULL, budget NULL,
          state, created_by, created_at, updated_at)

promotion_tier(promotion_id, min_spend, percent)
promotion_branch(promotion_id, branch_id)            -- none = every branch
promotion_service(promotion_id, service_id)          -- none = whole order
promotion_day(promotion_id, weekday)                 -- none = every day
promotion_customer(promotion_id, customer_id)        -- audience SPECIFIC
promotion_channel(promotion_id, channel)             -- SMS, EMAIL, WHATSAPP, IN_APP, POSTER …

promotion_redemption(id, promotion_id, order_id, customer_id,
                     discount_amount, order_total, at)   -- UNIQUE(promotion_id, order_id)

tenant_promotion_policy(tenant_id, stacking_mode,       -- NONE, WITH_DELIVERY, ALL
                        max_combined_percent)
```

Replace the empty `Discount` entity by these tables.

Every state change writes an audit entry (`entityType = PROMOTION`); the detail
view's history is `GET /audit?entityType=PROMOTION&entity=<uuid>`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/promotions` | Create (draft or published) |
| GET | `/promotions` | List (`status`, `type`, `branch`, `service`, `audience`, `from`, `to`, `search`) |
| GET | `/promotions/{uuid}` | One with stats |
| PATCH | `/promotions/{uuid}` | Edit |
| PATCH | `/promotions/{uuid}/state` | Publish, pause, resume, archive |
| POST | `/promotions/{uuid}/duplicate` | Copy as a draft |
| DELETE | `/promotions/{uuid}` | Delete a draft with no redemptions |
| POST | `/promotions/validate` | Check a code for an order |
| GET | `/promotions/{uuid}/redemptions` | Who used it |
| GET | `/promotions/{uuid}/reach?` | Audience size preview |
| GET/PUT | `/promotions/policy` | Stacking policy |

Create or edit:

```json
{
  "name": "Welcome 15 %",
  "code": "WELCOME15",
  "automatic": false,
  "description": "15 % off the first order",
  "type": "FIRST_ORDER",
  "discountKind": "PERCENT",
  "value": 15,
  "maxDiscount": 5000,
  "tiers": [],
  "audience": "NEW",
  "customers": [],
  "branches": ["branch-uuid"],
  "services": [],
  "minOrder": 3000,
  "stackable": false,
  "startAt": "2026-11-01",
  "endAt": "2026-11-30",
  "days": [],
  "usageLimit": 200,
  "perCustomerLimit": 1,
  "budget": 600000,
  "channels": ["SMS", "IN_APP"],
  "state": "PUBLISHED"
}
```

Validation:

- `code` unique per tenant, case-insensitive, 3–20 letters, digits or dashes;
  absent when `automatic`. An automatic promotion with no code needs
  `audience` and conditions that can be checked without one.
- `value`: percent 0–100; amount > 0. `FREE_DELIVERY` has no value. `TIERED`
  needs at least one tier, ascending `minSpend`.
- `endAt ≥ startAt`. `usageLimit`, `perCustomerLimit`, `budget` > 0 when set.
- `audience = SPECIFIC` needs `customers`; `NEW` / `FIRST_ORDER` means the
  customer has no completed order.
- Editing a published promotion that already has redemptions can't change its
  `code`, `type` or `discountKind` (409 `promotion_in_use`).

### Status

`GET` returns `state` (stored) and `status` (derived):

| Condition | `status` |
|---|---|
| `state = DRAFT / PAUSED / ARCHIVED` | the same |
| `PUBLISHED` and `startAt` in the future | `SCHEDULED` |
| `PUBLISHED`, within dates and caps | `ACTIVE` |
| `PUBLISHED` and ended, or `usageLimit` or `budget` reached | `EXPIRED` |

Derive it at read time; no job is needed to flip it.

### Validate a code: `POST /promotions/validate`

Used by the order form when the cashier types a code or when automatic offers
are checked. It never stores anything.

```json
{
  "code": "WELCOME15",
  "customer": "customer-uuid",
  "branch": "branch-uuid",
  "lines": [ { "service": "service-uuid", "amount": 9000 } ],
  "subtotal": 9000,
  "fulfilment": "DELIVERY",
  "deliveryFee": 1000,
  "at": null
}
```

Response:

```json
{
  "valid": true,
  "promotion": { "uuid": "…", "name": "Welcome 15 %", "code": "WELCOME15" },
  "discount": 1350,
  "freeDelivery": false,
  "lines": [ { "label": "Welcome 15 %", "amount": -1350, "kind": "DISCOUNT" } ],
  "reason": null,
  "alsoApplied": []
}
```

When not valid, `valid: false` and `reason` is a code the UI translates:
`not_found`, `not_started`, `expired`, `paused`, `branch_not_eligible`,
`service_not_eligible`, `audience_not_eligible`, `below_minimum`,
`day_not_allowed`, `usage_limit_reached`, `customer_limit_reached`,
`budget_exhausted`, `not_stackable`.

Calculation:

1. Check state, dates, weekday, branch, audience, minimum order, caps (count
   `promotion_redemption` rows; `perCustomerLimit` per customer).
2. The base is the subtotal of the eligible services (or the whole order if
   `services` is empty).
3. `PERCENT`: base × value %, capped at `maxDiscount`. `AMOUNT`: min(value,
   base). `TIERED`: the percent of the highest tier whose `minSpend` ≤ base.
   `FREE_DELIVERY`: sets `freeDelivery`.
4. **Stacking**: if several promotions apply (automatic ones plus a code), the
   tenant policy decides: `NONE` = the single best discount; `WITH_DELIVERY` =
   one discount plus free delivery; `ALL` = all that are `stackable`, with the
   total capped at `max_combined_percent` of the subtotal.
5. Budget: stop applying when `budget − Σ discount_amount < discount`.

Automatic promotions: `POST /promotions/validate` with `"code": null` returns
the automatic ones that apply (the order form calls it whenever lines change).
The same function is used by the quote engine (`09`) and by `POST /order`, so
the order stores the promotion and the discount it actually got
(`discount_amount`, `promotion_id`). The redemption row is written when the
order is created, and removed if the order is cancelled before completion.

### Detail and statistics: `GET /promotions/{uuid}`

```json
{
  "uuid": "…", "name": "Welcome 15 %", "state": "PUBLISHED", "status": "ACTIVE",
  "stats": { "uses": 84, "revenue": 1260000, "discount": 189000, "reach": 640 },
  "previous": { "uses": 51, "revenue": 790000, "discount": 118500, "reach": 520 },
  "createdBy": "Marcus Vance", "createdAt": "2026-10-28T10:00:00"
}
```

- `uses` = redemptions, `revenue` = Σ `order_total` of redeemed orders,
  `discount` = Σ `discount_amount`.
- `reach` = customers the promotion was sent to (from `message_log` rows with
  `related_type = PROMOTION`) plus in-app impressions if tracked.
- `previous` = the same figures for the previous period of the same length.

### Announcing a promotion

Publishing with `channels` queues messages through the dispatcher (`12`) to the
audience (respecting consent and marketing opt-in), tagged
`related = PROMOTION`. A separate `POST /promotions/{uuid}/announce
{ "channels": ["SMS"], "scheduledFor": null }` allows re-sending. The response
counts recipients and skipped customers.

### Policy: `PUT /promotions/policy`

```json
{ "mode": "WITH_DELIVERY", "maxCombined": 30 }
```

Owner only.

## Permissions

| Action | Owner | Manager | Front desk |
|---|---|---|---|
| Create, edit, pause, archive | ✓ | ✓ (their branch only) | – |
| Publish, delete, change policy | ✓ | – | – |
| Validate a code (order form) | ✓ | ✓ | ✓ |
| Read, statistics | ✓ | ✓ | – |
