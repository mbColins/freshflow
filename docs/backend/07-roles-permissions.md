# 07. Roles and permissions (access control)

Priority P1. Status: **Missing**.

## What the screens do

- The **Roles** page (new) creates roles with a name, description and scope
  (platform default, whole business, one branch) and gives them to staff.
- The Staff wizard shows a **permission preview** per role: for each module
  (Orders, Payments, Inventory, Staff, Reports), which actions the role gets.
  Today that preview comes from a hardcoded table
  (`ROLE_TEMPLATES` in `constants/staff.ts`) labelled "placeholder until
  permissions are enforced by the backend".
- Almost every page has a "Viewing as" switch (admin, manager, receptionist,
  staff) kept in `localStorage`. It decides which buttons show. It is a
  preview, not the real user's rights.
- Several pages have `TODO: show only to platform admins once the API exposes
  the user's role` (Tenants, Platform Plans, the branch wizard's tenant picker).

## What the backend has

`Roles(name, description, tenant, branch, scope)` with the access rules in
`RoleController` (platform admin, tenant owner, manager). A `Menu` entity
(`id` such as `ORDERS`, `name`, `description`) "used by RBAC" and not
referenced by anything. Users have a `role` and a `userType`. Controllers
decide access by `userType` and branch, so every endpoint has its own
`if (utils.isTenantOwner(...))` checks. A role grants nothing.

## Goal

A role is a set of permissions. The server enforces them on every endpoint, and
the UI reads the signed-in user's permissions from `/users/me` to hide what
they can't use, instead of the "Viewing as" switches.

## Data model

```
menu(id PK 'ORDERS', name, description, sort_order, platform_only BOOLEAN)   -- exists; add the two columns

permission(code PK,           -- 'PAYMENTS:REFUND'
           menu_id FK,        -- 'PAYMENTS'
           action,            -- 'REFUND'
           description)

role_permission(role_id, permission_code, PRIMARY KEY(role_id, permission_code))
```

The `Roles` entity keeps its scope rules. A role's permissions can only be
set by someone allowed to change that role (`RoleController` rules: admin, owner,
or a manager for their branch's roles), and **never beyond what they hold
themselves** (409 `cannot_grant_unheld_permission`), so a manager can't create a
role stronger than their own.

### Seed data

Menus (`platform_only` marks the last two):

`DASHBOARD, ORDERS, CUSTOMERS, SERVICES, OPERATIONS, LOGISTICS, PAYMENTS,
INVENTORY, STAFF, ROLES, REPORTS, NOTIFICATIONS, BRANCHES, MACHINES, PRICING,
PROMOTIONS, SETTINGS, TENANTS, PLATFORM_PLANS`

Permissions (`MENU:ACTION`). Where the UI already names actions, keep them:

| Menu | Actions |
|---|---|
| `ORDERS` | `VIEW`, `CREATE`, `EDIT`, `ASSIGN`, `CANCEL`, `QC`, `IMPORT` |
| `CUSTOMERS` | `VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT`, `IMPORT`, `MESSAGE` |
| `SERVICES` | `VIEW`, `CREATE`, `EDIT`, `DELETE` |
| `OPERATIONS` | `VIEW`, `PROCESS`, `OVERRIDE` (move out of order) |
| `LOGISTICS` | `VIEW`, `SCHEDULE`, `ASSIGN`, `MANAGE_DRIVERS`, `MANAGE_ZONES`, `SETTINGS` |
| `PAYMENTS` | `VIEW`, `RECORD`, `REFUND`, `APPROVE_REFUND`, `RECONCILE`, `SETTINGS` |
| `INVENTORY` | `VIEW`, `ADD_STOCK`, `ADJUST`, `TRANSFER`, `PURCHASE`, `APPROVE_PURCHASE`, `MANAGE_ITEMS` |
| `STAFF` | `VIEW`, `CREATE`, `EDIT`, `DELETE`, `ATTENDANCE`, `ASSIGN`, `LEAVE_APPROVE`, `PERFORMANCE`, `MANAGE_PERMISSIONS` |
| `ROLES` | `VIEW`, `MANAGE` |
| `REPORTS` | `VIEW`, `EXPORT` |
| `NOTIFICATIONS` | `VIEW`, `SEND`, `MANAGE_TEMPLATES`, `MANAGE_RULES` |
| `BRANCHES` | `VIEW`, `CREATE`, `EDIT`, `DELETE` |
| `MACHINES` | `VIEW`, `OPERATE`, `MANAGE`, `MAINTAIN` |
| `PRICING` | `VIEW`, `EDIT`, `BULK_EDIT`, `SCHEDULE` |
| `PROMOTIONS` | `VIEW`, `CREATE`, `EDIT`, `PUBLISH` |
| `SETTINGS` | `VIEW`, `EDIT_BUSINESS` |
| `TENANTS`, `PLATFORM_PLANS` | `VIEW`, `MANAGE` (platform admin only) |

Default roles (seed `role_permission` for the existing seeded roles, and offer
these as templates when a tenant creates a role):

| Role | Gets |
|---|---|
| `SYSTEM_ADMIN` | Everything, including `TENANTS` and `PLATFORM_PLANS` |
| `TENANT` | Everything except the two platform menus |
| `MANAGER` | Everything except `ROLES:MANAGE`, `STAFF:MANAGE_PERMISSIONS`, `SETTINGS:EDIT_BUSINESS`, `INVENTORY:APPROVE_PURCHASE`, `BRANCHES:DELETE` |
| `STAFF` | `ORDERS:VIEW`, `CUSTOMERS:VIEW`, `OPERATIONS:VIEW`, `OPERATIONS:PROCESS`, `INVENTORY:VIEW`, `INVENTORY:ADD_STOCK`, `MACHINES:VIEW`, `MACHINES:OPERATE`, `NOTIFICATIONS:VIEW` |

Template roles the Staff wizard names today, to seed as tenant roles on
tenant creation: Receptionist (orders view, create, edit; payments view,
record; inventory view; staff view), Cashier (orders view; payments view,
record), Laundry Operator (orders view, edit; operations view, process;
inventory view), Quality Control (orders view, qc; operations view),
Driver (orders view; logistics view), Inventory Staff (orders view;
inventory view, add stock, transfer).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/permissions/catalog` | All menus with their actions |
| GET | `/role/{uuid}/permissions` | A role's permissions |
| PUT | `/role/{uuid}/permissions` | Replace a role's permissions |
| GET | `/users/me` | Extended with the caller's effective permissions |

### Catalog: `GET /permissions/catalog`

```json
[
  { "menu": "PAYMENTS", "name": "Payments", "platformOnly": false,
    "actions": [
      { "code": "PAYMENTS:VIEW", "action": "VIEW", "description": "See the payments register" },
      { "code": "PAYMENTS:RECORD", "action": "RECORD", "description": "Record a payment" }
    ] }
]
```

Platform-only menus are returned only to a platform admin.

### Set a role's permissions: `PUT /role/{uuid}/permissions`

```json
{ "permissions": ["ORDERS:VIEW", "ORDERS:CREATE", "ORDERS:EDIT", "PAYMENTS:VIEW", "PAYMENTS:RECORD"] }
```

- Replaces the whole set. Unknown codes are 400 `unknown_permission`.
- Subject to the role's edit rules and to "not more than you hold".
- A platform role's permissions can only be changed by a platform admin.
- Writes an audit entry (`ROLE`, "Permissions changed", before and after).
- Existing users with the role get the change on their next request. Tokens
  must not carry permissions; read them from the database (cached for a few
  seconds) so a change takes effect without a new login.

`GET` returns the same list plus `menus` as the catalog groups.

### Effective permissions on `/users/me`

Add to the existing response:

```json
{
  "role": { "uuid": "…", "name": "Cashier", "scope": "BRANCH" },
  "platformAdmin": false,
  "tenantOwner": false,
  "permissions": ["ORDERS:VIEW", "PAYMENTS:VIEW", "PAYMENTS:RECORD"],
  "menus": ["DASHBOARD", "ORDERS", "PAYMENTS"],
  "modules": ["ORDER_TRACKING", "CUSTOMER_PROFILES", "RECEIPT_PRINTING"],
  "subscription": { "status": "ACTIVE", "plan": "SOLO", "endsAt": "2026-12-31" }
}
```

- `permissions` = the role's permissions **intersected with the tenant's plan
  modules**. A permission whose menu isn't enabled by the plan is dropped
  (map the plan's `Modules` to menus, e.g. `STAFF_ATTENDANCE_TRACKING` and
  `SHIFT_SCHEDULING` enable `STAFF:ATTENDANCE`, `ADVANCED_ANALYTICS` enables
  `REPORTS`). Publish this mapping as a constant.
- `TENANT` and `SYSTEM_ADMIN` users get everything their user type allows
  (`platformAdmin` is true only for `SYSTEM_ADMIN`). This replaces the
  frontend's guess `userType === 'SYSTEM_ADMIN'`.
- `menus` lists the menus where the user has at least `VIEW`, in display order.
  The sidebar uses it.
- An expired subscription (`EXPIRED`) leaves only `DASHBOARD`, `SETTINGS` and the
  notifications inbox (the in-app inbox is already unaffected, as documented).

## Enforcement

One mechanism, used everywhere:

```java
@RequiresPermission("PAYMENTS:REFUND")
public ... requestRefund(...)
```

- An aspect (or a method-security expression) loads the user's permission set
  and throws `ForbidenException("permission_denied")` → 403 when missing.
- Keep the existing **scope** checks (branch and tenant) as they are:
  permissions answer "may this person do this at all", scope answers "on which
  records".
- Where this spec's other files list a permissions table by role (for example
  "approve refunds: owner, manager"), implement it as the **default**
  permission set of that role, not as hardcoded `if (isManager)` checks.
- Add a test per annotated endpoint: allowed, denied, other branch denied.

## Staff wizard and Roles page changes (so the backend returns what they need)

- `GET /role` and `/role/dropdown` also return `permissionCount` and
  `userCount`, so the Roles page can show "12 permissions, 5 staff".
- `DELETE /role/{uuid}` already refuses a role in use; the message should
  include the user count.
- `POST /role` accepts an optional `template` (name of a default role) or
  `permissions` list, applied at creation.

## Permissions for this module

| Action | Platform admin | Tenant owner | Manager | Others |
|---|---|---|---|---|
| Read the catalog | ✓ | ✓ | ✓ | – |
| Set permissions on platform roles | ✓ | – | – | – |
| Set permissions on tenant roles | ✓ | ✓ | – | – |
| Set permissions on a branch role of their branch | ✓ | ✓ | ✓ (only permissions they hold) | – |
