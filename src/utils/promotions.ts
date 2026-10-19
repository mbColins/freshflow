import {
  ASSUMED_GROSS_MARGIN,
  AUDIENCES,
  BANNERS,
  DELIVERY_FEE,
  PROMOTION_STATUSES,
  PROMOTION_TYPES,
  WEEKDAYS,
} from '../constants/promotions'
import type {
  Audience,
  Promotion,
  PromotionDraft,
  PromotionFilters,
  PromotionStats,
  PromotionStatus,
  PromotionType,
} from '../types/promotion'
import { parseCsv } from './customers'
import { formatXaf } from './orders'
import { getSettings } from '../hooks/useSettings'
import { csvCell } from './csv'
import { formatDateSetting } from './settings'

const DAY_MS = 86_400_000

// ---------- Dates (YYYY-MM-DD keys in local time) ----------

export function toDateKey(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const parseKey = (key: string) => {
  const [year, month, date] = key.split('-').map(Number)
  return new Date(year, month - 1, date)
}

export function dayNumber(key: string) {
  const [year, month, date] = key.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, date) / DAY_MS)
}

export function formatDay(key: string, withYear = false) {
  const chosen = formatDateSetting(parseKey(key), getSettings(), withYear)
  if (chosen) return chosen
  return parseKey(key).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatValidity(promotion: Pick<PromotionDraft, 'startAt' | 'endAt'>) {
  if (!promotion.endAt) return `From ${formatDay(promotion.startAt, true)} · no end date`
  return `${formatDay(promotion.startAt)} – ${formatDay(promotion.endAt, true)}`
}

export function formatDays(days: number[]) {
  if (days.length === 0 || days.length === 7) return 'Every day'
  return [...days].sort().map((index) => WEEKDAYS[index]).join(', ')
}

// ---------- Status ----------

export function isLimitReached(promotion: Promotion) {
  return promotion.usageLimit !== null && promotion.stats.uses >= promotion.usageLimit
}

export function getPromotionStatus(promotion: Promotion, now: number): PromotionStatus {
  if (promotion.state !== 'published') return promotion.state
  const today = toDateKey(now)
  if (today < promotion.startAt) return 'scheduled'
  if ((promotion.endAt && today > promotion.endAt) || isLimitReached(promotion)) return 'expired'
  return 'active'
}

export function getStatusMeta(status: PromotionStatus) {
  return PROMOTION_STATUSES.find(({ value }) => value === status)!
}

export function getTypeMeta(type: PromotionType) {
  return PROMOTION_TYPES.find(({ value }) => value === type)!
}

// Days until an active promotion ends or a scheduled one starts
export function getCountdown(promotion: Promotion, now: number) {
  const status = getPromotionStatus(promotion, now)
  const today = dayNumber(toDateKey(now))
  if (status === 'scheduled') {
    const days = dayNumber(promotion.startAt) - today
    return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (status === 'active' && promotion.endAt) {
    const days = dayNumber(promotion.endAt) - today
    return days === 0 ? 'Ends today' : `${days} ${days === 1 ? 'day' : 'days'} left`
  }
  if (status === 'expired' && isLimitReached(promotion)) return 'Usage limit reached'
  return ''
}

// ---------- Describing the offer ----------

export function formatOffer(promotion: Pick<PromotionDraft, 'discountKind' | 'value' | 'tiers'>) {
  switch (promotion.discountKind) {
    case 'percent':
      return `${promotion.value}% OFF`
    case 'amount':
      return `${formatXaf(promotion.value)} OFF`
    case 'freeDelivery':
      return 'FREE DELIVERY'
    case 'tiered': {
      const best = Math.max(0, ...promotion.tiers.map(({ percent }) => percent))
      return `UP TO ${best}% OFF`
    }
  }
}

export function formatBranches(promotion: Pick<PromotionDraft, 'branches'>, branches: { id: string; name: string }[]) {
  if (promotion.branches.length === 0) return 'All branches'
  if (promotion.branches.length === 1) {
    return branches.find(({ id }) => id === promotion.branches[0])?.name ?? promotion.branches[0]
  }
  return `${promotion.branches.length} branches`
}

export function formatServices(promotion: Pick<PromotionDraft, 'services'>) {
  return promotion.services.length === 0 ? 'Whole order' : promotion.services.join(', ')
}

export function getAudienceLabel(audience: Audience) {
  return AUDIENCES.find(({ value }) => value === audience)!.label
}

export function getBannerClass(banner: string) {
  return (BANNERS.find(({ value }) => value === banner) ?? BANNERS[0]).className
}

// ---------- Performance ----------

export function getConversion(stats: PromotionStats) {
  return stats.reach === 0 ? 0 : (stats.uses / stats.reach) * 100
}

export function sumStats(list: PromotionStats[]): PromotionStats {
  return list.reduce(
    (total, stats) => ({
      uses: total.uses + stats.uses,
      revenue: total.revenue + stats.revenue,
      discount: total.discount + stats.discount,
      reach: total.reach + stats.reach,
    }),
    { uses: 0, revenue: 0, discount: 0, reach: 0 },
  )
}

export function formatDelta(current: number, previous: number, points = false) {
  if (points) {
    const delta = current - previous
    return `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts`
  }
  if (previous === 0) return current === 0 ? 'No change' : 'New'
  const delta = ((current - previous) / previous) * 100
  return `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}%`
}

// Splits redemptions across the promotion's channels; earlier channels carry more
export function getChannelBreakdown(promotion: Promotion) {
  const channels = promotion.channels.length > 0 ? promotion.channels : ['Counter POS']
  const weights = channels.map((_, index) => channels.length - index + 1)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let assigned = 0
  return channels.map((channel, index) => {
    const last = index === channels.length - 1
    const redemptions = last
      ? promotion.stats.uses - assigned
      : Math.round((promotion.stats.uses * weights[index]) / total)
    assigned += redemptions
    return { channel, redemptions }
  })
}

// ---------- List ----------

function getDateRange(filters: PromotionFilters, now: number): [string, string] | null {
  const today = new Date(now)
  if (filters.date === 'today') return [toDateKey(now), toDateKey(now)]
  if (filters.date === 'week') {
    const monday = now - ((today.getDay() + 6) % 7) * DAY_MS
    return [toDateKey(monday), toDateKey(monday + 6 * DAY_MS)]
  }
  if (filters.date === 'month') {
    return [
      toDateKey(new Date(today.getFullYear(), today.getMonth(), 1).getTime()),
      toDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime()),
    ]
  }
  if (filters.date === 'custom' && filters.from && filters.to && filters.from <= filters.to) {
    return [filters.from, filters.to]
  }
  return null
}

export function matchesPromotionFilters(promotion: Promotion, filters: PromotionFilters, now: number) {
  if (filters.status && getPromotionStatus(promotion, now) !== filters.status) return false
  if (filters.type && promotion.type !== filters.type) return false
  if (filters.branch && promotion.branches.length > 0 && !promotion.branches.includes(filters.branch)) return false
  if (filters.service && promotion.services.length > 0 && !promotion.services.includes(filters.service)) return false
  if (filters.audience && promotion.audience !== filters.audience) return false
  const range = getDateRange(filters, now)
  if (range && (promotion.startAt > range[1] || (promotion.endAt !== null && promotion.endAt < range[0]))) {
    return false
  }
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  return [promotion.name, promotion.code, promotion.description, getTypeMeta(promotion.type).label]
    .some((value) => value.toLowerCase().includes(query))
}

export type PromotionSortKey = 'name' | 'status' | 'start' | 'uses' | 'revenue' | 'discount'

export function comparePromotions(a: Promotion, b: Promotion, key: PromotionSortKey, now: number) {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'status': {
      const rank = (promotion: Promotion) =>
        PROMOTION_STATUSES.findIndex(({ value }) => value === getPromotionStatus(promotion, now))
      return rank(a) - rank(b) || a.startAt.localeCompare(b.startAt)
    }
    case 'start':
      return a.startAt.localeCompare(b.startAt)
    case 'uses':
      return a.stats.uses - b.stats.uses
    case 'revenue':
      return a.stats.revenue - b.stats.revenue
    case 'discount':
      return a.stats.discount - b.stats.discount
  }
}

export function promotionsToCsv(promotions: Promotion[], now: number, includeFinancials: boolean) {
  const header = [
    'ID', 'Name', 'Code', 'Type', 'Offer', 'Status', 'Start', 'End', 'Days', 'Branches', 'Services',
    'Audience', 'Minimum order', 'Usage limit', 'Uses', 'Reach', 'Conversion %',
    ...(includeFinancials ? ['Revenue (XAF)', 'Discount (XAF)'] : []),
  ]
  const rows = promotions.map((promotion) => [
    promotion.id, promotion.name, promotion.code || '(automatic)', getTypeMeta(promotion.type).label,
    formatOffer(promotion), getStatusMeta(getPromotionStatus(promotion, now)).label, promotion.startAt,
    promotion.endAt ?? '', formatDays(promotion.days), promotion.branches.join(' ') || 'All',
    formatServices(promotion), getAudienceLabel(promotion.audience), promotion.minOrder,
    promotion.usageLimit ?? '', promotion.stats.uses, promotion.stats.reach,
    getConversion(promotion.stats).toFixed(1),
    ...(includeFinancials ? [promotion.stats.revenue, promotion.stats.discount] : []),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

// ---------- Creating ----------

export function nextPromotionId(promotions: { id: string }[]) {
  const highest = Math.max(100, ...promotions.map(({ id }) => Number(id.replace(/\D/g, '')) || 0))
  return `PRM-${highest + 1}`
}

// "Weekend Fresh" with a 20% discount → WEEKEND20
export function suggestCode(name: string, value: number, taken: string[]) {
  const word = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(' ').find(Boolean) ?? 'PROMO'
  const base = `${word.slice(0, 10)}${value > 0 && value <= 100 ? value : ''}`
  let code = base
  for (let suffix = 2; taken.includes(code); suffix += 1) code = `${base}${suffix}`
  return code
}

export function emptyDraft(id: string, now: number): PromotionDraft {
  return {
    id,
    name: '',
    code: '',
    automatic: false,
    description: '',
    notes: '',
    banner: 'ocean',
    type: 'percentage',
    discountKind: 'percent',
    value: 10,
    maxDiscount: null,
    tiers: [
      { minSpend: 15_000, percent: 5 },
      { minSpend: 30_000, percent: 10 },
    ],
    bundleNote: '',
    audience: 'all',
    customers: '',
    branches: [],
    services: [],
    minOrder: 0,
    stackable: false,
    startAt: toDateKey(now),
    endAt: toDateKey(now + 30 * DAY_MS),
    days: [],
    usageLimit: null,
    perCustomerLimit: null,
    budget: null,
    channels: ['WhatsApp', 'SMS'],
    state: 'draft',
  }
}

// Drops results and history, leaving what the campaign builder edits
export function toDraft(promotion: Promotion): PromotionDraft {
  const { stats, previous, history, createdBy, createdAt, ...draft } = promotion
  void [stats, previous, history, createdBy, createdAt]
  return draft
}

const NO_STATS: PromotionStats = { uses: 0, revenue: 0, discount: 0, reach: 0 }

export function createPromotion(draft: PromotionDraft, user: string): Promotion {
  const at = new Date().toISOString()
  return {
    ...draft,
    stats: NO_STATS,
    previous: NO_STATS,
    history: [{ at, user, text: draft.state === 'published' ? 'Created and published the promotion' : 'Created the promotion as a draft' }],
    createdBy: user,
    createdAt: at,
  }
}

export function withEvent(promotion: Promotion, user: string, text: string): Promotion {
  return { ...promotion, history: [{ at: new Date().toISOString(), user, text }, ...promotion.history] }
}

export function getDraftProblems(draft: PromotionDraft, takenCodes: string[]) {
  const problems: string[] = []
  if (!draft.name.trim()) problems.push('Promotion name is required (Basic Info).')
  if (!draft.automatic) {
    if (!/^[A-Z0-9]{3,16}$/.test(draft.code)) problems.push('Promotion code must be 3–16 letters or digits, or mark the promotion as automatic (Basic Info).')
    else if (takenCodes.includes(draft.code)) problems.push(`Code ${draft.code} is already used by another promotion (Basic Info).`)
  }
  if (draft.discountKind === 'percent' && (draft.value <= 0 || draft.value > 100)) problems.push('Percentage must be between 1 and 100 (Discount).')
  if (draft.discountKind === 'amount' && draft.value <= 0) problems.push('Discount amount must be greater than zero (Discount).')
  if (draft.discountKind === 'tiered') {
    if (draft.tiers.length === 0) problems.push('Add at least one spend tier (Discount).')
    else if (draft.tiers.some(({ minSpend, percent }) => minSpend <= 0 || percent <= 0 || percent > 100)) problems.push('Every tier needs a spend above zero and a percentage between 1 and 100 (Discount).')
  }
  if (draft.audience === 'specific' && !draft.customers.trim()) problems.push('List the customers this promotion is for (Eligibility).')
  if (!draft.startAt) problems.push('Start date is required (Schedule).')
  if (draft.endAt && draft.endAt < draft.startAt) problems.push('End date must be on or after the start date (Schedule).')
  return problems
}

// Reads promotions from a CSV with a header row: name, code, type (percent | amount), value,
// start, end. Imported promotions are drafts.
export function importPromotions(text: string, existing: Promotion[], user: string, now: number) {
  const [header, ...rows] = parseCsv(text)
  const columns = (header ?? []).map((cell) => cell.toLowerCase())
  const added: Promotion[] = []
  let skipped = 0
  if (!columns.includes('name')) return { added, skipped: rows.length, missingHeader: true }
  rows.forEach((row) => {
    const cell = (name: string) => row[columns.indexOf(name)] ?? ''
    const taken = [...existing, ...added]
    const code = cell('code').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const value = Number(cell('value'))
    if (!cell('name') || !(value > 0) || (code && taken.some((promotion) => promotion.code === code))) {
      skipped += 1
      return
    }
    const percent = cell('type').toLowerCase() !== 'amount'
    const isDate = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text)
    const blank = emptyDraft(nextPromotionId(taken), now)
    added.push(
      createPromotion(
        {
          ...blank,
          name: cell('name'),
          code,
          automatic: !code,
          type: percent ? 'percentage' : 'fixed',
          discountKind: percent ? 'percent' : 'amount',
          value: percent ? Math.min(value, 100) : value,
          startAt: isDate(cell('start')) ? cell('start') : blank.startAt,
          endAt: isDate(cell('end')) ? cell('end') : blank.endAt,
        },
        user,
      ),
    )
  })
  return { added, skipped, missingHeader: false }
}

// ---------- Simulator ----------

export type SimulationInput = {
  basket: number
  audience: Audience
  branch: string
  service: string
  delivery: boolean
}

export function simulate(promotion: Promotion, input: SimulationInput, now: number) {
  const status = getPromotionStatus(promotion, now)
  const reasons: string[] = []
  if (status !== 'active') reasons.push(`The promotion is ${getStatusMeta(status).label.toLowerCase()}, not active.`)
  else if (promotion.days.length > 0 && !promotion.days.includes((new Date(now).getDay() + 6) % 7)) {
    reasons.push(`It only runs on ${formatDays(promotion.days)}.`)
  }
  if (promotion.branches.length > 0 && !promotion.branches.includes(input.branch)) reasons.push('This branch is not included.')
  if (promotion.audience !== 'all' && promotion.audience !== input.audience) {
    reasons.push(`It is reserved for: ${getAudienceLabel(promotion.audience).toLowerCase()}.`)
  }
  if (promotion.services.length > 0 && !promotion.services.includes(input.service)) {
    reasons.push(`It only applies to ${promotion.services.join(', ')}.`)
  }
  if (input.basket < promotion.minOrder) reasons.push(`The order is below the ${formatXaf(promotion.minOrder)} minimum.`)
  if (promotion.discountKind === 'freeDelivery' && !input.delivery) reasons.push('The order has no pickup or delivery to waive.')
  const tier = [...promotion.tiers]
    .sort((a, b) => b.minSpend - a.minSpend)
    .find(({ minSpend }) => input.basket >= minSpend)
  if (promotion.discountKind === 'tiered' && !tier) reasons.push('The order is below the first spend tier.')

  const eligible = reasons.length === 0
  const deliveryFee = input.delivery ? DELIVERY_FEE : 0
  let discount = 0
  let deliveryWaived = 0
  if (eligible) {
    if (promotion.discountKind === 'percent') discount = (input.basket * promotion.value) / 100
    if (promotion.discountKind === 'amount') discount = promotion.value
    if (promotion.discountKind === 'tiered' && tier) discount = (input.basket * tier.percent) / 100
    if (promotion.discountKind === 'freeDelivery') deliveryWaived = deliveryFee
    if (promotion.maxDiscount !== null) discount = Math.min(discount, promotion.maxDiscount)
    discount = Math.round(Math.min(discount, input.basket))
  }
  const payable = input.basket - discount + deliveryFee - deliveryWaived
  const cost = input.basket * (1 - ASSUMED_GROSS_MARGIN) + deliveryFee
  return {
    eligible,
    reasons,
    discount,
    deliveryFee,
    deliveryWaived,
    payable,
    capped: eligible && promotion.maxDiscount !== null && discount === promotion.maxDiscount,
    // Share of what the customer pays that is left after assumed costs
    margin: payable > 0 ? ((payable - cost) / payable) * 100 : 0,
    baseMargin: ((input.basket + deliveryFee - cost) / (input.basket + deliveryFee || 1)) * 100,
  }
}
