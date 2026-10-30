import { useMemo } from 'react'
import { useListPromotionsQuery } from '../services/promotionApi'
import type { PromotionRequest, RawPromotion } from '../services/promotionApi'
import type {
  Audience,
  DiscountKind,
  Promotion,
  PromotionDraft,
  PromotionState,
  PromotionStats,
  PromotionType,
} from '../types/promotion'
import useBranches from './useBranches'
import { useServicesQuery } from './useServices'

// The server names the days; the page counts from 0 = Monday
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const TYPES: Record<string, PromotionType> = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
  FREE_DELIVERY: 'freeDelivery',
  FIRST_ORDER: 'firstOrder',
  LOYALTY: 'loyalty',
  REFERRAL: 'referral',
  BUNDLE: 'bundle',
  VOLUME: 'volume',
  SEASONAL: 'seasonal',
}
const TYPE_CODES = Object.fromEntries(Object.entries(TYPES).map(([code, type]) => [type, code])) as Record<PromotionType, string>

const KINDS: Record<string, DiscountKind> = {
  PERCENT: 'percent',
  AMOUNT: 'amount',
  FREE_DELIVERY: 'freeDelivery',
  TIERED: 'tiered',
}
const KIND_CODES = Object.fromEntries(Object.entries(KINDS).map(([code, kind]) => [kind, code])) as Record<DiscountKind, string>

const AUDIENCES: Audience[] = ['all', 'new', 'loyalty', 'vip', 'corporate', 'referred', 'specific']

// BigDecimal may arrive as a number or a string
const num = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : num(value))

const toStats = (raw: RawPromotion['stats']): PromotionStats => ({
  uses: num(raw?.uses),
  revenue: num(raw?.revenue),
  discount: num(raw?.discount),
  reach: num(raw?.reach),
})

export type PromotionLookups = {
  // Branch code (BR-001) <-> uuid
  branchCodeOf: (uuid: string) => string
  branchUuidOf: (code: string) => string
  // Service name <-> uuid
  serviceNameOf: (uuid: string) => string
  serviceUuidOf: (name: string) => string
}

// A server promotion as the pages use it. Branches become their codes and
// services their names; anything the lookups don't know is dropped
export function promotionFromApi(raw: RawPromotion, lookups: PromotionLookups): Promotion {
  const state = (raw.state ?? 'DRAFT').toLowerCase()
  const audience = (raw.audience ?? 'ALL').toLowerCase() as Audience
  return {
    id: raw.uuid ?? '',
    name: raw.name ?? '',
    code: raw.code ?? '',
    automatic: !!raw.automatic,
    description: raw.description ?? '',
    notes: raw.notes ?? '',
    banner: raw.bannerUrl || 'ocean',
    type: TYPES[raw.type ?? ''] ?? 'percentage',
    discountKind: KINDS[raw.discountKind ?? ''] ?? 'percent',
    value: num(raw.value),
    maxDiscount: numOrNull(raw.maxDiscount),
    tiers: (raw.tiers ?? []).map((tier) => ({ minSpend: num(tier.minSpend), percent: num(tier.percent) })),
    bundleNote: raw.bundleNote ?? '',
    audience: AUDIENCES.includes(audience) ? audience : 'all',
    // Customer uuids, as typed in the builder
    customers: (raw.customers ?? []).join(', '),
    branches: (raw.branches ?? []).map(lookups.branchCodeOf).filter(Boolean),
    services: (raw.services ?? []).map(lookups.serviceNameOf).filter(Boolean),
    minOrder: num(raw.minOrder),
    stackable: !!raw.stackable,
    startAt: raw.startAt ?? '',
    endAt: raw.endAt ?? null,
    days: (raw.days ?? []).map((day) => DAYS.indexOf(day)).filter((index) => index >= 0).sort((a, b) => a - b),
    usageLimit: raw.usageLimit ?? null,
    perCustomerLimit: raw.perCustomerLimit ?? null,
    budget: numOrNull(raw.budget),
    channels: raw.channels ?? [],
    state: (['draft', 'published', 'paused', 'archived'].includes(state) ? state : 'draft') as PromotionState,
    stats: toStats(raw.stats),
    previous: toStats(raw.previous),
    // The history tab reads the audit trail
    history: [],
    createdBy: raw.createdBy ?? '',
    createdAt: raw.createdAt ?? '',
  }
}

// The body for a campaign from the builder. `state` is only read on create
export function promotionRequest(draft: PromotionDraft, lookups: PromotionLookups): PromotionRequest {
  return {
    name: draft.name.trim(),
    // An automatic promotion has no code
    code: draft.automatic ? '' : draft.code.trim(),
    automatic: draft.automatic,
    description: draft.description.trim(),
    notes: draft.notes.trim(),
    bannerUrl: draft.banner,
    type: TYPE_CODES[draft.type],
    discountKind: KIND_CODES[draft.discountKind],
    value: draft.value,
    maxDiscount: draft.maxDiscount,
    tiers: draft.discountKind === 'tiered' ? draft.tiers : [],
    bundleNote: draft.bundleNote.trim(),
    audience: draft.audience.toUpperCase(),
    customers: draft.audience === 'specific' ? draft.customers.split(/[\s,;]+/).filter(Boolean) : [],
    branches: draft.branches.map(lookups.branchUuidOf).filter(Boolean),
    services: draft.services.map(lookups.serviceUuidOf).filter(Boolean),
    minOrder: draft.minOrder,
    stackable: draft.stackable,
    startAt: draft.startAt,
    endAt: draft.endAt,
    days: draft.days.map((index) => DAYS[index]).filter(Boolean),
    usageLimit: draft.usageLimit,
    perCustomerLimit: draft.perCustomerLimit,
    budget: draft.budget,
    channels: draft.channels,
    state: draft.state === 'published' ? 'PUBLISHED' : 'DRAFT',
  }
}

const NO_PROMOTIONS: Promotion[] = []

// The branch and service lookups, from the lists the rest of the app loads
export function usePromotionLookups(): PromotionLookups {
  const branches = useBranches()
  const services = useServicesQuery().data?.items
  return useMemo(() => {
    const list = services ?? []
    return {
      branchCodeOf: (uuid) => branches.find((branch) => branch.uuid === uuid)?.id ?? '',
      branchUuidOf: (code) => branches.find((branch) => branch.id === code)?.uuid ?? '',
      serviceNameOf: (uuid) => list.find((service) => service.uuid === uuid)?.name ?? '',
      serviceUuidOf: (name) => list.find((service) => service.name === name)?.uuid ?? '',
    }
  }, [branches, services])
}

// The promotions the caller may see, with the query's loading and error state
export function usePromotionsQuery() {
  const query = useListPromotionsQuery()
  const lookups = usePromotionLookups()
  const promotions = useMemo(
    () => (query.data ? query.data.map((raw) => promotionFromApi(raw, lookups)) : NO_PROMOTIONS),
    [query.data, lookups],
  )
  return { ...query, promotions, lookups }
}

// Names of the services a promotion can apply to, A to Z
export function useServiceNames() {
  const services = useServicesQuery().data?.items
  return useMemo(() => (services ?? []).map(({ name }) => name).sort((a, b) => a.localeCompare(b)), [services])
}
