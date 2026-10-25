import type { ApiResponse } from '../types/api'
import type { DeliveryDriver, DriverAvailability, DriverRequest } from '../types/driver'
import { api } from './api'

// DriverResponse as sent
type RawDriver = {
  uuid?: string
  name?: string | null
  phoneNumber?: string | null
  email?: string | null
  user?: string | null
  // null when the driver serves every branch
  branch?: string | null
  branchName?: string | null
  allBranches?: boolean | null
  vehicleType?: string | null
  vehiclePlate?: string | null
  vehicleModel?: string | null
  status?: string | null
  latitude?: number | null
  longitude?: number | null
  locationUpdatedAt?: string | null
  score?: number | null
  createdAt?: string | null
}

const STATUSES: DriverAvailability[] = ['AVAILABLE', 'ON_ROUTE', 'OFF_DUTY']

function toDriver(raw: RawDriver): DeliveryDriver {
  return {
    id: raw.uuid ?? '',
    name: raw.name ?? '',
    phone: raw.phoneNumber ?? '',
    email: raw.email ?? '',
    userId: raw.user ?? '',
    branchId: raw.branch ?? '',
    branchName: raw.branchName ?? '',
    allBranches: raw.allBranches ?? !raw.branch,
    vehicleType: raw.vehicleType ?? '',
    vehiclePlate: raw.vehiclePlate ?? '',
    vehicleModel: raw.vehicleModel ?? '',
    // An unknown status reads as off duty so the driver isn't offered for jobs
    status: STATUSES.includes(raw.status as DriverAvailability) ? (raw.status as DriverAvailability) : 'OFF_DUTY',
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    locationUpdatedAt: raw.locationUpdatedAt ?? '',
    score: raw.score ?? null,
    createdAt: raw.createdAt ?? '',
  }
}

// The backend requires both `filter` (the field to search) and `search`,
// even when empty
export type DriverListParams = { filter: string; search: string; page?: number; size?: number }

export type DriverPage = { items: DeliveryDriver[]; total: number }

const LIST = { type: 'Driver' as const, id: 'LIST' }

export const driverApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a tenant owner sees every driver of the tenant,
    // anyone else their branch's drivers plus the tenant-wide ones. Paged as { totalPages, totalElements, data }. The trailing
    // slash matches the controller's @GetMapping("/")
    listDrivers: build.query<DriverPage, DriverListParams>({
      query: (params) => ({ url: '/logistics/drivers/', params }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
        const raw = (Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])) as RawDriver[]
        const items = raw.map(toDriver).filter(({ id }) => id !== '')
        return { items, total: page?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    // GET /logistics/drivers/by-branch?branch=uuid: the drivers of that branch only.
    // With no branch (pass ''): the drivers who serve every branch of the tenant.
    // 403 for a branch outside the caller's access. A job at a branch can use both
    listDriversByBranch: build.query<DeliveryDriver[], string>({
      query: (branchId) => ({ url: '/logistics/drivers/by-branch', params: branchId ? { branch: branchId } : undefined }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (Array.isArray(response.content) ? (response.content as RawDriver[]) : [])
          .map(toDriver)
          .filter(({ id }) => id !== ''),
      providesTags: [LIST],
    }),
    // name and phoneNumber are required; a platform admin must give a branch
    createDriver: build.mutation<DeliveryDriver, DriverRequest>({
      query: (driver) => ({ url: '/logistics/drivers/', method: 'POST', body: driver }),
      transformResponse: (response: ApiResponse<RawDriver>) => toDriver(response.content),
      invalidatesTags: [LIST],
    }),
    updateDriver: build.mutation<DeliveryDriver, { id: string; changes: Partial<DriverRequest> }>({
      query: ({ id, changes }) => ({ url: `/logistics/drivers/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: (response: ApiResponse<RawDriver>) => toDriver(response.content),
      invalidatesTags: [LIST],
    }),
    // Also allowed for the driver themselves
    updateDriverStatus: build.mutation<DeliveryDriver, { id: string; status: DriverAvailability }>({
      query: ({ id, status }) => ({ url: `/logistics/drivers/${encodeURIComponent(id)}/status`, method: 'PATCH', body: { status } }),
      transformResponse: (response: ApiResponse<RawDriver>) => toDriver(response.content),
      invalidatesTags: [LIST],
    }),
    // A linked user account stays; 409 when the driver has jobs
    deleteDriver: build.mutation<void, string>({
      query: (id) => ({ url: `/logistics/drivers/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
  }),
})

export const {
  useListDriversQuery,
  useListDriversByBranchQuery,
  useCreateDriverMutation,
  useUpdateDriverMutation,
  useUpdateDriverStatusMutation,
  useDeleteDriverMutation,
} = driverApi
