import type { BadgeTone } from '../components/ui/Badge'
import type {
  TenantFilters,
  TenantStatus,
  TenantUserType,
} from '../types/tenant'

// `apiValue` is the backend Status enum name
// TODO: confirm the Status enum values with the backend
export const TENANT_STATUSES: Record<TenantStatus, { label: string; tone: BadgeTone; apiValue: string }> = {
  trial: { label: 'Trial', tone: 'brand', apiValue: 'TRIAL' },
  active: { label: 'Active', tone: 'success', apiValue: 'ACTIVE' },
  suspended: { label: 'Suspended', tone: 'warning', apiValue: 'SUSPENDED' },
  cancelled: { label: 'Cancelled', tone: 'neutral', apiValue: 'CANCELLED' },
}

export const TENANT_USER_TYPES: Record<TenantUserType, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
}

export const TRIAL_DAYS = 14

// SVG is left out on purpose: an uploaded SVG can carry scripts
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

export const EMPTY_TENANT_FILTERS: TenantFilters = { query: '', status: '', plan: '' }
