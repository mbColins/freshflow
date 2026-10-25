import {
  ENERGY_ALERT_PCT,
  ENERGY_RATE_XAF,
  MACHINE_STATUSES,
  MACHINE_TYPES,
  MAINTENANCE_DUE_SOON_DAYS,
  REPEAT_FAULT_COUNT,
  UTILIZATION_LEVELS,
  WATER_RATE_XAF,
} from '../constants/machines'
import type {
  FaultSeverity,
  Machine,
  MachineFault,
  MachineFilters,
  MachineJob,
  MachineProfile,
  MachineStatus,
  MachineType,
  MaintenanceEntry,
  MaintenanceState,
  QueuedJob,
  UtilizationLevel,
  UtilizationRange,
} from '../types/machine'
import { csvCell } from './csv'
import { formatXaf } from './orders'
import { dayNumber, toDateKey } from './promotions'
import { formatCompactXaf } from './services'

const DAY_MS = 86_400_000

export function getMachineStatus(status: MachineStatus) {
  return MACHINE_STATUSES.find(({ value }) => value === status)!
}

export function getMachineType(type: MachineType) {
  return MACHINE_TYPES.find(({ value }) => value === type)!
}

export function formatRuntime(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe}m`
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`
}

export function isOperational(machine: Machine) {
  return machine.status === 'running' || machine.status === 'available' || machine.status === 'idle'
}

// ---------- Maintenance ----------

export function getMaintenance(machine: Machine, now: number) {
  const days = dayNumber(machine.nextMaintenanceAt) - dayNumber(toDateKey(now))
  const state: MaintenanceState = days < 0 ? 'overdue' : days <= MAINTENANCE_DUE_SOON_DAYS ? 'dueSoon' : 'ok'
  const label =
    machine.status === 'maintenance'
      ? 'In progress'
      : days < 0
        ? `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`
        : days === 0
          ? 'Due today'
          : `Due in ${days} ${days === 1 ? 'day' : 'days'}`
  return { days, state, label }
}

export function getUtilizationLevel(utilization: number): UtilizationLevel {
  return UTILIZATION_LEVELS.find(({ min }) => utilization >= min)!.value
}

export function getOpenFault(machine: Machine) {
  return machine.faults.find(({ status }) => status !== 'Resolved')
}

// How this machine's energy per cycle compares with others of its type, in percent
export function getEnergyDelta(machine: Machine, machines: Machine[]) {
  const peers = machines.filter(({ type, id }) => type === machine.type && id !== machine.id)
  if (peers.length === 0) return 0
  const average = peers.reduce((sum, peer) => sum + peer.energyPerCycle, 0) / peers.length
  return average > 0 ? ((machine.energyPerCycle - average) / average) * 100 : 0
}

// ---------- List ----------

export function matchesMachineFilters(machine: Machine, filters: MachineFilters, now: number) {
  if (filters.branch && machine.branchId !== filters.branch) return false
  if (filters.type && machine.type !== filters.type) return false
  if (filters.status && machine.status !== filters.status) return false
  if (filters.manufacturer && machine.manufacturer !== filters.manufacturer) return false
  if (filters.maintenance && getMaintenance(machine, now).state !== filters.maintenance) return false
  if (filters.utilization && getUtilizationLevel(machine.utilization) !== filters.utilization) return false
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  return [machine.name, machine.id, machine.serial, machine.type, machine.manufacturer, machine.model, machine.job?.orderId ?? '']
    .some((value) => value.toLowerCase().includes(query))
}

export type MachineSortKey = 'name' | 'status' | 'utilization' | 'runtime' | 'maintenance'

export function compareMachines(a: Machine, b: Machine, key: MachineSortKey) {
  switch (key) {
    case 'name':
      return a.id.localeCompare(b.id)
    case 'status':
      return (
        MACHINE_STATUSES.findIndex(({ value }) => value === a.status) -
          MACHINE_STATUSES.findIndex(({ value }) => value === b.status) || a.id.localeCompare(b.id)
      )
    case 'utilization':
      return a.utilization - b.utilization
    case 'runtime':
      return a.runtimeTodayMin - b.runtimeTodayMin
    case 'maintenance':
      return a.nextMaintenanceAt.localeCompare(b.nextMaintenanceAt)
  }
}

// ---------- Alerts and insights ----------

export type MachineAlert = {
  severity: FaultSeverity
  title: string
  text: string
  action: string
  machineId: string
  at?: string
}

const SEVERITY_ORDER: FaultSeverity[] = ['Critical', 'High', 'Medium', 'Low']

export function getMachineAlerts(machines: Machine[], now: number) {
  const alerts: MachineAlert[] = []
  machines
    .filter(({ status }) => status !== 'retired')
    .forEach((machine) => {
      const fault = getOpenFault(machine)
      if (fault) {
        alerts.push({ severity: fault.severity, title: `${machine.name}: ${fault.type}`, text: fault.description, action: fault.technician ? `${fault.technician} is assigned. Keep new jobs off this machine.` : 'Assign a technician.', machineId: machine.id, at: fault.reportedAt })
      }
      const maintenance = getMaintenance(machine, now)
      if (machine.status !== 'maintenance' && maintenance.state === 'overdue') {
        alerts.push({ severity: 'High', title: `${machine.name}: maintenance overdue`, text: `Preventive maintenance was due ${-maintenance.days} ${maintenance.days === -1 ? 'day' : 'days'} ago.`, action: 'Schedule the service now.', machineId: machine.id })
      } else if (machine.status !== 'maintenance' && maintenance.days <= 2) {
        alerts.push({ severity: 'Medium', title: `${machine.name}: maintenance ${maintenance.days === 0 ? 'due today' : `due in ${maintenance.days} ${maintenance.days === 1 ? 'day' : 'days'}`}`, text: `Assigned to ${machine.technician}.`, action: 'Plan the queue around the service window.', machineId: machine.id })
      }
      if (machine.utilization >= 95) {
        alerts.push({ severity: 'Medium', title: `${machine.name}: utilization at ${machine.utilization}%`, text: 'The machine has almost no spare capacity.', action: 'Move queued jobs to another machine of the same type.', machineId: machine.id })
      }
      const energy = getEnergyDelta(machine, machines)
      if (energy >= ENERGY_ALERT_PCT) {
        alerts.push({ severity: 'Medium', title: `${machine.name}: energy ${energy.toFixed(0)}% above similar machines`, text: `${machine.energyPerCycle} kWh per cycle against the ${machine.type.toLowerCase()} average.`, action: 'Check filters, seals and heating elements.', machineId: machine.id })
      }
      const recent = machine.faults.filter(({ reportedAt }) => now - new Date(reportedAt).getTime() <= 30 * DAY_MS).length
      if (recent >= REPEAT_FAULT_COUNT) {
        alerts.push({ severity: 'Medium', title: `${machine.name}: ${recent} faults in 30 days`, text: 'Repeated faults often point to a worn part.', action: 'Book an inspection instead of another repair.', machineId: machine.id })
      }
    })
  return alerts.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}

// Downtime minutes grouped by cause: open and resolved faults, plus completed maintenance
export function getDowntimeCauses(machines: Machine[]) {
  const totals = new Map<string, number>()
  const add = (cause: string, minutes: number) => totals.set(cause, (totals.get(cause) ?? 0) + minutes)
  let incidents = 0
  let longest = 0
  machines.forEach((machine) => {
    machine.faults.forEach((fault) => {
      add(fault.type, fault.downtimeMin)
      incidents += 1
      longest = Math.max(longest, fault.downtimeMin)
    })
    machine.maintenanceLog
      .filter(({ status }) => status === 'Completed' || status === 'In Progress')
      .forEach((entry) => add('Scheduled Maintenance', entry.durationMin))
  })
  const total = [...totals.values()].reduce((sum, minutes) => sum + minutes, 0)
  const faultMinutes = total - (totals.get('Scheduled Maintenance') ?? 0)
  return {
    causes: [...totals.entries()]
      .map(([cause, minutes]) => ({ cause, minutes, share: total > 0 ? (minutes / total) * 100 : 0 }))
      .sort((a, b) => b.minutes - a.minutes),
    total,
    incidents,
    longest,
    // Mean time to repair across faults
    averageRepair: incidents > 0 ? Math.round(faultMinutes / incidents) : 0,
  }
}

// ---------- Utilization history ----------

const wave = (seed: number, index: number) => 0.5 + 0.5 * Math.sin(seed * 1.3 + index * 1.9)

// Share of time in each state per period; each row adds up to 100
export function getUtilizationSeries(machine: Machine, range: UtilizationRange, now: number) {
  const seed = machine.totalCycles % 97
  const date = (daysAgo: number) =>
    new Date(now - daysAgo * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const labels: string[] =
    range === 'today'
      ? ['06–08', '08–10', '10–12', '12–14', '14–16', '16–18', '18–20']
      : range === 'week'
        ? Array.from({ length: 7 }, (_, index) => new Date(now - (6 - index) * DAY_MS).toLocaleDateString('en-GB', { weekday: 'short' }))
        : range === 'month'
          ? Array.from({ length: 4 }, (_, index) => `Week to ${date((3 - index) * 7)}`)
          : Array.from({ length: 3 }, (_, index) => {
              const month = new Date(now)
              month.setDate(1)
              month.setMonth(month.getMonth() - (2 - index))
              return month.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
            })
  return labels.map((label, index) => {
    const operating = Math.round(Math.min(98, Math.max(5, machine.utilization + (wave(seed, index) - 0.5) * 24)))
    const downtime = Math.round(Math.min(100 - operating, machine.downtimePct * (0.4 + wave(seed + 3, index) * 1.4)))
    const maintenance = Math.round(Math.min(100 - operating - downtime, 2 + wave(seed + 7, index) * 5))
    return { label, operating, idle: 100 - operating - downtime - maintenance, maintenance, downtime }
  })
}

// ---------- Assigning work ----------

export function getTypeForService(service: string) {
  return MACHINE_TYPES.find(({ services }) => services.includes(service))?.value
}

// Compatible machines for a load: free machines first, then the shortest queue
export function recommendMachines(machines: Machine[], type: MachineType, loadKg: number, branchId: string) {
  return machines
    .filter((machine) => machine.type === type && isOperational(machine) && machine.specs.capacityKg >= loadKg)
    .filter((machine) => !branchId || machine.branchId === branchId)
    .map((machine) => ({
      machine,
      // Minutes until the machine could start this job; a free machine starts straight away
      waitMin: machine.job ? machine.job.remainingMin + machine.queue.reduce((sum, job) => sum + job.durationMin, 0) : 0,
    }))
    .sort((a, b) => a.waitMin - b.waitMin || a.machine.utilization - b.machine.utilization)
}

// ---------- Changes ----------

export type FaultInput = Pick<MachineFault, 'type' | 'severity' | 'description' | 'technician' | 'downtimeMin'>

export type MaintenanceInput = Pick<MaintenanceEntry, 'date' | 'time' | 'type' | 'technician' | 'durationMin' | 'cost' | 'description'>

export type JobInput = Pick<MachineJob, 'orderId' | 'customer' | 'service' | 'loadKg'> & { priority: QueuedJob['priority'] }

// ---------- Creating ----------

export function nextMachineId(type: MachineType, machines: { id: string }[]) {
  const { prefix } = getMachineType(type)
  const highest = Math.max(0, ...machines.filter(({ id }) => id.startsWith(`${prefix}-`)).map(({ id }) => Number(id.replace(/\D/g, '')) || 0))
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`
}

export function emptyProfile(id: string, branchId: string): MachineProfile {
  const meta = getMachineType('Washing Machine')
  return {
    id,
    uuid: '',
    name: '',
    type: 'Washing Machine',
    manufacturer: '',
    model: '',
    serial: '',
    yearPurchased: new Date().getFullYear(),
    description: '',
    branchId,
    area: meta.area,
    zone: '',
    specs: { capacityKg: 15, powerKw: 12, waterL: 150, voltage: 380, maxTemp: 90, cycleMin: 45, warrantyEnd: '' },
    capabilities: meta.capabilities,
    purchaseCost: 0,
    maintenanceEveryDays: 30,
  }
}

export function toProfile(machine: Machine): MachineProfile {
  const { id, uuid, name, type, manufacturer, model, serial, yearPurchased, description, branchId, area, zone, specs, capabilities, purchaseCost, maintenanceEveryDays } = machine
  return { id, uuid, name, type, manufacturer, model, serial, yearPurchased, description, branchId, area, zone, specs, capabilities, purchaseCost, maintenanceEveryDays }
}

export function createMachine(profile: MachineProfile, by: string, now: number): Machine {
  const next = toDateKey(now + profile.maintenanceEveryDays * DAY_MS)
  return {
    ...profile,
    status: 'available',
    statusNote: '',
    job: null,
    queue: [],
    runtimeTodayMin: 0,
    cyclesToday: 0,
    totalCycles: 0,
    utilization: 0,
    availability: 100,
    efficiency: 0,
    downtimePct: 0,
    avgCycleMin: profile.specs.cycleMin,
    energyKwh: 0,
    waterUsedL: 0,
    energyPerCycle: Number((profile.specs.powerKw * (profile.specs.cycleMin / 60)).toFixed(1)),
    lastMaintenanceAt: '',
    nextMaintenanceAt: next,
    technician: '',
    maintenanceLog: [],
    faults: [],
    costs: { maintenance: 0, repairs: 0, operating: 0, energy: 0 },
    revenue: 0,
    activity: [{ at: new Date(now).toISOString(), text: 'Machine registered', by }],
    transfers: [],
  }
}

export function getProfileProblems(profile: MachineProfile, takenIds: string[]) {
  const problems: string[] = []
  if (!profile.name.trim()) problems.push('Machine name is required (Basic Info).')
  if (!/^[A-Z]{2,3}-\d{3,}$/.test(profile.id)) problems.push('Machine ID must look like WM-015 (Basic Info).')
  else if (takenIds.includes(profile.id)) problems.push(`Machine ID ${profile.id} is already in use (Basic Info).`)
  if (!profile.manufacturer.trim()) problems.push('Manufacturer is required (Basic Info).')
  if (!profile.branchId) problems.push('Choose a branch (Location).')
  if (profile.specs.capacityKg <= 0) problems.push('Capacity must be greater than zero (Specifications).')
  if (profile.specs.cycleMin <= 0) problems.push('Cycle duration must be greater than zero (Specifications).')
  if (profile.capabilities.length === 0) problems.push('Select at least one capability (Capabilities).')
  return problems
}

// ---------- Costs ----------

export function getCostSummary(machine: Machine) {
  const { maintenance, repairs, operating, energy } = machine.costs
  const running = maintenance + repairs + operating + energy
  const total = machine.purchaseCost + running
  return {
    running,
    total,
    contribution: machine.revenue - running,
    // Return on everything spent on the machine, including buying it
    roi: total > 0 ? ((machine.revenue - total) / total) * 100 : 0,
    costPerCycle: machine.totalCycles > 0 ? Math.round(running / machine.totalCycles) : 0,
    energyCostPerCycle: Math.round(machine.energyPerCycle * ENERGY_RATE_XAF),
    waterCostPerCycle: Math.round(machine.specs.waterL * WATER_RATE_XAF),
  }
}

// ---------- Export and comparison ----------

export function machinesToCsv(machines: Machine[], branchName: (id: string) => string, now: number) {
  const header = ['ID', 'Name', 'Type', 'Manufacturer', 'Model', 'Serial', 'Branch', 'Area', 'Status', 'Current order', 'Utilization %', 'Runtime today (min)', 'Cycles today', 'Total cycles', 'Next maintenance', 'Maintenance status', 'Open fault']
  const rows = machines.map((machine) => [
    machine.id, machine.name, machine.type, machine.manufacturer, machine.model, machine.serial,
    branchName(machine.branchId), machine.area, getMachineStatus(machine.status).label, machine.job?.orderId ?? '',
    machine.utilization, machine.runtimeTodayMin, machine.cyclesToday, machine.totalCycles,
    machine.nextMaintenanceAt, getMaintenance(machine, now).label, getOpenFault(machine)?.type ?? '',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export const COMPARE_MACHINE_METRICS: {
  label: string
  financial?: boolean
  // Whether a larger value is the better one
  higherIsBetter: boolean
  get: (machine: Machine) => number
  format: (value: number) => string
}[] = [
  { label: 'Utilization', higherIsBetter: true, get: (machine) => machine.utilization, format: (value) => `${value}%` },
  { label: 'Cycles today', higherIsBetter: true, get: (machine) => machine.cyclesToday, format: String },
  { label: 'Efficiency', higherIsBetter: true, get: (machine) => machine.efficiency, format: (value) => `${value}%` },
  { label: 'Downtime', higherIsBetter: false, get: (machine) => machine.downtimePct, format: (value) => `${value}%` },
  { label: 'Energy per cycle', higherIsBetter: false, get: (machine) => machine.energyPerCycle, format: (value) => `${value} kWh` },
  { label: 'Water per cycle', higherIsBetter: false, get: (machine) => machine.specs.waterL, format: (value) => `${value} L` },
  { label: 'Faults on record', higherIsBetter: false, get: (machine) => machine.faults.length, format: String },
  { label: 'Maintenance cost', financial: true, higherIsBetter: false, get: (machine) => machine.costs.maintenance, format: formatCompactXaf },
]

export function formatMoney(value: number, compact = false) {
  return compact ? formatCompactXaf(value) : formatXaf(value)
}
