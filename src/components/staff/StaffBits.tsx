import { TriangleAlert } from 'lucide-react'
import type { StaffMember, StaffStatus } from '../../types/staff'
import { getInitials } from '../../utils/customers'
import {
  getActiveTasks,
  getLoad,
  getStaffStatus,
  isOverloaded,
} from '../../utils/staff'
import Badge from '../ui/Badge'

const AVATAR_SIZES = {
  sm: 'size-9 text-[10px]',
  lg: 'size-14 text-base',
}

export function StaffAvatar({
  member,
  size = 'sm',
}: {
  member: Pick<StaffMember, 'name' | 'status'>
  size?: keyof typeof AVATAR_SIZES
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white ${AVATAR_SIZES[size]}`}
    >
      {getInitials(member.name)}
      <span
        className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white"
        style={{ backgroundColor: getStaffStatus(member.status).color }}
      />
    </span>
  )
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  const { label, tone } = getStaffStatus(status)
  return <Badge tone={tone}>{label}</Badge>
}

export function WorkloadBar({ member }: { member: StaffMember }) {
  const load = getLoad(member)
  const overloaded = isOverloaded(member)
  const percent = Math.round(load * 100)

  return (
    <div className="min-w-28">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className={`flex items-center gap-1 font-semibold ${overloaded ? 'text-danger' : 'text-ink'}`}
        >
          {overloaded && <TriangleAlert className="size-3" aria-hidden="true" />}
          {percent}% {overloaded ? 'overloaded' : 'load'}
        </span>
        <span className="text-muted tabular-nums">
          {getActiveTasks(member)} / {member.capacity}
        </span>
      </div>
      <div
        className={`mt-1 h-1.5 overflow-hidden rounded-full ${overloaded ? 'bg-danger/15' : 'bg-brand/15'}`}
        role="meter"
        aria-label={`${member.name} workload`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${overloaded ? 'bg-danger' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}
