import { NEAR_CAPACITY_RATIO, PRICING_MODELS } from '../constants/services'
import type {
  AuditEntry,
  LaundryService,
  ServiceFilters,
} from '../types/service'
import { formatXaf } from './orders'

export function formatPrice(service: LaundryService) {
  if (service.pricingModel === 'custom') {
    const prices = service.itemPrices.map(({ price }) => price)
    return prices.length > 0
      ? `From ${formatXaf(Math.min(...prices))} / item`
      : 'Item-specific'
  }
  if (service.pricingModel === 'fixed') return `${formatXaf(service.basePrice)} fixed`
  const unit = PRICING_MODELS.find(({ id }) => id === service.pricingModel)!.unit
  return `${formatXaf(service.basePrice)} / ${unit}`
}

export function formatHours(hours: number) {
  if (hours < 24) return `${hours} hours`
  const days = hours / 24
  return Number.isInteger(days)
    ? `${hours} hours (${days} ${days === 1 ? 'day' : 'days'})`
    : `${hours} hours`
}

export function formatCompactXaf(value: number) {
  if (value >= 1_000_000) return `XAF ${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `XAF ${Math.round(value / 1_000)}K`
  return formatXaf(value)
}

export function getBranchCount(service: LaundryService) {
  return service.branches.filter(({ available }) => available).length
}

export type CapacityState = 'ok' | 'near' | 'full'

export function getCapacity(service: LaundryService) {
  if (!service.dailyCapacity) return null
  const ratio = service.currentLoad / service.dailyCapacity
  const state: CapacityState =
    ratio >= 1 ? 'full' : ratio >= NEAR_CAPACITY_RATIO ? 'near' : 'ok'
  return {
    ratio: Math.min(1, ratio),
    remaining: Math.max(0, service.dailyCapacity - service.currentLoad),
    state,
  }
}

// Reasons a service cannot currently be delivered, for the alerts strip
export function getAvailabilityAlert(service: LaundryService) {
  if (service.status === 'unavailable') {
    return `${service.name} temporarily unavailable: ${service.statusReason || 'operational constraint.'}`
  }
  if (service.status !== 'active') return null
  const capacity = getCapacity(service)
  if (capacity?.state === 'full') {
    return `${service.name} has reached today’s capacity; new orders should be scheduled for tomorrow.`
  }
  if (capacity?.state === 'near') {
    return `${service.name} is near capacity: ${capacity.remaining} ${service.capacityUnit} left today.`
  }
  return null
}

export function matchesServiceFilters(
  service: LaundryService,
  filters: ServiceFilters,
) {
  const needle = filters.query.trim().toLowerCase()
  if (
    needle &&
    ![service.name, service.id, service.category, service.description].some(
      (field) => field.toLowerCase().includes(needle),
    )
  ) {
    return false
  }
  if (filters.category && service.category !== filters.category) return false
  if (filters.status && service.status !== filters.status) return false
  if (
    filters.branch &&
    !service.branches.some(
      ({ branch, available }) => available && branch === filters.branch,
    )
  ) {
    return false
  }
  if (filters.pricingModel && service.pricingModel !== filters.pricingModel) {
    return false
  }
  if (filters.express === 'yes' && !service.express.enabled) return false
  if (filters.express === 'no' && service.express.enabled) return false
  if (filters.visibility && service.visibility !== filters.visibility) {
    return false
  }
  if (filters.processing === 'sameDay' && service.standardHours > 12) return false
  if (
    filters.processing === 'day' &&
    (service.standardHours <= 12 || service.standardHours > 24)
  ) {
    return false
  }
  if (filters.processing === 'longer' && service.standardHours <= 24) return false
  return true
}

export function countServiceFilters(filters: ServiceFilters) {
  return Object.values(filters).filter((value) => value !== '').length
}

export type ServiceSortKey =
  | 'name'
  | 'category'
  | 'price'
  | 'hours'
  | 'orders'
  | 'revenue'

export function compareServices(
  a: LaundryService,
  b: LaundryService,
  key: ServiceSortKey,
) {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'category':
      return a.category.localeCompare(b.category)
    case 'price':
      return a.basePrice - b.basePrice
    case 'hours':
      return a.standardHours - b.standardHours
    case 'orders':
      return a.stats.orders - b.stats.orders
    case 'revenue':
      return a.stats.revenue - b.stats.revenue
  }
}

// WAF-011 style code from the service name and the next free number
export function generateCode(name: string, services: LaundryService[]) {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  const prefix = (
    letters.length >= 3
      ? letters.slice(0, 3).map((word) => word[0]).join('')
      : (letters.join('') + 'XXX').slice(0, 3)
  ).padEnd(3, 'X')
  const next =
    Math.max(0, ...services.map(({ id }) => Number(id.replace(/\D/g, '')) || 0)) + 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

export function withAudit(
  service: LaundryService,
  by: string,
  entry: Omit<AuditEntry, 'at' | 'by'>,
): LaundryService {
  return {
    ...service,
    audit: [{ at: new Date().toISOString(), by, ...entry }, ...service.audit],
  }
}

export function servicesToCsv(services: LaundryService[], includeFinancials: boolean) {
  const columns: [string, (service: LaundryService) => string | number][] = [
    ['Service Name', (service) => service.name],
    ['Code', (service) => service.id],
    ['Category', (service) => service.category],
    ['Price', formatPrice],
    ['Pricing Unit', (service) => service.pricingModel],
    ['Processing Time (h)', (service) => service.standardHours],
    ['Express', (service) => (service.express.enabled ? `${service.express.hours}h` : 'No')],
    ['Status', (service) => service.status],
    [
      'Branches',
      (service) =>
        service.branches
          .filter(({ available }) => available)
          .map(({ branch }) => branch)
          .join('; '),
    ],
  ]
  if (includeFinancials) {
    columns.push(
      ['Orders', (service) => service.stats.orders],
      ['Revenue (XAF)', (service) => service.stats.revenue],
    )
  }
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map(([header]) => escape(header)).join(','),
    ...services.map((service) =>
      columns.map(([, read]) => escape(read(service))).join(','),
    ),
  ].join('\r\n')
}
