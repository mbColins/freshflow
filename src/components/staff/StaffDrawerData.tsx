import { useState } from 'react'
import { Check, Play, X } from 'lucide-react'
import { TASK_TYPES } from '../../constants/staff'
import {
  useAddTrainingMutation,
  useListAttendanceQuery,
  useListStaffTasksQuery,
  useListTrainingQuery,
  useUpdateTaskStatusMutation,
  useUpdateTrainingMutation,
} from '../../services/staffTeamApi'
import type { StaffTask, TaskStatus } from '../../services/staffTeamApi'
import { describeError } from '../../utils/apiReasons'
import { formatDate } from '../../utils/customers'
import { fieldClass, iconButton, secondaryButton, sectionTitle } from '../orders/styles'
import Badge from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'

// The drawer's lists, read from the server for one person

const smallButton = `${secondaryButton} h-7 px-2.5 text-[11px]`
const empty = 'rounded-lg bg-field px-3 py-4 text-center text-xs text-muted'

const TASK_LABELS: Record<string, string> = Object.fromEntries(TASK_TYPES.map(({ code, label }) => [code, label]))

const TASK_TONES: Record<TaskStatus, BadgeTone> = {
  ASSIGNED: 'neutral',
  IN_PROGRESS: 'brand',
  DONE: 'success',
  CANCELLED: 'neutral',
  OVERDUE: 'danger',
}

const title = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const ATTENDANCE_TONES: Record<string, BadgeTone> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  ON_LEAVE: 'brand',
}

const time = (iso: string) => (iso ? iso.slice(11, 16) : '')

function Loading({ children }: { children: string }) {
  return <p className={empty}>{children}</p>
}

// Today's and recent tasks. The assignee or a manager starts and finishes
// them; cancelling is for managers
export function TasksSection({ userId, canManage }: { userId: string; canManage: boolean }) {
  const tasks = useListStaffTasksQuery({ user: userId })
  const [updateStatus] = useUpdateTaskStatusMutation()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function change(task: StaffTask, status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED') {
    setBusyId(task.id)
    setError(null)
    try {
      await updateStatus({ id: task.id, status }).unwrap()
    } catch (failure) {
      setError(describeError(failure, 'The task wasn’t updated.'))
    } finally {
      setBusyId(null)
    }
  }

  const list = tasks.data ?? []
  const open = (task: StaffTask) => task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS' || task.status === 'OVERDUE'

  return (
    <section>
      <h3 className={sectionTitle}>Tasks</h3>
      <div className="mt-2">
        {tasks.isLoading ? (
          <Loading>Loading tasks…</Loading>
        ) : tasks.isError && !tasks.data ? (
          <p className={empty}>{describeError(tasks.error, 'Couldn’t load the tasks.')}</p>
        ) : list.length === 0 ? (
          <p className={empty}>No tasks assigned.</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((task) => (
              <li key={task.id} className="rounded-lg bg-field p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 font-semibold text-ink">
                    {task.title || TASK_LABELS[task.type] || title(task.type)}
                    {task.reference && <span className="font-normal text-muted"> · {task.reference}</span>}
                  </p>
                  <Badge tone={TASK_TONES[task.status]}>{title(task.status)}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {task.dueAt ? `Due ${formatDate(task.dueAt)} ${time(task.dueAt)}` : 'No due time'}
                  {task.estimatedMin > 0 && ` · about ${task.estimatedMin} min`}
                  {task.assignedBy && ` · by ${task.assignedBy}`}
                </p>
                {open(task) && (
                  <div className="mt-2 flex gap-1.5">
                    {task.status !== 'IN_PROGRESS' && (
                      <button type="button" disabled={busyId === task.id} onClick={() => void change(task, 'IN_PROGRESS')} className={smallButton}>
                        <Play className="size-3" aria-hidden="true" />
                        Start
                      </button>
                    )}
                    <button type="button" disabled={busyId === task.id} onClick={() => void change(task, 'DONE')} className={`${smallButton} font-bold`}>
                      <Check className="size-3" aria-hidden="true" />
                      Done
                    </button>
                    {canManage && (
                      <button type="button" disabled={busyId === task.id} onClick={() => void change(task, 'CANCELLED')} className={`${smallButton} text-danger`}>
                        <X className="size-3" aria-hidden="true" />
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

// The last 30 days, newest first
export function AttendanceHistorySection({ userId }: { userId: string }) {
  const history = useListAttendanceQuery({ user: userId })
  const days = history.data ?? []

  return (
    <section>
      <h3 className={sectionTitle}>Attendance, last 30 days</h3>
      <div className="mt-2">
        {history.isLoading ? (
          <Loading>Loading attendance…</Loading>
        ) : history.isError && !history.data ? (
          <p className={empty}>{describeError(history.error, 'Couldn’t load the attendance.')}</p>
        ) : days.length === 0 ? (
          <p className={empty}>No attendance recorded.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {days.map((day) => (
              <li key={day.id} className="flex items-center justify-between gap-2 rounded-md bg-field px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{formatDate(day.date)}</span>
                  <span className="block text-[11px] text-muted">
                    {day.clockIn ? `${day.clockIn} – ${day.clockOut || 'now'}` : day.absenceReason || 'Not clocked in'}
                    {day.lateMinutes > 0 && ` · ${day.lateMinutes} min late`}
                    {day.breakMinutes > 0 && ` · ${day.breakMinutes} min break`}
                  </span>
                </span>
                <Badge tone={ATTENDANCE_TONES[day.status] ?? 'neutral'}>{title(day.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

// Courses and when they were finished. Managers add courses and tick them off
export function TrainingSection({ userId, canManage }: { userId: string; canManage: boolean }) {
  const training = useListTrainingQuery(userId)
  const [addTraining, adding] = useAddTrainingMutation()
  const [updateTraining] = useUpdateTrainingMutation()
  const [course, setCourse] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const list = training.data ?? []
  const done = list.filter(({ completedAt }) => completedAt).length

  async function handleAdd() {
    setError(null)
    try {
      await addTraining({ user: userId, course: course.trim(), ...(dueAt ? { dueAt } : {}) }).unwrap()
      setCourse('')
      setDueAt('')
    } catch (failure) {
      setError(describeError(failure, 'The course wasn’t added.'))
    }
  }

  async function handleComplete(id: string) {
    setError(null)
    try {
      await updateTraining({ id, completedAt: today() }).unwrap()
    } catch (failure) {
      setError(describeError(failure, 'The course wasn’t updated.'))
    }
  }

  return (
    <section>
      <h3 className={sectionTitle}>
        Training{list.length > 0 && <span className="font-normal text-muted"> · {done} of {list.length} done</span>}
      </h3>
      <div className="mt-2 space-y-2">
        {training.isLoading ? (
          <Loading>Loading training…</Loading>
        ) : training.isError && !training.data ? (
          <p className={empty}>{describeError(training.error, 'Couldn’t load the training.')}</p>
        ) : list.length === 0 ? (
          <p className={empty}>No training on record.</p>
        ) : (
          <ul className="space-y-1">
            {list.map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-2 rounded-md bg-field px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{record.course}</span>
                  <span className="block text-[11px] text-muted">
                    {record.completedAt
                      ? `Completed ${formatDate(record.completedAt)}`
                      : record.dueAt
                        ? `Due ${formatDate(record.dueAt)}`
                        : 'Not completed'}
                  </span>
                </span>
                {record.completedAt ? (
                  <Badge tone="success">Done</Badge>
                ) : (
                  canManage && (
                    <button type="button" onClick={() => void handleComplete(record.id)} className={smallButton}>
                      Mark done
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <input
              aria-label="Course"
              placeholder="Course name"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              className={fieldClass}
            />
            <input
              aria-label="Due date"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={fieldClass}
            />
            <button type="button" disabled={!course.trim() || adding.isLoading} onClick={() => void handleAdd()} className={`${iconButton} w-auto px-3 text-xs font-semibold`}>
              Add
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
