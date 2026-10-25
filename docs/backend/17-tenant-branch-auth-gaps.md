# 17. Tenants, branches, platform subscription and sign-in: remaining gaps

Priority P2. Status: **Partial**.

Several small gaps that don't justify their own file. Each has its own table.

---

## A. Tenants (platform admin)

### What the screen does

`pages/TenantsPage.tsx` is connected to `/tenant`. It shows a tenant's plan,
status (`trial`, `active`, `suspended`, `cancelled`), the owner, usage (branches,
users, orders this month), trial end, and lets the platform admin suspend,
reactivate or cancel a tenant with a note.

### Gaps

| Gap | Today |
|---|---|
| **Reason for suspension or cancellation** | `TenantRequest` has no field (`TenantsPage.tsx:142`), so the reason isn't kept |
| **Usage figures** (`currentShopCount`, `currentStaffCount`, `currentMonthOrderCount`) | `TenantResponse` doesn't return them, so the page shows zeros |
| **Trial end date** | Not returned (the platform subscription has it, the tenant response doesn't) |
| `hostname` and `slogan` | Accepted by `TenantRequest`, not returned |
| **Is this username or email free?** | The form only checks the tenants already loaded (`TenantsPage.tsx:321`, "the backend is the real check") |
| **Logo** | `TenantResponse.logo` is a `byte[]`, which JSON turns into a huge base64 string in every list row |

### Changes

Add to `tenant`: `status_reason TEXT NULL`, `status_changed_at`,
`status_changed_by`.

`PATCH /tenant/{tenantId}` accepts `status` and `statusReason`:

```json
{ "status": "SUSPENDED", "statusReason": "Unpaid invoice for October" }
```

- `statusReason` is required for `SUSPENDED` and `CANCELLED` (400
  `reason_required`); cleared when the status returns to `ACTIVE`.
- Suspending a tenant blocks all of its users from signing in and from every
  endpoint except the in-app inbox (the same rule as an expired
  subscription), and sends the owner an in-app notification and an email with
  the reason. Cancelling keeps data for the retention period.
- Write an audit entry (`TENANT`).
- Only the platform admin can change status (403 otherwise).

`TenantResponse` adds:

```json
{
  "hostname": "freshpress",
  "slogan": "Clean, on time",
  "logoUrl": "https://…/logo.png",
  "statusReason": "Unpaid invoice for October",
  "statusChangedAt": "2026-10-20T09:00:00",
  "trialEndsAt": "2026-11-05",
  "subscription": { "plan": "SOLO", "status": "ACTIVE", "endsAt": "2026-12-31" },
  "usage": { "branches": 3, "staff": 14, "ordersThisMonth": 812 },
  "limits": { "maxShops": 5, "maxStaff": 25, "maxOrdersPerMonth": 2000 }
}
```

- `usage` is counted live (branches, active users excluding the owner, orders
  created this calendar month). `limits` come from the plan; `null` = unlimited.
- Return `logoUrl` (a URL) instead of bytes; serve the file from
  `GET /tenant/{tenantId}/logo`. Keep `logo` upload as multipart.
- `GET /tenant` filters: `status`, `plan`, `search`, `createdFrom`, `createdTo`.

Availability: `GET /tenant/availability?username=&email=&hostname=` →

```json
{ "username": true, "email": false, "hostname": true }
```

`true` = free. Only the supplied fields are checked. Used by the tenant form for
live validation. Platform admin only, and rate-limited (it reveals which
usernames exist).

---

## B. Platform plan limits and subscription (tenant-facing)

### What the screens do

- **Platform Plans** (`PlatformPlansPage`) is connected to
  `/subscription-plans`. It needs a **Subscribe** button for the tenant (the
  original request in this project). The backend already has
  `POST /subscriptions { tenant, plan }`, `GET /subscriptions` and
  `PATCH /subscriptions/{id}/{status}`: **no backend work for the button
  itself**.
- Plans define `maxShops`, `maxStaff`, `maxOrdersPerMonth`, `trialPeriodDays`
  and `enabledFeatures`.

### Gaps

| Gap | Change |
|---|---|
| **Limits are not enforced.** `maxShops`, `maxStaff`, `maxOrdersPerMonth` aren't read by any service | Enforce on create: `POST /branch` (409 `plan_limit_shops`), `POST /users` (409 `plan_limit_staff`), `POST /order` (409 `plan_limit_orders`). Count against the tenant's current plan; return the limit and usage in the error so the UI can say "3 of 3 shops". A limit of `null` is unlimited. Downgrades never delete data: they only block new records |
| **Modules are not enforced.** `enabledFeatures` is stored but nothing checks it | `07` intersects permissions with the plan's modules; also reject calls to a disabled module's endpoints with 403 `module_not_in_plan` |
| **The tenant has no way to read its own subscription** | `GET /subscriptions/current` → `{ plan, status, startDate, endDate, trialEndsAt, scheduledNext }` for the caller's tenant (owner and managers); the Subscribe page and a banner use it. Also in `/users/me` (`07`) |
| **Plan change and renewal** | `POST /subscriptions` already starts now or schedules after the running one; add `POST /subscriptions/{id}/cancel` (at period end) and `…/change-plan { plan }` (upgrade now, prorated; downgrade at period end) |
| **Payment for the subscription** | A subscription is created with no charge. Add `subscription_invoice(id, tenant_id, subscription_id, amount, currency, period_start, period_end, status, paid_at, payment_reference)` and `GET /subscriptions/invoices`. Payment collection depends on the platform's billing provider; until then, the platform admin marks invoices paid with `PATCH /subscriptions/invoices/{id} { "status": "PAID", "reference": "…" }` |
| **Expiry handling** | `SubscriptionExpiryEvent` exists (notifications). Add the state change: after `endDate` plus the grace period (default 7 days) the status becomes `EXPIRED` and access narrows as described in `07` |

---

## C. Branch overview

### What the screen does

`BranchesPage` and `BranchDetailPage` are connected to `/branch` for the
profile (hours, special days, closure, services, capacity, payment methods).
The performance side is fabricated in the browser: `BranchStats` has fields
such as `seed`, `baseOrders`, `downDays` and `downFactor` that exist only to
generate fake history; the staff, machines and stock tabs show sample rows and
"changes to them only live in the cached list" (`hooks/useBranches.ts`).

### Endpoint: `GET /branch/{uuid}/overview?date=`

```json
{
  "asOf": "2026-10-25T10:45:00",
  "stats": {
    "ordersToday": 64, "revenueToday": 1180000,
    "activeOrders": 91, "processing": 33, "ready": 18,
    "pendingDelivery": 9, "outForDelivery": 5, "deliveredToday": 21,
    "overdue": 4, "customers": 812, "newCustomers": 9,
    "completionPercent": 93, "onTimePercent": 94, "cancelRatePercent": 2.1,
    "satisfaction": 4.5,
    "machineUtilization": 68, "staffUtilization": 74, "inventoryHealth": 88
  },
  "history": [ { "date": "2026-10-24", "orders": 71, "revenue": 1290000 } ],
  "staff": [ { "uuid": "…", "name": "Elena Rostova", "role": "Wash Tech", "ordersProcessed": 14, "workload": 78, "performance": 96, "status": "ACTIVE" } ],
  "machines": [ { "uuid": "…", "code": "WM-002", "name": "Washer 2", "type": "WASHING_MACHINE", "status": "RUNNING", "job": "ORD-10452", "utilization": 81, "nextMaintenanceAt": "2026-11-02" } ],
  "stock": [ { "uuid": "…", "name": "Detergent", "unit": "L", "onHand": 18, "reorderAt": 20 } ]
}
```

Everything is derived from existing or planned modules; no new tables:

| Field | Source |
|---|---|
| `ordersToday`, `revenueToday`, `activeOrders`, `overdue`, `completionPercent`, `onTimePercent`, `cancelRatePercent` | `orders` for the branch (revenue per `01`) |
| `processing`, `ready` | Processing jobs (`03`), or order status counts |
| `pendingDelivery`, `outForDelivery`, `deliveredToday` | `dispatch_job` (`SCHEDULED`/`ASSIGNED`, `EN_ROUTE`/`ARRIVED`, `COMPLETED` today) |
| `customers`, `newCustomers` | Customers of the branch, registered today |
| `satisfaction` | Average `order_rating` (`16`); `null` until it exists |
| `machineUtilization`, machines list | `04` |
| `staffUtilization`, staff list | `06` (`workload ÷ capacity`, status from today's attendance) |
| `inventoryHealth`, stock list | Share of items not `LOW`/`CRITICAL`/`OUT`, lowest first |
| `history` | Daily orders and revenue for the last 14 days |

Staff `status` values: `ACTIVE`, `ON_BREAK`, `OFF_SHIFT`.

Scope: a tenant owner and platform admin for any branch; a manager for their
own branch.

`GET /branch` (list) should include a light version (`ordersToday`,
`revenueToday`, `activeOrders`, `machineUtilization`) so the branches table
doesn't call `/overview` per row.

Remove the fabricated fields (`seed`, `baseOrders`, `baseRevenue`,
`downDays`, `downFactor`) from the frontend type once this exists.

---

## D. Sign-in and sessions

### What the screens do

`LoginPage`, `OtpPage`, `ForgotPasswordPage`, `ResetPasswordPage` are
connected to `/auth` and `/otp`.

| Gap | Today | Change |
|---|---|---|
| **OTP by voice call** | "Resend by call" button exists but `resend_otp` can only send by the user's channel (`OtpForm.tsx:278`) | `POST /otp/resend_otp/{uuid}` accepts `{ "channel": "SMS" \| "EMAIL" \| "VOICE" }`. `VOICE` calls the user and reads the code (needs a voice provider; return 501 `channel_not_supported` until configured, and the frontend hides the button when the platform reports it unsupported: `GET /app_config` → `otpChannels: ["SMS","EMAIL"]`). Limit resends: 3 per 10 minutes per user (429) |
| **Sign out other devices after a password reset** | The reset form has a "sign out everywhere" intent but can't send it (`ResetPasswordForm.tsx:114`) | `POST /auth/reset_password/{uuid}` accepts `signOutOthers: true`. The backend already has `RevokedToken`: revoke every refresh token of the user (store a `tokens_valid_after` timestamp on the user and reject any token issued before it; cheaper than listing tokens). Make this the **default** after a reset, since the old password may have been compromised |
| **Confirm password** | Only checked in the browser | Optional `confirmPassword` in the body, validated server-side (400 `passwords_do_not_match`) |
| **Active sessions** | Not shown | `GET /auth/sessions` lists the caller's refresh tokens (`device`, `ip`, `lastUsedAt`, `current`), `DELETE /auth/sessions/{id}` and `DELETE /auth/sessions` (all except current). Needs a `refresh_session` table written at login |
| **Login attempts** | `LoginAttempt` entity exists | Expose to the platform admin and owner: `GET /auth/login-attempts?user=&from=&to=` (successes and failures with IP), for the security view |
| **Account lock** | `LoginAttemptService` exists | Return a clear `account_locked` error with `retryAfterSeconds` so the login form can show a countdown, and let an owner or manager unlock a staff account: `POST /users/{uuid}/unlock` |
| **Two-factor** | `twoFactorRequired` is a flag on the user, and OTP is already used at login (`Steps`) | Document the rule: a user with `twoFactorRequired = true` always completes the OTP step; others skip it when the device is trusted. Add `POST /auth/trust-device` if "remember this device for 30 days" is wanted |

---

## E. Smaller items

| Item | Detail |
|---|---|
| `GET /users/availability?username=&email=` | `{ "username": true, "email": false }` for the Add Staff wizard, so duplicates are caught before the last step (the page now only learns from the 409 on create) |
| `PATCH /users/{uuid}` and `DELETE` | Return 409 `user_has_open_work` when the user has open tasks, jobs or orders assigned, listing the counts, so the UI can offer reassignment instead of a generic failure |
| Branch deletion | `DELETE /branch/{uuid}` must refuse with 409 when it still has orders, staff, machines, stock or open jobs, and return the counts |
| `GET /app_config` | Public subset (no secrets): `otpChannels`, `supportEmail`, `termsUrl`, `maintenanceMode` and a message. Lets the login page show a maintenance banner |
