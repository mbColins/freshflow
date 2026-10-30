import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Clock,
  CreditCard,
  Package,
  Shirt,
  TriangleAlert,
  Truck,
  Wrench,
  X,
} from 'lucide-react'
import { Link } from 'react-router'
import { useDismissAttentionMutation, useGetAttentionQuery } from '../../services/dashboardCardsApi'
import type { AttentionSeverity } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardEmpty, CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

// Item ids look like ORDER_OVERDUE:ORD-10428; the part before the colon is the kind
const KIND_ICONS: Record<string, LucideIcon> = {
  ORDER_OVERDUE: Clock,
  UNPAID_COLLECTION: Banknote,
  MACHINE_FAULT: Wrench,
  MAINTENANCE_OVERDUE: Wrench,
  QC_FAILED: Shirt,
  STOCK: Package,
  DELIVERY_FAILED: Truck,
  PAYMENT_EXCEPTION: CreditCard,
}

const SEVERITY_CLASSES: Record<AttentionSeverity, string> = {
  CRITICAL: 'bg-danger/5 ring-danger/20 text-danger',
  WARNING: 'bg-warning/5 ring-warning/20 text-warning',
}

function NeedsAttention({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetAttentionQuery(branch ? { branch } : undefined)
  const [dismiss, { isLoading: dismissing, originalArgs }] = useDismissAttentionMutation()
  const items = data?.items ?? []
  const critical = items.filter(({ severity }) => severity === 'CRITICAL').length

  return (
    <DashboardCard
      title="Needs Attention & Escalations"
      icon={TriangleAlert}
      badge={
        data && data.total > 0 ? (
          <Badge tone={critical > 0 ? 'danger' : 'warning'}>
            {data.total} {data.total === 1 ? 'alert' : 'alerts'}
          </Badge>
        ) : undefined
      }
    >
      {isLoading ? (
        <CardLoading label="Loading alerts…" />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the alerts" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <CardEmpty title="All clear">Nothing needs your attention right now.</CardEmpty>
      ) : (
        <ul className={`space-y-2 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {items.map(({ id, severity, kind, title, body, action, branch: branchName }) => {
            const Icon = KIND_ICONS[kind] ?? TriangleAlert
            return (
              <li key={id} className={`flex items-start gap-3 rounded-lg p-3 ring-1 ${SEVERITY_CLASSES[severity]}`}>
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">
                    <span className="sr-only">{severity === 'CRITICAL' ? 'Critical: ' : 'Warning: '}</span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {body}
                    {branchName && ` · ${branchName}`}
                  </p>
                </div>
                {action && (
                  <Link
                    to={action.to || '/'}
                    className="shrink-0 rounded-md bg-white px-2.5 py-1.5 text-[10px] font-bold text-ink shadow-sm ring-1 ring-line transition hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {action.label}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void dismiss({ id, branch })}
                  disabled={dismissing && originalArgs?.id === id}
                  aria-label="Hide for 24 hours"
                  title="Hide for 24 hours"
                  className="shrink-0 rounded-md p-1 text-muted transition hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}

export default NeedsAttention
