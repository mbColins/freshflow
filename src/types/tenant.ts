// A business subscribed to the platform (one laundry company with its branches)

// A PlatformPlan code, e.g. "SOLO"
export type TenantPlan = string

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled'

// TODO: confirm the UserType enum values with the backend
export type TenantUserType = 'OWNER' | 'ADMIN'

// The user account created with the tenant
export type TenantOwner = {
  username: string
  firstName: string
  lastName: string
  city: string
  neighborhood: string
  phone: string
  email: string
  userType: TenantUserType
}

export type Tenant = {
  // The uuid the API addresses the tenant by
  id: string
  // Short reference shown to admins (the numeric id when the API sends one)
  ref: string
  name: string
  // Unique; the tenant's address on the platform
  hostname: string
  phone: string
  email: string
  slogan: string
  town: string
  logoUrl: string | null
  plan: TenantPlan
  status: TenantStatus
  // Why the tenant is suspended or cancelled
  statusNote: string
  createdAt: string
  // Trial only
  trialEndsAt: string | null
  branches: number
  users: number
  ordersThisMonth: number
  owner: TenantOwner
}

// Create / edit form. Field names follow the backend's TenantRequest so the
// multipart body maps one to one; `logo` is the file part.
export type TenantFormValues = {
  businessName: string
  phoneNumber: string
  email: string
  subscriptionPlan: TenantPlan
  town: string
  slogan: string
  hostname: string
  status: TenantStatus
  logo: File | null
  // Owner account
  username: string
  firstName: string
  lastName: string
  city: string
  neighborhood: string
  oPhoneNumber: string
  oEmail: string
  userType: TenantUserType
}

export type TenantFilters = {
  query: string
  status: TenantStatus | ''
  plan: TenantPlan | ''
}
