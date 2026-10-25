import type { MachineKind, MachineRequest, ServerMachine } from '../services/machineApi'
import type { Machine, MachineProfile, MachineSpecs, MachineType } from '../types/machine'
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

// The stored profile as the app's machine. The server keeps no runtime state
// (status, job, queue, counters, maintenance, faults), so those start neutral
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
  const created = server.createdAt ? new Date(server.createdAt).getTime() : Date.now()
  return { ...createMachine(profile, server.createdBy, created), activity: [] }
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
