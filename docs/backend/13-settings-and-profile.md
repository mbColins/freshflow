# 13. Settings and profile

Priority P2. Status: **Partial**. Per-user preferences are **Missing**; the
business-level configuration is **Ready** on the backend (UI not connected).

## What the screen does

`pages/SettingsPage.tsx` edits the signed-in user's preferences, kept in
`localStorage` by `hooks/useSettings.ts` (`// TODO: sync with the user's profile
once the settings API exists`). They are lost on another browser or device.

| Group | Fields |
|---|---|
| Appearance | `theme` (`LIGHT`, `DARK`, `SYSTEM`), `accent` (`blue`, `teal`, `green`, `violet`, `slate`), `textScale` (100, 110, 125), `reduceMotion` |
| Language and region | `language` (`en`, `fr`), `dateFormat` (`MEDIUM`, `DMY`, `ISO`), `timeFormat` (`H24`, `H12`) |
| Layout | `showNavBadges`, `sidebarCollapsed` |
| Session | `startPage` (a route such as `/orders`), `autoLockMinutes` (0 never locks) |

## Per-user preferences (missing)

```
user_setting(user_id PK, theme, accent, text_scale, reduce_motion,
             language, date_format, time_format,
             show_nav_badges, sidebar_collapsed,
             start_page, auto_lock_minutes, updated_at)
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me/settings` | The caller's preferences |
| PUT | `/users/me/settings` | Replace them |
| DELETE | `/users/me/settings` | Reset to the defaults |

```json
{
  "theme": "DARK",
  "accent": "teal",
  "textScale": 110,
  "reduceMotion": false,
  "language": "fr",
  "dateFormat": "DMY",
  "timeFormat": "H24",
  "showNavBadges": true,
  "sidebarCollapsed": false,
  "startPage": "/orders",
  "autoLockMinutes": 15
}
```

Rules:

- A user can only read and write their own row (no `{userId}` in the path).
- Validate every value against the lists above (400 `invalid_setting` naming
  the field). `accent` is an id, never a colour.
- `startPage` must be a route the user can open. Compare with their menus
  (`/users/me`, `07`); if it isn't allowed, store it but have `/users/me`
  return `/` as the effective start page.
- `autoLockMinutes` between 0 and 240.
- Defaults when no row exists: those in `DEFAULT_SETTINGS`
  (`constants/settings.ts`); also seed `language` and `timeFormat` from
  `TenantConfiguration.defaultLanguage` for new users.
- `GET` always returns a full object (defaults filled in).
- Also include `settings` in `GET /users/me`, so the app applies the theme and
  language on start without a second request.
- The frontend keeps a local copy and syncs: on change, `PUT`; on start, the
  server value wins.

## Language of server messages

The user's `language` should select the `Locale` for messages
(`MessageSource`) and for emails and SMS sent to **staff**. Today the
controllers use `request.getLocale()`; add a filter that sets the locale from
`user_setting.language`, falling back to `Accept-Language`, then to the
tenant's default. Customer messages use the customer's own language (add
`customer.language`, default from the tenant).

## Business configuration (backend ready, UI not connected)

`/tenant-configuration/{tenantId}` already stores `logoUrl`, `primaryColor`,
`receiptTemplate`, `defaultCurrency`, `defaultLanguage`, `defaultTimezone`,
`enabledNotificationChannels`. The Settings page has no section for it yet.
When the UI adds a **Business** section (owner only), it needs two small
backend changes:

1. **Logo upload.** `logoUrl` is a string. Add `POST
   /tenant-configuration/{tenantId}/logo` (`multipart/form-data`, `file`: png,
   jpeg or svg, max 1 MB) that stores the file and sets `logoUrl`. Reject other
   types (400 `invalid_image`).
2. **Operational thresholds** that other specs refer to. Add these keys to
   `TenantConfiguration` (all optional, with the defaults shown):

| Key | Default | Used by |
|---|---|---|
| `refundAutoApproveLimit` | 5 000 | `01` |
| `poAutoApproveLimit` | 100 000 | `05` |
| `staffDailyCapacity` | 12 | `06` |
| `pointsPerXaf` / `xafPerPoint` | 100 / 5 | `08` |
| `vipSpendThreshold` | 500 000 | `08` |
| `loyaltyTiers` | bronze 0, silver 500, gold 1 500, platinum 5 000 | `08` |
| `lateGraceMinutes` | 5 | `06` |
| `opsHealthDelayedWarningPercent` / `…CriticalPercent` | 10 / 20 | `03` |
| `energyRatePerKwh`, `waterRatePerLiter` | 100 / 1 | `04` |
| `pointsExpiryMonths` | 12 | `08` |

Expose them under a `thresholds` object on the same GET and PATCH, owner only.

## Own profile and password (small gaps)

The Staff page edits other users. A person has no way to edit **their own**
name, phone or email, or to change their password while signed in (only the
forgot-and-reset flow exists).

| Method | Path | Body |
|---|---|---|
| PATCH | `/users/me` | `{ "firstName", "lastName", "phoneNumber", "city", "neighborhood", "emergencyContact" }` |
| POST | `/users/me/change-password` | `{ "currentPassword": "…", "newPassword": "…" }` |

- `PATCH /users/me` may not change `userType`, `role`, `branch`, `loginAccess`,
  `accountStatus` or the username; changing the email needs the OTP flow (send a
  code to the new address, `POST /users/me/confirm-email { "code": "…" }`).
- `change-password`: verify the current password (403 `wrong_password`),
  enforce the same strength rules as `reset_password`, and **revoke the other
  refresh tokens** (see `17`). Write an audit entry and email the user
  ("your password was changed").
