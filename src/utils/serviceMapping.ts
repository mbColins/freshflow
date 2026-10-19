import {
  MACHINE_TYPES,
  MATERIALS,
  SERVICE_OPTIONS,
  STAFF_SKILLS,
  WORKFLOW_STAGES,
} from '../constants/services'
import type {
  LaundryService,
  PricingModel,
  ServiceStatus,
  ServiceVisibility,
} from '../types/service'

// Conversions between the app's LaundryService and the /service API
// (ServiceRequest / ServiceResponse). The app keeps display labels
// ("Quality Check", "Washing Machine"); the API uses UPPER_SNAKE_CASE enums.

// "Pressing & Finishing" -> "PRESSING_FINISHING", "Pre-spotting" -> "PRE_SPOTTING"
export function toEnum(label: string) {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// The app label for an enum value; unknown values are title-cased
function fromEnum(value: string, labels: readonly string[]) {
  return (
    labels.find((label) => toEnum(label) === value) ??
    value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())
  )
}

const VISIBILITY_TO_API: Record<ServiceVisibility, string> = {
  visible: 'VISIBLE',
  hidden: 'HIDDEN',
  comingSoon: 'COMING_SOON',
}

// ---------- Days and hours ----------

const WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
export type DayOfWeek = (typeof WEEK)[number]
export const WEEK_DAYS: { value: DayOfWeek; label: string; short: string }[] = WEEK.map((value) => ({
  value,
  label: value[0] + value.slice(1).toLowerCase(),
  short: value[0] + value.slice(1, 3).toLowerCase(),
}))

// ["MONDAY", …, "SATURDAY"] -> "Monday–Saturday"; gaps give a list
export function formatDays(days: readonly string[]) {
  const indexes = WEEK.map((day, index) => (days.includes(day) ? index : -1)).filter((index) => index >= 0)
  if (indexes.length === 0) return ''
  if (indexes.length === 7) return 'Every day'
  const label = (index: number) => WEEK_DAYS[index].label
  const contiguous = indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1)
  if (contiguous && indexes.length >= 3) return `${label(indexes[0])}–${label(indexes[indexes.length - 1])}`
  return indexes.map(label).join(', ')
}

// The reverse of formatDays, also reading "Mon–Sat", "Mon-Fri, Sun" or "Daily";
// null when a part isn't a day
export function parseDays(text: string): DayOfWeek[] | null {
  const value = text.trim().toLowerCase()
  if (!value) return []
  if (/^(every ?day|daily|all week)$/.test(value)) return [...WEEK]
  const dayIndex = (part: string) => WEEK.findIndex((day) => day.toLowerCase().startsWith(part.trim().slice(0, 3)))
  const picked = new Set<number>()
  for (const part of value.split(/,|\band\b/)) {
    if (!part.trim()) continue
    const range = part.split(/[–—-]|\bto\b/)
    if (range.length === 2) {
      const [from, to] = range.map(dayIndex)
      if (from < 0 || to < 0) return null
      for (let index = from; ; index = (index + 1) % 7) {
        picked.add(index)
        if (index === to) break
      }
    } else {
      const index = dayIndex(part)
      if (index < 0) return null
      picked.add(index)
    }
  }
  return WEEK.filter((_, index) => picked.has(index))
}

// "08:00–18:00" -> { open: "08:00", close: "18:00" }; null when unreadable
export function parseHours(text: string) {
  const match = text.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/)
  if (!match) return null
  const pad = (hours: string, minutes: string) => `${hours.padStart(2, '0')}:${minutes}`
  return { open: pad(match[1], match[2]), close: pad(match[3], match[4]) }
}

export const formatHours = (open: string, close: string) => `${open}–${close}`

// LocalTime may arrive as "HH:mm" or "HH:mm:ss"
const hhmm = (value: string | null | undefined, fallback: string) => (value ? value.slice(0, 5) : fallback)

// BigDecimal may arrive as a number or a string
const amount = (value: unknown, fallback = 0) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : fallback
}

// ---------- API shapes ----------

// ServiceResponse; every field optional so an odd response degrades to defaults
export type ServiceResponse = {
  uuid?: string
  code?: string
  name?: string
  category?: string
  description?: string | null
  icon?: string
  status?: string
  statusReason?: string | null
  pricingModel?: string
  basePrice?: number | string | null
  minQty?: number | null
  maxQty?: number | null
  itemPrices?: { item?: string; price?: number | string; expressPrice?: number | string | null }[]
  workflow?: string[]
  standardHours?: number | null
  machines?: string[]
  staffSkill?: string | null
  dailyCapacity?: number | null
  capacityUnit?: string | null
  consumption?: { material?: string; amount?: number | string; unit?: string }[]
  visibility?: string
  availableDays?: string[]
  openTime?: string | null
  closeTime?: string | null
  express?: {
    enabled?: boolean
    hours?: number | null
    surchargePct?: number | string | null
    cutoff?: string | null
    minQty?: number | null
  } | null
  addOns?: string[]
  options?: string[]
  includes?: string[]
  branches?: { branchId?: string; branchName?: string; available?: boolean | null; priceOverride?: number | string | null }[]
  createdBy?: string | null
  updatedBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ServiceRequest = {
  code: string
  name: string
  category: string
  description: string
  icon: string
  status: string
  statusReason: string | null
  pricingModel: string
  basePrice: number
  minQty: number
  maxQty: number | null
  itemPrices: { item: string; price: number; expressPrice: number | null }[]
  workflow: string[]
  standardHours: number
  machines: string[]
  staffSkill: string
  dailyCapacity: number | null
  capacityUnit: string
  consumption: { material: string; amount: number; unit: string }[]
  visibility: string
  availableDays: string[]
  openTime: string
  closeTime: string
  express: { enabled: boolean; hours: number; surchargePct: number; cutoff: string; minQty: number }
  addOns: string[]
  options: string[]
  includes: string[]
  branches: { branchId: string; available: boolean; priceOverride: number | null }[]
}

// ---------- Conversions ----------

// A service from the API in the app's shape. Order statistics, promotions and
// load aren't stored by the API, so they start empty. `includes` holds codes
// here; the list resolves them to names (see resolveIncludes).
export function serviceFromApi(raw: ServiceResponse): LaundryService | null {
  if (!raw.uuid || !raw.code) return null
  const express = raw.express ?? {}
  const changedAt = raw.updatedAt ?? raw.createdAt
  return {
    id: raw.code,
    uuid: raw.uuid,
    name: raw.name ?? raw.code,
    category: raw.category ?? '',
    description: raw.description ?? '',
    icon: (raw.icon ?? 'WASH').toLowerCase(),
    status: (raw.status ?? 'DRAFT').toLowerCase() as ServiceStatus,
    statusReason: raw.statusReason ?? '',
    pricingModel: (raw.pricingModel ?? 'ITEM').toLowerCase() as PricingModel,
    basePrice: amount(raw.basePrice),
    minQty: raw.minQty ?? 1,
    maxQty: raw.maxQty ?? null,
    itemPrices: (raw.itemPrices ?? []).map(({ item, price, expressPrice }) => ({
      item: item ?? '',
      price: amount(price),
      expressPrice: amount(expressPrice),
    })),
    standardHours: raw.standardHours ?? 24,
    express: {
      enabled: Boolean(express.enabled),
      hours: express.hours ?? 8,
      surchargePct: amount(express.surchargePct, 30),
      cutoff: hhmm(express.cutoff, '14:00'),
      minQty: express.minQty ?? 1,
    },
    workflow: (raw.workflow ?? []).map((stage) => fromEnum(stage, WORKFLOW_STAGES)),
    machines: (raw.machines ?? []).map((machine) => fromEnum(machine, MACHINE_TYPES.map(({ name }) => name))),
    staffSkill: raw.staffSkill ? fromEnum(raw.staffSkill, STAFF_SKILLS) : STAFF_SKILLS[0],
    consumption: (raw.consumption ?? []).map(({ material, amount: used, unit }) => ({
      material: material ? fromEnum(material, MATERIALS.map(({ name }) => name)) : '',
      amount: amount(used),
      unit: unit ?? '',
    })),
    addOnIds: (raw.addOns ?? []).map((addOn) => addOn.toLowerCase()),
    options: (raw.options ?? []).map((option) => fromEnum(option, SERVICE_OPTIONS)),
    branches: (raw.branches ?? []).map(({ branchId, branchName, available, priceOverride }) => ({
      branch: branchName ?? branchId ?? '',
      branchId,
      available: available ?? true,
      priceOverride: priceOverride === null || priceOverride === undefined ? null : amount(priceOverride),
    })),
    visibility:
      (Object.keys(VISIBILITY_TO_API) as ServiceVisibility[]).find((key) => VISIBILITY_TO_API[key] === raw.visibility) ??
      'visible',
    availableDays: formatDays(raw.availableDays ?? []),
    availableHours: formatHours(hhmm(raw.openTime, '08:00'), hhmm(raw.closeTime, '18:00')),
    dailyCapacity: raw.dailyCapacity ?? null,
    currentLoad: 0,
    capacityUnit: raw.capacityUnit ?? 'kg',
    includes: raw.includes ?? [],
    stats: {
      orders: 0,
      revenue: 0,
      growthPct: 0,
      avgHours: 0,
      satisfaction: 0,
      qualityPass: 0,
      reprocessRate: 0,
      lateRate: 0,
      complaints: 0,
    },
    monthlyOrders: Array<number>(12).fill(0),
    monthlyRevenue: Array<number>(12).fill(0),
    promotions: [],
    audit: changedAt
      ? [
          {
            at: changedAt,
            by: raw.updatedBy ?? raw.createdBy ?? '',
            change: raw.updatedAt && raw.updatedAt !== raw.createdAt ? 'Last updated' : 'Created service',
          },
        ]
      : [],
  }
}

// Bundles: the API sends codes, the app shows names
export function resolveIncludes(services: LaundryService[]) {
  return services.map((service) => ({
    ...service,
    includes: service.includes.map((code) => services.find(({ id }) => id === code)?.name ?? code),
  }))
}

// The ServiceRequest for a service. `all` resolves bundle names back to codes.
// Branch settings without a branch uuid (old sample data) can't be sent.
export function toServiceRequest(service: LaundryService, all: LaundryService[]): ServiceRequest {
  const custom = service.pricingModel === 'custom'
  const hours = parseHours(service.availableHours) ?? { open: '08:00', close: '18:00' }
  return {
    code: service.id.trim().toUpperCase(),
    name: service.name.trim(),
    category: service.category,
    description: service.description,
    icon: service.icon.toUpperCase(),
    status: service.status.toUpperCase(),
    statusReason: service.statusReason.trim() || null,
    pricingModel: service.pricingModel.toUpperCase(),
    basePrice: service.basePrice,
    minQty: service.minQty,
    maxQty: service.maxQty,
    itemPrices: custom
      ? service.itemPrices
          .filter(({ item }) => item.trim())
          .map(({ item, price, expressPrice }) => ({ item: item.trim(), price, expressPrice: expressPrice || null }))
      : [],
    workflow: service.workflow.map(toEnum),
    standardHours: service.standardHours,
    machines: service.machines.map(toEnum),
    staffSkill: toEnum(service.staffSkill),
    dailyCapacity: service.dailyCapacity,
    capacityUnit: service.capacityUnit,
    consumption: service.consumption
      .filter(({ material }) => material)
      .map(({ material, amount: used, unit }) => ({ material: toEnum(material), amount: used, unit })),
    visibility: VISIBILITY_TO_API[service.visibility],
    availableDays: parseDays(service.availableDays) ?? [],
    openTime: hours.open,
    closeTime: hours.close,
    express: {
      enabled: service.express.enabled,
      hours: service.express.hours,
      surchargePct: service.express.surchargePct,
      cutoff: service.express.cutoff,
      minQty: service.express.minQty,
    },
    addOns: service.addOnIds.map((id) => id.toUpperCase()),
    options: service.options.map(toEnum),
    includes: service.includes.map((name) => all.find((other) => other.name === name || other.id === name)?.id ?? name),
    branches: service.branches.flatMap(({ branchId, available, priceOverride }) =>
      branchId ? [{ branchId, available, priceOverride }] : [],
    ),
  }
}
