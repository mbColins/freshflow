import { useEffect, useState } from 'react'
import { Ellipsis, Plus, RotateCcw, Search, ShieldCheck } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import RoleDialog from '../components/staff/RoleDialog'
import RolePermissionsDialog from '../components/staff/RolePermissionsDialog'
import type { RoleEditor } from '../components/staff/RoleDialog'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import useCurrentUser from '../hooks/useCurrentUser'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useListRolesQuery,
  useUpdateRoleMutation,
} from '../services/roleApi'
import type { Role, RoleListParams, RoleRequest, RoleScope } from '../services/roleApi'
import { useGetTenantDropdownQuery } from '../services/tenantApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'

const TOAST_MS = 4000
// TODO: page through the list if a tenant ever has more roles than this
const ALL_ROLES: RoleListParams = { page: 0, size: 200 }
const NO_ROLES: Role[] = []

const SCOPES: Record<RoleScope, { label: string; tone: BadgeTone }> = {
  PLATFORM: { label: 'Platform default', tone: 'warning' },
  TENANT: { label: 'Whole business', tone: 'brand' },
  BRANCH: { label: 'Branch', tone: 'neutral' },
}

// An empty id creates a new role
type FormState = { id: string }

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

// Staff > Roles: the roles staff can be given, by where they apply
function RolesPage() {
  const { user, isPlatformAdmin } = useCurrentUser()
  // What the backend lets this user manage (see RoleService)
  const editor: RoleEditor | null = isPlatformAdmin
    ? 'admin'
    : user?.userType === 'TENANT'
      ? 'owner'
      : user?.userType === 'MANAGER' || user?.userType === 'STORE_MANAGER'
        ? 'manager'
        : null
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useListRolesQuery(ALL_ROLES)
  const roles = data?.items ?? NO_ROLES
  const { data: branches = [] } = useGetBranchDropdownQuery(undefined, { skip: editor === null || editor === 'manager' })
  const { data: tenants = [] } = useGetTenantDropdownQuery(undefined, { skip: editor !== 'admin' })
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<RoleScope | ''>('')
  const [form, setForm] = useState<FormState | null>(null)
  // The role whose permissions are open
  const [permissionsFor, setPermissionsFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createRole, { error: createError, reset: resetCreate }] = useCreateRoleMutation()
  const [updateRole, { error: updateError, reset: resetUpdate }] = useUpdateRoleMutation()
  const [deleteRole] = useDeleteRoleMutation()

  // Platform defaults are the admin's; a manager only changes their branch's roles
  const canChange = (role: Role) =>
    editor === 'admin' ||
    (editor === 'owner' && role.scope !== 'PLATFORM') ||
    (editor === 'manager' && role.scope === 'BRANCH' && Boolean(user?.branch) && role.branchName === user?.branch)

  const editing = form?.id ? roles.find(({ id }) => id === form.id) : undefined
  const saveError = form
    ? editing
      ? updateError && failure(updateError, 'The server rejected these changes. Check the fields and try again.')
      : createError && failure(createError, 'The server rejected this role. Check the fields and try again.')
    : null

  const scopesShown = (Object.keys(SCOPES) as RoleScope[]).filter((scope) => roles.some((role) => role.scope === scope))
  const needle = query.trim().toLowerCase()
  const shown = roles
    .filter(
      (role) =>
        (!scopeFilter || role.scope === scopeFilter) &&
        (!needle || [role.name, role.description, role.branchName, role.tenant].some((text) => text.toLowerCase().includes(needle))),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function closeForm() {
    resetCreate()
    resetUpdate()
    setForm(null)
  }

  async function handleSave(role: RoleRequest) {
    try {
      if (editing) {
        await updateRole({ id: editing.id, changes: { name: role.name, description: role.description } }).unwrap()
        setToast(`${role.name} updated`)
      } else {
        await createRole(role).unwrap()
        setToast(`${role.name} created`)
      }
      closeForm()
    } catch {
      // The mutation's error drives the message in the dialog
    }
  }

  function handleDelete(role: Role) {
    setConfirm({
      title: `Delete ${role.name}?`,
      body: 'The role is removed for good. A role that staff still hold can’t be deleted; give them another role first.',
      confirmLabel: 'Delete Role',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteRole(role.id).unwrap()
          setToast(`${role.name} deleted`)
        } catch (error) {
          setToast(failure(error, `Couldn’t delete ${role.name}. Staff may still hold it.`))
        }
      },
    })
  }

  // A rename can't clash with another role in the same place; for a new role
  // the server decides, since the same name can be fine in another branch
  const takenNames = editing
    ? roles
        .filter((role) => role.id !== editing.id && role.scope === editing.scope && role.branchId === editing.branchId)
        .map(({ name }) => name)
    : []

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Roles</h1>
          <p className="text-xs text-muted">
            The roles staff can be given, for the whole business or for one branch.
          </p>
        </div>
        {editor && (
          <button type="button" onClick={() => setForm({ id: '' })} className={primaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            New Role
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading roles…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-xl bg-white ring-1 ring-line" />
          ))}
        </div>
      ) : isError && roles.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the roles</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ?? (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <ShieldCheck className="size-6 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">No roles yet</h2>
          <p className="max-w-sm text-xs text-muted">Create roles such as Shift Supervisor or Cashier, then give them to staff.</p>
          {editor && (
            <button type="button" onClick={() => setForm({ id: '' })} className={`${secondaryButton} mt-2`}>
              New Role
            </button>
          )}
        </div>
      ) : (
        <section className="rounded-xl bg-white ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, description or branch"
                aria-label="Search roles"
                className={`${fieldClass} pl-9`}
              />
            </div>
            {scopesShown.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by where the role applies">
                {[{ id: '' as const, label: 'All', total: roles.length }, ...scopesShown.map((scope) => ({ id: scope, label: SCOPES[scope].label, total: roles.filter((role) => role.scope === scope).length }))].map(
                  ({ id, label, total }) => (
                    <button
                      key={id || 'all'}
                      type="button"
                      aria-pressed={scopeFilter === id}
                      onClick={() => setScopeFilter(id)}
                      className={`h-8 rounded-full px-3 text-[11px] font-semibold transition ${
                        scopeFilter === id ? 'bg-ink text-white' : 'bg-field text-muted hover:text-ink'
                      }`}
                    >
                      {label} <span className="tabular-nums">{total}</span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Role</th>
                  <th scope="col" className="px-3 py-2 font-bold">Applies to</th>
                  {editor === 'admin' && <th scope="col" className="px-3 py-2 font-bold">Business</th>}
                  <th scope="col" className="px-3 py-2 font-bold">Permissions</th>
                  <th scope="col" className="px-3 py-2 font-bold">Staff</th>
                  <th scope="col" className="px-3 py-2 font-bold">Created by</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((role) => (
                  <tr key={role.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-ink">{role.name}</p>
                      {role.description && <p className="max-w-md text-[11px] text-muted">{role.description}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={SCOPES[role.scope].tone}>{SCOPES[role.scope].label}</Badge>
                      {role.scope === 'BRANCH' && role.branchName && <p className="mt-1 text-[11px] text-ink">{role.branchName}</p>}
                    </td>
                    {editor === 'admin' && <td className="px-3 py-2.5 text-ink">{role.tenant || '—'}</td>}
                    <td className="px-3 py-2.5 tabular-nums text-ink">{role.permissionCount}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink">{role.userCount}</td>
                    <td className="px-3 py-2.5 text-muted">{role.createdBy || '—'}</td>
                    <td className="px-3 py-1.5 text-right">
                      {editor && (
                        <Menu
                          label={`Actions for ${role.name}`}
                          trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                          triggerClassName={iconButton}
                        >
                          {(close) => (
                            <>
                              <MenuItem onSelect={() => { close(); setPermissionsFor(role.id) }}>
                                {canChange(role) ? 'Edit permissions' : 'View permissions'}
                              </MenuItem>
                              {canChange(role) && (
                                <MenuItem onSelect={() => { close(); setForm({ id: role.id }) }}>Edit role</MenuItem>
                              )}
                              {canChange(role) && role.scope !== 'PLATFORM' && (
                                <MenuItem destructive onSelect={() => { close(); handleDelete(role) }}>
                                  Delete role
                                </MenuItem>
                              )}
                            </>
                          )}
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={editor === 'admin' ? 7 : 6} className="px-3 py-10 text-center text-xs text-muted">
                      No roles match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!editor && (
            <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
              Only the business owner and branch managers can create or change roles.
            </p>
          )}
        </section>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {form && editor && (!form.id || editing) && (
        <RoleDialog
          key={editing?.id ?? 'new'}
          initial={editing}
          editor={editor}
          branches={branches}
          tenants={tenants}
          takenNames={takenNames}
          error={saveError}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
      {permissionsFor && roles.some(({ id }) => id === permissionsFor) && (
        <RolePermissionsDialog
          key={permissionsFor}
          role={roles.find(({ id }) => id === permissionsFor)!}
          editable={canChange(roles.find(({ id }) => id === permissionsFor)!)}
          onClose={() => setPermissionsFor(null)}
          onSaved={(message) => {
            setPermissionsFor(null)
            setToast(message)
          }}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default RolesPage
