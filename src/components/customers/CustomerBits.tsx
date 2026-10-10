import { CircleAlert, CircleCheck, CircleMinus } from 'lucide-react'
import { CUSTOMER_STATUSES } from '../../constants/customers'
import type { CrmCustomer } from '../../types/customer'
import { getInitials, getTier } from '../../utils/customers'
import type { Health } from '../../utils/customers'
import Badge from '../ui/Badge'

const AVATAR_SIZES = {
  sm: 'size-8 text-[10px]',
  md: 'size-10 text-xs',
  lg: 'size-14 text-base',
}

export function Avatar({
  customer,
  size = 'sm',
}: {
  customer: Pick<CrmCustomer, 'name' | 'kind'>
  size?: keyof typeof AVATAR_SIZES
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-bold text-white ${AVATAR_SIZES[size]} ${
        customer.kind === 'corporate' ? 'rounded-lg bg-ink' : 'rounded-full bg-brand'
      }`}
    >
      {getInitials(customer.name)}
    </span>
  )
}

export function CustomerStatusBadge({ customer }: { customer: CrmCustomer }) {
  const { label, tone } = CUSTOMER_STATUSES.find(
    ({ id }) => id === customer.status,
  )!
  return <Badge tone={tone}>{label}</Badge>
}

const TIER_COLORS = {
  bronze: '#b45309',
  silver: '#94a3b8',
  gold: '#eda100',
  platinum: '#6250d6',
}

export function TierBadge({ points }: { points: number }) {
  const { tier } = getTier(points)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-field px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-ink">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: TIER_COLORS[tier.id] }}
      />
      {tier.label}
    </span>
  )
}

const HEALTH_STYLES = {
  active: { tone: 'success', icon: CircleCheck },
  risk: { tone: 'warning', icon: CircleAlert },
  inactive: { tone: 'danger', icon: CircleMinus },
} as const

export function HealthBadge({ health }: { health: Health }) {
  const { tone, icon: Icon } = HEALTH_STYLES[health.level]
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {health.label}
    </Badge>
  )
}
