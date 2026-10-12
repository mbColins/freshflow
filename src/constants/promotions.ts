import {
  Archive,
  BadgePercent,
  Banknote,
  CalendarClock,
  CircleCheck,
  CirclePause,
  FilePen,
  Gift,
  Layers,
  Package,
  Snowflake,
  Sparkles,
  TimerOff,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../components/ui/Badge'
import type { OrderRole } from '../types/order'
import type {
  Audience,
  DiscountKind,
  PromotionFilters,
  PromotionStatus,
  PromotionType,
  StackingPolicy,
} from '../types/promotion'

export const PROMOTION_STATUSES: {
  value: PromotionStatus
  label: string
  tone: BadgeTone
  icon: LucideIcon
  bar: string
}[] = [
  { value: 'active', label: 'Active', tone: 'success', icon: CircleCheck, bar: 'bg-success' },
  { value: 'scheduled', label: 'Scheduled', tone: 'brand', icon: CalendarClock, bar: 'bg-brand' },
  { value: 'draft', label: 'Draft', tone: 'neutral', icon: FilePen, bar: 'bg-muted/40' },
  { value: 'paused', label: 'Paused', tone: 'warning', icon: CirclePause, bar: 'bg-warning' },
  { value: 'expired', label: 'Expired', tone: 'danger', icon: TimerOff, bar: 'bg-danger/60' },
  { value: 'archived', label: 'Archived', tone: 'neutral', icon: Archive, bar: 'bg-ink/30' },
]

export const PROMOTION_TYPES: {
  value: PromotionType
  label: string
  example: string
  icon: LucideIcon
  // Discount kinds the type allows; the first is the default
  kinds: DiscountKind[]
}[] = [
  { value: 'percentage', label: 'Percentage Discount', example: '20% OFF', icon: BadgePercent, kinds: ['percent'] },
  { value: 'fixed', label: 'Fixed Discount', example: 'XAF 2,000 OFF', icon: Banknote, kinds: ['amount'] },
  { value: 'freeDelivery', label: 'Free Delivery', example: 'Pickup and delivery fee waived', icon: Truck, kinds: ['freeDelivery'] },
  { value: 'firstOrder', label: 'First Order', example: 'Discount for new customers', icon: Sparkles, kinds: ['amount', 'percent'] },
  { value: 'loyalty', label: 'Loyalty Reward', example: 'Reward returning customers', icon: Gift, kinds: ['amount', 'percent'] },
  { value: 'referral', label: 'Referral', example: 'Reward a customer and their friend', icon: Users, kinds: ['percent', 'amount'] },
  { value: 'bundle', label: 'Bundle', example: 'Save on a set of items', icon: Package, kinds: ['amount', 'percent'] },
  { value: 'volume', label: 'Buy More, Save More', example: 'Bigger loads, bigger discount', icon: Layers, kinds: ['tiered'] },
  { value: 'seasonal', label: 'Seasonal Campaign', example: 'Holiday and peak-season offers', icon: Snowflake, kinds: ['percent', 'amount'] },
]

export const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  percent: 'Percentage of the order',
  amount: 'Fixed amount (XAF)',
  freeDelivery: 'Free pickup and delivery',
  tiered: 'Spend tiers',
}

export const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'all', label: 'All customers' },
  { value: 'new', label: 'New customers (first order)' },
  { value: 'loyalty', label: 'Loyalty members' },
  { value: 'vip', label: 'VIP customers' },
  { value: 'corporate', label: 'Corporate accounts' },
  { value: 'referred', label: 'Referred customers' },
  { value: 'specific', label: 'Specific customers' },
]

export const CHANNELS = ['WhatsApp', 'SMS', 'Email', 'In-App', 'Counter POS']

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Banner themes stand in for an uploaded campaign image
export const BANNERS: { value: string; label: string; className: string }[] = [
  { value: 'ocean', label: 'Ocean', className: 'bg-linear-to-br from-brand-dark to-accent' },
  { value: 'fresh', label: 'Fresh', className: 'bg-linear-to-br from-emerald-600 to-teal-400' },
  { value: 'sunset', label: 'Sunset', className: 'bg-linear-to-br from-orange-600 to-amber-400' },
  { value: 'berry', label: 'Berry', className: 'bg-linear-to-br from-violet-700 to-pink-500' },
  { value: 'night', label: 'Night', className: 'bg-linear-to-br from-ink to-slate-600' },
]

export const PROMO_WIZARD_STEPS = [
  'Basic Info',
  'Type',
  'Discount',
  'Eligibility',
  'Conditions',
  'Schedule',
  'Limits',
  'Channels',
  'Preview',
  'Publish',
]

export const STACKING_MODES: { value: StackingPolicy['mode']; label: string; detail: string }[] = [
  { value: 'none', label: 'One promotion per order', detail: 'The best eligible promotion wins. Nothing combines.' },
  { value: 'withDelivery', label: 'One discount + free delivery', detail: 'A discount can combine with a free pickup/delivery offer. Two discount codes never combine.' },
  { value: 'all', label: 'Stackable promotions combine', detail: 'Promotions marked stackable can be used together, up to the combined ceiling.' },
]

export const DEFAULT_STACKING: StackingPolicy = { mode: 'withDelivery', maxCombined: 30 }

// Used by the simulator; replace with real figures when pricing is connected
export const DELIVERY_FEE = 1500
export const ASSUMED_GROSS_MARGIN = 0.4

export const EMPTY_PROMOTION_FILTERS: PromotionFilters = {
  query: '',
  status: '',
  type: '',
  branch: '',
  service: '',
  audience: '',
  date: '',
  from: '',
  to: '',
}

export type PromotionPermissions = { manage: boolean; financials: boolean }

export const PROMOTION_PERMISSIONS: Record<OrderRole, PromotionPermissions> = {
  admin: { manage: true, financials: true },
  manager: { manage: true, financials: true },
  receptionist: { manage: false, financials: false },
  staff: { manage: false, financials: false },
}
