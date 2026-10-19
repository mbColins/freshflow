import type { PlatformModule } from '../types/platformPlan'

export const PLATFORM_MODULES: Record<PlatformModule, string> = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  SERVICES: 'Services',
  OPERATIONS: 'Laundry operations',
  PICKUP_DELIVERY: 'Pickup & delivery',
  PAYMENTS: 'Payments',
  INVENTORY: 'Inventory',
  STAFF: 'Staff',
  MACHINES: 'Machines',
  PROMOTIONS: 'Promotions',
  CUSTOMER_SUBSCRIPTIONS: 'Customer subscriptions',
  REPORTS: 'Reports',
  NOTIFICATIONS: 'Notifications',
}
