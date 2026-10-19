import type { UserType } from '../types/user'

// Display names for the backend UserType enum
export const USER_TYPES: Record<UserType, string> = {
  STAFF_MEMBER: 'Staff member',
  SYSTEM_ADMIN: 'Platform administrator',
  INDIVIDUAL_CUSTOMER: 'Individual customer',
  STORE_MANAGER: 'Store manager',
  FRONT_DESK: 'Front desk / cashier',
  MANAGER: 'Manager',
  TENANT: 'Tenant owner',
  B2B: 'Commercial client',
  DELIVERY_AGENT: 'Delivery agent',
  DRY_CLEANER: 'Dry cleaner',
  WASHER: 'Washer',
  OWNER: 'Business owner',
}
