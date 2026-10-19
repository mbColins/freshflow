import {
  BRANCH_SERVICES,
  BRANCH_STATUSES,
  DAYS,
  DEFAULT_HOURS,
  PAYMENT_METHODS,
  PERFORMANCE_TIERS,
  REGIONS,
  SETUP_TASKS,
} from '../constants/branches'
import type { BranchResponse } from '../services/branchApi'
import type {
  Branch,
  BranchCapacity,
  BranchFilters,
  BranchPeriod,
  BranchProfile,
  BranchStats,
  BranchStatus,
  BranchType,
  DayHours,
  PerformanceTier,
  RevenueGranularity,
} from '../types/branch'
import { csvCell } from './csv'
import { parseCsv } from './customers'
import { formatXaf } from './orders'
import { formatCompactXaf } from './services'

const DAY_MS = 86_400_000

export function getBranchStatus(value: Branch['status']) {
  return BRANCH_STATUSES.find((status) => status.value === value)!
}

export function getStaffCounts(branch: Branch) {
  return {
    on: branch.staff.filter(({ status }) => status !== 'Off shift').length,
    total: branch.staff.length,
  }
}

export function getMachineCounts(branch: Branch) {
  return {
    up: branch.machines.filter(({ status }) => status !== 'Maintenance').length,
    total: branch.machines.length,
  }
}

// What the health score is made of; weights are renormalised when a factor doesn't apply
export function getHealthFactors(branch: Branch) {
  const { stats } = branch
  const machines = getMachineCounts(branch)
  return [
    { label: 'Order processing', value: stats.completion, weight: 0.25 },
    { label: 'Delivery performance', value: stats.onTime, weight: 0.25 },
    ...(machines.total > 0
      ? [{ label: 'Machine availability', value: Math.round((machines.up / machines.total) * 100), weight: 0.2 }]
      : []),
    { label: 'Inventory levels', value: stats.inventoryHealth, weight: 0.15 },
    { label: 'Customer satisfaction', value: Math.round((stats.satisfaction / 5) * 100), weight: 0.15 },
  ]
}

// null when the branch isn't trading, so there is nothing to score
export function getHealth(branch: Branch) {
  if (branch.status === 'closed' || branch.status === 'inactive') return null
  if (branch.stats.baseOrders === 0) return null
  const factors = getHealthFactors(branch)
  const weight = factors.reduce((sum, factor) => sum + factor.weight, 0)
  return Math.round(
    factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / weight,
  )
}

export function getPerformanceTier(health: number | null): PerformanceTier | null {
  if (health === null) return null
  return PERFORMANCE_TIERS.find(({ min }) => health >= min)!.value
}

export function getTierLabel(health: number | null) {
  const tier = getPerformanceTier(health)
  return tier ? PERFORMANCE_TIERS.find(({ value }) => value === tier)!.label : 'Not operating'
}

// ---------- History derived from a typical trading day ----------

const wave = (seed: number, ago: number) =>
  1 + 0.12 * Math.sin(seed * 1.7 + ago * 0.9) + 0.05 * Math.sin(seed + ago * 2.3)

type Measure = 'orders' | 'revenue'

const baseOf = (stats: BranchStats, measure: Measure) =>
  measure === 'orders' ? stats.baseOrders : stats.baseRevenue

// Oldest first; the last value is today
function dailyValues(stats: BranchStats, measure: Measure, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const ago = days - 1 - index
    if (ago === 0) return measure === 'orders' ? stats.ordersToday : stats.revenueToday
    const factor = ago < stats.downDays ? stats.downFactor : 1
    return Math.round(baseOf(stats, measure) * factor * wave(stats.seed, ago))
  })
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

function weeklyValue(stats: BranchStats, measure: Measure, ago: number) {
  if (ago < 4) return sum(dailyValues(stats, measure, (ago + 1) * 7).slice(0, 7))
  return Math.round(baseOf(stats, measure) * 7 * 0.996 ** ago * wave(stats.seed + 3, ago))
}

function monthlyValue(stats: BranchStats, measure: Measure, ago: number) {
  if (ago === 0) return sum(dailyValues(stats, measure, 30))
  return Math.round(baseOf(stats, measure) * 30 * 0.985 ** ago * wave(stats.seed + 5, ago))
}

function yearlyValue(stats: BranchStats, measure: Measure, ago: number, now: number) {
  if (ago === 0) {
    const months = new Date(now).getMonth() + 1
    return sum(Array.from({ length: months }, (_, month) => monthlyValue(stats, measure, month)))
  }
  return Math.round(baseOf(stats, measure) * 360 * 0.85 ** ago * wave(stats.seed + 9, ago))
}

export function getPeriodStats(branch: Branch, period: BranchPeriod) {
  const read = (measure: Measure): [current: number, previous: number] => {
    const { stats } = branch
    if (period === 'today') {
      const [previous, current] = dailyValues(stats, measure, 2)
      return [current, previous]
    }
    if (period === 'week') return [weeklyValue(stats, measure, 0), weeklyValue(stats, measure, 1)]
    const ago = period === 'month' ? 0 : 1
    return [monthlyValue(stats, measure, ago), monthlyValue(stats, measure, ago + 1)]
  }
  const [orders, previousOrders] = read('orders')
  const [revenue, previousRevenue] = read('revenue')
  return { orders, previousOrders, revenue, previousRevenue }
}

export function getYearToDateRevenue(branch: Branch, now: number) {
  return yearlyValue(branch.stats, 'revenue', 0, now)
}

const SERIES_LENGTH: Record<RevenueGranularity, number> = {
  daily: 14,
  weekly: 8,
  monthly: 6,
  yearly: 4,
}

// Current period next to the one before it; yearly has no earlier period to compare
export function getRevenueSeries(branch: Branch, granularity: RevenueGranularity, now: number) {
  const { stats } = branch
  const length = SERIES_LENGTH[granularity]
  const day = (ago: number) =>
    new Date(now - ago * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const agos = Array.from({ length }, (_, index) => length - 1 - index)

  if (granularity === 'daily') {
    const values = dailyValues(stats, 'revenue', length * 2)
    return {
      labels: agos.map(day),
      current: values.slice(length),
      previous: values.slice(0, length),
    }
  }
  if (granularity === 'weekly') {
    return {
      labels: agos.map((ago) => `Week to ${day(ago * 7)}`),
      current: agos.map((ago) => weeklyValue(stats, 'revenue', ago)),
      previous: agos.map((ago) => weeklyValue(stats, 'revenue', ago + length)),
    }
  }
  if (granularity === 'monthly') {
    const month = (ago: number) => {
      const date = new Date(now)
      date.setDate(1)
      date.setMonth(date.getMonth() - ago)
      return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    }
    return {
      labels: agos.map(month),
      current: agos.map((ago) => monthlyValue(stats, 'revenue', ago)),
      previous: agos.map((ago) => monthlyValue(stats, 'revenue', ago + length)),
    }
  }
  const year = new Date(now).getFullYear()
  return {
    labels: agos.map((ago) => (ago === 0 ? `${year} to date` : String(year - ago))),
    current: agos.map((ago) => yearlyValue(stats, 'revenue', ago, now)),
    previous: null,
  }
}

// Processing and Ready are the live queue; the rest are totals for the period
export function getOrderBreakdown(branch: Branch, period: BranchPeriod) {
  const { stats } = branch
  const { orders } = getPeriodStats(branch, period)
  const today = period === 'today'
  return [
    { label: 'Received', value: orders },
    { label: 'Processing', value: stats.processing },
    { label: 'Ready', value: stats.ready },
    { label: 'Delivered', value: today ? stats.deliveredToday : Math.round((orders * stats.completion) / 100) },
    { label: 'Cancelled', value: Math.round(orders * stats.cancelRate) },
    { label: 'Overdue', value: today ? stats.overdue : Math.round(orders * (1 - stats.onTime / 100) * 0.3) },
  ]
}

export function getChange(current: number, previous: number) {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function formatChange(change: number | null) {
  if (change === null) return 'No earlier data'
  return `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}%`
}

// ---------- Opening hours ----------

const hoursText = (day: DayHours) => (day.closed ? 'closed' : `${day.open}–${day.close}`)

// "Mon–Sat 07:00–21:00 · Sun closed"
export function formatHoursSummary(hours: DayHours[]) {
  const groups: { from: number; to: number; text: string }[] = []
  hours.forEach((day, index) => {
    const text = hoursText(day)
    const last = groups.at(-1)
    if (last && last.text === text) last.to = index
    else groups.push({ from: index, to: index, text })
  })
  const short = (index: number) => DAYS[index].slice(0, 3)
  return groups
    .map(({ from, to, text }) => `${from === to ? short(from) : `${short(from)}–${short(to)}`} ${text}`)
    .join(' · ')
}

// ---------- List ----------

export function matchesBranchFilters(branch: Branch, filters: BranchFilters) {
  if (filters.status && branch.status !== filters.status) return false
  if (filters.city && branch.city !== filters.city) return false
  if (filters.performance && getPerformanceTier(getHealth(branch)) !== filters.performance) {
    return false
  }
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  const digits = query.replace(/\D/g, '')
  return (
    [branch.name, branch.id, branch.city, branch.district, branch.address, branch.email, branch.manager]
      .some((value) => value.toLowerCase().includes(query)) ||
    (digits.length >= 3 && branch.phone.replace(/\D/g, '').includes(digits))
  )
}

export type BranchSortKey = 'name' | 'orders' | 'revenue' | 'staff' | 'performance' | 'status'

export function compareBranches(a: Branch, b: Branch, key: BranchSortKey, period: BranchPeriod) {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'orders':
      return getPeriodStats(a, period).orders - getPeriodStats(b, period).orders
    case 'revenue':
      return getPeriodStats(a, period).revenue - getPeriodStats(b, period).revenue
    case 'staff':
      return a.staff.length - b.staff.length
    case 'performance':
      return (getHealth(a) ?? -1) - (getHealth(b) ?? -1)
    case 'status':
      return (
        BRANCH_STATUSES.findIndex(({ value }) => value === a.status) -
        BRANCH_STATUSES.findIndex(({ value }) => value === b.status)
      )
  }
}

export function branchesToCsv(branches: Branch[], period: BranchPeriod, includeFinancials: boolean) {
  const header = [
    'Code', 'Name', 'Type', 'Status', 'City', 'District', 'Address', 'Phone', 'Email',
    'Manager', 'Opening hours', 'Orders', ...(includeFinancials ? ['Revenue (XAF)'] : []),
    'Active orders', 'Customers', 'Staff', 'Machines working', 'Machines', 'Health %',
  ]
  const rows = branches.map((branch) => {
    const stats = getPeriodStats(branch, period)
    const machines = getMachineCounts(branch)
    return [
      branch.id, branch.name, branch.type, getBranchStatus(branch.status).label, branch.city,
      branch.district, branch.address, branch.phone, branch.email, branch.manager,
      formatHoursSummary(branch.hours), stats.orders, ...(includeFinancials ? [stats.revenue] : []),
      branch.stats.activeOrders, branch.stats.customers, branch.staff.length, machines.up,
      machines.total, getHealth(branch) ?? '',
    ]
  })
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function nextBranchCode(branches: { id: string }[]) {
  const highest = Math.max(0, ...branches.map(({ id }) => Number(id.replace(/\D/g, '')) || 0))
  return `BR-${String(highest + 1).padStart(3, '0')}`
}

export function emptyProfile(id: string): BranchProfile {
  return {
    id,
    name: '',
    description: '',
    logoUrl: null,
    tenant: '',
    type: 'Standard Branch',
    status: 'active',
    country: 'Cameroon',
    region: 'Littoral',
    city: 'Douala',
    district: '',
    address: '',
    postalCode: '',
    lat: null,
    lng: null,
    phone: '',
    phone2: '',
    email: '',
    whatsapp: '',
    website: '',
    manager: '',
    hours: DEFAULT_HOURS,
    specialDays: [],
    closure: null,
    services: BRANCH_SERVICES.map(({ name }) => ({ name, enabled: true, price: null })),
    capacity: { dailyOrders: 50, maxItems: 600, processingHours: 24, pickups: 15, deliveries: 15, machines: 0 },
    paymentMethods: PAYMENT_METHODS.slice(0, 3),
    pendingSetup: [],
  }
}

// multipart/form-data body for POST / PATCH /branch: BranchRequest as flat
// keys, as Spring binds them. Nested objects use dotted keys (capacity.dailyOrders),
// lists use indexed keys (hours[0].open) and string lists repeat their key
// (paymentMethods=Cash&paymentMethods=Mobile Money). Only the fields given are
// sent, so it also builds partial PATCH bodies.
// Note: multipart can't express "empty list" or "no closure"; clearing those
// needs backend support. TODO: agree on how with the backend
export function branchFormData(profile: Partial<BranchProfile>, logo: File | null = null) {
  const body = new FormData()
  const put = (key: string, value: string | number | boolean | null | undefined) => {
    if (value !== null && value !== undefined) body.append(key, String(value))
  }
  const { id, lat, lng, hours, specialDays, closure, services, capacity, paymentMethods, pendingSetup, ...text } = profile
  // The branch code; `id` isn't a BranchRequest field
  put('code', id)
  // BranchRequest binds latitude / longitude, not lat / lng
  put('latitude', lat)
  put('longitude', lng)
  for (const [key, value] of Object.entries(text)) {
    // The logo travels as the `logo` file part, not as its URL
    if (key === 'logoUrl') continue
    // '' means the caller's own tenant, which the backend assumes anyway
    if (key === 'tenant' && value === '') continue
    put(key, value)
  }
  hours?.forEach((day, index) => {
    put(`hours[${index}].open`, day.open)
    put(`hours[${index}].close`, day.close)
    put(`hours[${index}].closed`, day.closed)
  })
  specialDays?.forEach((day, index) => {
    put(`specialDays[${index}].date`, day.date)
    put(`specialDays[${index}].label`, day.label)
    put(`specialDays[${index}].closed`, day.closed)
    put(`specialDays[${index}].open`, day.open)
    put(`specialDays[${index}].close`, day.close)
  })
  if (closure) {
    put('closure.from', closure.from)
    put('closure.to', closure.to)
    put('closure.reason', closure.reason)
  }
  services?.forEach((service, index) => {
    put(`services[${index}].name`, service.name)
    put(`services[${index}].enabled`, service.enabled)
    // Left out = use the catalog price
    put(`services[${index}].price`, service.price)
  })
  if (capacity) {
    for (const [key, value] of Object.entries(capacity)) put(`capacity.${key}`, value)
  }
  paymentMethods?.forEach((method) => put('paymentMethods', method))
  pendingSetup?.forEach((task) => put('pendingSetup', task))
  if (logo) body.append('logo', logo, logo.name)
  return body
}

// Just the profile fields of a branch (what a create request carries)
export function profileOf(branch: BranchProfile): BranchProfile {
  const profile = emptyProfile(branch.id)
  for (const key of Object.keys(profile) as (keyof BranchProfile)[]) {
    Object.assign(profile, { [key]: branch[key] })
  }
  return profile
}

// The profile fields that differ between two versions of a branch, for a PATCH
export function changedProfileFields(before: BranchProfile, after: BranchProfile): Partial<BranchProfile> {
  const keys = Object.keys(emptyProfile('')) as (keyof BranchProfile)[]
  const changes: Partial<BranchProfile> = {}
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(changes, { [key]: after[key] })
    }
  }
  // The code is the branch's identity, so it goes along with any change
  return Object.keys(changes).length > 0 ? { ...changes, id: after.id } : changes
}

const BRANCH_TYPES: BranchType[] = ['Main Branch', 'Standard Branch', 'Pickup Point', 'Processing Center']

// The API may send numbers as strings (latitude / longitude are strings)
const toNumber = (value: unknown) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : null
}

// A branch from the API in the shape the pages use. Fields the response leaves
// out get the new-branch defaults; trading figures, staff, machines and stock
// start empty until the backend provides them. Null when it has no id at all.
// TODO: confirm the response shape with the backend
export function branchFromApi(raw: BranchResponse): Branch | null {
  const uuid = raw.uuid ?? (raw.id !== undefined && raw.id !== null ? String(raw.id) : '')
  const code = raw.code ?? uuid
  if (!uuid) return null
  const base = createBranch(emptyProfile(code), 0)
  const status = BRANCH_STATUSES.find(({ value }) => value === raw.status?.toLowerCase())?.value
  const type = BRANCH_TYPES.find((value) => value.toLowerCase() === raw.type?.toLowerCase())
  const capacity: BranchCapacity = { ...base.capacity }
  for (const key of Object.keys(capacity) as (keyof BranchCapacity)[]) {
    capacity[key] = toNumber(raw.capacity?.[key]) ?? capacity[key]
  }
  return {
    ...base,
    uuid,
    name: raw.name ?? code,
    description: raw.description ?? '',
    logoUrl: raw.logoUrl ?? raw.logo ?? null,
    type: type ?? base.type,
    status: (status as BranchStatus | undefined) ?? base.status,
    country: raw.country ?? '',
    region: raw.region ?? '',
    city: raw.city ?? '',
    district: raw.district ?? '',
    address: raw.address ?? '',
    postalCode: raw.postalCode ?? '',
    lat: toNumber(raw.latitude ?? raw.lat),
    lng: toNumber(raw.longitude ?? raw.lng),
    phone: raw.phone ?? '',
    phone2: raw.phone2 ?? '',
    email: raw.email ?? '',
    whatsapp: raw.whatsapp ?? '',
    website: raw.website ?? '',
    manager: raw.manager ?? '',
    // Seven days, Monday first; anything else falls back to the defaults
    hours:
      raw.hours?.length === 7
        ? raw.hours.map((day) => ({ open: day.open ?? '08:00', close: day.close ?? '18:00', closed: Boolean(day.closed) }))
        : base.hours,
    specialDays: (raw.specialDays ?? []).map((day) => ({
      date: day.date ?? '',
      label: day.label ?? '',
      closed: Boolean(day.closed),
      open: day.open ?? '',
      close: day.close ?? '',
    })),
    closure: raw.closure?.from ? { from: raw.closure.from, to: raw.closure.to ?? '', reason: raw.closure.reason ?? '' } : null,
    services: raw.services?.length
      ? raw.services.map((service) => ({
          name: service.name ?? '',
          enabled: service.enabled ?? true,
          price: toNumber(service.price),
        }))
      : base.services,
    capacity,
    paymentMethods: raw.paymentMethods ?? base.paymentMethods,
    pendingSetup: raw.pendingSetup ?? [],
    openedAt: (raw.createdAt ?? '').slice(0, 10) || base.openedAt,
    // The manager row createBranch adds is from the default profile; rebuild it
    staff: raw.manager
      ? [{ name: raw.manager, role: 'Branch Manager', ordersProcessed: 0, workload: 0, performance: 0, status: 'Off shift' }]
      : [],
  }
}

// A branch with no trading history yet
export function createBranch(profile: BranchProfile, seed: number): Branch {
  return {
    ...profile,
    uuid: '',
    statusNote: '',
    openedAt: new Date().toISOString().slice(0, 10),
    stats: {
      ordersToday: 0, revenueToday: 0, baseOrders: 0, baseRevenue: 0, downDays: 0, downFactor: 1,
      activeOrders: 0, customers: 0, newCustomers: 0, processing: 0, ready: 0, pendingDelivery: 0,
      outForDelivery: 0, deliveredToday: 0, overdue: 0, completion: 0, onTime: 0, satisfaction: 0,
      machineUtil: 0, staffUtil: 0, inventoryHealth: 0, cancelRate: 0, seed,
    },
    staff: profile.manager
      ? [{ name: profile.manager, role: 'Branch Manager', ordersProcessed: 0, workload: 0, performance: 0, status: 'Off shift' }]
      : [],
    machines: [],
    stock: [],
  }
}

// ---------- Comparison ----------

export const COMPARE_METRICS: {
  label: string
  financial?: boolean
  get: (branch: Branch) => number | null
  format: (value: number) => string
}[] = [
  { label: 'Revenue (this month)', financial: true, get: (branch) => getPeriodStats(branch, 'month').revenue, format: formatCompactXaf },
  { label: 'Orders (this month)', get: (branch) => getPeriodStats(branch, 'month').orders, format: (value) => value.toLocaleString('en-US') },
  { label: 'Customers', get: (branch) => branch.stats.customers, format: (value) => value.toLocaleString('en-US') },
  { label: 'Completion', get: (branch) => branch.stats.completion, format: (value) => `${value}%` },
  { label: 'On-time delivery', get: (branch) => branch.stats.onTime, format: (value) => `${value}%` },
  { label: 'Customer satisfaction', get: (branch) => branch.stats.satisfaction, format: (value) => `${value.toFixed(1)} / 5` },
  { label: 'Machine utilization', get: (branch) => (branch.machines.length > 0 ? branch.stats.machineUtil : null), format: (value) => `${value}%` },
  { label: 'Branch health', get: getHealth, format: (value) => `${value}%` },
]

export function formatRevenue(value: number, compact = true) {
  return compact ? formatCompactXaf(value) : formatXaf(value)
}

// Reads branches from a CSV with a header row. Needs a "name" column; code, city, district,
// address, phone, email and manager are optional. Imported branches start inactive.
export function importBranches(text: string, existing: Branch[]) {
  const [header, ...rows] = parseCsv(text)
  const columns = (header ?? []).map((cell) => cell.toLowerCase())
  const added: Branch[] = []
  let skipped = 0
  if (!columns.includes('name')) return { added, skipped: rows.length, missingHeader: true }
  rows.forEach((row) => {
    const cell = (name: string) => row[columns.indexOf(name)] ?? ''
    const taken = [...existing, ...added]
    const id = cell('code').toUpperCase() || nextBranchCode(taken)
    if (!cell('name') || taken.some((branch) => branch.id === id)) {
      skipped += 1
      return
    }
    const city = cell('city') || 'Douala'
    const region = Object.keys(REGIONS).find((key) => REGIONS[key].includes(city)) ?? ''
    added.push(
      createBranch(
        {
          ...emptyProfile(id),
          name: cell('name'),
          status: 'inactive',
          city,
          region,
          district: cell('district'),
          address: cell('address'),
          phone: cell('phone'),
          email: cell('email'),
          manager: cell('manager'),
          pendingSetup: SETUP_TASKS,
        },
        taken.length + 1,
      ),
    )
  })
  return { added, skipped, missingHeader: false }
}
