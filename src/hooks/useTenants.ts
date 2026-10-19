import { useListTenantsQuery } from '../services/tenantApi'
import type { TenantListParams } from '../services/tenantApi'
import type { Tenant } from '../types/tenant'

// One shared argument so every caller reads the same cached list
// TODO: page through the list once there are more tenants than this
const ALL_TENANTS: TenantListParams = { page: 0, size: 100 }
const NO_TENANTS: Tenant[] = []

// The tenant list with its loading / error state, for pages that show them
export function useTenantsQuery() {
  return useListTenantsQuery(ALL_TENANTS)
}

// Just the tenants; empty until GET /tenant answers
function useTenants() {
  return useTenantsQuery().data?.items ?? NO_TENANTS
}

export default useTenants
