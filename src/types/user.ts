// Backend UserType enum
export type UserType =
  | 'STAFF_MEMBER'
  | 'SYSTEM_ADMIN'
  | 'INDIVIDUAL_CUSTOMER'
  | 'STORE_MANAGER'
  | 'FRONT_DESK'
  | 'MANAGER'
  | 'TENANT'
  | 'B2B'
  | 'DELIVERY_AGENT'
  | 'DRY_CLEANER'
  | 'WASHER'
  | 'OWNER'

// Backend Status enum
export type UserStatus = 'PENDING' | 'ACTIVE' | 'TRIAL' | 'INACTIVE' | 'COMPLETED'

// A user as the API returns it (UserResponse), with names in our spelling
export type AppUser = {
  // Numeric id; the API addresses users by `uuid`
  id: number | null
  uuid: string
  username: string
  firstName: string
  lastName: string
  city: string
  neighborhood: string
  phone: string
  email: string
  active: boolean
  userType: UserType | null
  status: UserStatus | null
  createdBy: string
  // Names, not ids: the response carries the branch name, the tenant's
  // business name and the role name
  branch: string
  tenant: string
  role: string
  // EMAIL | SMS | PUSH
  channel: string
  createdAt: string
  updatedAt: string
  lastLoginTime: string
}

// POST / PATCH /users body (UserRequest). Create sends every field; PATCH any subset.
export type UserRequest = {
  username: string
  firstName: string
  lastName: string
  city: string
  neighborhood: string
  phoneNumber: string
  email: string
  userType: UserType
  // Branch uuid; must belong to the caller's tenant. Optional
  branch?: string
  // Role id from GET /role/dropdown. Optional
  role?: number
}
