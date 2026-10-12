import {
  OVERRIDE_REVIEW_PCT,
  PROMOTION_EXPIRY_WARNING_DAYS,
  SAME_DAY_SURCHARGE_ID,
} from '../constants/pricing'
import { PRICING_MODELS } from '../constants/services'
import type {
  BulkAdjustment,
  PriceTier,
  PricingConfig,
  PricingFilters,
  QuoteInput,
  QuoteLine,
  ScheduledChange,
} from '../types/pricing'
import type { Promotion } from '../types/promotion'
import type { LaundryService } from '../types/service'
import { parseCsv } from './customers'
import { formatXaf } from './orders'
import { dayNumber, getPromotionStatus, toDateKey } from './promotions'

export function getUnit(service: LaundryService) {
  return PRICING_MODELS.find(({ id }) => id === service.pricingModel)!.unit
}

export function getModelLabel(service: LaundryService, tiers: PriceTier[] = []) {
  const { label } = PRICING_MODELS.find(({ id }) => id === service.pricingModel)!
  return tiers.length > 0 ? `${label} · tiered` : label
}

// The price every branch charges unless it has its own
export function getGlobalPrice(service: LaundryService) {
  if (service.pricingModel !== 'custom') return service.basePrice
  return service.itemPrices.length > 0 ? Math.min(...service.itemPrices.map(({ price }) => price)) : 0
}

export function getOverrides(service: LaundryService) {
  return service.branches.filter(({ available, priceOverride }) => available && priceOverride !== null)
}

export function getTiers(config: PricingConfig, serviceId: string) {
  return [...(config.tiers[serviceId] ?? [])].sort((a, b) => a.from - b.from)
}

// "1–5 kg", "6–10 kg", "11+ kg" with the price for each band
export function getTierBands(service: LaundryService, tiers: PriceTier[]) {
  const steps = [{ from: Math.max(service.minQty, 1), price: service.basePrice }, ...tiers]
  return steps.map((step, index) => {
    const next = steps[index + 1]
    return {
      range: next ? `${step.from}–${next.from - 1}` : `${step.from}+`,
      price: step.price,
    }
  })
}

export function matchesPricingFilters(service: LaundryService, filters: PricingFilters) {
  if (filters.category && service.category !== filters.category) return false
  if (filters.model && service.pricingModel !== filters.model) return false
  if (filters.status && service.status !== filters.status) return false
  if (filters.branch && !service.branches.some(({ branch, available }) => branch === filters.branch && available)) {
    return false
  }
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  return [service.name, service.id, service.category, service.description]
    .some((value) => value.toLowerCase().includes(query))
}

export function getLastPriceChange(service: LaundryService) {
  return service.audit.find(({ change }) => /price/i.test(change))?.at ?? service.audit.at(-1)?.at
}

export type PricingSortKey = 'name' | 'category' | 'price' | 'branches' | 'changed'

export function getSortValue(service: LaundryService, key: PricingSortKey) {
  switch (key) {
    case 'name':
      return service.name.toLowerCase()
    case 'category':
      return service.category.toLowerCase()
    case 'price':
      return getGlobalPrice(service)
    case 'branches':
      return service.branches.filter(({ available }) => available).length
    case 'changed':
      return getLastPriceChange(service) ?? ''
  }
}

// ---------- Quotes ----------

export function calculateQuote(service: LaundryService, config: PricingConfig, input: QuoteInput) {
  const custom = service.pricingModel === 'custom'
  const item = custom ? (service.itemPrices[input.itemIndex] ?? service.itemPrices[0]) : undefined
  const globalPrice = custom ? (item?.price ?? 0) : service.basePrice
  const setting = service.branches.find(({ branch }) => branch === input.branch)
  const override = custom ? null : (setting?.priceOverride ?? null)
  // A branch with its own price keeps the same tier discounts, scaled to that price
  const ratio = override !== null && globalPrice > 0 ? override / globalPrice : 1
  const quantity = Math.max(input.quantity, 0)
  const charged = Math.max(quantity, service.minQty)
  const tier = custom
    ? undefined
    : [...getTiers(config, service.id)].reverse().find(({ from }) => charged >= from)
  const unitPrice = Math.round((tier ? tier.price : globalPrice) * ratio)
  const unit = getUnit(service)
  const subtotal = unitPrice * charged
  const warnings: string[] = []
  if (setting && !setting.available) warnings.push(`${service.name} is not offered at ${input.branch}.`)
  if (service.status !== 'active') warnings.push(`${service.name} is not active, so it can’t be ordered.`)

  const lines: QuoteLine[] = [
    {
      label: `${item ? `${item.item} · ` : ''}${charged} ${unit} × ${formatXaf(unitPrice)}`,
      amount: subtotal,
      kind: 'base',
      note: [
        charged > quantity ? `Minimum of ${service.minQty} ${unit} charged` : '',
        tier ? `Tier price from ${tier.from} ${unit}` : '',
        override !== null ? `${input.branch} price` : '',
      ].filter(Boolean).join(' · ') || undefined,
    },
  ]

  const group = config.groups.find(({ id }) => id === input.groupId)
  const discount = group && group.discountPct > 0 ? Math.round((subtotal * group.discountPct) / 100) : 0
  if (group && discount > 0) {
    lines.push({ label: `${group.name} discount (${group.discountPct}%)`, amount: -discount, kind: 'discount' })
  }

  let surcharges = 0
  const addSurcharge = (label: string, amount: number) => {
    if (amount <= 0) return
    surcharges += amount
    lines.push({ label, amount, kind: 'surcharge' })
  }
  if (input.speed !== 'standard') {
    if (!service.express.enabled) warnings.push(`${service.name} has no express option; standard timing is priced.`)
    else if (input.speed === 'express') {
      addSurcharge(
        `Express surcharge (${service.express.surchargePct}%)`,
        item ? (item.expressPrice - item.price) * charged : Math.round((subtotal * service.express.surchargePct) / 100),
      )
    }
  }
  const extras = config.surcharges.filter(
    ({ id, enabled }) =>
      enabled &&
      (input.surchargeIds.includes(id) ||
        (id === SAME_DAY_SURCHARGE_ID && input.speed === 'sameDay' && service.express.enabled)),
  )
  extras.forEach((extra) =>
    addSurcharge(
      extra.kind === 'percent' ? `${extra.name} (${extra.value}%)` : extra.name,
      extra.kind === 'percent' ? Math.round((subtotal * extra.value) / 100) : extra.value,
    ),
  )

  const zone = config.zones.find(({ id }) => id === input.zoneId)
  const net = subtotal - discount
  let delivery = 0
  if (zone) {
    const free = config.freeDeliveryAbove > 0 && net >= config.freeDeliveryAbove
    delivery = free ? 0 : zone.deliveryFee + zone.pickupFee
    if (net < zone.minOrder) warnings.push(`${zone.name} needs an order of at least ${formatXaf(zone.minOrder)}.`)
    lines.push({
      label: `Pickup & delivery · ${zone.name} (${zone.distance})`,
      amount: delivery,
      kind: 'delivery',
      note: free ? `Free above ${formatXaf(config.freeDeliveryAbove)}` : undefined,
    })
  }

  const taxable = net + surcharges
  let tax = 0
  config.taxes
    .filter(({ enabled }) => enabled)
    .forEach(({ name, rate }) => {
      const amount = Math.round((taxable * rate) / 100)
      tax += amount
      lines.push({ label: `${name} (${rate}%)`, amount, kind: 'tax', note: 'On services, not delivery' })
    })

  return { lines, subtotal, discount, surcharges, delivery, tax, total: taxable + delivery + tax, warnings }
}

// ---------- Rules in plain language ----------

export function getPricingRules(services: LaundryService[], config: PricingConfig) {
  const rules: { when: string; then: string; source: string }[] = []
  services.forEach((service) => {
    const unit = getUnit(service)
    getTiers(config, service.id).forEach(({ from, price }) =>
      rules.push({ when: `${service.name} quantity is ${from} ${unit} or more`, then: `Charge ${formatXaf(price)} / ${unit}`, source: 'Tier' }),
    )
    if (service.minQty > 1) {
      rules.push({ when: `${service.name} order is under ${service.minQty} ${unit}`, then: `Charge the minimum of ${service.minQty} ${unit}`, source: 'Minimum' })
    }
    if (service.express.enabled) {
      rules.push({ when: `${service.name} is ordered as express`, then: `Add ${service.express.surchargePct}%`, source: 'Express' })
    }
    getOverrides(service).forEach(({ branch, priceOverride }) =>
      rules.push({ when: `${service.name} is ordered at ${branch}`, then: `Charge ${formatXaf(priceOverride!)} / ${unit}`, source: 'Branch' }),
    )
  })
  config.groups
    .filter(({ discountPct }) => discountPct > 0)
    .forEach(({ name, discountPct }) =>
      rules.push({ when: `Customer group is ${name}`, then: `Apply a ${discountPct}% discount`, source: 'Customer' }),
    )
  config.surcharges
    .filter(({ enabled }) => enabled)
    .forEach(({ name, kind, value, when }) =>
      rules.push({ when: `${name}: ${when.toLowerCase()}`, then: kind === 'percent' ? `Add ${value}%` : `Add ${formatXaf(value)}`, source: 'Surcharge' }),
    )
  if (config.freeDeliveryAbove > 0) {
    rules.push({ when: `Order subtotal is ${formatXaf(config.freeDeliveryAbove)} or more`, then: 'Waive the pickup and delivery fee', source: 'Delivery' })
  }
  config.taxes
    .filter(({ enabled }) => enabled)
    .forEach(({ name, rate }) => rules.push({ when: 'Any taxable service is ordered', then: `Add ${name} at ${rate}%`, source: 'Tax' }))
  return rules
}

// ---------- Health ----------

export type PricingIssue = {
  level: 'problem' | 'notice'
  text: string
  serviceId?: string
}

const CHECKS_PER_SERVICE = 5

export function getPricingHealth(
  services: LaundryService[],
  config: PricingConfig,
  scheduled: ScheduledChange[],
  promotions: Promotion[],
  now: number,
) {
  const issues: PricingIssue[] = []
  const live = services.filter(({ status }) => status === 'active')
  const names = new Map<string, number>()
  services.forEach(({ name }) => names.set(name.trim().toLowerCase(), (names.get(name.trim().toLowerCase()) ?? 0) + 1))

  live.forEach((service) => {
    const price = getGlobalPrice(service)
    if (price <= 0) issues.push({ level: 'problem', text: `${service.name} has no active price.`, serviceId: service.id })
    if (!service.branches.some(({ available }) => available)) {
      issues.push({ level: 'problem', text: `${service.name} is active but not offered at any branch.`, serviceId: service.id })
    }
    getOverrides(service).forEach(({ branch, priceOverride }) => {
      const gap = price > 0 ? ((priceOverride! - price) / price) * 100 : 0
      if (Math.abs(gap) > OVERRIDE_REVIEW_PCT) {
        issues.push({ level: 'problem', text: `${service.name} at ${branch} is ${Math.abs(gap).toFixed(0)}% ${gap > 0 ? 'above' : 'below'} the global price.`, serviceId: service.id })
      }
    })
    const tiers = getTiers(config, service.id)
    if (tiers.some(({ price: tierPrice }, index) => tierPrice >= (index === 0 ? service.basePrice : tiers[index - 1].price))) {
      issues.push({ level: 'problem', text: `${service.name} has a quantity tier that is not cheaper than the one before it.`, serviceId: service.id })
    }
    if ((names.get(service.name.trim().toLowerCase()) ?? 0) > 1) {
      issues.push({ level: 'problem', text: `More than one service is named ${service.name}.`, serviceId: service.id })
    }
  })

  const today = dayNumber(toDateKey(now))
  scheduled.forEach((change) => {
    const service = services.find(({ id }) => id === change.serviceId)
    const days = dayNumber(change.effectiveAt) - today
    if (!service) return
    if (days <= 0) issues.push({ level: 'problem', text: `The scheduled price change for ${service.name} is due and has not been applied.`, serviceId: service.id })
    else if (days <= 3) issues.push({ level: 'notice', text: `${service.name} changes to ${formatXaf(change.newPrice)} ${days === 1 ? 'tomorrow' : `in ${days} days`}.`, serviceId: service.id })
  })
  promotions.forEach((promotion) => {
    if (getPromotionStatus(promotion, now) !== 'active' || !promotion.endAt) return
    const days = dayNumber(promotion.endAt) - today
    if (days <= PROMOTION_EXPIRY_WARNING_DAYS) {
      issues.push({ level: 'notice', text: `Promotion ${promotion.name} expires ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}.` })
    }
  })

  const problems = issues.filter(({ level }) => level === 'problem').length
  const checks = Math.max(live.length * CHECKS_PER_SERVICE, 1)
  return { issues, problems, score: Math.max(0, Math.round(((checks - problems) / checks) * 100)) }
}

// ---------- Bulk update ----------

const roundTo = (value: number, step: number) => Math.max(0, Math.round(value / Math.max(step, 1)) * Math.max(step, 1))

export function adjustPrice(price: number, adjustment: BulkAdjustment) {
  const sign = adjustment.direction === 'increase' ? 1 : -1
  const next = adjustment.kind === 'percent' ? price * (1 + (sign * adjustment.value) / 100) : price + sign * adjustment.value
  return roundTo(next, adjustment.roundTo)
}

// What a bulk adjustment would do, without changing anything
export function previewBulk(services: LaundryService[], adjustment: BulkAdjustment) {
  const inScope = services.filter(
    (service) => service.status !== 'inactive' && (!adjustment.category || service.category === adjustment.category),
  )
  const rows = inScope
    .filter(({ pricingModel }) => pricingModel !== 'custom')
    .map((service) => ({
      service,
      from: service.basePrice,
      to: adjustPrice(service.basePrice, adjustment),
      overrides: adjustment.includeOverrides
        ? getOverrides(service).map(({ branch, priceOverride }) => ({
            branch,
            from: priceOverride!,
            to: adjustPrice(priceOverride!, adjustment),
          }))
        : [],
    }))
    .filter(({ from, to }) => from !== to)
  const branches = new Set(rows.flatMap(({ service }) => service.branches.filter(({ available }) => available).map(({ branch }) => branch)))
  return {
    rows,
    skipped: inScope.filter(({ pricingModel }) => pricingModel === 'custom').length,
    branches: branches.size,
    // Assumes order volume stays the same after the change
    monthlyImpact: Math.round(rows.reduce((sum, { service, from, to }) => sum + (from > 0 ? service.stats.revenue * (to / from - 1) : 0), 0)),
  }
}

// ---------- Import / export ----------

export type ImportRow = {
  code: string
  name: string
  from: number | null
  to: number | null
  status: 'valid' | 'unchanged' | 'unknown' | 'invalid' | 'duplicate'
}

// Expects a header row with "code" and "price" columns
export function parsePriceImport(text: string, services: LaundryService[]) {
  const [header, ...lines] = parseCsv(text)
  const columns = (header ?? []).map((cell) => cell.toLowerCase())
  const codeAt = columns.indexOf('code')
  const priceAt = columns.findIndex((cell) => cell.startsWith('price') || cell.startsWith('base price'))
  if (codeAt < 0 || priceAt < 0) return null
  const seen = new Set<string>()
  return lines.map((line): ImportRow => {
    const code = (line[codeAt] ?? '').toUpperCase()
    const service = services.find(({ id }) => id === code)
    const raw = (line[priceAt] ?? '').replace(/[^\d.-]/g, '')
    const price = raw === '' ? Number.NaN : Number(raw)
    const base = { code, name: service?.name ?? '', from: service ? service.basePrice : null }
    if (!service) return { ...base, to: Number.isFinite(price) ? price : null, status: 'unknown' }
    if (seen.has(code)) return { ...base, to: price, status: 'duplicate' }
    seen.add(code)
    if (!Number.isFinite(price) || price <= 0 || service.pricingModel === 'custom') return { ...base, to: Number.isFinite(price) ? price : null, status: 'invalid' }
    return { ...base, to: price, status: price === service.basePrice ? 'unchanged' : 'valid' }
  })
}

const csvCell = (value: string | number) => {
  const text = String(value)
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function pricesToCsv(services: LaundryService[], config: PricingConfig) {
  const branches = services[0]?.branches.map(({ branch }) => branch) ?? []
  const header = ['Code', 'Service', 'Category', 'Pricing model', 'Price', 'Unit', 'Status', 'Express surcharge %', 'Tiers', ...branches]
  const rows = services.map((service) => [
    service.id, service.name, service.category, getModelLabel(service), getGlobalPrice(service), getUnit(service),
    service.status, service.express.enabled ? service.express.surchargePct : '',
    getTiers(config, service.id).map(({ from, price }) => `${from}+:${price}`).join(' '),
    ...branches.map((name) => {
      const setting = service.branches.find(({ branch }) => branch === name)
      return !setting?.available ? 'not offered' : (setting.priceOverride ?? getGlobalPrice(service))
    }),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
