import type { MachineKind, MachineRequest, ServerMachine } from '../services/machineApi'
import type {
  Machine,
  MachineFault,
  MachineProfile,
  MachineSpecs,
  MachineStatus,
  MachineType,
  MaintenanceEntry,
} from '../types/machine'
import { createMachine, emptyProfile } from './machines'

// The server knows five kinds of machine and the app eight, so the app's own
// type travels in `specs.machineType` and wins when it comes back. The kind
// sent is the nearest one
const KIND_OF: Record<MachineType, MachineKind> = {
  'Washing Machine': 'WASHING_MACHINE',
  Dryer: 'DRYER',
  Press: 'STEAM_PRESS',
  'Ironing Machine': 'STEAM_PRESS',
  'Steam Machine': 'STEAM_PRESS',
  'Folding Machine': 'STEAM_PRESS',
  'Packaging Machine': 'DRY_CLEANING_MACHINE',
  Other: 'DRY_CLEANING_MACHINE',
}

const TYPE_OF: Record<MachineKind, MachineType> = {
  WASHING_MACHINE: 'Washing Machine',
  DRYER: 'Dryer',
  DRY_CLEANING_MACHINE: 'Other',
  STEAM_PRESS: 'Press',
  OZONE_CHAMBER: 'Other',
}

const APP_TYPES = new Set<string>(Object.keys(KIND_OF))
const DEFAULT_SPECS = emptyProfile('', '').specs

const spec = (specs: Record<string, unknown>, key: keyof MachineSpecs) => {
  const value = Number(specs[key])
  return Number.isFinite(value) && specs[key] !== '' && specs[key] !== null ? value : (DEFAULT_SPECS[key] as number)
}

const num = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

// "IN_PROGRESS" -> "In Progress"
const title = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const STATUSES: MachineStatus[] = ['running', 'available', 'idle', 'maintenance', 'fault', 'offline', 'retired']

// The stored machine as the app's machine, with what the server says it is
// doing. The list leaves out costs, logs and transfers, which the single read has
export function toMachine(server: ServerMachine): Machine {
  const storedType = server.specs.machineType
  const type: MachineType =
    typeof storedType === 'string' && APP_TYPES.has(storedType)
      ? (storedType as MachineType)
      : server.type
        ? TYPE_OF[server.type]
        : 'Other'
  const warranty = server.specs.warrantyEnd
  const profile: MachineProfile = {
    id: server.code,
    uuid: server.id,
    name: server.name,
    type,
    manufacturer: server.manufacturer,
    model: server.model,
    serial: server.serialNumber,
    yearPurchased: server.yearPurchased ?? new Date().getFullYear(),
    description: server.description,
    branchId: server.branchId,
    area: server.area,
    zone: server.zone,
    specs: {
      capacityKg: spec(server.specs, 'capacityKg'),
      powerKw: spec(server.specs, 'powerKw'),
      waterL: spec(server.specs, 'waterL'),
      voltage: spec(server.specs, 'voltage'),
      maxTemp: spec(server.specs, 'maxTemp'),
      cycleMin: spec(server.specs, 'cycleMin'),
      warrantyEnd: typeof warranty === 'string' ? warranty : '',
    },
    capabilities: server.capabilities,
    purchaseCost: server.purchaseCost ?? 0,
    maintenanceEveryDays: server.maintenanceEveryDays ?? 30,
  }
  const run = server.runtime
  const created = server.createdAt ? new Date(server.createdAt).getTime() : Date.now()
  const base = createMachine(profile, server.createdBy, created)
  const status = STATUSES.find((value) => value === run.status?.toLowerCase()) ?? 'available'
  const metrics = run.metrics
  const job = run.job
  return {
    ...base,
    status,
    statusNote: run.statusNote ?? '',
    technician: run.technician ?? '',
    lastMaintenanceAt: run.lastMaintenanceAt ?? '',
    nextMaintenanceAt: run.nextMaintenanceAt ?? base.nextMaintenanceAt,
    totalCycles: run.totalCycles ?? 0,
    job: job
      ? {
          uuid: job.uuid ?? '',
          orderId: job.order ?? '',
          customer: job.customer ?? '',
          service: job.service ?? '',
          loadKg: num(job.loadKg),
          cycle: job.cycle ?? '',
          progress: job.progress ?? 0,
          remainingMin: job.remainingMin ?? 0,
          operator: job.operator ?? '',
          temperature: job.temperature ?? null,
          paused: job.paused === true,
          readyToComplete: job.readyToComplete === true,
        }
      : null,
    queue: (run.queue ?? []).map((item) => ({
      uuid: item.uuid ?? '',
      orderId: item.order ?? '',
      service: item.service ?? '',
      loadKg: num(item.loadKg),
      durationMin: item.durationMin ?? 0,
      priority: item.priority?.toUpperCase() === 'HIGH' ? ('High' as const) : ('Normal' as const),
    })),
    runtimeTodayMin: metrics?.runtimeTodayMin ?? 0,
    cyclesToday: metrics?.cyclesToday ?? 0,
    utilization: metrics?.utilization ?? 0,
    availability: metrics?.availability ?? 100,
    efficiency: metrics?.efficiency ?? 0,
    downtimePct: metrics?.downtimePct ?? 0,
    avgCycleMin: metrics?.avgCycleMin ?? profile.specs.cycleMin,
    energyKwh: num(metrics?.energyKwh),
    waterUsedL: num(metrics?.waterUsedL),
    energyPerCycle: num(metrics?.energyPerCycle),
    revenue: num(metrics?.revenue),
    costs: {
      maintenance: num(run.costs?.maintenance),
      repairs: num(run.costs?.repairs),
      operating: num(run.costs?.operating),
      energy: num(run.costs?.energy),
    },
    maintenanceLog: (run.maintenanceLog ?? []).map((entry) => ({
      id: entry.uuid ?? '',
      date: entry.date ?? '',
      time: (entry.time ?? '').slice(0, 5),
      type: entry.type ?? '',
      technician: entry.technician ?? '',
      durationMin: entry.durationMin ?? 0,
      cost: num(entry.cost),
      description: entry.description ?? '',
      status: (title(entry.status) || 'Scheduled') as MaintenanceEntry['status'],
    })),
    faults: (run.faults ?? []).map((fault) => ({
      id: fault.uuid ?? '',
      type: fault.type ?? '',
      severity: (title(fault.severity) || 'Medium') as MachineFault['severity'],
      reportedAt: fault.reportedAt ?? '',
      reportedBy: fault.reportedBy ?? '',
      description: fault.description ?? '',
      technician: fault.technician ?? '',
      downtimeMin: fault.downtimeMin ?? 0,
      status: (title(fault.status) || 'Open') as MachineFault['status'],
      resolution: fault.resolution ?? '',
    })),
    transfers: (run.transfers ?? []).map((entry) => ({
      at: entry.at ?? '',
      from: entry.from?.uuid ?? '',
      to: entry.to?.uuid ?? '',
      reason: entry.reason ?? '',
      by: entry.by ?? '',
    })),
    // The activity comes from the audit trail, on the machine's page
    activity: [],
  }
}

// The request that stores a profile. `withBranch` is false for an edit: a
// machine moves between branches through a transfer, not through its form
export function toMachineRequest(profile: MachineProfile, withBranch: boolean): MachineRequest {
  return {
    code: profile.id,
    name: profile.name.trim(),
    type: KIND_OF[profile.type],
    manufacturer: profile.manufacturer.trim(),
    model: profile.model.trim(),
    serialNumber: profile.serial.trim(),
    yearPurchased: profile.yearPurchased,
    description: profile.description.trim(),
    ...(withBranch ? { branch: profile.branchId } : {}),
    area: profile.area.trim(),
    zone: profile.zone.trim(),
    specs: { ...profile.specs, machineType: profile.type },
    capabilities: profile.capabilities,
    purchaseCost: profile.purchaseCost,
    maintenanceEveryDays: profile.maintenanceEveryDays,
  }
}
