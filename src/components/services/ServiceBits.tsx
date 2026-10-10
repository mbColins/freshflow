import type { LucideIcon } from 'lucide-react'
import {
  BedDouble,
  ChevronRight,
  Crown,
  Flame,
  Footprints,
  LayoutGrid,
  ShieldCheck,
  Shirt,
  Sparkles,
  Truck,
  WashingMachine,
} from 'lucide-react'
import { SERVICE_STATUSES } from '../../constants/services'
import type { LaundryService, ServiceStatus } from '../../types/service'
import { getCapacity } from '../../utils/services'
import Badge from '../ui/Badge'

const ICONS: Record<string, LucideIcon> = {
  wash: WashingMachine,
  suit: Shirt,
  iron: Flame,
  bed: BedDouble,
  shoe: Footprints,
  gown: Sparkles,
  sanitize: ShieldCheck,
  carpet: LayoutGrid,
  delivery: Truck,
  premium: Crown,
}

const ICON_SIZES = {
  sm: 'size-9 [&>svg]:size-4',
  lg: 'size-14 [&>svg]:size-6',
}

export function ServiceIcon({
  icon,
  size = 'sm',
}: {
  icon: string
  size?: keyof typeof ICON_SIZES
}) {
  const Icon = ICONS[icon] ?? WashingMachine
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ${ICON_SIZES[size]}`}
    >
      <Icon aria-hidden="true" />
    </span>
  )
}

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const { label, tone } = SERVICE_STATUSES.find(({ id }) => id === status)!
  return <Badge tone={tone}>{label}</Badge>
}

const CAPACITY_STYLES = {
  ok: { fill: 'bg-brand', track: 'bg-brand/15', label: 'Capacity available' },
  near: { fill: 'bg-warning', track: 'bg-warning/15', label: 'Service Near Capacity' },
  full: { fill: 'bg-danger', track: 'bg-danger/15', label: 'Capacity Reached' },
}

export function CapacityMeter({ service }: { service: LaundryService }) {
  const capacity = getCapacity(service)
  if (!capacity) return null
  const style = CAPACITY_STYLES[capacity.state]
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-ink">{style.label}</span>
        <span className="text-muted tabular-nums">
          {service.currentLoad} / {service.dailyCapacity} {service.capacityUnit}
        </span>
      </div>
      <div
        className={`mt-1.5 h-2 overflow-hidden rounded-full ${style.track}`}
        role="meter"
        aria-label={`${service.name} daily capacity in use`}
        aria-valuenow={service.currentLoad}
        aria-valuemin={0}
        aria-valuemax={service.dailyCapacity ?? 0}
      >
        <div
          className={`h-full rounded-full ${style.fill}`}
          style={{ width: `${capacity.ratio * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Remaining today: {capacity.remaining} {service.capacityUnit}
      </p>
    </div>
  )
}

export function WorkflowChain({ stages }: { stages: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-ink">
      {stages.map((stage, index) => (
        <li key={`${stage}-${index}`} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="size-3 text-muted" aria-hidden="true" />
          )}
          <span className="rounded bg-field px-1.5 py-0.5 whitespace-nowrap">
            {stage}
          </span>
        </li>
      ))}
    </ol>
  )
}
