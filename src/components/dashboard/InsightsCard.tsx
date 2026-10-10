import { ChartPie, Clock, Smartphone, Sparkles, Timer } from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const INSIGHTS = [
  {
    icon: ChartPie,
    title: 'Wash & Fold generated 42% of this month’s revenue (XAF 2.1M)',
    body: 'Commercial hotel contracts increased average load weight per intake batch by 18.5%.',
  },
  {
    icon: Clock,
    title: 'Peak counter intake window: 10:00 AM – 12:00 PM',
    body: 'Averaging 34 orders/hour. Staggering dryer start times during this window cuts energy peaks by 14%.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Money adoption jumped +28% via QR counter tickets',
    body: 'Instant settlement eliminated counter checkout friction, dropping wait time under 45s.',
  },
  {
    icon: Timer,
    title: 'Average turnaround improved to 4h 12m (−18 min)',
    body: 'Same-day service completion SLA compliance reached 99.1% across all downtown residential routes.',
  },
]

function InsightsCard() {
  return (
    <DashboardCard
      title="AI Plant Insights & Optimization"
      icon={Sparkles}
      badge={<Badge>Updated hourly</Badge>}
    >
      <ul className="space-y-2">
        {INSIGHTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3 rounded-lg bg-field p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </DashboardCard>
  )
}

export default InsightsCard
