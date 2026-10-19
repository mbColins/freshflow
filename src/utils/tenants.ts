import { TENANT_STATUSES } from '../constants/tenants'
import type { TenantResponse } from '../services/tenantApi'
import type { PlatformPlan } from '../types/platformPlan'
import type {
  Tenant,
  TenantFilters,
  TenantFormValues,
  TenantStatus,
  TenantUserType,
} from '../types/tenant'

export function ownerName(tenant: Tenant) {
  return `${tenant.owner.firstName} ${tenant.owner.lastName}`.trim()
}

export function matchesTenantFilters(tenant: Tenant, filters: TenantFilters) {
  const query = filters.query.trim().toLowerCase()
  const text = [tenant.ref, tenant.name, tenant.hostname, tenant.email, tenant.town, ownerName(tenant), tenant.owner.username, tenant.owner.email]
    .join(' ')
    .toLowerCase()
  return (
    (!query || text.includes(query)) &&
    (!filters.status || tenant.status === filters.status) &&
    (!filters.plan || tenant.plan === filters.plan)
  )
}

// Lowercase letters, digits and single dashes, e.g. "Clean Express" -> "clean-express"
export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// One or more DNS labels: "clean-express" or "clean-express.freshflow.app"
export const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/

// Trimmed / normalised copy of the form, as sent to the API
export function cleanTenantForm(values: TenantFormValues): TenantFormValues {
  const trim = (value: string) => value.trim()
  return {
    ...values,
    businessName: trim(values.businessName),
    phoneNumber: trim(values.phoneNumber),
    email: trim(values.email).toLowerCase(),
    town: trim(values.town),
    slogan: trim(values.slogan),
    hostname: trim(values.hostname).toLowerCase(),
    username: trim(values.username).toLowerCase(),
    firstName: trim(values.firstName),
    lastName: trim(values.lastName),
    city: trim(values.city),
    neighborhood: trim(values.neighborhood),
    oPhoneNumber: trim(values.oPhoneNumber),
    oEmail: trim(values.oEmail).toLowerCase(),
    // Forced: the account created with a tenant is always its owner
    userType: 'OWNER',
  }
}

// multipart/form-data body for POST /tenant: one text part per TenantRequest
// field (Spring binds them by name) plus the optional `logo` file part
export function tenantFormData(values: TenantFormValues) {
  const { logo, status, ...text } = values
  const body = new FormData()
  for (const [key, value] of Object.entries(text)) body.append(key, value)
  body.append('status', TENANT_STATUSES[status].apiValue)
  if (logo) body.append('logo', logo, logo.name)
  return body
}

// multipart/form-data body for PATCH /tenant/{uuid}: only the fields given
export function tenantPatchData(changes: Partial<TenantFormValues>) {
  const { logo, status, ...text } = changes
  const body = new FormData()
  for (const [key, value] of Object.entries(text)) {
    if (value !== undefined) body.append(key, value)
  }
  if (status) body.append('status', TENANT_STATUSES[status].apiValue)
  if (logo) body.append('logo', logo, logo.name)
  return body
}

export function formFromTenant(tenant: Tenant): TenantFormValues {
  return {
    businessName: tenant.name,
    phoneNumber: tenant.phone,
    email: tenant.email,
    subscriptionPlan: tenant.plan,
    town: tenant.town,
    slogan: tenant.slogan,
    hostname: tenant.hostname,
    status: tenant.status,
    logo: null,
    username: tenant.owner.username,
    firstName: tenant.owner.firstName,
    lastName: tenant.owner.lastName,
    city: tenant.owner.city,
    neighborhood: tenant.owner.neighborhood,
    oPhoneNumber: tenant.owner.phone,
    oEmail: tenant.owner.email,
    userType: tenant.owner.userType,
  }
}

// The tenant fields a form edits, applied to a tenant record
export function applyTenantForm(tenant: Tenant, values: TenantFormValues, logoUrl: string | null): Tenant {
  return {
    ...tenant,
    name: values.businessName,
    phone: values.phoneNumber,
    email: values.email,
    plan: values.subscriptionPlan,
    town: values.town,
    slogan: values.slogan,
    hostname: values.hostname,
    status: values.status,
    logoUrl,
    owner: {
      username: values.username,
      firstName: values.firstName,
      lastName: values.lastName,
      city: values.city,
      neighborhood: values.neighborhood,
      phone: values.oPhoneNumber,
      email: values.oEmail,
      userType: values.userType,
    },
  }
}

// A tenant from the API with defaults for whatever it leaves out, or null when
// it has no id to address it by
export function tenantFromApi(response: TenantResponse): Tenant | null {
  // GET / PATCH / DELETE /tenant/{tenantId} take the uuid, so that's the key;
  // the numeric id is only shown
  const id = response.uuid ?? response.id
  if (id === undefined || id === null || id === '') return null
  const blank: Tenant = {
    id: String(id),
    ref: String(response.id ?? id),
    name: '',
    hostname: '',
    phone: '',
    email: '',
    slogan: '',
    town: '',
    logoUrl: null,
    plan: '',
    status: 'active',
    statusNote: '',
    createdAt: '',
    trialEndsAt: null,
    branches: 0,
    users: 0,
    ordersThisMonth: 0,
    owner: { username: '', firstName: '', lastName: '', city: '', neighborhood: '', phone: '', email: '', userType: 'OWNER' },
  }
  return tenantFromResponse(response, blank)
}

function planCode(plan: TenantResponse['subscriptionPlan']) {
  const code = typeof plan === 'string' ? plan : plan?.code
  return code ? code.toUpperCase() : undefined
}

// The server's copy of a tenant laid over the local record: fields the
// response leaves out (or sends with unknown enum values) keep the local value
export function tenantFromResponse(response: TenantResponse, local: Tenant): Tenant {
  const fromApi = <T extends string>(values: Record<T, { apiValue: string }>, apiValue: string | undefined) =>
    (Object.keys(values) as T[]).find((key) => values[key].apiValue === apiValue?.toUpperCase())
  const owner = response.owner ?? {}
  const userType = owner.userType?.toUpperCase()
  return {
    ...local,
    name: response.businessName ?? response.name ?? local.name,
    hostname: response.hostname ?? local.hostname,
    phone: response.phoneNumber ?? local.phone,
    email: response.email ?? local.email,
    slogan: response.slogan ?? local.slogan,
    town: response.town ?? local.town,
    logoUrl: response.logoUrl !== undefined ? response.logoUrl : local.logoUrl,
    plan: planCode(response.subscriptionPlan) ?? local.plan,
    status: fromApi<TenantStatus>(TENANT_STATUSES, response.status) ?? local.status,
    statusNote: response.statusNote ?? local.statusNote,
    branches: response.currentShopCount ?? local.branches,
    users: response.currentStaffCount ?? local.users,
    ordersThisMonth: response.currentMonthOrderCount ?? local.ordersThisMonth,
    createdAt: response.createdAt ?? local.createdAt,
    trialEndsAt: response.trialEndsAt !== undefined ? response.trialEndsAt : local.trialEndsAt,
    owner: {
      username: owner.username ?? local.owner.username,
      firstName: owner.firstName ?? local.owner.firstName,
      lastName: owner.lastName ?? local.owner.lastName,
      city: owner.city ?? local.owner.city,
      neighborhood: owner.neighborhood ?? local.owner.neighborhood,
      phone: owner.phoneNumber ?? local.owner.phone,
      email: owner.email ?? local.owner.email,
      userType: userType === 'OWNER' || userType === 'ADMIN' ? (userType as TenantUserType) : local.owner.userType,
    },
  }
}

// Monthly recurring revenue: paying tenants only
export function getMrr(tenants: Tenant[], plans: PlatformPlan[]) {
  return tenants
    .filter(({ status }) => status === 'active')
    .reduce((sum, tenant) => sum + (plans.find(({ code }) => code === tenant.plan)?.monthlyPrice ?? 0), 0)
}

// Whole days left in a trial, or null when the tenant isn't on one
export function trialDaysLeft(tenant: Tenant, now: number) {
  if (tenant.status !== 'trial' || !tenant.trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - now) / 86_400_000))
}

// Usage against the plan's limits, e.g. "4 / 5"; unlimited plans show the count only
export function usageLabel(used: number, limit: number | null) {
  return limit === null ? String(used) : `${used} / ${limit}`
}
