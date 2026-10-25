import type { ApiResponse } from '../types/api'
import { api } from './api'

// PLATFORM: a seeded default (MANAGER, SYSTEM_ADMIN, STAFF, TENANT), only
// visible to the platform admin. TENANT: one tenant's role. BRANCH: a tenant
// role reserved to one branch
export type RoleScope = 'PLATFORM' | 'TENANT' | 'BRANCH'

export type Role = {
  // The uuid the API addresses the role by
  id: string
  name: string
  description: string
  // The tenant's name; empty for a platform role
  tenant: string
  // Branch uuid and name, for a branch role
  branchId: string
  branchName: string
  scope: RoleScope
  permissionCount: number
  userCount: number
  createdBy: string
  createdAt: string
}

// RoleRequest. The scope is fixed once the role exists, so PATCH only reads
// name and description. tenantUuid is only read from a platform admin (none =
// a platform default); `branch` makes it a branch role
export type RoleRequest = {
  name: string
  description: string
  // Start the role with these codes (MENU:ACTION), or copy a default or
  // ready-made role by name (Cashier, Receptionist, ...). The list wins
  permissions?: string[]
  template?: string
  tenantUuid?: string
  branch?: string
}

type RawRole = {
  uuid?: string
  name?: string | null
  description?: string | null
  tenant?: string | null
  branch?: string | null
  branchName?: string | null
  scope?: string | null
  permissionCount?: number | null
  userCount?: number | null
  createdBy?: string | null
  createdAt?: string | null
}

function toRoles(items: unknown[]): Role[] {
  return (items as RawRole[]).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            name: raw.name ?? '',
            description: raw.description ?? '',
            tenant: raw.tenant ?? '',
            branchId: raw.branch ?? '',
            branchName: raw.branchName ?? '',
            scope: raw.scope === 'PLATFORM' || raw.scope === 'BRANCH' ? raw.scope : 'TENANT',
            permissionCount: raw.permissionCount ?? 0,
            userCount: raw.userCount ?? 0,
            createdBy: raw.createdBy ?? '',
            createdAt: raw.createdAt ?? '',
          },
        ]
      : [],
  )
}

// GET /permissions/catalog: every menu with the actions a role can hold on it
export type PermissionAction = { code: string; action: string; description: string }
export type PermissionMenu = { menu: string; name: string; platformOnly: boolean; actions: PermissionAction[] }

type RawMenu = {
  menu?: string
  name?: string | null
  platformOnly?: boolean
  actions?: { code?: string; action?: string | null; description?: string | null }[] | null
}

const toMenus = (items: unknown): PermissionMenu[] =>
  (Array.isArray(items) ? (items as RawMenu[]) : []).flatMap((raw) =>
    raw?.menu
      ? [
          {
            menu: raw.menu,
            name: raw.name ?? raw.menu,
            platformOnly: raw.platformOnly === true,
            actions: (raw.actions ?? []).flatMap((action) =>
              action.code ? [{ code: action.code, action: action.action ?? '', description: action.description ?? '' }] : [],
            ),
          },
        ]
      : [],
  )

export type RoleListParams = { filter?: string; search?: string; page?: number; size?: number }
export type RolePage = { items: Role[]; total: number }

const LIST = { type: 'Role' as const, id: 'LIST' }
// The staff wizard's role picker reads GET /role/dropdown (see userApi)
const DROPDOWN = { type: 'Role' as const, id: 'DROPDOWN' }
const permissionsTag = (id: string) => ({ type: 'Role' as const, id: `PERMISSIONS-${id}` })

export const roleApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a platform admin sees every role, a tenant owner
    // their tenant's, anyone else the tenant-wide roles plus their branch's
    listRoles: build.query<RolePage, RoleListParams>({
      query: (params) => ({ url: '/role', params }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const content = response.content
        const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
        const items = toRoles(Array.isArray(content) ? content : (page?.data ?? page?.content ?? []))
        return { items, total: page?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    // Fixed in code on the server, so cached for the session
    getPermissionCatalog: build.query<PermissionMenu[], void>({
      query: () => '/permissions/catalog',
      transformResponse: (response: ApiResponse<unknown>) => toMenus(response.content),
    }),
    // The codes a role holds
    getRolePermissions: build.query<string[], string>({
      query: (id) => `/role/${encodeURIComponent(id)}/permissions`,
      transformResponse: (response: ApiResponse<{ permissions?: string[] }>) => response.content?.permissions ?? [],
      providesTags: (_result, _error, id) => [permissionsTag(id)],
    }),
    // Replaces the role's whole set. 409 cannot_grant_unheld_permission when
    // the caller adds a code they don't hold themselves
    setRolePermissions: build.mutation<void, { id: string; permissions: string[] }>({
      query: ({ id, permissions }) => ({
        url: `/role/${encodeURIComponent(id)}/permissions`,
        method: 'PUT',
        body: { permissions },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [permissionsTag(id), LIST, { type: 'User', id: 'ME' }],
    }),
    // The responses carry only a status string
    createRole: build.mutation<void, RoleRequest>({
      query: (role) => ({ url: '/role', method: 'POST', body: role }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, DROPDOWN],
    }),
    updateRole: build.mutation<void, { id: string; changes: Pick<RoleRequest, 'name' | 'description'> }>({
      query: ({ id, changes }) => ({ url: `/role/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, DROPDOWN],
    }),
    // 409 default_role_cannot_be_deleted, or role_in_use while staff hold it
    deleteRole: build.mutation<void, string>({
      query: (id) => ({ url: `/role/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, DROPDOWN],
    }),
  }),
})

export const {
  useListRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetPermissionCatalogQuery,
  useGetRolePermissionsQuery,
  useSetRolePermissionsMutation,
} = roleApi
