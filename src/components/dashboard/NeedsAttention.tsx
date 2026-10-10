import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Clock, Smartphone, TriangleAlert, Wrench, Shirt } from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

type Alert = {
  icon: LucideIcon
  severity: 'critical' | 'warning'
  title: string
  body: string
  action: string
}

const ALERTS: Alert[] = [
  {
    icon: Clock,
    severity: 'critical',
    title: 'Order #ORD-10428 is 2h overdue (Hospital Linen)',
    body: 'Scheduled for 08:00 AM delivery. Client: St. Jude Clinic.',
    action: 'View Order',
  },
  {
    icon: Smartphone,
    severity: 'warning',
    title: '3 orders unpaid pending collection (XAF 42,500)',
    body: 'Automated SMS reminder queued for 11:00 AM dispatch.',
    action: 'Send Reminder',
  },
  {
    icon: Wrench,
    severity: 'critical',
    title: 'Washer #04 vibration anomaly detected',
    body: 'Bearing load spike 1400 RPM. Unit auto-throttled to 40%.',
    action: 'Dispatch Tech',
  },
  {
    icon: Shirt,
    severity: 'warning',
    title: 'Order #ORD-10411 failed QA inspection (stain)',
    body: 'Silk blouse requires spot pre-treatment & delicate re-rinse.',
    action: 'Re-wash',
  },
]

const SEVERITY_CLASSES = {
  critical: 'bg-danger/5 ring-danger/20 text-danger',
  warning: 'bg-warning/5 ring-warning/20 text-warning',
}

function NeedsAttention() {
  const [seen, setSeen] = useState(false)

  return (
    <DashboardCard
      title="Needs Attention & Escalations"
      icon={TriangleAlert}
      badge={!seen && <Badge tone="danger">{ALERTS.length} alerts</Badge>}
      action={
        <button
          type="button"
          onClick={() => setSeen(true)}
          disabled={seen}
          className="rounded-sm text-[11px] font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:text-muted disabled:no-underline"
        >
          {seen ? 'Marked seen' : 'Mark seen'}
        </button>
      }
    >
      <ul className="space-y-2">
        {ALERTS.map(({ icon: Icon, severity, title, body, action }) => (
          <li
            key={title}
            className={`flex items-start gap-3 rounded-lg p-3 ring-1 ${SEVERITY_CLASSES[severity]} ${seen ? 'opacity-70' : ''}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink">
                <span className="sr-only">
                  {severity === 'critical' ? 'Critical: ' : 'Warning: '}
                </span>
                {title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {body}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md bg-white px-2.5 py-1.5 text-[10px] font-bold text-ink shadow-sm ring-1 ring-line transition hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {action}
            </button>
          </li>
        ))}
      </ul>
    </DashboardCard>
  )
}

export default NeedsAttention
