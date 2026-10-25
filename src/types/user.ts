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

// Backend staff enums (Department, EmploymentType, Skill, SkillLevel, AccountStatus)
export type Department =
  | 'LAUNDRY_OPERATIONS'
  | 'FINISHING_PRESS'
  | 'QUALITY_CONTROL'
  | 'FRONT_DESK'
  | 'DELIVERY'
  | 'MAINTENANCE'
  | 'MANAGEMENT'
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'TEMPORARY' | 'CONTRACT' | 'INTERN'
export type SkillCode =
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'FOLDING'
  | 'STAIN_TREATMENT'
  | 'QUALITY_CONTROL'
  | 'PACKAGING'
  | 'CUSTOMER_SERVICE'
  | 'DRIVING'
  | 'MACHINE_MAINTENANCE'
export type SkillLevelCode = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
// java.time.DayOfWeek
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

// The employment details stored with a staff member (StaffParts and friends)
export type StaffDetails = {
  // e.g. EMP-0024; empty for users without one
  employeeNumber: string
  emergencyContact: string
  jobTitle: string
  department: Department | null
  employmentType: EmploymentType | null
  // YYYY-MM-DD
  hiredAt: string
  managerId: string
  managerName: string
  loginAccess: boolean
  twoFactorRequired: boolean
  // HH:mm
  shiftStart: string
  shiftEnd: string
  workingDays: Weekday[]
  skills: { skill: SkillCode; level: SkillLevelCode }[]
  monthlySalary: number
  leaveBalance: number
  certification: { name: string; expiresAt: string } | null
  accountStatus: AccountStatus
  statusReason: string
}

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
  // The branch's uuid and the role's id, next to their names above
  branchUuid: string
  roleId: number | null
  staff: StaffDetails
  // What the user may do, from GET /users/me only; null on other reads
  access: UserAccess | null
}

// The "effective permissions" part of GET /users/me: the role's permission
// codes (MENU:ACTION) limited by the tenant's plan
export type UserAccess = {
  platformAdmin: boolean
  tenantOwner: boolean
  permissions: string[]
  // Menu ids the user can open, e.g. ORDERS
  menus: string[]
  subscriptionStatus: string
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
  // Staff details, all optional; PATCH changes only the ones sent
  emergencyContact?: string
  jobTitle?: string
  department?: Department
  employmentType?: EmploymentType
  // yyyy-MM-dd
  hiredAt?: string
  // The manager's user uuid
  managerId?: string
  loginAccess?: boolean
  twoFactorRequired?: boolean
  // HH:mm
  shiftStart?: string
  shiftEnd?: string
  workingDays?: Weekday[]
  skills?: { skill: SkillCode; level: SkillLevelCode }[]
  monthlySalary?: number
  leaveBalance?: number
  certification?: { name: string; expiresAt: string | null } | null
  accountStatus?: AccountStatus
  statusReason?: string
}
