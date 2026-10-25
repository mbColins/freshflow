import type { ApiResponse } from '../types/api'
import type {
  AppUser,
  Department,
  EmploymentType,
  SkillCode,
  SkillLevelCode,
  StaffDetails,
  UserRequest,
  UserStatus,
  UserType,
  Weekday,
} from '../types/user'
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
  // A plain name in the staff lists, { uuid, name, scope } on /users/me
  role?: string | { uuid?: string; name?: string | null; scope?: string | null } | null
  platformAdmin?: boolean
  tenantOwner?: boolean
  permissions?: string[] | null
  menus?: string[] | null
  subscription?: { status?: string | null } | null
  channel?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lastLoginTime?: string | null
  branchUuid?: string | null
  roleId?: number | null
  employeeNumber?: string | null
  emergencyContact?: string | null
  jobTitle?: string | null
  department?: string | null
  employmentType?: string | null
  hiredAt?: string | null
  managerId?: string | null
  managerName?: string | null
  loginAccess?: boolean | null
  twoFactorRequired?: boolean | null
  shiftStart?: string | null
  shiftEnd?: string | null
  workingDays?: string[] | null
  skills?: { skill?: string | null; level?: string | null }[] | null
  monthlySalary?: number | string | null
  leaveBalance?: number | string | null
  certification?: { name?: string | null; expiresAt?: string | null } | null
  accountStatus?: string | null
  statusReason?: string | null
}

// BigDecimal may arrive as a number or a string
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}
// LocalTime may come as "08:00" or "08:00:00"; the UI works in HH:mm
const toClock = (value: string | null | undefined) => (value ? value.slice(0, 5) : '')

function toStaffDetails(raw: RawUser): StaffDetails {
  return {
    employeeNumber: raw.employeeNumber ?? '',
    emergencyContact: raw.emergencyContact ?? '',
    jobTitle: raw.jobTitle ?? '',
    department: (raw.department as Department | null | undefined) ?? null,
    employmentType: (raw.employmentType as EmploymentType | null | undefined) ?? null,
    hiredAt: raw.hiredAt ?? '',
    managerId: raw.managerId ?? '',
    managerName: raw.managerName ?? '',
    // The backend treats a missing value as allowed
    loginAccess: raw.loginAccess !== false,
    twoFactorRequired: raw.twoFactorRequired ?? false,
    shiftStart: toClock(raw.shiftStart),
    shiftEnd: toClock(raw.shiftEnd),
    workingDays: (raw.workingDays ?? []) as Weekday[],
    skills: (raw.skills ?? []).flatMap(({ skill, level }) =>
      skill && level ? [{ skill: skill as SkillCode, level: level as SkillLevelCode }] : [],
    ),
    monthlySalary: toAmount(raw.monthlySalary),
    leaveBalance: toAmount(raw.leaveBalance),
    certification: raw.certification?.name
      ? { name: raw.certification.name, expiresAt: raw.certification.expiresAt ?? '' }
      : null,
    accountStatus: raw.accountStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    statusReason: raw.statusReason ?? '',
  }
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
    role: typeof raw.role === 'object' && raw.role ? (raw.role.name ?? '') : (raw.role ?? ''),
    channel: raw.channel ?? '',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    lastLoginTime: raw.lastLoginTime ?? '',
    branchUuid: raw.branchUuid ?? '',
    roleId: raw.roleId ?? null,
    staff: toStaffDetails(raw),
    access: Array.isArray(raw.permissions)
      ? {
          platformAdmin: raw.platformAdmin === true,
          tenantOwner: raw.tenantOwner === true,
          permissions: raw.permissions,
          menus: raw.menus ?? [],
          subscriptionStatus: raw.subscription?.status ?? '',
        }
      : null,
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
