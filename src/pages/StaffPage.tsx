import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ClipboardList, Clock, Download, RotateCcw, UserPlus } from 'lucide-react'
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
import {
  DEPARTMENT_CODES,
  EMPLOYMENT_CODES,
  EMPTY_STAFF_FILTERS,
  SKILL_CODES,
  SKILL_LEVEL_CODES,
  STAFF_PERMISSIONS,
} from '../constants/staff'
import useCurrentUser from '../hooks/useCurrentUser'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useListTenantUsersQuery,
  useListUsersQuery,
  useUpdateUserMutation,
} from '../services/userApi'
import type { OrderRole } from '../types/order'
import type { LeaveRequest, OpenShift, StaffFilters, StaffMember } from '../types/staff'
import { NETWORK_ERROR_MESSAGE, saveFailureMessage, serverMessage } from '../utils/apiErrors'
import { downloadFile } from '../utils/orders'
import { matchesStaffFilters, memberFromUser, staffToCsv } from '../utils/staff'

const TOAST_MS = 4000
// Platform admins (no tenant) read GET /users; one page is enough for now
// TODO: page through the list once there are more users than this
const ALL_USERS = { page: 0, size: 100 }

type DialogState =
  | { name: 'assign' | 'attendance'; staffId: string }
  | { name: 'fill'; shiftId: string }
  | { name: 'leave' | 'add' }

function StaffPage() {
  const now = useNow()
  const me = useCurrentUser()
  // Who actions are stamped with
  const actor = me.name || CURRENT_USER
  // A tenant's staff come from GET /users/tenant. GET /users isn't limited to
  // one tenant, so it's only used for a platform admin, who has no tenant.
  const hasTenant = Boolean(me.user?.tenant)
  const tenantUsers = useListTenantUsersQuery(undefined, { skip: !me.user || !hasTenant })
  const allUsers = useListUsersQuery(ALL_USERS, { skip: !me.user || hasTenant })
  const source = hasTenant ? tenantUsers : allUsers
  const users = hasTenant ? tenantUsers.data : allUsers.data?.items
  const loadingStaff = me.isLoading || source.isLoading
  const loadFailed = me.isError || source.isError
  // Employment details come from the server. The API has no attendance, tasks
  // or leave yet, so what's recorded for those is kept for this session only,
  // laid over the server's users by uuid
  // TODO: replace with the staff endpoints once the backend has them
  const [overlay, setOverlay] = useState<Record<string, StaffMember>>({})
  const staff = useMemo(
    () =>
      (users ?? []).map((user): StaffMember => {
        const fromApi = memberFromUser(user)
        const local = overlay[user.uuid] ?? fromApi
        return {
          ...local,
          // The server owns the account details
          id: fromApi.id,
          username: fromApi.username,
          name: fromApi.name,
          phone: fromApi.phone,
          email: fromApi.email,
          hiredAt: fromApi.hiredAt,
          lastLoginAt: fromApi.lastLoginAt,
          // The server owns suspension too
          status: fromApi.status === 'suspended' ? 'suspended' : local.status === 'suspended' ? 'offline' : local.status,
        }
      }),
    [users, overlay],
  )
  const [leave, setLeave] = useState<LeaveRequest[]>([])
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [createUser, { error: createError, isLoading: creating, reset: resetCreate }] = useCreateUserMutation()
  const [deleteUser] = useDeleteUserMutation()
  const [updateUser] = useUpdateUserMutation()
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
    const changed = staff.filter((member) => ids.includes(member.id))
    setOverlay((current) => {
      const next = { ...current }
      for (const member of changed) {
        next[member.id] = { ...change(member), activity: [{ at, text: event }, ...member.activity] }
      }
      return next
    })
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
      `Assigned by ${actor}: ${assignment}`,
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
        ? `Marked absent by ${actor}`
        : `${action} at ${time} (recorded by ${actor})`,
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
              approver: actor,
            }
          : request,
      ),
    )
    setToast(approve ? 'Leave approved' : 'Leave rejected')
  }

  // POST /users creates the account, with its employment details, and emails
  // the generated password when login is allowed
  async function handleCreate(input: NewStaffInput) {
    const username = input.username.trim().toLowerCase()
    const name = `${input.firstName} ${input.lastName}`.trim()
    const amount = (value: string) => (value.trim() === '' ? undefined : Number(value))
    const certification = input.certificationName.trim()
    try {
      await createUser({
        username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        city: input.city.trim(),
        neighborhood: input.neighborhood.trim(),
        phoneNumber: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        userType: input.userType,
        ...(input.branchUuid ? { branch: input.branchUuid } : {}),
        ...(input.roleId !== null ? { role: input.roleId } : {}),
        ...(input.emergencyContact.trim() ? { emergencyContact: input.emergencyContact.trim() } : {}),
        jobTitle: input.jobTitle.trim(),
        department: DEPARTMENT_CODES[input.department],
        employmentType: EMPLOYMENT_CODES[input.employment],
        ...(input.hiredAt ? { hiredAt: input.hiredAt } : {}),
        ...(input.managerId ? { managerId: input.managerId } : {}),
        loginAccess: input.loginAccess,
        twoFactorRequired: input.twoFactor,
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
        workingDays: input.workingDays,
        skills: input.skills.flatMap(({ name: skill, level }) =>
          SKILL_CODES[skill] ? [{ skill: SKILL_CODES[skill], level: SKILL_LEVEL_CODES[level] }] : [],
        ),
        ...(amount(input.monthlySalary) !== undefined ? { monthlySalary: amount(input.monthlySalary) } : {}),
        ...(amount(input.leaveBalance) !== undefined ? { leaveBalance: amount(input.leaveBalance) } : {}),
        ...(certification
          ? { certification: { name: certification, expiresAt: input.certificationExpiresAt || null } }
          : {}),
        accountStatus: 'ACTIVE',
      }).unwrap()
    } catch {
      // `createError` drives the message in the wizard
      return
    }
    setDialog(null)
    setToast(
      input.loginAccess
        ? `${name} added. Their sign-in details were emailed to ${input.email.trim()}.`
        : `${name} added without login access.`,
    )
  }

  function handleDelete(id: string) {
    const member = staff.find((item) => item.id === id)!
    setConfirm({
      title: `Delete ${member.name}’s account?`,
      body: 'The user is removed from the server and can no longer sign in. This can’t be undone; to keep their history, disable the account instead.',
      confirmLabel: 'Delete Account',
      destructive: true,
      onConfirm: () => {
        deleteUser(id)
          .unwrap()
          .then(() => {
            setOpenId(null)
            setToast(`${member.name}’s account deleted`)
          })
          .catch((error: unknown) => setToast(saveFailureMessage(error, `${member.name}’s account wasn’t deleted.`)))
      },
    })
  }

  function requestSuspend(ids: string[]) {
    setConfirm({
      title: ids.length === 1 ? 'Disable this account?' : `Suspend ${ids.length} staff?`,
      body: 'Suspended staff lose system access and cannot be given new work until an administrator re-enables them. Their history is kept.',
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: async () => {
        const results = await Promise.allSettled(
          ids.map((id) =>
            updateUser({ uuid: id, changes: { accountStatus: 'SUSPENDED', statusReason: `Suspended by ${actor}` } }).unwrap(),
          ),
        )
        const saved = ids.filter((_, index) => results[index].status === 'fulfilled')
        updateStaff(
          saved,
          (member) => ({ ...member, status: 'suspended', assignment: '', assignmentRef: '' }),
          `Account suspended by ${actor}`,
        )
        setSelectedIds([])
        const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
        setToast(
          failed
            ? `${saved.length} of ${ids.length} suspended. ${saveFailureMessage(failed.reason, 'The server refused the rest.')}`
            : `${ids.length} ${ids.length === 1 ? 'account' : 'accounts'} suspended`,
        )
      },
    })
  }

  function handleToggleSuspended(id: string) {
    const member = staff.find((item) => item.id === id)!
    if (member.status !== 'suspended') {
      requestSuspend([id])
      return
    }
    updateUser({ uuid: id, changes: { accountStatus: 'ACTIVE' } })
      .unwrap()
      .then(() => {
        updateStaff([id], (current) => ({ ...current, status: 'offline' }), `Account re-enabled by ${actor}`)
        setToast(`${member.name}’s account re-enabled`)
      })
      .catch((error: unknown) => setToast(saveFailureMessage(error, `${member.name}’s account wasn’t re-enabled.`)))
  }

  const exportStaff = (list: StaffMember[]) => {
    downloadFile('staff.csv', staffToCsv(list, permissions.performance), 'text/csv;charset=utf-8')
    setToast(`Exported ${list.length} staff`)
  }

  if (loadingStaff || loadFailed) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-ink">Staff</h1>
        {loadingStaff ? (
          <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line" aria-busy="true">
            <p className="sr-only" role="status">Loading staff…</p>
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-14 animate-pulse rounded-md bg-field" />
            ))}
          </div>
        ) : (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
            <h2 className="text-sm font-bold text-ink">Couldn’t load the staff</h2>
            <p className="max-w-md text-xs text-muted">
              {serverMessage(source.error) ?? NETWORK_ERROR_MESSAGE}
            </p>
            <button
              type="button"
              onClick={() => void source.refetch()}
              disabled={source.isFetching}
              className={`${secondaryButton} mt-2`}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {source.isFetching ? 'Retrying…' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
    )
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
        onDelete={handleDelete}
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
        <StaffWizard
          saving={creating}
          managers={(users ?? [])
            .filter((user) => user.active && user.staff.accountStatus !== 'SUSPENDED')
            .map((user) => ({ id: user.uuid, name: `${user.firstName} ${user.lastName}`.trim() || user.username }))
            .sort((a, b) => a.name.localeCompare(b.name))}
          error={createError ? saveFailureMessage(createError, 'The staff member wasn’t created.', 'The username or email is already in use.') : null}
          onClose={() => {
            resetCreate()
            setDialog(null)
          }}
          onCreate={(input) => void handleCreate(input)}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default StaffPage
