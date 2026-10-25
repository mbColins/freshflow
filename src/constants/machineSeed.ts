import type { MachineProfile, MachineType } from '../types/machine'
import { MACHINE_TYPES } from './machines'

// The demo fleet that used to be the Machines page's mock data, reduced to
// what the server stores: each machine's profile. "Import sample fleet" on the
// empty Machines page sends these to POST /machines. Delete this file and
// that button once the fleet is imported.

const DAY = 86_400_000
const dayKey = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)

const MODELS: Record<MachineType, { maker: string; model: string; capacity: number; power: number; water: number; maxTemp: number; cycle: number; cost: number }> = {
  'Washing Machine': { maker: 'EcoWash', model: 'Pro 40kg', capacity: 40, power: 12, water: 150, maxTemp: 90, cycle: 45, cost: 4_500_000 },
  Dryer: { maker: 'HydroSpin', model: 'Industrial 35kg', capacity: 35, power: 18, water: 0, maxTemp: 85, cycle: 40, cost: 3_800_000 },
  Press: { maker: 'SteamMaster', model: 'Rotary 3000', capacity: 60, power: 9, water: 12, maxTemp: 180, cycle: 30, cost: 5_200_000 },
  'Ironing Machine': { maker: 'PressLine', model: 'Flat 180', capacity: 25, power: 6, water: 6, maxTemp: 200, cycle: 25, cost: 1_600_000 },
  'Steam Machine': { maker: 'ThermoCore', model: 'Boiler 120', capacity: 120, power: 30, water: 220, maxTemp: 170, cycle: 60, cost: 6_400_000 },
  'Folding Machine': { maker: 'FoldTech', model: 'F-200', capacity: 50, power: 3, water: 0, maxTemp: 0, cycle: 20, cost: 2_900_000 },
  'Packaging Machine': { maker: 'WrapPro', model: 'Seal 60', capacity: 60, power: 2, water: 0, maxTemp: 0, cycle: 15, cost: 1_200_000 },
  Other: { maker: 'Generic', model: 'Utility', capacity: 10, power: 1, water: 0, maxTemp: 0, cycle: 30, cost: 500_000 },
}

// Machines per floor, and the mix of equipment each floor runs. A floor
// becomes one of the business's real branches when imported
const FLOORS = [14, 12, 8, 4, 2, 2]
const MIX: MachineType[] = [
  'Washing Machine', 'Dryer', 'Press', 'Washing Machine', 'Dryer', 'Washing Machine', 'Ironing Machine',
  'Washing Machine', 'Dryer', 'Steam Machine', 'Folding Machine', 'Washing Machine', 'Dryer', 'Packaging Machine',
]

export type SeedMachine = Omit<MachineProfile, 'uuid' | 'branchId'> & {
  // Which floor (0-based) of the demo fleet the machine stood on
  floor: number
}

export function buildMachineSeed(): SeedMachine[] {
  const counters: Partial<Record<MachineType, number>> = {}
  let index = 0
  return FLOORS.flatMap((count, floor) =>
    Array.from({ length: count }, (_, position) => {
      const type = MIX[position % MIX.length]
      const meta = MACHINE_TYPES.find(({ value }) => value === type)!
      const model = MODELS[type]
      const number = (counters[type] = (counters[type] ?? 0) + 1)
      const at = index++
      return {
        floor,
        id: `${meta.prefix}-${String(number).padStart(3, '0')}`,
        name: `${type === 'Washing Machine' ? 'Washer' : type.replace(' Machine', '')} #${String(number).padStart(2, '0')}`,
        type,
        manufacturer: model.maker,
        model: model.model,
        serial: `SN-${String(9_280_000 + at * 7_919).slice(0, 7)}`,
        yearPurchased: 2020 + (at % 6),
        description: `${model.maker} ${model.model} on the ${meta.area.toLowerCase()}.`,
        area: meta.area,
        zone: `Zone ${String.fromCharCode(65 + (at % 3))} / Station ${String((at % 6) + 1).padStart(2, '0')}`,
        specs: { capacityKg: model.capacity, powerKw: model.power, waterL: model.water, voltage: 380, maxTemp: model.maxTemp, cycleMin: model.cycle, warrantyEnd: dayKey(400 - at * 45) },
        capabilities: meta.capabilities.filter((_, spot) => (at + spot) % 5 !== 4),
        purchaseCost: model.cost,
        maintenanceEveryDays: 30,
      }
    }),
  )
}
