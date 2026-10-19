export type BranchStatus = 'active' | 'maintenance' | 'inactive' | 'closed'

export type BranchType =
  | 'Main Branch'
  | 'Standard Branch'
  | 'Pickup Point'
  | 'Processing Center'

export type DayHours = { open: string; close: string; closed: boolean }

export type SpecialDay = {
  date: string
  label: string
  closed: boolean
  open: string
  close: string
}

export type BranchClosure = { from: string; to: string; reason: string }

export type BranchService = {
  name: string
  enabled: boolean
  // Branch-specific price in XAF; null uses the catalog price
  price: number | null
}

export type BranchCapacity = {
  dailyOrders: number
  maxItems: number
  processingHours: number
  pickups: number
  deliveries: number
  machines: number
}

// Everything an administrator enters in the branch form
export type BranchProfile = {
  id: string
  name: string
  description: string
  // The saved logo; a newly chosen file is sent alongside the profile
  logoUrl: string | null
  // Uuid of the tenant the branch belongs to; '' = the caller's own tenant
  tenant: string
  type: BranchType
  status: BranchStatus
  country: string
  region: string
  city: string
  district: string
  address: string
  postalCode: string
  lat: number | null
  lng: number | null
  phone: string
  phone2: string
  email: string
  whatsapp: string
  website: string
  manager: string
  // Monday first
  hours: DayHours[]
  specialDays: SpecialDay[]
  closure: BranchClosure | null
  services: BranchService[]
  capacity: BranchCapacity
  paymentMethods: string[]
  // Setup tasks still to be done
  pendingSetup: string[]
}

export type BranchStats = {
  ordersToday: number
  revenueToday: number
  // A typical trading day, used to derive history
  baseOrders: number
  baseRevenue: number
  // Most recent days running below normal, and at what share of normal
  downDays: number
  downFactor: number
  activeOrders: number
  customers: number
  newCustomers: number
  processing: number
  ready: number
  pendingDelivery: number
  outForDelivery: number
  deliveredToday: number
  overdue: number
  completion: number
  onTime: number
  satisfaction: number
  machineUtil: number
  staffUtil: number
  inventoryHealth: number
  cancelRate: number
  seed: number
}

export type BranchStaffRow = {
  name: string
  role: string
  ordersProcessed: number
  workload: number
  performance: number
  status: 'Active' | 'On break' | 'Off shift'
}

export type MachineStatus = 'Running' | 'Available' | 'Maintenance'

export type BranchMachine = {
  id: string
  name: string
  type: string
  status: MachineStatus
  job: string
  utilization: number
  maintenanceAt: string
}

export type BranchStockItem = {
  name: string
  unit: string
  onHand: number
  reorderAt: number
}

export type Branch = BranchProfile & {
  // What the API addresses the branch by (GET / PATCH / DELETE /branch/{branchId});
  // `id` stays the branch code (BR-001) that other modules refer to
  uuid: string
  statusNote: string
  openedAt: string
  stats: BranchStats
  staff: BranchStaffRow[]
  machines: BranchMachine[]
  stock: BranchStockItem[]
}

export type BranchPeriod = 'today' | 'week' | 'month' | 'lastMonth'
export type PerformanceTier = 'high' | 'average' | 'low'

export type BranchFilters = {
  query: string
  status: BranchStatus | ''
  city: string
  performance: PerformanceTier | ''
  period: BranchPeriod
}

export type RevenueGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
