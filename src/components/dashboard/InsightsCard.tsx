import type { LucideIcon } from 'lucide-react'
import { Box, ChartPie, Clock, Sparkles, Timer, Wallet, Wrench } from 'lucide-react'
import { useGetInsightsQuery } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardEmpty, CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

// Icon names the backend sends with each insight
const ICONS: Record<string, LucideIcon> = {
  CHART_PIE: ChartPie,
  CLOCK: Clock,
  WALLET: Wallet,
  TIMER: Timer,
  BOX: Box,
  WRENCH: Wrench,
}

// Facts about the month, computed on the server in the business's language
function InsightsCard({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetInsightsQuery(branch ? { branch } : undefined)
  const insights = data ?? []

  return (
    <DashboardCard title="Plant Insights" subtitle="What stands out this month" icon={Sparkles} badge={<Badge>Updated hourly</Badge>}>
      {isLoading ? (
        <CardLoading label="Loading insights…" />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the insights" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : insights.length === 0 ? (
        <CardEmpty title="Not enough data yet">Insights appear once the month has a few orders.</CardEmpty>
      ) : (
        <ul className={`space-y-2 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {insights.map(({ id, icon, title, body }) => {
            const Icon = ICONS[icon] ?? Sparkles
            return (
              <li key={id} className="flex items-start gap-3 rounded-lg bg-field p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}

export default InsightsCard
