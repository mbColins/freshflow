import { LEAVE_CODES } from '../constants/staff'
import type { ApiResponse } from '../types/api'
import type { LeaveRequest, LeaveStatus, OpenShift } from '../types/staff'
import { api } from './api'

// Staff operations: attendance, tasks, shifts and leave (/staff)

type RawRef = { uuid?: string; name?: string } | null

// "LAUNDRY_OPERATIONS" -> "Laundry Operations"
const title = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

// A list comes as a bare array or as a page
function listOf(content: unknown): unknown[] {
  if (Array.isArray(content)) return content
  const page = content as { data?: unknown[]; content?: unknown[] } | null
  return page?.data ?? page?.content ?? []
}

// ---------- Shifts ----------

type RawShift = {
  uuid?: string
  title?: string | null
  department?: string | null
  skill?: string | null
  startTime?: string | null
  endTime?: string | null
  status?: string | null
}

// ---------- Leave ----------

type RawLeave = {
  uuid?: string
  user?: RawRef
  type?: string | null
  from?: string | null
  to?: string | null
  reason?: string | null
  status?: string | null
  decidedBy?: string | null
}

const LEAVE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(LEAVE_CODES).map(([label, code]) => [code, label]))

const LEAVE_STATUS: Record<string, LeaveStatus> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

// What recording attendance can do. MARK_ABSENT needs a reason
export type AttendanceCode = 'CLOCK_IN' | 'CLOCK_OUT' | 'START_BREAK' | 'END_BREAK' | 'MARK_ABSENT'

export type AssignTaskBody = {
  // A TaskType such as LAUNDRY_ORDER_WASHING
  type: string
  // Order number, job code or machine code
  reference?: string
  title?: string
  // Local date-time without a zone
  dueAt?: string
  estimatedMin?: number
  // Lets a manager assign beyond the person's daily capacity
  force?: boolean
}

const STAFF_TAG = { type: 'Staff' as const, id: 'OPS' }
const USERS = { type: 'User' as const, id: 'LIST' }

// Anything that changes a person's day also changes the staff lists
const DAY_CHANGED = [STAFF_TAG, USERS, { type: 'Audit' as const, id: 'LIST' }]

export const staffOpsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 409 already_clocked_in, account_blocked, on_leave, not_clocked_in,
    // break_already_started, no_open_break; 403 time_override_not_allowed.
    // `time` (HH:mm) is for managers only
    recordAttendance: build.mutation<void, { user: string; action: AttendanceCode; time?: string; reason?: string }>({
      query: ({ user, ...body }) => ({ url: `/staff/${encodeURIComponent(user)}/attendance`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
    // Resolves to the warnings, e.g. skill_missing: allowed, but worth a look.
    // 409 user_not_active, on_leave, not_on_duty, over_capacity (unless forced)
    assignTask: build.mutation<string[], { user: string } & AssignTaskBody>({
      query: ({ user, ...body }) => ({ url: `/staff/${encodeURIComponent(user)}/tasks`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<{ warnings?: string[] } | null>) => response.content?.warnings ?? [],
      invalidatesTags: DAY_CHANGED,
    }),

    // Shifts nobody has taken yet
    listOpenShifts: build.query<OpenShift[], void>({
      query: () => ({ url: '/staff/shifts', params: { status: 'OPEN' } }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawShift[]).flatMap((raw) =>
          raw?.uuid
            ? [
                {
                  id: raw.uuid,
                  title: raw.title ?? '',
                  department: title(raw.department),
                  start: (raw.startTime ?? '').slice(0, 5),
                  end: (raw.endTime ?? '').slice(0, 5),
                  skill: title(raw.skill),
                },
              ]
            : [],
        ),
      providesTags: [STAFF_TAG],
    }),
    // 409 shift_not_open, schedule_conflict
    fillShift: build.mutation<void, { shift: string; user: string }>({
      query: ({ shift, user }) => ({ url: `/staff/shifts/${encodeURIComponent(shift)}/fill`, method: 'PATCH', body: { user } }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),

    // A manager sees their scope's requests, anyone else their own
    listLeave: build.query<LeaveRequest[], { status?: string } | void>({
      query: (params) => ({ url: '/staff/leave', params: { page: 0, size: 100, ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawLeave[]).flatMap((raw) =>
          raw?.uuid && raw.status?.toUpperCase() !== 'CANCELLED'
            ? [
                {
                  id: raw.uuid,
                  staffId: raw.user?.uuid ?? '',
                  type: LEAVE_LABELS[raw.type ?? ''] ?? title(raw.type),
                  from: raw.from ?? '',
                  to: raw.to ?? '',
                  reason: raw.reason ?? '',
                  status: LEAVE_STATUS[raw.status?.toUpperCase() ?? ''] ?? ('Pending' as const),
                  approver: raw.decidedBy ?? '',
                },
              ]
            : [],
        ),
      providesTags: [STAFF_TAG],
    }),
    // `user` defaults to the caller; only a manager can ask for someone else.
    // 409 insufficient_leave_balance, leave_overlap
    requestLeave: build.mutation<void, { user?: string; type: string; from: string; to: string; reason: string }>({
      query: (body) => ({ url: '/staff/leave', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
    // Never the requester (403 cannot_decide_own_leave); 409 leave_already_decided
    decideLeave: build.mutation<void, { id: string; approve: boolean; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/staff/leave/${encodeURIComponent(id)}/decision`, method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
  }),
})

export const {
  useRecordAttendanceMutation,
  useAssignTaskMutation,
  useListOpenShiftsQuery,
  useFillShiftMutation,
  useListLeaveQuery,
  useRequestLeaveMutation,
  useDecideLeaveMutation,
} = staffOpsApi
