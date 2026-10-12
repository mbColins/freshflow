import { Zap } from 'lucide-react'
import type { Promotion, PromotionDraft, PromotionStatus } from '../../types/promotion'
import { getStatusMeta } from '../../utils/promotions'
import Badge from '../ui/Badge'

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const { label, tone, icon: Icon } = getStatusMeta(status)
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

// The code customers type, or a marker that none is needed
export function PromotionCode({ promotion }: { promotion: Pick<PromotionDraft, 'code' | 'automatic'> }) {
  return promotion.automatic || !promotion.code ? (
    <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-ink">
      <Zap className="size-3 text-accent" aria-hidden="true" />
      Automatic
    </span>
  ) : (
    <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand">
      {promotion.code}
    </span>
  )
}

export function UsageBar({ promotion }: { promotion: Promotion }) {
  const { uses } = promotion.stats
  const limit = promotion.usageLimit
  const share = limit ? Math.min(100, (uses / limit) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-muted">Redemptions</span>
        <span className="font-semibold text-ink tabular-nums">
          {uses.toLocaleString('en-US')}
          {limit ? ` / ${limit.toLocaleString('en-US')} (${share.toFixed(0)}%)` : ' · no limit'}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-field">
        {limit !== null && (
          <div
            className={`h-full rounded-full ${share >= 100 ? 'bg-danger' : share >= 80 ? 'bg-warning' : 'bg-brand'}`}
            style={{ width: `${share}%` }}
          />
        )}
      </div>
    </div>
  )
}
