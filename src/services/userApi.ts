import type { ApiResponse } from '../types/api'
import type { AppUser, UserRequest, UserStatus, UserType } from '../types/user'
import { api } from './api'

// UserResponse as sent. Note the lowercase `firstname` / `lastname`
type RawUser = {
  id?: number | null
  uuid?: string
  username?: string
  firstname?: string
  lastname?: string
  city?: string
  neighborhood?: string
  phoneNumber?: string
  email?: string
  isActive?: boolean
  active?: boolean
  userType?: string | null
  status?: string | null
  createdBy?: string | null
  branch?: string | null
  tenant?: string | null
  role?: string | null
  channel?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lastLoginTime?: string | null
}

function toUser(raw: RawUser): AppUser {
  return {
    id: raw.id ?? null,
    uuid: raw.uuid ?? '',
    username: raw.username ?? '',
    firstName: raw.firstname ?? '',
    lastName: raw.lastname ?? '',
    city: raw.city ?? '',
    neighborhood: raw.neighborhood ?? '',
    phone: raw.phoneNumber ?? '',
    email: raw.email ?? '',
    active: raw.isActive ?? raw.active ?? true,
    userType: (raw.userType as UserType | null | undefined) ?? null,
    status: (raw.status as UserStatus | null | undefined) ?? null,
    createdBy: raw.createdBy ?? '',
    branch: raw.branch ?? '',
    tenant: raw.tenant ?? '',
    role: raw.role ?? '',
    channel: raw.channel ?? '',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    lastLoginTime: raw.lastLoginTime ?? '',
  }
}

const toUsers = (content: unknown) =>
  (Array.isArray(content) ? (content as RawUser[]) : []).map(toUser).filter(({ uuid }) => uuid !== '')

export type UserListParams = {
  filter?: string
  search?: string
  // Zero-based; the backend defaults to page 0, size 10
  page?: number
  size?: number
}

export type UserPage = { items: AppUser[]; total: number; totalPages: number }

// A role from GET /role/dropdown (DropDownResponse); `id` is what UserRequest.role takes
export type RoleOption = { id: number; uuid: string; name: string; code: string }

const LIST = { type: 'User' as const, id: 'LIST' }

export const userApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The signed-in user, from the token
    getMe: build.query<AppUser, void>({
      query: () => '/users/me',
      transformResponse: (response: ApiResponse<RawUser>) => toUser(response.content),
      providesTags: [{ type: 'User', id: 'ME' }],
    }),
    // Paged (DataTable: { totalPages, totalElements, data }); excludes the caller
    listUsers: build.query<UserPage, UserListParams | void>({
      query: (params) => ({ url: '/users', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ totalPages?: number; totalElements?: number; data?: RawUser[] }>) => {
        const items = toUsers(response.content?.data)
        return {
          items,
          total: response.content?.totalElements ?? items.length,
          totalPages: response.content?.totalPages ?? 1,
        }
      },
      providesTags: [LIST],
    }),
    getUser: build.query<AppUser, string>({
      query: (uuid) => `/users/${encodeURIComponent(uuid)}`,
      transformResponse: (response: ApiResponse<RawUser>) => toUser(response.content),
      providesTags: (_result, _error, uuid) => [{ type: 'User', id: uuid }],
    }),
    // Every user of the caller's tenant, all branches, excluding the caller.
    // Only for UserType TENANT; 403 otherwise
    listTenantUsers: build.query<AppUser[], void>({
      query: () => '/users/tenant',
      transformResponse: (response: ApiResponse<unknown>) => toUsers(response.content),
      providesTags: [LIST],
    }),
    // Users of one branch, excluding the caller; 403 outside the caller's access
    listBranchUsers: build.query<AppUser[], string>({
      query: (branchUuid) => `/users/branch/${encodeURIComponent(branchUuid)}`,
      transformResponse: (response: ApiResponse<unknown>) => toUsers(response.content),
      providesTags: [LIST],
    }),
    // Created under the caller's own tenant; the backend generates the
    // password and emails it with the username. The response is only a message.
    createUser: build.mutation<void, UserRequest>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    updateUser: build.mutation<void, { uuid: string; changes: Partial<UserRequest> }>({
      query: ({ uuid, changes }) => ({ url: `/users/${encodeURIComponent(uuid)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { uuid }) => [{ type: 'User', id: uuid }, LIST, { type: 'User', id: 'ME' }],
    }),
    deleteUser: build.mutation<void, string>({
      query: (uuid) => ({ url: `/users/${encodeURIComponent(uuid)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, uuid) => [{ type: 'User', id: uuid }, LIST],
    }),
    // Roles for the user form
    getRoleDropdown: build.query<RoleOption[], void>({
      query: () => '/role/dropdown',
      transformResponse: (response: ApiResponse<unknown>) =>
        (Array.isArray(response.content) ? response.content : []).flatMap(
          (raw: { id?: number; uuid?: string; name?: string; code?: string }) =>
            raw.id !== undefined && raw.id !== null
              ? [{ id: raw.id, uuid: raw.uuid ?? '', name: raw.name ?? raw.code ?? String(raw.id), code: raw.code ?? '' }]
              : [],
        ),
      providesTags: [{ type: 'Role', id: 'DROPDOWN' }],
    }),
  }),
})

export const {
  useGetMeQuery,
  useListUsersQuery,
  useGetUserQuery,
  useListTenantUsersQuery,
  useListBranchUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetRoleDropdownQuery,
} = userApi
