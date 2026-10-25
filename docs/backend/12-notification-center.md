# 12. Notification centre: messages, templates, rules, preferences, log

Priority P2. Status: **Partial**.

## What the screens do

Two things share the word "notification":

1. **The bell** in the top bar: the signed-in user's own in-app inbox. It is
   connected (`/notifications`, `/unread-count`, `/{id}/read`, SSE `/stream`).
2. **The Notifications page** (`pages/NotificationsPage.tsx`, sample data in
   `constants/sampleNotifications.ts`): an administration centre. It has:
   - An **inbox of everything the system sent or raised**, for staff and for
     customers, with category (orders, customers, operations, delivery,
     payments, inventory, staff, machines, system), priority (critical, high,
     medium, low), channels (in-app, email, SMS, push, WhatsApp), delivery
     state (delivered, queued, scheduled, failed with reason and attempts),
     related record link, read, resolved and archived flags; tabs and filters.
   - **Compose**: write a message to an audience (customers, staff, a role,
     everyone) over chosen channels, for a branch, now or scheduled.
   - **Automation rules**: when a trigger happens and conditions match, send
     on channels to an audience; shows success rate and run count; on or off.
   - **Templates**: name, category, channel, language (English, French), subject
     and body with placeholders, active, usage count.
   - **Channel health and statistics** for the last 30 days: status
     (operational, degraded, down), sent, delivered, failed, read, average
     delivery seconds.
   - **Preferences**: which categories each role is alerted about, and quiet
     hours.
   - **Activity log** of who changed rules, templates and sent messages.
   - Retry failed messages, mark resolved, archive.

## What the backend has

- `InAppNotification(title, message, type, read, readAt, user, tenant)` with
  only two types (`SUBSCRIPTION_EXPIRING_SOON`, `SUBSCRIPTION_EXPIRED`), the
  list, unread count, mark-read, and the SSE stream.
- `MessageService`: sends email, and the SMS keys exist in `AppConfig`.
- `NotificationTemplate(eventCode, status, messageTemplate, subject)`, seeded
  from the `Events` enum (login OTP, new user credentials, order placed, pickup
  reminder, subscription expiry, tenant created…). No endpoint reads or edits
  them.
- Placeholders use `%name%` (`%firstname%`, `%orderNumber%`, `%businessName%`…).

## Data model

Use the `message_log` described in the README (block B) for every outbound
message, and extend the others:

```
in_app_notification   -- add columns
  category    VARCHAR      -- ORDERS, CUSTOMERS, OPERATIONS, DELIVERY, PAYMENTS, INVENTORY, STAFF, MACHINES, SYSTEM
  priority    VARCHAR      -- CRITICAL, HIGH, MEDIUM, LOW
  branch_id   NULL
  related_type NULL, related_id NULL, related_label NULL     -- "ORDER", "ORD-10428", for the link
  resolved BOOLEAN, resolved_by NULL, resolved_at NULL
  archived BOOLEAN
  -- type: widen from the two subscription values to a string event code

notification_template  -- add columns (keep eventCode, subject, messageTemplate)
  uuid, tenant_id NULL,   -- NULL = platform default; a tenant row overrides it
  name, category, channel, language,       -- EN, FR
  active, updated_by, updated_at, use_count

automation_rule(id, uuid, tenant_id, branch_id NULL, name,
                trigger,          -- see the trigger catalogue
                logic,            -- AND, OR
                channels,         -- set
                audience,         -- CUSTOMER, STAFF_ROLE:<role>, STAFF_ALL, OWNER, BRANCH_MANAGERS, ASSIGNEE
                template_id NULL, active, created_by, created_at)
automation_rule_condition(rule_id, field, operator, value)   -- operator: EQ, NE, GT, LT, CONTAINS

notification_preference(id, tenant_id, scope,   -- ROLE, USER
                        role_id NULL, user_id NULL,
                        categories,             -- set of categories the scope is alerted about
                        quiet_enabled, quiet_from, quiet_to)    -- HH:mm

message_log -- see README B; plus the columns category, priority, branch_id
```

Channel health is stored in the provider settings (`payment_provider_setting`
style): `channel_setting(tenant_id, channel, status, note, updated_at)`,
updated by the send results (a window of failures turns a channel
`DEGRADED`, then `DOWN`; a success run restores it).

## The page's read model

`GET /notification-center` returns one unified list for the page, newest first:
staff alerts (from `in_app_notification` for users in scope) and customer or
system messages (from `message_log`).

Params: `tab` (`ALL`, `UNREAD`, `CRITICAL`, `CUSTOMERS`, `STAFF`, `OPERATIONS`,
`PAYMENTS`, `INVENTORY`, `DELIVERY`, `SYSTEM`, `SCHEDULED`, `FAILED`),
`priority`, `channel`, `branch`, `date` (`TODAY`, `YESTERDAY`, `WEEK`),
`search`, `page`, `size`.

```json
{
  "uuid": "…",
  "category": "PAYMENTS",
  "priority": "HIGH",
  "title": "Payment failed: Mobile Money",
  "message": "XAF 24,000 from Sarah K. was declined.",
  "audience": "STAFF",
  "recipient": "Cashiers",
  "branch": { "uuid": "…", "name": "Bonapriso" },
  "channels": ["IN_APP"],
  "delivery": "DELIVERED",
  "createdAt": "2026-10-25T10:35:00",
  "scheduledFor": null,
  "failure": null,
  "related": { "kind": "PAYMENT", "label": "TXN-000231", "to": "/payments" },
  "read": false, "readAt": null, "resolved": false, "archived": false,
  "createdBy": "System"
}
```

Customer-facing items (`audience: CUSTOMER`) come from `message_log` and carry
`failure: { reason, attempts, lastAttemptAt }` when failed.

Scope: staff see their branch; the owner sees all branches; **only** managers
and the owner see customer messages (`NOTIFICATIONS:VIEW`).

### Actions

| Method | Path | Body | Purpose |
|---|---|---|---|
| PATCH | `/notification-center/{uuid}` | `{ "read": true }` | Mark read or unread (bulk allowed, below) |
| PATCH | `/notification-center/bulk` | `{ "ids": [...], "read": true, "archived": true, "resolved": true }` | Several at once |
| POST | `/notification-center/read-all` | `{ "category": null }` | Mark every unread as read |
| POST | `/message-log/{uuid}/retry` | – | Retry a failed message |
| DELETE | `/message-log/{uuid}` | – | Cancel a scheduled message |

The bell's "mark all as read" should use `read-all` instead of one call per
notification. `PATCH /notifications/{id}/read` stays as is.

## Compose: `POST /notification-center/messages`

```json
{
  "audience": "STAFF_ROLE:Washer",
  "channels": ["IN_APP", "SMS"],
  "title": "Shift change tomorrow",
  "message": "Morning shift starts at 07:00 tomorrow.",
  "branch": "branch-uuid",
  "scheduledFor": "2026-10-26T18:00:00",
  "priority": "MEDIUM",
  "category": "STAFF"
}
```

- `audience`: `CUSTOMERS` (everyone with consent), `CUSTOMER:<uuid>`,
  `SEGMENT:<uuid>`, `STAFF_ALL`, `STAFF_ROLE:<role name>`, `BRANCH_MANAGERS`,
  `OWNER`.
- Marketing-type messages to customers need `consent.marketing`.
- Without `scheduledFor` the message goes now; with it, `message_log` status
  `SCHEDULED` and the scheduled-send job (README, C) sends it (checks again at
  send time that the recipient still consents).
- `IN_APP` creates `in_app_notification` rows for staff and pushes them over
  the SSE stream; `EMAIL`, `SMS`, `WHATSAPP` go to the channel adapters.
- Response: `{ "recipients": 42, "skipped": [{ "reason": "no_consent", "count": 3 }], "scheduled": true }`.
- Needs `NOTIFICATIONS:SEND`.

## Templates

| Method | Path | Purpose |
|---|---|---|
| GET | `/notification-templates` | List (`category`, `channel`, `language`, `active`, `search`) |
| POST | `/notification-templates` | Create a tenant template |
| PATCH | `/notification-templates/{uuid}` | Edit (editing a platform default creates a tenant copy) |
| DELETE | `/notification-templates/{uuid}` | Delete a tenant template (revert to the platform default) |
| POST | `/notification-templates/{uuid}/preview` | Render with sample values |

```json
{
  "name": "Order ready (SMS)",
  "category": "ORDERS",
  "eventCode": "ORDER_READY",
  "channel": "SMS",
  "language": "EN",
  "subject": null,
  "body": "Hi %firstname%, your order %orderNumber% is ready at %branchName%.",
  "active": true
}
```

- One active template per (`eventCode`, `channel`, `language`) per tenant;
  the lookup order is tenant template, then platform default.
- Only the documented placeholders are allowed; an unknown one is 400
  `unknown_placeholder` (the list comes from `GET
  /notification-templates/placeholders`, returned per event code).
- `subject` is required for `EMAIL`.
- `use_count` is incremented by the dispatcher when the template is used, and
  returned as `uses`.
- `preview` body: `{ "values": { "firstname": "Amina" } }`; missing values keep
  their placeholder.

## Automation rules

| Method | Path | Purpose |
|---|---|---|
| GET | `/automation-rules` | List with `successRate` and `runs` |
| POST | `/automation-rules` | Create |
| PATCH | `/automation-rules/{uuid}` | Edit, switch on or off |
| DELETE | `/automation-rules/{uuid}` | Delete |
| GET | `/automation-rules/catalog` | Triggers, their fields and audiences |

```json
{
  "name": "Notify the customer when an order is ready",
  "trigger": "ORDER_READY",
  "conditions": [ { "field": "priority", "operator": "EQ", "value": "EXPRESS" } ],
  "logic": "AND",
  "channels": ["SMS", "WHATSAPP"],
  "audience": "CUSTOMER",
  "template": "template-uuid",
  "active": true
}
```

**Trigger catalogue** (each is a domain event published by the module that owns
it, with the fields conditions can test):

| Trigger | Published by | Fields |
|---|---|---|
| `ORDER_CREATED`, `ORDER_READY`, `ORDER_OVERDUE`, `ORDER_CANCELLED` | orders | `priority`, `branch`, `service`, `method`, `total`, `customerKind` |
| `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `PAYMENT_OVERDUE` | payments | `amount`, `method`, `branch` |
| `LOW_STOCK`, `OUT_OF_STOCK`, `ITEM_EXPIRING` | inventory | `item`, `category`, `branch` |
| `MACHINE_FAULT`, `MAINTENANCE_DUE` | machines | `severity`, `machineType`, `branch` |
| `DELIVERY_ASSIGNED`, `DELIVERY_FAILED`, `DELIVERY_COMPLETED` | logistics | `priority`, `zone`, `branch` |
| `LEAVE_REQUESTED`, `LEAVE_DECIDED`, `CERTIFICATION_EXPIRING` | staff | `type`, `department` |
| `SUBSCRIPTION_EXPIRING`, `CUSTOMER_PLAN_RENEWAL` | subscriptions | `plan` |

Evaluation:

1. The owning module publishes a Spring application event (as
   `InAppNotificationCreatedEvent` already does).
2. A listener loads the tenant's active rules for that trigger and branch,
   evaluates the conditions with the rule's `logic`, and for each match calls
   `MessageDispatcher.send` (README, B) with the rule's template, channels and
   audience.
3. It writes `runs += 1` and, once the send finishes, updates `successRate`
   (delivered ÷ sent over the last 30 days). A rule must never throw into the
   publishing transaction: run after commit and catch errors.
4. Built-in behaviour (login OTP, credentials, subscription expiry) stays
   hardcoded and is not rule-driven.

## Preferences

`GET /notification-preferences` and `PUT /notification-preferences`:

```json
{
  "roles": {
    "Manager": ["ORDERS", "PAYMENTS", "INVENTORY", "MACHINES"],
    "Washer": ["OPERATIONS", "MACHINES"]
  },
  "quietHours": { "enabled": true, "from": "21:00", "to": "06:00" }
}
```

- Decides which **staff** alerts are delivered to which roles. Applied by the
  dispatcher when an alert has a category.
- Quiet hours hold non-critical messages until the window ends (`CRITICAL`
  always goes through). Customer messages follow the customer's own consent
  and the tenant's sending hours instead.
- Users may also set their own: `PUT /notification-preferences/me` with the
  same shape for one user.
- Owner and managers can change roles' preferences.

## Statistics and health

`GET /notification-center/channels?days=30`:

```json
[
  { "channel": "SMS", "status": "OPERATIONAL", "note": "", "sent": 1240, "delivered": 1198, "failed": 42, "read": null, "avgSeconds": 4 },
  { "channel": "EMAIL", "status": "DEGRADED", "note": "Slow provider responses", "sent": 860, "delivered": 801, "failed": 59, "read": 412, "avgSeconds": 38 }
]
```

Computed from `message_log`. `read` is only filled for channels that can report
it (in-app, email opens if tracked, WhatsApp read receipts); otherwise `null`.
`avgSeconds` is the mean of `delivered_at − sent_at`.

## Activity log

`GET /audit?entityType=MESSAGE|TEMPLATE|RULE` (README, A). Entries are written
when someone sends a message, edits a template, or changes a rule.

## Permissions

| Action | Owner | Manager | Front desk | Others |
|---|---|---|---|---|
| See their own alerts (the bell) | ✓ | ✓ | ✓ | ✓ |
| See the centre (staff + customer messages) | ✓ | ✓ (their branch) | – | – |
| Compose, retry, cancel scheduled | ✓ | ✓ | – | – |
| Templates, rules, preferences | ✓ | – | – | – |
