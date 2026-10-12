import type {
  Machine,
  MachineFault,
  MachineStatus,
  MachineType,
  MaintenanceEntry,
} from '../types/machine'
import { ENERGY_RATE_XAF, MACHINE_TYPES, TECHNICIANS, WATER_RATE_XAF } from './machines'

// Sample fleet, relative to page-load time so dates and progress always look current
const NOW = Date.now()
const DAY = 86_400_000
const MINUTE = 60_000
const dayKey = (offset: number) => {
  const date = new Date(NOW + offset * DAY)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const minutesAgo = (minutes: number) => new Date(NOW - minutes * MINUTE).toISOString()

// Smooth pseudo-random value in [0, 1) so the fleet varies without Math.random
const vary = (seed: number, salt: number) => {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.5453
  return value - Math.floor(value)
}

const MODELS: Record<MachineType, { maker: string; model: string; capacity: number; power: number; water: number; maxTemp: number; cycle: number; cost: number; service: string; cycleName: string }> = {
  'Washing Machine': { maker: 'EcoWash', model: 'Pro 40kg', capacity: 40, power: 12, water: 150, maxTemp: 90, cycle: 45, cost: 4_500_000, service: 'Wash & Fold', cycleName: 'Standard Wash' },
  Dryer: { maker: 'HydroSpin', model: 'Industrial 35kg', capacity: 35, power: 18, water: 0, maxTemp: 85, cycle: 40, cost: 3_800_000, service: 'Tumble Dry', cycleName: 'High-Temp Tumble' },
  Press: { maker: 'SteamMaster', model: 'Rotary 3000', capacity: 60, power: 9, water: 12, maxTemp: 180, cycle: 30, cost: 5_200_000, service: 'Flatwork Press', cycleName: 'Flatwork Feed' },
  'Ironing Machine': { maker: 'PressLine', model: 'Flat 180', capacity: 25, power: 6, water: 6, maxTemp: 200, cycle: 25, cost: 1_600_000, service: 'Ironing Only', cycleName: 'Steam Iron' },
  'Steam Machine': { maker: 'ThermoCore', model: 'Boiler 120', capacity: 120, power: 30, water: 220, maxTemp: 170, cycle: 60, cost: 6_400_000, service: 'Steam Finish', cycleName: 'Steam Supply' },
  'Folding Machine': { maker: 'FoldTech', model: 'F-200', capacity: 50, power: 3, water: 0, maxTemp: 0, cycle: 20, cost: 2_900_000, service: 'Folding', cycleName: 'Auto Fold' },
  'Packaging Machine': { maker: 'WrapPro', model: 'Seal 60', capacity: 60, power: 2, water: 0, maxTemp: 0, cycle: 15, cost: 1_200_000, service: 'Packaging', cycleName: 'Bag & Seal' },
  Other: { maker: 'Generic', model: 'Utility', capacity: 10, power: 1, water: 0, maxTemp: 0, cycle: 30, cost: 500_000, service: 'Utility', cycleName: 'Run' },
}

// Machines per branch, and the mix of equipment each floor runs
const FLEET: [branchId: string, count: number][] = [
  ['BR-004', 14],
  ['BR-002', 12],
  ['BR-001', 8],
  ['BR-006', 4],
  ['BR-007', 2],
  ['BR-008', 2],
]
const MIX: MachineType[] = [
  'Washing Machine', 'Dryer', 'Press', 'Washing Machine', 'Dryer', 'Washing Machine', 'Ironing Machine',
  'Washing Machine', 'Dryer', 'Steam Machine', 'Folding Machine', 'Washing Machine', 'Dryer', 'Packaging Machine',
]

const FAULT_AT = [3, 17, 30]
const MAINTENANCE_AT = [6, 13, 22, 28, 37]
const AVAILABLE_AT = [4, 9, 11, 16, 20, 25, 27, 33, 36, 40]

const OPERATORS = ['Jean Mbarga', 'Sarah Mbarga', 'Elena Rostova', 'Priya Patel', 'Aline Biya', 'Patrice Alima']
const CUSTOMERS = ['Hôtel La Falaise', 'Amina Bello', 'Clinique du Littoral', 'Joseph Tabi', 'Résidence Bastos', 'Nadia Fotso']
const MAINTENANCE_WORK = [
  ['Preventive Maintenance', 'Belt tension, bearings and seals checked'],
  ['Filter Replacement', 'Lint and inlet filters replaced'],
  ['Calibration', 'Temperature and load sensors recalibrated'],
  ['Routine Inspection', 'Visual inspection and leak test'],
  ['Cleaning', 'Drum descaled and door gasket cleaned'],
] as const
const PAST_FAULTS = [
  ['Sensor Error', 'Door lock sensor misread; reseated the connector', 'Medium'],
  ['Water Pressure', 'Low inlet pressure; cleaned the inlet valve', 'High'],
  ['Overheating', 'Exhaust duct blocked with lint; cleared', 'High'],
  ['Operator Error', 'Overloaded drum tripped the imbalance cut-out', 'Low'],
] as const

const OPEN_FAULTS: Record<number, Pick<MachineFault, 'type' | 'severity' | 'description' | 'status' | 'downtimeMin'>> = {
  3: { type: 'Drainage Blockage', severity: 'Critical', description: 'Vibration spike at the drain stage. Drum safety valve halted the cycle with water still in the drum.', status: 'In Progress', downtimeMin: 90 },
  17: { type: 'Electrical Failure', severity: 'High', description: 'Heating element trips the breaker after ten minutes.', status: 'Open', downtimeMin: 180 },
  30: { type: 'Sensor Error', severity: 'Medium', description: 'Moisture sensor reads dry on a wet load, ending cycles early.', status: 'In Progress', downtimeMin: 60 },
}

const counters: Partial<Record<MachineType, number>> = {}

function build(index: number, branchId: string, type: MachineType): Machine {
  const meta = MACHINE_TYPES.find(({ value }) => value === type)!
  const model = MODELS[type]
  const number = (counters[type] = (counters[type] ?? 0) + 1)
  const id = `${meta.prefix}-${String(number).padStart(3, '0')}`
  const status: MachineStatus = FAULT_AT.includes(index)
    ? 'fault'
    : MAINTENANCE_AT.includes(index)
      ? 'maintenance'
      : AVAILABLE_AT.includes(index)
        ? 'available'
        : 'running'
  const running = status === 'running'
  const technician = TECHNICIANS[index % TECHNICIANS.length]
  const utilization = Math.round(
    running ? 68 + vary(index, 1) * 29 : status === 'available' ? 34 + vary(index, 1) * 28 : 45 + vary(index, 1) * 25,
  )
  const cyclesToday = running ? 8 + Math.round(vary(index, 2) * 12) : Math.round(vary(index, 2) * 7)
  const totalCycles = 3_000 + Math.round(vary(index, 3) * 11_000)
  // One dryer runs hot so the energy alert has something to find
  const energyPerCycle = Number((model.power * (model.cycle / 60) * (0.92 + vary(index, 4) * 0.12) * (id === 'DR-002' ? 1.22 : 1)).toFixed(1))
  const monthlyCycles = Math.round(cyclesToday * 22 + 60)
  const energyKwh = Math.round(energyPerCycle * monthlyCycles)
  const waterUsedL = model.water * monthlyCycles
  const progress = 12 + Math.round(vary(index, 5) * 80)
  const nextOffset = status === 'maintenance' ? 0 : index % 11 === 5 ? -3 : index % 7 === 2 ? 2 + (index % 4) : 9 + Math.round(vary(index, 6) * 30)
  const openFault = OPEN_FAULTS[index]
  const pastFaultCount = index === 8 ? 3 : Math.round(vary(index, 7) * 1.6)

  const maintenanceLog: MaintenanceEntry[] = [
    ...(status === 'maintenance'
      ? [{ id: `${id}-MT-0`, date: dayKey(0), time: '08:30', type: index === 13 ? 'Parts Replacement' : 'Preventive Maintenance', technician, durationMin: 120, cost: 35_000, description: index === 13 ? 'Replacing the drive belt and door gasket' : 'Scheduled service in progress', status: 'In Progress' as const }]
      : [{ id: `${id}-MT-0`, date: dayKey(nextOffset), time: '09:00', type: 'Preventive Maintenance', technician, durationMin: 90, cost: 25_000, description: 'Scheduled preventive service', status: nextOffset < 0 ? ('Overdue' as const) : ('Scheduled' as const) }]),
    ...[1, 2, 3].map((step) => {
      const [workType, description] = MAINTENANCE_WORK[(index + step) % MAINTENANCE_WORK.length]
      return { id: `${id}-MT-${step}`, date: dayKey(-(step * 30 - 6 + (index % 5))), time: '09:00', type: workType, technician: TECHNICIANS[(index + step) % TECHNICIANS.length], durationMin: 45 + ((index + step) % 4) * 30, cost: 15_000 + ((index + step) % 5) * 7_500, description, status: 'Completed' as const }
    }),
  ]

  const faults: MachineFault[] = [
    ...(openFault
      ? [{ id: `${id}-F-0`, ...openFault, reportedAt: minutesAgo(42 + index * 3), reportedBy: OPERATORS[index % OPERATORS.length], technician, resolution: '' }]
      : []),
    ...Array.from({ length: pastFaultCount }, (_, step) => {
      const [faultType, resolution, severity] = PAST_FAULTS[(index + step) % PAST_FAULTS.length]
      return { id: `${id}-F-${step + 1}`, type: faultType, severity, reportedAt: minutesAgo((6 + step * 9 + (index % 5)) * 1440), reportedBy: OPERATORS[(index + step) % OPERATORS.length], description: `${faultType} reported during a cycle.`, technician: TECHNICIANS[(index + step) % TECHNICIANS.length], downtimeMin: 40 + ((index + step) % 5) * 35, status: 'Resolved' as const, resolution }
    }),
  ]

  const job = running
    ? {
        orderId: `ORD-10${400 + index}`,
        customer: CUSTOMERS[index % CUSTOMERS.length],
        service: model.service,
        loadKg: Number((model.capacity * (0.45 + vary(index, 8) * 0.45)).toFixed(1)),
        cycle: model.cycleName,
        progress,
        remainingMin: Math.max(1, Math.round((model.cycle * (100 - progress)) / 100)),
        operator: OPERATORS[index % OPERATORS.length],
        temperature: meta.heated ? Math.round(model.maxTemp * (0.45 + vary(index, 9) * 0.3)) : null,
        paused: false,
      }
    : null

  const maintenanceCost = maintenanceLog.filter((entry) => entry.status === 'Completed').reduce((sum, entry) => sum + entry.cost, 0) * 4
  const repairs = faults.length * 40_000
  const energyCost = Math.round(energyKwh * ENERGY_RATE_XAF * 12)
  const operating = Math.round(waterUsedL * WATER_RATE_XAF * 12 + 180_000 + vary(index, 10) * 240_000)

  return {
    id,
    name: `${type === 'Washing Machine' ? 'Washer' : type.replace(' Machine', '')} #${String(number).padStart(2, '0')}`,
    type,
    manufacturer: model.maker,
    model: model.model,
    serial: `SN-${String(9_280_000 + index * 7_919).slice(0, 7)}`,
    yearPurchased: 2020 + (index % 6),
    description: `${model.maker} ${model.model} on the ${meta.area.toLowerCase()}.`,
    branchId,
    area: meta.area,
    zone: `Zone ${String.fromCharCode(65 + (index % 3))} / Station ${String((index % 6) + 1).padStart(2, '0')}`,
    specs: { capacityKg: model.capacity, powerKw: model.power, waterL: model.water, voltage: 380, maxTemp: model.maxTemp, cycleMin: model.cycle, warrantyEnd: dayKey(400 - index * 45) },
    capabilities: meta.capabilities.filter((_, position) => (index + position) % 5 !== 4),
    purchaseCost: model.cost,
    maintenanceEveryDays: 30,
    status,
    statusNote: openFault ? openFault.description : status === 'maintenance' ? maintenanceLog[0].description : '',
    job,
    queue: status === 'running' || status === 'available'
      ? Array.from({ length: Math.round(vary(index, 11) * 3) }, (_, step) => ({ orderId: `ORD-10${460 + index + step * 43}`, service: model.service, loadKg: Number((model.capacity * (0.4 + vary(index, 12 + step) * 0.5)).toFixed(1)), durationMin: model.cycle, priority: (index + step) % 4 === 0 ? ('High' as const) : ('Normal' as const) }))
      : [],
    runtimeTodayMin: cyclesToday * model.cycle - Math.round(vary(index, 14) * 20),
    cyclesToday,
    totalCycles,
    utilization,
    availability: Math.round(99 - faults.length * 2.5 - vary(index, 15) * 4),
    efficiency: Math.round(84 + vary(index, 16) * 13),
    downtimePct: Number((1 + faults.length * 1.6 + vary(index, 17) * 2).toFixed(1)),
    avgCycleMin: Math.round(model.cycle * (0.94 + vary(index, 18) * 0.12)),
    energyKwh,
    waterUsedL,
    energyPerCycle,
    lastMaintenanceAt: maintenanceLog[1].date,
    nextMaintenanceAt: maintenanceLog[0].date,
    technician,
    maintenanceLog,
    faults,
    costs: { maintenance: maintenanceCost, repairs, operating, energy: energyCost },
    revenue: Math.round(totalCycles * (type === 'Washing Machine' || type === 'Dryer' ? 2_400 : 1_300)),
    activity: [
      ...(openFault ? [{ at: minutesAgo(42 + index * 3), text: `Fault reported: ${openFault.type}`, by: OPERATORS[index % OPERATORS.length] }] : []),
      ...(job ? [{ at: minutesAgo(Math.round((model.cycle * progress) / 100)), text: `Started ${job.cycle}`, by: job.operator, orderId: job.orderId }] : []),
      { at: minutesAgo(95 + index), text: 'Cycle completed', by: 'System', orderId: `ORD-10${380 + index}` },
      { at: minutesAgo(140 + index), text: 'Order assigned', by: OPERATORS[(index + 1) % OPERATORS.length], orderId: `ORD-10${380 + index}` },
      { at: minutesAgo(1440 * 6 + index * 11), text: `${maintenanceLog[1].type} completed`, by: maintenanceLog[1].technician },
    ],
    transfers: index === 5 ? [{ at: minutesAgo(1440 * 120), from: 'BR-002', to: branchId, reason: 'Rebalancing washer capacity', by: 'Marcus Vance' }] : [],
  }
}

// TODO: replace with the machines API
export const SAMPLE_MACHINES: Machine[] = FLEET.flatMap(([branchId, count], branchIndex) => {
  const offset = FLEET.slice(0, branchIndex).reduce((sum, [, size]) => sum + size, 0)
  return Array.from({ length: count }, (_, position) => build(offset + position, branchId, MIX[position % MIX.length]))
})
