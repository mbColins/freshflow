import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Banknote,
  ClipboardCheck,
  TriangleAlert,
  Truck,
  WashingMachine,
} from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

type PlantEvent = {
  icon: LucideIcon
  title: string
  time: string
  body: string
  alert?: boolean
}

const EVENTS: PlantEvent[] = [
  {
    icon: WashingMachine,
    title: 'Order #ORD-10452 started wash cycle',
    time: '10:42 AM',
    body: 'Elena R. assigned 40kg drum in Washer #02 with hypoallergenic cycle.',
  },
  {
    icon: Banknote,
    title: 'XAF 24,000 received via Mobile Money',
    time: '10:35 AM',
    body: 'Customer Sarah K. paid for Express Dry Cleaning (#ORD-10451).',
  },
  {
    icon: Truck,
    title: 'Driver Carlos departed for Run #3',
    time: '10:20 AM',
    body: 'Van #1 dispatched with 6 finished garment bags for Akwa residential corridor.',
  },
  {
    icon: TriangleAlert,
    title: 'Low stock threshold reached',
    time: '10:05 AM',
    body: 'Garment Poly Bags (XL) reached 120 units. Reorder alert triggered.',
    alert: true,
  },
  {
    icon: ClipboardCheck,
    title: 'Morning shift handover signed',
    time: '08:00 AM',
    body: 'Night cycle report archived by Marcus Vance. All 18 washers disinfected.',
  },
]

function EventStream() {
  return (
    <DashboardCard
      title="Live Operational Event Stream"
      icon={Activity}
      badge={<Badge tone="success">Live stream</Badge>}
    >
      <ol className="space-y-3">
        {EVENTS.map(({ icon: Icon, title, time, body, alert }) => (
          <li key={title} className="flex items-start gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                alert ? 'bg-danger/10 text-danger' : 'bg-field text-muted'
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-ink">
                {title}
                <time className="text-[10px] font-normal text-muted">
                  {time}
                </time>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="mt-4 h-9 w-full rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        View Complete System Audit Log
      </button>
    </DashboardCard>
  )
}

export default EventStream
