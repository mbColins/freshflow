import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ClipboardList, Clock, Download, RotateCcw, UserPlus } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
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
import {
  ATTENDANCE_CODES,
  DEPARTMENT_CODES,
  EMPLOYMENT_CODES,
  EMPTY_STAFF_FILTERS,
  LEAVE_CODES,
  SKILL_CODES,
  SKILL_LEVEL_CODES,
  TASK_TYPES,
} from '../constants/staff'
import type { StaffPermissions } from '../constants/staff'
import useCurrentUser from '../hooks/useCurrentUser'
import useLocalStorage from '../hooks/useLocalStorage'
import {
  useAssignTaskMutation,
  useDecideLeaveMutation,
  useFillShiftMutation,
  useListLeaveQuery,
  useListOpenShiftsQuery,
  useRecordAttendanceMutation,
  useRequestLeaveMutation,
} from '../services/staffOpsApi'
import { describeError } from '../utils/apiReasons'
import useNow from '../hooks/useNow'
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useListTenantUsersQuery,
  useListUsersQuery,
  useUpdateUserMutation,
} from '../services/userApi'
import type { StaffFilters, StaffMember } from '../types/staff'
import { NETWORK_ERROR_MESSAGE, saveFailureMessage, serverMessage } from '../utils/apiErrors'
import { downloadFile } from '../utils/orders'
import { matchesStaffFilters, memberFromUser, staffToCsv } from '../utils/staff'

const TOAST_MS = 4000
// Platform admins (no tenant) read GET /users; one page is enough for now
// TODO: page through the list once there are more users than this
const ALL_USERS = { page: 0, size: 100, include: 'daily' as const }

type DialogState =
  | { name: 'assign' | 'attendance'; staffId: string }
  | { name: 'fill'; shiftId: string }
  | { name: 'leave' | 'add' }

function StaffPage() {
  const now = useNow()
  const me = useCurrentUser()
  // Who actions are stamped with
  const actor = me.name || 'You'
  // A tenant's staff come from GET /users/tenant. GET /users isn't limited to
  // one tenant, so it's only used for a platform admin, who has no tenant.
  const hasTenant = Boolean(me.user?.tenant)
  const tenantUsers = useListTenantUsersQuery({ daily: true }, { skip: !me.user || !hasTenant })
  const allUsers = useListUsersQuery(ALL_USERS, { skip: !me.user || hasTenant })
  const source = hasTenant ? tenantUsers : allUsers
  const users = hasTenant ? tenantUsers.data : allUsers.data?.items
  const loadingStaff = me.isLoading || source.isLoading
  const loadFailed = me.isError || source.isError
  // Everything about a person comes from the server: their account, and today's
  // state, workload and performance (include=daily)
  const staff = useMemo(() => (users ?? []).map(memberFromUser), [users])
  const { data: openShifts = [] } = useListOpenShiftsQuery()
  const { data: leave = [] } = useListLeaveQuery()
  const [recordAttendance] = useRecordAttendanceMutation()
  const [assignTask] = useAssignTaskMutation()
  const [fillShift] = useFillShiftMutation()
  const [requestLeave] = useRequestLeaveMutation()
  const [decideLeave] = useDecideLeaveMutation()
  const [createUser, { error: createError, isLoading: creating, reset: resetCreate }] = useCreateUserMutation()
  const [deleteUser] = useDeleteUserMutation()
  const [updateUser] = useUpdateUserMutation()
  const [filters, setFilters] = useState<StaffFilters>(EMPTY_STAFF_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useLocalStorage<StaffView>('staff.view', 'table')
  const searchRef = useRef<HTMLInputElement>(null)
  const directoryRef = useRef<HTMLDivElement>(null)

  // From the role's permissions; everything is allowed until the profile says otherwise
  const permissions: StaffPermissions = {
    manage: me.can('STAFF:EDIT') || me.can('STAFF:CREATE'),
    performance: me.can('STAFF:PERFORMANCE'),
    payroll: me.user?.userType === 'TENANT' || me.isPlatformAdmin,
  }
  const filtered = staff.filter((member) => matchesStaffFilters(member, filters, now))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openMember = staff.find(({ id }) => id === openId) ?? null
  const shiftToFill =
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

  const fail = (error: unknown, fallback: string) => setToast(describeError(error, fallback))

  // Assigning work: the server checks the person is on duty, not on leave, and
  // within their daily capacity. A manager can go past capacity on purpose
  async function handleAssign(staffId: string, task: string, reference: string) {
    const member = staff.find(({ id }) => id === staffId)
    const type = TASK_TYPES.find(({ label }) => label === task)?.code
    if (!member || !type) return
    const send = (force: boolean) => assignTask({ user: staffId, type, ...(reference ? { reference } : {}), ...(force ? { force: true } : {}) }).unwrap()
    try {
      let warnings: string[]
      try {
        warnings = await send(false)
      } catch (error) {
        if (!permissions.manage || !describeError(error, '').includes('full day')) throw error
        if (!window.confirm(`${member.name} already has a full day of work. Assign it anyway?`)) return
        warnings = await send(true)
      }
      setDialog(null)
      setToast(
        `${member.name} assigned: ${task}${warnings.includes('skill_missing') ? '. They don’t have the skill listed for this work' : ''}`,
      )
    } catch (error) {
      fail(error, `${member.name} wasn’t assigned the work.`)
    }
  }

  async function handleAttendance(staffId: string, action: AttendanceAction, time: string) {
    const member = staff.find(({ id }) => id === staffId)
    if (!member) return
    let reason: string | undefined
    if (action === 'Mark absent') {
      reason = window.prompt(`Why is ${member.name} absent?`)?.trim()
      if (!reason) {
        setToast('A reason is needed to mark someone absent.')
        return
      }
    }
    try {
      await recordAttendance({
        user: staffId,
        action: ATTENDANCE_CODES[action],
        // Only a manager may set the time by hand
        ...(permissions.manage && time ? { time } : {}),
        ...(reason ? { reason } : {}),
      }).unwrap()
      setDialog(null)
      setToast(`${member.name}: ${action.toLowerCase()} recorded`)
    } catch (error) {
      fail(error, `${member.name}’s attendance wasn’t recorded.`)
    }
  }

  async function handleFillShift(shiftId: string, staffId: string) {
    const shift = openShifts.find(({ id }) => id === shiftId)
    const member = staff.find(({ id }) => id === staffId)
    if (!shift || !member) return
    try {
      await fillShift({ shift: shiftId, user: staffId }).unwrap()
      setDialog(null)
      setToast(`${member.name} scheduled for ${shift.title}`)
    } catch (error) {
      fail(error, `${member.name} wasn’t scheduled.`)
    }
  }

  async function handleLeave(input: LeaveInput) {
    try {
      await requestLeave({
        user: input.staffId,
        type: LEAVE_CODES[input.type] ?? 'OTHER',
        from: input.from,
        to: input.to,
        reason: input.reason,
      }).unwrap()
      setDialog(null)
      setToast('Leave request submitted for approval')
    } catch (error) {
      fail(error, 'The leave request wasn’t submitted.')
    }
  }

  async function handleLeaveDecision(id: string, approve: boolean) {
    try {
      await decideLeave({ id, approve }).unwrap()
      setToast(approve ? 'Leave approved' : 'Leave rejected')
    } catch (error) {
      fail(error, 'The decision wasn’t saved.')
    }
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
          onDecide={(id, approve) => void handleLeaveDecision(id, approve)}
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
          onAssign={(staffId, task, reference) => void handleAssign(staffId, task, reference)}
        />
      )}
      {dialog?.name === 'attendance' && (
        <AttendanceDialog
          staff={staff}
          initialStaffId={dialog.staffId}
          onClose={() => setDialog(null)}
          onSubmit={(staffId, action, time) => void handleAttendance(staffId, action, time)}
        />
      )}
      {shiftToFill && (
        <FillShiftDialog
          shift={shiftToFill}
          staff={staff}
          onClose={() => setDialog(null)}
          onFill={(shiftId, staffId) => void handleFillShift(shiftId, staffId)}
        />
      )}
      {dialog?.name === 'leave' && (
        <LeaveDialog staff={staff} onClose={() => setDialog(null)} onSubmit={(input) => void handleLeave(input)} />
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
