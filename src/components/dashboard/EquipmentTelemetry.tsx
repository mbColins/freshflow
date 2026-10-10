import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  Gauge,
  Thermometer,
  Timer,
  TriangleAlert,
  WashingMachine,
  Wind,
} from 'lucide-react'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import DashboardCard from './DashboardCard'

type Machine = {
  name: string
  icon: LucideIcon
  detail: string
  status: string
  statusIcon: LucideIcon
  tone: BadgeTone
  load?: number
}

const MACHINES: Machine[] = [
  {
    name: 'Washer #01 (EcoWash 40kg)',
    icon: WashingMachine,
    detail: 'Cotton cycle · 1,200 RPM',
    status: '34m left',
    statusIcon: Timer,
    tone: 'brand',
    load: 92,
  },
  {
    name: 'Washer #02 (FastSpin 25kg)',
    icon: WashingMachine,
    detail: 'Delicates cycle · 800 RPM',
    status: '12m left',
    statusIcon: Timer,
    tone: 'brand',
    load: 60,
  },
  {
    name: 'Washer #04 (EcoWash 40kg)',
    icon: WashingMachine,
    detail: 'Vibration alert · throttled',
    status: 'Maintenance',
    statusIcon: TriangleAlert,
    tone: 'danger',
  },
  {
    name: 'Dryer #01 (SpeedDry 30kg)',
    icon: Wind,
    detail: 'Cool down ready · drum cleared',
    status: 'Available',
    statusIcon: CircleCheck,
    tone: 'success',
  },
  {
    name: 'Steam Press #01 (Rotary)',
    icon: Thermometer,
    detail: 'High steam chamber active',
    status: '88°C',
    statusIcon: Thermometer,
    tone: 'brand',
  },
]

function EquipmentTelemetry() {
  return (
    <DashboardCard
      title="Equipment Telemetry"
      subtitle="Live inverter loads, drum RPM, and thermal status"
      icon={Gauge}
      badge={<Badge tone="success">4 / 5 active</Badge>}
    >
      <ul className="space-y-2">
        {MACHINES.map(
          ({ name, icon: Icon, detail, status, statusIcon: StatusIcon, tone, load }) => (
            <li key={name} className="rounded-lg bg-field p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                  <Icon
                    className="size-3.5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                  <span className="truncate">{name}</span>
                </p>
                <Badge tone={tone}>
                  <StatusIcon className="size-3" aria-hidden="true" />
                  {status}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                <span>{detail}</span>
                {load !== undefined && <span>{load}% load</span>}
              </div>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        className="mt-3 h-9 w-full rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        Equipment Grid & Calibration
      </button>
    </DashboardCard>
  )
}

export default EquipmentTelemetry
