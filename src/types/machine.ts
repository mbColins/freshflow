export type MachineStatus =
  | 'running'
  | 'available'
  | 'idle'
  | 'maintenance'
  | 'fault'
  | 'offline'
  | 'retired'

export type MachineType =
  | 'Washing Machine'
  | 'Dryer'
  | 'Press'
  | 'Ironing Machine'
  | 'Steam Machine'
  | 'Folding Machine'
  | 'Packaging Machine'
  | 'Other'

export type MachineJob = {
  orderId: string
  customer: string
  service: string
  loadKg: number
  cycle: string
  // 0–100
  progress: number
  remainingMin: number
  operator: string
  temperature: number | null
  paused: boolean
}

export type QueuedJob = {
  orderId: string
  service: string
  loadKg: number
  durationMin: number
  priority: 'Normal' | 'High'
}

export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'

export type MaintenanceEntry = {
  id: string
  // YYYY-MM-DD
  date: string
  time: string
  type: string
  technician: string
  durationMin: number
  cost: number
  description: string
  status: MaintenanceStatus
}

export type FaultSeverity = 'Low' | 'Medium' | 'High' | 'Critical'

export type MachineFault = {
  id: string
  type: string
  severity: FaultSeverity
  reportedAt: string
  reportedBy: string
  description: string
  technician: string
  // Estimated while open, actual once resolved
  downtimeMin: number
  status: 'Open' | 'In Progress' | 'Resolved'
  resolution: string
}

export type MachineEvent = {
  at: string
  text: string
  by: string
  orderId?: string
}

export type MachineTransfer = {
  at: string
  from: string
  to: string
  reason: string
  by: string
}

export type MachineSpecs = {
  capacityKg: number
  powerKw: number
  waterL: number
  voltage: number
  maxTemp: number
  cycleMin: number
  // YYYY-MM-DD, or empty when out of warranty
  warrantyEnd: string
}

// What an administrator enters in the machine form
export type MachineProfile = {
  // The machine's asset tag, e.g. WM-015, which the app routes by
  id: string
  // The server's uuid, empty until the machine is stored
  uuid: string
  name: string
  type: MachineType
  manufacturer: string
  model: string
  serial: string
  yearPurchased: number
  description: string
  branchId: string
  area: string
  zone: string
  specs: MachineSpecs
  capabilities: string[]
  purchaseCost: number
  maintenanceEveryDays: number
}

export type Machine = MachineProfile & {
  status: MachineStatus
  statusNote: string
  job: MachineJob | null
  queue: QueuedJob[]
  runtimeTodayMin: number
  cyclesToday: number
  totalCycles: number
  // Percentages
  utilization: number
  availability: number
  efficiency: number
  downtimePct: number
  avgCycleMin: number
  // This month
  energyKwh: number
  waterUsedL: number
  energyPerCycle: number
  lastMaintenanceAt: string
  nextMaintenanceAt: string
  technician: string
  maintenanceLog: MaintenanceEntry[]
  faults: MachineFault[]
  costs: { maintenance: number; repairs: number; operating: number; energy: number }
  revenue: number
  activity: MachineEvent[]
  transfers: MachineTransfer[]
}

export type MaintenanceState = 'ok' | 'dueSoon' | 'overdue'
export type UtilizationLevel = 'low' | 'normal' | 'high' | 'critical'

export type MachineFilters = {
  query: string
  branch: string
  type: MachineType | ''
  status: MachineStatus | ''
  manufacturer: string
  maintenance: MaintenanceState | ''
  utilization: UtilizationLevel | ''
}

export type UtilizationRange = 'today' | 'week' | 'month' | 'quarter'
