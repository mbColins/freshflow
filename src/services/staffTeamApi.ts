import type { ApiResponse } from '../types/api'
import { api } from './api'

// Staff operations beyond clocking in and leave: attendance history, tasks,
// training, shifts and recommendations (/staff)

type RawRef = { uuid?: string; name?: string } | null

// A list comes as a bare array or as a page
function listOf(content: unknown): unknown[] {
  if (Array.isArray(content)) return content
  const page = content as { data?: unknown[]; content?: unknown[] } | null
  return page?.data ?? page?.content ?? []
}

const str = (value: string | null | undefined) => value ?? ''

export type AttendanceDay = {
  id: string
  // yyyy-MM-dd
  date: string
  scheduledStart: string
  scheduledEnd: string
  clockIn: string
  clockOut: string
  breakMinutes: number
  // PRESENT, LATE, ABSENT, ON_LEAVE ...
  status: string
  lateMinutes: number
  absenceReason: string
}

export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'OVERDUE'

export type StaffTask = {
  id: string
  type: string
  reference: string
  title: string
  dueAt: string
  estimatedMin: number
  status: TaskStatus
  assignedBy: string
  assignedAt: string
  startedAt: string
  doneAt: string
}

export type TrainingRecord = {
  id: string
  course: string
  // yyyy-MM-dd, empty until done
  completedAt: string
  dueAt: string
}

export type Candidate = {
  id: string
  name: string
  skillLevel: string
  // Tasks taken today as a share of the daily capacity (0 to 1 and above)
  load: number
  onDuty: boolean
  reason: string
}

type RawAttendance = {
  uuid?: string
  date?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  clockIn?: string | null
  clockOut?: string | null
  breakMinutes?: number | null
  status?: string | null
  lateMinutes?: number | null
  absenceReason?: string | null
}

type RawTask = {
  uuid?: string
  type?: string | null
  reference?: string | null
  title?: string | null
  dueAt?: string | null
  estimatedMin?: number | null
  status?: string | null
  assignedBy?: string | null
  assignedAt?: string | null
  startedAt?: string | null
  doneAt?: string | null
}

type RawTraining = { uuid?: string; course?: string | null; completedAt?: string | null; dueAt?: string | null }

type RawCandidate = {
  user?: RawRef
  skillLevel?: string | null
  load?: number | null
  onDuty?: boolean
  reason?: string | null
}

export type ShiftBody = {
  title: string
  // A Department code such as LAUNDRY_OPERATIONS
  department: string
  // A Skill code such as WASHING
  skill: string
  // yyyy-MM-dd
  workDate: string
  // HH:mm
  startTime: string
  endTime: string
  // Without a person the shift is open
  user?: string
  // For the owner and platform admin
  branch?: string
}

const TASKS_TAG = { type: 'Staff' as const, id: 'TASKS' }
const TRAINING_TAG = { type: 'Staff' as const, id: 'TRAINING' }
const ATTENDANCE_TAG = { type: 'Staff' as const, id: 'ATTENDANCE' }
// The lists staffOpsApi and userApi read from
const OPS = { type: 'Staff' as const, id: 'OPS' }
const USERS = { type: 'User' as const, id: 'LIST' }
const AUDIT = { type: 'Audit' as const, id: 'LIST' }

// Anything that changes a person's day also changes the staff lists
const DAY_CHANGED = [OPS, TASKS_TAG, ATTENDANCE_TAG, USERS, AUDIT]

export const staffTeamApi = api.injectEndpoints({
  endpoints: (build) => ({
    // A person's days, newest first. The server defaults to the last 30 days
    listAttendance: build.query<AttendanceDay[], { user: string; from?: string; to?: string }>({
      query: ({ user, ...params }) => ({ url: `/staff/${encodeURIComponent(user)}/attendance`, params }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawAttendance[])
          .map((raw, index) => ({
            id: raw.uuid ?? String(index),
            date: str(raw.date),
            scheduledStart: str(raw.scheduledStart),
            scheduledEnd: str(raw.scheduledEnd),
            clockIn: str(raw.clockIn),
            clockOut: str(raw.clockOut),
            breakMinutes: raw.breakMinutes ?? 0,
            status: str(raw.status),
            lateMinutes: raw.lateMinutes ?? 0,
            absenceReason: str(raw.absenceReason),
          }))
          .sort((a, b) => b.date.localeCompare(a.date)),
      providesTags: [ATTENDANCE_TAG],
    }),

    // A manager sees their scope's tasks, anyone else their own
    listStaffTasks: build.query<StaffTask[], { user?: string; status?: string; date?: string } | void>({
      query: (params) => ({ url: '/staff/tasks', params: { page: 0, size: 100, ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawTask[]).flatMap((raw) =>
          raw?.uuid
            ? [
                {
                  id: raw.uuid,
                  type: str(raw.type),
                  reference: str(raw.reference),
                  title: str(raw.title),
                  dueAt: str(raw.dueAt),
                  estimatedMin: raw.estimatedMin ?? 0,
                  status: (raw.status ?? 'ASSIGNED') as TaskStatus,
                  assignedBy: str(raw.assignedBy),
                  assignedAt: str(raw.assignedAt),
                  startedAt: str(raw.startedAt),
                  doneAt: str(raw.doneAt),
                },
              ]
            : [],
        ),
      providesTags: [TASKS_TAG],
    }),
    // The assignee or a manager; cancelling is for managers. 409 invalid_task_transition
    updateTaskStatus: build.mutation<void, { id: string; status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED' }>({
      query: ({ id, status }) => ({ url: `/staff/tasks/${encodeURIComponent(id)}`, method: 'PATCH', body: { status } }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
    // Best candidates first: on duty, then the skill, then least loaded (managers)
    recommendStaff: build.query<Candidate[], { skill?: string; branch?: string }>({
      query: (params) => ({ url: '/staff/recommend', params }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawCandidate[]).flatMap((raw) =>
          raw?.user?.uuid
            ? [
                {
                  id: raw.user.uuid,
                  name: str(raw.user.name),
                  skillLevel: str(raw.skillLevel),
                  load: raw.load ?? 0,
                  onDuty: !!raw.onDuty,
                  reason: str(raw.reason),
                },
              ]
            : [],
        ),
      providesTags: [TASKS_TAG, ATTENDANCE_TAG],
    }),

    // The person themselves or a manager
    listTraining: build.query<TrainingRecord[], string>({
      query: (user) => `/staff/${encodeURIComponent(user)}/training`,
      transformResponse: (response: ApiResponse<unknown>) =>
        (listOf(response.content) as RawTraining[]).flatMap((raw) =>
          raw?.uuid ? [{ id: raw.uuid, course: str(raw.course), completedAt: str(raw.completedAt), dueAt: str(raw.dueAt) }] : [],
        ),
      providesTags: [TRAINING_TAG],
    }),
    addTraining: build.mutation<void, { user: string; course: string; dueAt?: string; completedAt?: string }>({
      query: ({ user, ...body }) => ({ url: `/staff/${encodeURIComponent(user)}/training`, method: 'POST', body }),
      transformResponse: () => undefined,
      // The done / total figures in the staff list come from here
      invalidatesTags: [TRAINING_TAG, USERS],
    }),
    updateTraining: build.mutation<void, { id: string; course?: string; dueAt?: string; completedAt?: string }>({
      query: ({ id, ...body }) => ({ url: `/staff/training/${encodeURIComponent(id)}`, method: 'PATCH', body }),
      transformResponse: () => undefined,
      invalidatesTags: [TRAINING_TAG, USERS],
    }),

    createShift: build.mutation<void, ShiftBody>({
      query: (body) => ({ url: '/staff/shifts', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
    // Tells the person it was cancelled
    cancelShift: build.mutation<void, string>({
      query: (id) => ({ url: `/staff/shifts/${encodeURIComponent(id)}/cancel`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
    // Withdraws a pending request: the person or whoever requested it
    cancelLeave: build.mutation<void, string>({
      query: (id) => ({ url: `/staff/leave/${encodeURIComponent(id)}/cancel`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: DAY_CHANGED,
    }),
  }),
})

export const {
  useListAttendanceQuery,
  useListStaffTasksQuery,
  useUpdateTaskStatusMutation,
  useRecommendStaffQuery,
  useListTrainingQuery,
  useAddTrainingMutation,
  useUpdateTrainingMutation,
  useCreateShiftMutation,
  useCancelShiftMutation,
  useCancelLeaveMutation,
} = staffTeamApi
