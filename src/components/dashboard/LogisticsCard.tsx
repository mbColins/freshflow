import { Truck } from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const STATS = [
  { label: 'Pickups', value: 18 },
  { label: 'Deliveries', value: 24 },
  { label: 'In transit', value: 7 },
  { label: 'Delivered', value: 15 },
]

const VANS = [
  { id: 'Van #1', x: 150, y: 62, status: 'Carlos M. · Stop 4 of 9 (Akwa North)' },
  { id: 'Van #2', x: 286, y: 122, status: 'Ngoma route · ETA 8 min' },
]

function LogisticsCard() {
  return (
    <DashboardCard
      title="Pickup & Delivery Logistics"
      subtitle="Fleet telemetry across Downtown & residential sectors"
      icon={Truck}
      badge={<Badge tone="brand">3 active runs</Badge>}
      action={
        <button
          type="button"
          className="rounded-md bg-field px-2.5 py-1.5 text-[10px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Manifest & Stops
        </button>
      }
    >
      <dl className="grid grid-cols-4 gap-2 rounded-md bg-field px-3 py-2.5 text-center">
        {STATS.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold text-muted">{label}</dt>
            <dd className="text-base font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Static route illustration; swap for a real map component when one is chosen */}
      <svg
        viewBox="0 0 400 170"
        className="mt-3 h-auto w-full rounded-md"
        aria-hidden="true"
      >
        <rect width="400" height="170" fill="#eef2f7" />
        <path
          d="M0,120 C60,100 90,150 150,135 S250,150 300,170 L0,170 Z"
          fill="#dbeafe"
        />
        <g stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-10,40 L410,70" />
          <path d="M90,-10 L130,180" />
          <path d="M250,-10 L310,180" />
          <path d="M-10,100 L410,150" />
        </g>
        <polyline
          points="60,46 150,62 215,96 286,122 352,140"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="60" cy="46" r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
        <circle cx="352" cy="140" r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
        {VANS.map(({ id, x, y }) => (
          <g key={id}>
            <circle cx={x} cy={y} r="9" fill="#0f172a" stroke="#fff" strokeWidth="2" />
            <rect x={x - 21} y={y - 30} width="42" height="16" rx="4" fill="#0f172a" />
            <text
              x={x}
              y={y - 19}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#ffffff"
            >
              {id}
            </text>
          </g>
        ))}
      </svg>

      <ul className="mt-3 space-y-1 text-[11px] text-muted">
        {VANS.map(({ id, status }) => (
          <li key={id} className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-bold text-ink">{id}</span>
            {status}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        Total route distance: <span className="font-bold text-ink">48.6 km</span>{' '}
        · Next collection pickup:{' '}
        <span className="font-bold text-ink">11:30 AM (Bonapriso)</span>
      </p>
    </DashboardCard>
  )
}

export default LogisticsCard
