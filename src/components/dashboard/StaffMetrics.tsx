import { Users } from 'lucide-react'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const STAFF = [
  {
    initials: 'MV',
    name: 'Marcus Vance',
    role: 'Operations Lead',
    score: '99.2% QA',
    note: '14 orders audited',
  },
  {
    initials: 'ER',
    name: 'Elena Rostova',
    role: 'Wash Tech Specialist',
    score: '98.5% QA',
    note: '38 orders washed',
  },
  {
    initials: 'DK',
    name: 'David Kim',
    role: 'Pressing & Packaging',
    score: '94.0% QA',
    note: '26 orders pressed',
  },
  {
    initials: 'CM',
    name: 'Carlos Mendez',
    role: 'Fleet Delivery Driver',
    score: '100% on-time',
    note: '18 stops closed',
  },
]

function StaffMetrics() {
  return (
    <DashboardCard
      title="Staff & Shift QA Metrics"
      subtitle="Individual throughput, folding accuracy & QA ratings"
      icon={Users}
      badge={<Badge tone="success">Shift 1 (Day)</Badge>}
    >
      <ul className="space-y-2">
        {STAFF.map(({ initials, name, role, score, note }) => (
          <li
            key={name}
            className="flex items-center gap-3 rounded-lg bg-field p-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{name}</p>
              <p className="truncate text-[11px] text-muted">{role}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-ink">{score}</p>
              <p className="text-[10px] text-muted">{note}</p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 h-9 w-full rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        Manage Shift Roster
      </button>
    </DashboardCard>
  )
}

export default StaffMetrics
