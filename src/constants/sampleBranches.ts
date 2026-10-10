import type {
  Branch,
  BranchMachine,
  BranchStaffRow,
  BranchStatus,
  BranchStockItem,
  BranchType,
  DayHours,
} from '../types/branch'
import { BRANCH_SERVICES, MACHINE_TYPES, PAYMENT_METHODS, STAFF_ROLES } from './branches'

// Sample data is relative to page-load time so dates always look current
const NOW = Date.now()
const DAY = 86_400_000
const dayOffset = (days: number) => new Date(NOW + days * DAY).toISOString().slice(0, 10)

const STAFF_NAMES = [
  'Aline Biya', 'Patrice Alima', 'Grace Ekane', 'Samuel Etoundi', 'Mireille Ngo',
  'Fabrice Tala', 'Sandrine Mballa', 'Olivier Nkeng', 'Carine Atangana', 'Serge Manga',
  'Estelle Fouda', 'Thierry Abena', 'Nadine Owona', 'Rodrigue Essama', 'Vanessa Mbida',
  'Christian Ondoa', 'Pauline Bella', 'Arnaud Zang', 'Josiane Meka', 'Blaise Ngono',
]

// Smooth pseudo-random variation so generated rows differ without Math.random
const vary = (seed: number, index: number) =>
  0.5 + 0.5 * Math.sin(seed * 2.1 + index * 1.7)

function week(open: string, close: string, openDays: number): DayHours[] {
  return Array.from({ length: 7 }, (_, index) => ({
    open,
    close,
    closed: index >= openDays,
  }))
}

function buildStaff(seed: number, manager: string, on: number, total: number): BranchStaffRow[] {
  return Array.from({ length: total }, (_, index) => {
    const onShift = index < on
    return {
      name: index === 0 ? manager : STAFF_NAMES[(seed * 3 + index) % STAFF_NAMES.length],
      role: index === 0 ? 'Branch Manager' : STAFF_ROLES[(seed + index) % STAFF_ROLES.length],
      ordersProcessed: Math.round(60 + vary(seed, index) * 90),
      workload: onShift ? Math.round(45 + vary(seed + 1, index) * 45) : 0,
      performance: Math.round(82 + vary(seed + 2, index) * 16),
      status: !onShift ? 'Off shift' : index % 6 === 5 ? 'On break' : 'Active',
    }
  })
}

function buildMachines(id: string, seed: number, up: number, total: number): BranchMachine[] {
  const counts: Record<string, number> = {}
  return Array.from({ length: total }, (_, index) => {
    const type = MACHINE_TYPES[(index * 2 + (index % 3)) % MACHINE_TYPES.length]
    counts[type] = (counts[type] ?? 0) + 1
    const working = index < up
    const running = working && index % 3 !== 2
    return {
      id: `${id}-M${String(index + 1).padStart(2, '0')}`,
      name: `${type} ${String(counts[type]).padStart(2, '0')}`,
      type,
      status: !working ? 'Maintenance' : running ? 'Running' : 'Available',
      job: running ? `ORD-10${400 + seed * 11 + index}` : '',
      utilization: working ? Math.round(50 + vary(seed, index) * 45) : 0,
      maintenanceAt: dayOffset(working ? 6 + ((seed + index * 5) % 40) : 0),
    }
  })
}

function buildStock(seed: number, health: number): BranchStockItem[] {
  const items: [string, string, number][] = [
    ['Liquid detergent', 'L', 40],
    ['Fabric softener', 'L', 25],
    ['Stain remover', 'L', 10],
    ['Hangers', 'pcs', 300],
    ['Garment bags', 'pcs', 400],
  ]
  return items.map(([name, unit, reorderAt], index) => ({
    name,
    unit,
    reorderAt,
    onHand: Math.round(reorderAt * (0.2 + (health / 100) * 1.3 + vary(seed, index) * 0.9)),
  }))
}

type Seed = {
  id: string
  name: string
  type: BranchType
  status: BranchStatus
  note?: string
  description: string
  region: string
  city: string
  district: string
  address: string
  phone: string
  manager: string
  hours: DayHours[]
  today: [orders: number, revenue: number]
  base: [orders: number, revenue: number]
  down?: [days: number, factor: number]
  activeOrders: number
  customers: number
  pipeline: [processing: number, ready: number, pendingDelivery: number, overdue: number]
  staff: [on: number, total: number]
  machines: [up: number, total: number]
  quality: [completion: number, onTime: number, satisfaction: number]
  usage: [machines: number, staff: number, inventory: number]
  coords: [lat: number, lng: number]
  capacity: number
  pendingSetup?: string[]
  closure?: { from: string; to: string; reason: string }
}

const SEEDS: Seed[] = [
  {
    id: 'BR-004', name: 'Downtown Hub #4', type: 'Main Branch', status: 'active',
    description: 'Main commercial processing hub with evening dispatch.',
    region: 'Littoral', city: 'Douala', district: 'Akwa', address: '142 Boulevard de la Liberté',
    phone: '+237 671 892 164', manager: 'Marcus Vance', hours: week('07:00', '21:00', 6),
    today: [84, 485_000], base: [80, 460_000], activeOrders: 32, customers: 1245,
    pipeline: [18, 8, 6, 0], staff: [14, 16], machines: [12, 14],
    quality: [96, 94, 4.8], usage: [88, 82, 92], coords: [4.0483, 9.7043], capacity: 120,
  },
  {
    id: 'BR-001', name: 'Bastos Flagship & Valet', type: 'Standard Branch', status: 'active',
    description: 'Premium retail counter and express dry cleaning.',
    region: 'Centre', city: 'Yaoundé', district: 'Bastos', address: 'Rue 1.077, Bastos Embassy Row',
    phone: '+237 699 440 218', manager: 'Solange Biya', hours: week('07:30', '20:00', 7),
    today: [68, 512_000], base: [66, 495_000], activeOrders: 24, customers: 980,
    pipeline: [12, 7, 5, 0], staff: [9, 10], machines: [8, 10],
    quality: [95, 93, 4.7], usage: [75, 78, 90], coords: [3.8931, 11.5093], capacity: 90,
  },
  {
    id: 'BR-002', name: 'Bonamoussadi Plant', type: 'Processing Center', status: 'active',
    note: 'Running near maximum machine capacity. Two orders are delayed.',
    description: 'Industrial multi-shift plant serving commercial accounts.',
    region: 'Littoral', city: 'Douala', district: 'Bonamoussadi', address: 'Carrefour Denver',
    phone: '+237 677 109 883', manager: 'Jean-Paul Kamga', hours: week('06:00', '22:00', 7),
    today: [92, 420_000], base: [85, 400_000], activeOrders: 41, customers: 1510,
    pipeline: [26, 11, 4, 2], staff: [18, 20], machines: [16, 17],
    quality: [93, 89, 4.5], usage: [94, 90, 84], coords: [4.0892, 9.7401], capacity: 100,
  },
  {
    id: 'BR-005', name: 'Omnisports Express', type: 'Pickup Point', status: 'active',
    description: 'Drop-off and pickup satellite; washing is done at Bastos.',
    region: 'Centre', city: 'Yaoundé', district: 'Omnisports', address: 'Avenue Marc Vivien Foé',
    phone: '+237 655 321 884', manager: 'Claire Nguemo', hours: week('08:00', '19:30', 6),
    today: [45, 215_000], base: [42, 200_000], activeOrders: 16, customers: 640,
    pipeline: [9, 8, 7, 0], staff: [4, 4], machines: [0, 0],
    quality: [95, 96, 4.6], usage: [0, 70, 88], coords: [3.8862, 11.5412], capacity: 60,
  },
  {
    id: 'BR-006', name: 'Bonabéri Logistics Bay', type: 'Processing Center', status: 'maintenance',
    note: 'Washer bay #3 and boiler inspection in progress. Operating at reduced capacity.',
    description: 'Commercial marine and heavy-wash facility.',
    region: 'Littoral', city: 'Douala', district: 'Bonabéri', address: 'Zone Industrielle MAGZI',
    phone: '+237 679 220 418', manager: 'Eric Ndong', hours: week('06:00', '18:00', 5),
    today: [14, 62_000], base: [38, 170_000], down: [3, 0.4], activeOrders: 12, customers: 320,
    pipeline: [8, 3, 1, 1], staff: [6, 12], machines: [4, 10],
    quality: [84, 81, 4.2], usage: [40, 55, 74], coords: [4.0747, 9.6628], capacity: 70,
  },
  {
    id: 'BR-003', name: 'Mvan Transit Depot', type: 'Pickup Point', status: 'closed',
    note: 'Floor and drainage renovation. New drop-offs are routed to Bastos and Omnisports.',
    description: 'Regional logistics and transport hub.',
    region: 'Centre', city: 'Yaoundé', district: 'Mvan', address: 'Gare Routière de Mvan',
    phone: '+237 651 409 881', manager: 'David Eboa', hours: week('07:00', '19:00', 6),
    today: [0, 0], base: [30, 130_000], down: [12, 0], activeOrders: 0, customers: 410,
    pipeline: [0, 0, 0, 0], staff: [0, 6], machines: [0, 5],
    quality: [90, 88, 4.4], usage: [0, 0, 80], coords: [3.8215, 11.4987], capacity: 50,
    closure: { from: dayOffset(-12), to: dayOffset(18), reason: 'Floor and drainage renovation' },
  },
  {
    id: 'BR-007', name: 'Akwa Branch', type: 'Standard Branch', status: 'active',
    description: 'Neighbourhood counter for walk-in customers.',
    region: 'Littoral', city: 'Douala', district: 'Akwa', address: '58 Rue Joss',
    phone: '+237 670 554 120', manager: 'Brigitte Fotso', hours: week('07:30', '19:00', 6),
    today: [22, 88_000], base: [24, 95_000], activeOrders: 9, customers: 385,
    pipeline: [5, 3, 1, 0], staff: [5, 6], machines: [4, 5],
    quality: [92, 90, 4.5], usage: [68, 72, 86], coords: [4.0469, 9.6952], capacity: 40,
  },
  {
    id: 'BR-008', name: 'Bonapriso Branch', type: 'Standard Branch', status: 'active',
    note: 'Two machines are down and stock is running low.',
    description: 'Residential counter with home delivery.',
    region: 'Littoral', city: 'Douala', district: 'Bonapriso', address: '12 Avenue de Gaulle',
    phone: '+237 698 731 045', manager: 'Hervé Tchoumi', hours: week('08:00', '19:00', 6),
    today: [17, 68_000], base: [21, 90_000], activeOrders: 7, customers: 298,
    pipeline: [4, 2, 1, 1], staff: [4, 5], machines: [3, 5],
    quality: [78, 72, 3.9], usage: [58, 64, 58], coords: [4.0246, 9.6981], capacity: 40,
    pendingSetup: ['Pricing'],
  },
]

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')

// TODO: replace with the branches API
export const SAMPLE_BRANCHES: Branch[] = SEEDS.map((seed, index) => {
  const number = index + 1
  const noMachines = seed.machines[1] === 0
  const [processing, ready, pendingDelivery, overdue] = seed.pipeline
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    type: seed.type,
    status: seed.status,
    statusNote: seed.note ?? '',
    country: 'Cameroon',
    region: seed.region,
    city: seed.city,
    district: seed.district,
    address: seed.address,
    postalCode: '',
    lat: seed.coords[0],
    lng: seed.coords[1],
    phone: seed.phone,
    phone2: '',
    email: `${slug(seed.name)}@freshflow.cm`,
    whatsapp: seed.phone,
    website: '',
    manager: seed.manager,
    hours: seed.hours,
    specialDays: [],
    closure: seed.closure ?? null,
    services: BRANCH_SERVICES.map(({ name }, serviceIndex) => ({
      name,
      enabled: noMachines
        ? name === 'Pickup & Delivery' || serviceIndex < 3
        : (number + serviceIndex) % 5 !== 0,
      price: seed.id === 'BR-001' && name === 'Dry Cleaning' ? 4500 : null,
    })),
    capacity: {
      dailyOrders: seed.capacity,
      maxItems: seed.capacity * 12,
      processingHours: noMachines ? 48 : 24,
      pickups: Math.round(seed.capacity * 0.3),
      deliveries: Math.round(seed.capacity * 0.35),
      machines: seed.machines[1],
    },
    paymentMethods: PAYMENT_METHODS.slice(0, seed.type === 'Pickup Point' ? 3 : 4),
    pendingSetup: seed.pendingSetup ?? [],
    openedAt: dayOffset(-(300 + number * 190)),
    stats: {
      ordersToday: seed.today[0],
      revenueToday: seed.today[1],
      baseOrders: seed.base[0],
      baseRevenue: seed.base[1],
      downDays: seed.down?.[0] ?? 0,
      downFactor: seed.down?.[1] ?? 1,
      activeOrders: seed.activeOrders,
      customers: seed.customers,
      newCustomers: Math.round(seed.customers * 0.06),
      processing,
      ready,
      pendingDelivery,
      outForDelivery: Math.round(pendingDelivery * 0.6),
      deliveredToday: Math.round(seed.today[0] * 0.55),
      overdue,
      completion: seed.quality[0],
      onTime: seed.quality[1],
      satisfaction: seed.quality[2],
      machineUtil: seed.usage[0],
      staffUtil: seed.usage[1],
      inventoryHealth: seed.usage[2],
      cancelRate: 0.02,
      seed: number,
    },
    staff: buildStaff(number, seed.manager, seed.staff[0], seed.staff[1]),
    machines: buildMachines(seed.id, number, seed.machines[0], seed.machines[1]),
    stock: buildStock(number, seed.usage[2]),
  }
})
