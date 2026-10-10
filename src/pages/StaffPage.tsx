import { useEffect, useRef, useState } from 'react'
import { CalendarClock, ClipboardList, Clock, Download, UserPlus } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import {
  AssignWorkDialog,
  AttendanceDialog,
  FillShiftDialog,
  LeaveDialog,
  StaffWizard,
} from '../components/staff/StaffDialogs'
import type {
  AttendanceAction,
  LeaveInput,
  NewStaffInput,
} from '../components/staff/StaffDialogs'
import StaffDirectory from '../components/staff/StaffDirectory'
import type { StaffView } from '../components/staff/StaffDirectory'
import StaffDrawer from '../components/staff/StaffDrawer'
import {
  AttendancePanel,
  BranchStaffTable,
  DepartmentCards,
  Leaderboard,
  LeavePanel,
  ShiftRoster,
  StaffAlerts,
  StaffKpis,
  WorkforceInsights,
  WorkforceOverview,
} from '../components/staff/StaffPanels'
import { CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import { EMPTY_STAFF_FILTERS, STAFF_PERMISSIONS } from '../constants/staff'
import {
  SAMPLE_LEAVE,
  SAMPLE_OPEN_SHIFTS,
  SAMPLE_STAFF,
} from '../constants/sampleStaff'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type { OrderRole } from '../types/order'
import type { StaffFilters, StaffMember } from '../types/staff'
import { downloadFile } from '../utils/orders'
import { matchesStaffFilters, staffToCsv } from '../utils/staff'

const TOAST_MS = 4000

type DialogState =
  | { name: 'assign' | 'attendance'; staffId: string }
  | { name: 'fill'; shiftId: string }
  | { name: 'leave' | 'add' }

function StaffPage() {
  const now = useNow()
  // TODO: replace these in-memory lists with the staff API
  const [staff, setStaff] = useState(SAMPLE_STAFF)
  const [leave, setLeave] = useState(SAMPLE_LEAVE)
  const [openShifts, setOpenShifts] = useState(SAMPLE_OPEN_SHIFTS)
  const [filters, setFilters] = useState<StaffFilters>(EMPTY_STAFF_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('staff.role', 'manager')
  const [view, setView] = useLocalStorage<StaffView>('staff.view', 'table')
  const searchRef = useRef<HTMLInputElement>(null)
  const directoryRef = useRef<HTMLDivElement>(null)

  const permissions = STAFF_PERMISSIONS[role]
  const filtered = staff.filter((member) => matchesStaffFilters(member, filters, now))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openMember = staff.find(({ id }) => id === openId) ?? null
  const fillShift =
    dialog?.name === 'fill' ? openShifts.find(({ id }) => id === dialog.shiftId) : undefined

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function replaceFilters(next: StaffFilters) {
    setFilters(next)
    setSelectedIds([])
  }

  function showInDirectory(patch: Partial<StaffFilters>) {
    replaceFilters({ ...EMPTY_STAFF_FILTERS, ...patch })
    directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Changes staff records and stamps what happened on their activity timeline
  function updateStaff(
    ids: string[],
    change: (member: StaffMember) => StaffMember,
    event: string,
  ) {
    const at = new Date().toISOString()
    setStaff((current) =>
      current.map((member) =>
        ids.includes(member.id)
          ? { ...change(member), activity: [{ at, text: event }, ...member.activity] }
          : member,
      ),
    )
  }

  function handleAssign(staffId: string, task: string, reference: string) {
    const member = staff.find(({ id }) => id === staffId)!
    const assignment = reference ? `${task} · ${reference}` : task
    updateStaff(
      [staffId],
      (current) => ({
        ...current,
        status: 'working',
        assignment,
        assignmentRef: reference,
        tasksAssigned: current.tasksAssigned + 1,
      }),
      `Assigned by ${CURRENT_USER}: ${assignment}`,
    )
    setDialog(null)
    setToast(`${member.name} assigned: ${task}`)
  }

  function handleAttendance(staffId: string, action: AttendanceAction, time: string) {
    const member = staff.find(({ id }) => id === staffId)!
    updateStaff(
      [staffId],
      (current) => {
        switch (action) {
          case 'Clock in':
            return { ...current, clockIn: time, status: 'available' }
          case 'Clock out':
            return { ...current, status: 'offline', assignment: '', assignmentRef: '' }
          case 'Start break':
            return { ...current, status: 'break' }
          case 'End break':
            return {
              ...current,
              status: current.assignment ? 'working' : 'available',
              breakMinutes: current.breakMinutes + 15,
            }
          case 'Mark absent':
            return { ...current, status: 'absent', clockIn: '', assignment: '', assignmentRef: '' }
        }
      },
      action === 'Mark absent'
        ? `Marked absent by ${CURRENT_USER}`
        : `${action} at ${time} (recorded by ${CURRENT_USER})`,
    )
    setDialog(null)
    setToast(`${member.name}: ${action.toLowerCase()} recorded`)
  }

  function handleFillShift(shiftId: string, staffId: string) {
    const shift = openShifts.find(({ id }) => id === shiftId)!
    const member = staff.find(({ id }) => id === staffId)!
    updateStaff(
      [staffId],
      (current) => ({
        ...current,
        shiftStart:
          current.shiftStart && current.shiftStart < shift.start
            ? current.shiftStart
            : shift.start,
        shiftEnd: current.shiftEnd > shift.end ? current.shiftEnd : shift.end,
      }),
      `Scheduled for ${shift.title} (${shift.start}–${shift.end})`,
    )
    setOpenShifts(openShifts.filter(({ id }) => id !== shiftId))
    setDialog(null)
    setToast(`${member.name} scheduled for ${shift.title}`)
  }

  function handleLeave(input: LeaveInput) {
    setLeave([
      {
        id: `LV-0${31 + leave.length}`,
        ...input,
        status: 'Pending',
        approver: '',
      },
      ...leave,
    ])
    setDialog(null)
    setToast('Leave request submitted for approval')
  }

  function handleLeaveDecision(id: string, approve: boolean) {
    setLeave(
      leave.map((request) =>
        request.id === id
          ? {
              ...request,
              status: approve ? 'Approved' : 'Rejected',
              approver: CURRENT_USER,
            }
          : request,
      ),
    )
    setToast(approve ? 'Leave approved' : 'Leave rejected')
  }

  function handleCreate(input: NewStaffInput) {
    const number =
      Math.max(...staff.map(({ id }) => Number(id.replace(/\D/g, '')))) + 1
    const at = new Date().toISOString()
    const name = `${input.firstName} ${input.lastName}`.trim()
    const member: StaffMember = {
      id: `EMP-${String(number).padStart(4, '0')}`,
      name,
      jobTitle: input.jobTitle.trim(),
      department: input.department,
      branch: input.branch,
      phone: input.phone.trim(),
      email: input.email.trim(),
      employment: input.employment,
      hiredAt: at,
      manager: CURRENT_USER,
      template: input.template,
      status: 'offline',
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      workingDays: input.workingDays,
      clockIn: '',
      breakMinutes: 0,
      assignment: '',
      assignmentRef: '',
      tasksAssigned: 0,
      tasksDone: 0,
      tasksOverdue: 0,
      capacity: 12,
      attendanceRate: 100,
      lateThisMonth: 0,
      score: 0,
      onTime: 0,
      quality: 0,
      rating: 0,
      skills: input.skills,
      certification: null,
      trainingDone: 0,
      trainingTotal: 10,
      emergencyContact: input.emergencyContact.trim() || 'Not provided',
      monthlySalary: 0,
      leaveBalance: 0,
      twoFactor: input.twoFactor,
      loginAccess: input.loginAccess,
      lastLoginAt: at,
      activity: [{ at, text: `Profile created by ${CURRENT_USER}` }],
    }
    setStaff([member, ...staff])
    setDialog(null)
    setToast(`${name} added as ${member.id}`)
  }

  function requestSuspend(ids: string[]) {
    setConfirm({
      title: ids.length === 1 ? 'Disable this account?' : `Suspend ${ids.length} staff?`,
      body: 'Suspended staff lose system access and cannot be given new work until an administrator re-enables them. Their history is kept.',
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: () => {
        updateStaff(
          ids,
          (member) => ({ ...member, status: 'suspended', assignment: '', assignmentRef: '' }),
          `Account suspended by ${CURRENT_USER}`,
        )
        setSelectedIds([])
        setToast(`${ids.length} ${ids.length === 1 ? 'account' : 'accounts'} suspended`)
      },
    })
  }

  function handleToggleSuspended(id: string) {
    const member = staff.find((item) => item.id === id)!
    if (member.status !== 'suspended') {
      requestSuspend([id])
      return
    }
    updateStaff([id], (current) => ({ ...current, status: 'offline' }), `Account re-enabled by ${CURRENT_USER}`)
    setToast(`${member.name}’s account re-enabled`)
  }

  const exportStaff = (list: StaffMember[]) => {
    downloadFile('staff.csv', staffToCsv(list, permissions.performance), 'text/csv;charset=utf-8')
    setToast(`Exported ${list.length} staff`)
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Staff</h1>
            <p className="text-xs text-muted">
              Manage employees, schedules, attendance, workload, roles, and performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => exportStaff(filtered)} className={secondaryButton}>
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {permissions.manage && (
              <>
                <button
                  type="button"
                  disabled={openShifts.length === 0}
                  onClick={() => setDialog({ name: 'fill', shiftId: openShifts[0].id })}
                  className={secondaryButton}
                >
                  <CalendarClock className="size-4 text-muted" aria-hidden="true" />
                  Schedule Staff
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'attendance', staffId: '' })}
                  className={secondaryButton}
                >
                  <Clock className="size-4 text-muted" aria-hidden="true" />
                  Record Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'assign', staffId: '' })}
                  className={secondaryButton}
                >
                  <ClipboardList className="size-4 text-muted" aria-hidden="true" />
                  Assign Work
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'add' })}
                  className={`${primaryButton} max-md:hidden`}
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  Add Staff
                </button>
              </>
            )}
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as OrderRole)
              setSelectedIds([])
            }}
            className={`${fieldClass} h-8 w-auto!`}
          >
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <StaffKpis
        staff={staff}
        openShifts={openShifts}
        filters={filters}
        onSelect={(patch) => showInDirectory(patch)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <WorkforceOverview
            staff={staff}
            selected={filters.status}
            onSelect={(status) => showInDirectory({ status })}
          />
          {permissions.manage && (
            <WorkforceInsights
              staff={staff}
              openShifts={openShifts}
              onAssignWork={() => setDialog({ name: 'assign', staffId: '' })}
              onFillShift={(shiftId) => setDialog({ name: 'fill', shiftId })}
            />
          )}
        </div>
        <StaffAlerts staff={staff} now={now} onOpen={setOpenId} />
      </div>

      <DepartmentCards
        staff={staff}
        selected={filters.department}
        onSelect={(department) => replaceFilters({ ...filters, department })}
      />

      <div ref={directoryRef} className="scroll-mt-20">
        <StaffDirectory
          searchRef={searchRef}
          staff={filtered}
          totalCount={staff.length}
          filters={filters}
          filtersActive={filtersActive}
          onChange={(patch) => replaceFilters({ ...filters, ...patch })}
          onReset={() => replaceFilters(EMPTY_STAFF_FILTERS)}
          view={view}
          onViewChange={setView}
          permissions={permissions}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds(
              selectedIds.includes(id)
                ? selectedIds.filter((current) => current !== id)
                : [...selectedIds, id],
            )
          }
          onToggleAll={(checked) =>
            setSelectedIds(checked ? filtered.map(({ id }) => id) : [])
          }
          onClearSelection={() => setSelectedIds([])}
          onOpen={setOpenId}
          onAssign={(staffId) => setDialog({ name: 'assign', staffId })}
          onSuspend={requestSuspend}
          onMessage={(count) =>
            setToast(`Message to ${count} staff prepared. Sending isn’t connected yet.`)
          }
          onExport={exportStaff}
        />
      </div>

      <ShiftRoster
        staff={staff}
        openShifts={openShifts}
        now={now}
        canManage={permissions.manage}
        onOpen={setOpenId}
        onFillShift={(shiftId) => setDialog({ name: 'fill', shiftId })}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AttendancePanel staff={staff} now={now} />
        </div>
        <LeavePanel
          requests={leave}
          staff={staff}
          canManage={permissions.manage}
          onDecide={handleLeaveDecision}
          onRequest={() => setDialog({ name: 'leave' })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {permissions.performance && <Leaderboard staff={staff} onOpen={setOpenId} />}
        <BranchStaffTable staff={staff} onSelect={(branch) => showInDirectory({ branch })} />
      </div>

      {permissions.manage && (
        <button
          type="button"
          onClick={() => setDialog({ name: 'add' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Add Staff
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      <StaffDrawer
        member={openMember}
        now={now}
        permissions={permissions}
        onClose={() => setOpenId(null)}
        onAssign={(staffId) => setDialog({ name: 'assign', staffId })}
        onAttendance={(staffId) => setDialog({ name: 'attendance', staffId })}
        onToggleSuspended={handleToggleSuspended}
      />
      {dialog?.name === 'assign' && (
        <AssignWorkDialog
          staff={staff}
          initialStaffId={dialog.staffId}
          onClose={() => setDialog(null)}
          onAssign={handleAssign}
        />
      )}
      {dialog?.name === 'attendance' && (
        <AttendanceDialog
          staff={staff}
          initialStaffId={dialog.staffId}
          onClose={() => setDialog(null)}
          onSubmit={handleAttendance}
        />
      )}
      {fillShift && (
        <FillShiftDialog
          shift={fillShift}
          staff={staff}
          onClose={() => setDialog(null)}
          onFill={handleFillShift}
        />
      )}
      {dialog?.name === 'leave' && (
        <LeaveDialog staff={staff} onClose={() => setDialog(null)} onSubmit={handleLeave} />
      )}
      {dialog?.name === 'add' && (
        <StaffWizard onClose={() => setDialog(null)} onCreate={handleCreate} />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default StaffPage
