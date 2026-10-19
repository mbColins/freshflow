import { Building2, Factory, PackageCheck, Store } from 'lucide-react'
import type { Branch, BranchStatus, BranchType } from '../../types/branch'
import { getBranchStatus, getPerformanceTier, getTierLabel } from '../../utils/branches'
import Badge from '../ui/Badge'

export function BranchStatusBadge({ status }: { status: BranchStatus }) {
  const { label, tone, icon: Icon } = getBranchStatus(status)
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

const TYPE_ICONS: Record<BranchType, typeof Store> = {
  'Main Branch': Building2,
  'Standard Branch': Store,
  'Pickup Point': PackageCheck,
  'Processing Center': Factory,
}

// Decorative header band standing in for a branch photo
export function BranchArt({ branch, className = '' }: { branch: Branch; className?: string }) {
  const Icon = TYPE_ICONS[branch.type]
  const trading = branch.status === 'active' || branch.status === 'maintenance'
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${
        trading ? 'bg-linear-to-br from-brand-dark to-accent' : 'bg-linear-to-br from-ink to-muted'
      } ${className}`}
    >
      <Icon className="absolute -right-3 -bottom-4 size-24 text-white/15" strokeWidth={1.25} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgb(255_255_255/0.18),transparent_55%)]" />
    </div>
  )
}

const TIER_STYLES = {
  high: { bar: 'bg-success', text: 'text-success' },
  average: { bar: 'bg-brand', text: 'text-brand' },
  low: { bar: 'bg-danger', text: 'text-danger' },
}

export function HealthMeter({ health, compact = false }: { health: number | null; compact?: boolean }) {
  const tier = getPerformanceTier(health)
  if (health === null || tier === null) {
    return <span className="text-[11px] text-muted">{compact ? '—' : 'No health score available'}</span>
  }
  const styles = TIER_STYLES[tier]
  return (
    <div className={compact ? 'min-w-24' : ''}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        {!compact && <span className="font-semibold text-ink">Branch Health</span>}
        <span className={`font-bold tabular-nums ${styles.text}`}>
          {health}%
          <span className="ml-1 font-semibold">{getTierLabel(health).replace(' performing', '')}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${health}%` }} />
      </div>
    </div>
  )
}

// Labelled 0–100 progress bar
export function Meter({ label, value, display }: { label: string; value: number; display?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-bold text-ink tabular-nums">{display ?? `${value}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-field"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}
