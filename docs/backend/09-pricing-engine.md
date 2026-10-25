# 09. Pricing: groups, surcharges, taxes, tiers, history, quotes

Priority P2. Status: **Partial** (service prices exist).

## What the screen does

`pages/PricingPage.tsx` lists the real services (`useServices()`, from
`/service`, including `basePrice`, `itemPrices` and per-branch
`priceOverride`). Everything around the price list is sample data
(`constants/pricing.ts`, the `// TODO: replace with the pricing API` note):

- **Customer groups** with a percentage discount (Standard 0 %, VIP 10 %,
  Corporate 15 %, Hotel 20 %, Wholesale 25 %, Staff 30 %).
- **Surcharges** (percent or fixed, with a condition): same-day, weekend,
  holiday, heavy stain, special handling; each can be switched on or off.
- **Taxes** (name, rate, what it applies to, on or off).
- **Quantity tiers** per service ("from 10 kg the price is 1 200").
- A "free delivery above" amount, and delivery zones with fees.
- **Price change history** and **scheduled price changes**.
- **Bulk adjustment** (raise or lower a category by a percentage or fixed
  amount, round to a multiple, optionally include branch overrides) with a
  preview, and **price import** from a file.
- A **quote calculator**: pick a service, quantity, customer group, speed,
  branch and zone, surcharges, and see every line of the price.

## What the backend has

- Service prices: `basePrice`, `itemPrices`, `minQty`, `maxQty`, express
  pricing (`ServiceExpress`), and branch availability with a price override
  (`ServiceBranchSetting`).
- `PriceConfig` (`code`, `name`, `description`, `price`, `active`,
  `articleType`, branch, service) with `/price-configs` CRUD.
- Delivery fees: `DeliveryZone` (`collectionFee`, `deliveryFee`) and
  `LogisticsSettings` (`pickupFee`, `expressSurcharge`, `sameDaySurcharge`,
  `freeDeliveryThreshold`, `delayLimitMinutes`), used when a delivery job is
  created.

So three things in the frontend config already exist on the backend and must
**not** be duplicated:

| Frontend config | Use instead |
|---|---|
| `zones` (name, distance, delivery fee, pickup fee, minimum order) | `DeliveryZone` and `/delivery-zones`. Remove the zones section from the Pricing page; add `minOrder` to `DeliveryZone` if still wanted |
| `freeDeliveryAbove` | `LogisticsSettings.freeDeliveryThreshold` |
| Express and same-day surcharge amounts for deliveries | `LogisticsSettings.expressSurcharge` and `sameDaySurcharge` |

`PriceConfig` and `ServiceItemPrice` both hold article-type prices. Pick one
source of truth: treat the service's `itemPrices` as the price list, and
`PriceConfig` as an optional **branch-level override per article type**.
The quote engine below resolves in that order.

## Data model (new)

```
customer_group(id, uuid, tenant_id, code, name, discount_percent, note, active,
               created_at)
-- add to customer: price_group_id FK NULL (default group = the one with code STANDARD)

surcharge(id, uuid, tenant_id, branch_id NULL,        -- NULL = every branch
          code,           -- SAME_DAY, WEEKEND, HOLIDAY, HEAVY_STAIN, SPECIAL_HANDLING, or custom
          name, kind,     -- PERCENT, FIXED
          value, condition_text,
          auto_apply_rule,  -- NONE, SAME_DAY_DUE, WEEKEND_INTAKE, HOLIDAY_INTAKE
          enabled, created_at)

tax(id, uuid, tenant_id, name, rate_percent, applies_to,   -- ALL, SERVICES, DELIVERY
    enabled, created_at)

price_tier(id, service_id, from_quantity, price)           -- below the first tier the base price applies

price_change_schedule(id, uuid, tenant_id, service_id, branch_id NULL,
                      new_price, effective_at DATE, reason,
                      status,            -- SCHEDULED, APPLIED, CANCELLED
                      created_by, applied_at NULL)

public_holiday(id, tenant_id, day DATE, name)              -- used by HOLIDAY auto-apply
```

Price history is the audit log (README, A) with `entityType = PRICE`, one
entry per change: `{ serviceId, serviceName, scope ("Global" or a branch), from,
to, reason }`. Every code path that changes a service price (edit, bulk,
import, scheduled change, branch override) writes one.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/pricing/groups` | Customer groups |
| GET/POST/PATCH/DELETE | `/pricing/surcharges` | Surcharges |
| GET/POST/PATCH/DELETE | `/pricing/taxes` | Taxes |
| GET/PUT | `/service/{uuid}/tiers` | A service's quantity tiers |
| GET | `/pricing/history` | Price change history |
| GET/POST/DELETE | `/pricing/scheduled` | Scheduled changes |
| POST | `/pricing/bulk/preview` | Preview a bulk adjustment |
| POST | `/pricing/bulk/apply` | Apply it |
| POST | `/pricing/import` | Import prices from a file |
| GET | `/pricing/export` | Export the price list |
| POST | `/pricing/quote` | Price an order |
| PATCH | `/customer/{id}` | `priceGroup` field (uuid) |

Permissions: reading is for everyone who can create orders (the quote). Changing
anything is `PRICING:EDIT`, bulk and import `PRICING:BULK_EDIT`, scheduling
`PRICING:SCHEDULE` (see `07`).

### Groups, surcharges, taxes

```json
// POST /pricing/groups
{ "code": "HOTEL", "name": "Hotel", "discountPercent": 20, "note": "Hospitality linen contracts" }

// POST /pricing/surcharges
{ "code": "SAME_DAY", "name": "Same-Day Service", "kind": "PERCENT", "value": 60,
  "conditionText": "Order must be ready the same day", "autoApplyRule": "SAME_DAY_DUE",
  "branch": null, "enabled": true }

// POST /pricing/taxes
{ "name": "VAT", "ratePercent": 19.25, "appliesTo": "ALL", "enabled": true }
```

- `discountPercent` 0–100; `value` for `PERCENT` surcharges 0–1000; `ratePercent`
  0–100.
- Deleting a group that customers use is 409 `group_in_use` (offer to move
  them to Standard).
- The `STANDARD` group can't be deleted.

### Tiers: `PUT /service/{uuid}/tiers`

```json
{ "tiers": [ { "from": 10, "price": 1200 }, { "from": 25, "price": 1000 } ] }
```

`from` strictly increasing, `price` decreasing or equal. Replaces the list.
Only for services with `pricingModel` that supports tiers (per kg, per item).

### History: `GET /pricing/history?service=&branch=&from=&to=&page=&size=`

```json
{ "at": "2026-10-20T09:12:00", "service": { "uuid": "…", "name": "Wash & Fold" }, "scope": "Global", "from": 1500, "to": 1800, "by": "Marcus Vance", "reason": "Detergent cost increase" }
```

### Scheduled changes: `POST /pricing/scheduled`

```json
{ "service": "service-uuid", "branch": null, "newPrice": 1800, "effectiveAt": "2026-11-01", "reason": "November tariff" }
```

- `effectiveAt` must be in the future. One scheduled change per
  (service, branch, date).
- A daily job at 00:05 applies due changes (sets the price, writes the history
  entry with the reason, marks `APPLIED`) and notifies the creator. It must be
  idempotent.

### Bulk adjustment

`POST /pricing/bulk/preview` and `/apply` take the same body (the frontend's
`BulkAdjustment`):

```json
{
  "category": "Laundry",
  "services": null,
  "branch": null,
  "direction": "INCREASE",
  "kind": "PERCENT",
  "value": 8,
  "roundTo": 50,
  "includeOverrides": false,
  "reason": "Annual increase"
}
```

- `services` (a list of uuids) overrides `category` when set.
- New price = `old ± (old × value / 100)` or `old ± value`, then rounded to the
  nearest multiple of `roundTo` (1 keeps it exact), never below 0.
- Applies to the base price and to each item price. Branch overrides are only
  changed when `includeOverrides` is true.
- `preview` returns the affected services with old and new prices and changes
  nothing; `apply` does it in one transaction, writes one history entry per
  service price changed, and returns the same list.

```json
{ "affected": [ { "service": { "uuid": "…", "name": "Wash & Fold" }, "from": 1500, "to": 1620 } ], "totalServices": 12 }
```

### Import: `POST /pricing/import`

`multipart/form-data`: `file` (CSV with `serviceCode,price,expressPrice`) and
`reason`. Validate the whole file first: unknown codes and negative prices are
reported per row, and nothing is applied if any row is invalid (`dryRun=true`
returns the report only). Response: `{ updated, unchanged, errors:
[{ row, message }] }`.

### Quote: `POST /pricing/quote`

This moves `calculateQuote` (`utils/pricing.ts`) to the server, so the same
numbers are used by the quote calculator and when an order is created.

```json
{
  "branch": "branch-uuid",
  "customer": "customer-uuid",
  "priceGroup": null,
  "speed": "EXPRESS",
  "fulfilment": "DELIVERY",
  "zone": "zone-uuid",
  "dueAt": "2026-10-25T18:00:00",
  "intakeAt": null,
  "surcharges": ["HEAVY_STAIN"],
  "lines": [
    { "service": "service-uuid", "itemType": "SHIRT", "quantity": 3, "weightKg": null }
  ]
}
```

Calculation, in order:

1. **Unit price** per line: item price if an `itemType` is given, else the base
   price; replaced by a `PriceConfig` branch override for that article type if
   one exists, then by the branch `priceOverride`; then the quantity tier whose
   `from` ≤ quantity; `EXPRESS` uses the express price or the express uplift of
   the service.
2. **Line amount** = unit price × quantity (or × `weightKg` for per-kg
   services). Respect `minQty` and `maxQty` (400 with the limit).
3. **Group discount**: `priceGroup` (or the customer's group) % off the
   service subtotal.
4. **Surcharges**: explicitly listed codes, plus those whose `autoApplyRule`
   matches (`SAME_DAY_DUE`: `dueAt` the same day as intake; `WEEKEND_INTAKE`;
   `HOLIDAY_INTAKE` against `public_holiday`). Percent surcharges apply to the
   discounted subtotal.
5. **Delivery**: for `DELIVERY`, the zone's `deliveryFee` plus the branch's
   express or same-day delivery surcharge; free when the discounted subtotal
   reaches `LogisticsSettings.freeDeliveryThreshold` (0 = never free). A
   pickup uses the zone's `collectionFee`.
6. **Taxes**: enabled taxes, each on what it `appliesTo`.
7. Promotions (`11`), when the request carries a `promoCode`.

```json
{
  "currency": "XAF",
  "lines": [
    { "label": "Shirt × 3", "amount": 4500, "kind": "BASE" },
    { "label": "VIP discount (10 %)", "amount": -450, "kind": "DISCOUNT" },
    { "label": "Express service (60 %)", "amount": 2430, "kind": "SURCHARGE", "note": "Same-day" },
    { "label": "Delivery (Zone A)", "amount": 1000, "kind": "DELIVERY" },
    { "label": "VAT (19.25 %)", "amount": 1040, "kind": "TAX" }
  ],
  "subtotal": 4050,
  "total": 8520
}
```

`POST /order` must call the same function and store the breakdown
(`02-orders-extensions.md` fields) instead of trusting a client total.

## Permissions

| Action | Owner | Manager | Front desk |
|---|---|---|---|
| Quote | ✓ | ✓ | ✓ |
| Edit prices, groups, surcharges, taxes | ✓ | ✓ (their branch overrides only) | – |
| Bulk, import, schedule | ✓ | – | – |
| Read history | ✓ | ✓ | – |
