import { useEffect, useState } from 'react'
import { Building2, CircleCheck, CircleDollarSign, Hourglass, Plus, RotateCcw, Search, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import SuspendTenantDialog from '../components/tenants/SuspendTenantDialog'
import TenantFormDialog from '../components/tenants/TenantFormDialog'
import TenantsTable from '../components/tenants/TenantsTable'
import { EMPTY_TENANT_FILTERS, TENANT_STATUSES } from '../constants/tenants'
import useNow from '../hooks/useNow'
import usePlatformPlans from '../hooks/usePlatformPlans'
import { useTenantsQuery } from '../hooks/useTenants'
import {
  useCreateTenantMutation,
  useDeleteTenantMutation,
  useGetTenantQuery,
  useUpdateTenantMutation,
} from '../services/tenantApi'
import type { Tenant, TenantFilters, TenantFormValues, TenantStatus } from '../types/tenant'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatXaf } from '../utils/orders'
import {
  getMrr,
  matchesTenantFilters,
  tenantFromResponse,
  trialDaysLeft,
} from '../utils/tenants'

const TOAST_MS = 4000
const NO_TENANTS: Tenant[] = []

// What went wrong with a tenant request, in the user's terms, after `prefix`
// ("The tenant wasn’t created."). The backend's own message wins when it sends one.
function failureMessage(error: unknown, prefix: string) {
  const fromServer = serverMessage(error)
  const status = (error as { status?: unknown } | undefined)?.status
  if (fromServer) return `${prefix} ${fromServer}`
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return `${prefix} ${NETWORK_ERROR_MESSAGE}`
  if (status === 401 || status === 403) return `${prefix} Your account isn’t allowed to do this.`
  if (status === 404) return `${prefix} The tenant no longer exists.`
  if (status === 409) return `${prefix} The hostname, email or owner username is already in use.`
  if (typeof status === 'number' && status >= 400 && status < 500) return `${prefix} Check the fields and try again.`
  return `${prefix} The server ran into a problem. Try again in a moment.`
}

type FormState = { mode: 'create' } | { mode: 'edit'; id: string }

function Kpi({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{note}</p>
    </div>
  )
}

// Platform admin: every business subscribed to the SaaS
// TODO: show only to platform admins once the API exposes the user's role
function TenantsPage() {
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useTenantsQuery()
  const tenants = data?.items ?? NO_TENANTS
  const plans = usePlatformPlans()
  const now = useNow()
  const [filters, setFilters] = useState<TenantFilters>(EMPTY_TENANT_FILTERS)
  const [form, setForm] = useState<FormState | null>(null)
  const [suspendingId, setSuspendingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createTenantRequest, { error: createError, reset: resetCreate }] = useCreateTenantMutation()
  const [updateTenantRequest, { error: updateError, reset: resetUpdate }] = useUpdateTenantMutation()
  const [deleteTenantRequest] = useDeleteTenantMutation()
  const createMessage = createError ? failureMessage(createError, 'The tenant wasn’t created.') : null
  const updateMessage = updateError ? failureMessage(updateError, 'The changes weren’t saved.') : null

  const filtered = tenants.filter((tenant) => matchesTenantFilters(tenant, filters))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const editingId = form?.mode === 'edit' ? form.id : null
  // Edit from the server's latest copy, falling back to the local record
  const {
    data: fetchedTenant,
    isFetching: loadingTenant,
    isError: tenantLoadFailed,
  } = useGetTenantQuery(editingId ?? '', { skip: !editingId, refetchOnMountOrArgChange: true })
  const localEditing = editingId ? tenants.find(({ id }) => id === editingId) : undefined
  const editing =
    localEditing && fetchedTenant && !loadingTenant ? tenantFromResponse(fetchedTenant, localEditing) : localEditing
  const suspending = tenants.find(({ id }) => id === suspendingId)
  const active = tenants.filter(({ status }) => status === 'active').length
  const trials = tenants.filter(({ status }) => status === 'trial')
  const endingSoon = trials.filter((tenant) => (trialDaysLeft(tenant, now) ?? 99) <= 3).length
  const patchFilters = (patch: Partial<TenantFilters>) => setFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleSave(values: TenantFormValues) {
    if (editing) {
      // Editing doesn't touch the owner account, so only the business fields go
      const { businessName, phoneNumber, email, subscriptionPlan, town, slogan, hostname, status, logo } = values
      try {
        await updateTenantRequest({
          id: editing.id,
          changes: { businessName, phoneNumber, email, subscriptionPlan, town, slogan, hostname, status, logo },
        }).unwrap()
        setToast(`${businessName} updated`)
        setForm(null)
      } catch {
        // `updateError` drives the message in the dialog
      }
      return
    }
    try {
      // The list reloads on its own to show the new tenant
      await createTenantRequest(values).unwrap()
      setToast(`Tenant ${values.businessName} was created, with owner @${values.username}.`)
      setForm(null)
    } catch {
      // `createError` drives the message in the dialog
    }
  }

  // Status changes are a PATCH with just the status
  async function changeStatus(tenant: Tenant, status: TenantStatus, done: string) {
    try {
      await updateTenantRequest({ id: tenant.id, changes: { status } }).unwrap()
      setToast(`${tenant.name} ${done}`)
    } catch (error) {
      setToast(failureMessage(error, `${tenant.name} wasn’t ${done}.`))
    } finally {
      resetUpdate()
    }
  }

  // TODO: TenantRequest has no field for the reason, so it isn't stored yet
  function handleSuspend() {
    if (!suspending) return
    setSuspendingId(null)
    void changeStatus(suspending, 'suspended', 'suspended')
  }

  function handleReactivate(id: string) {
    const tenant = tenants.find((item) => item.id === id)!
    void changeStatus(tenant, 'active', 'reactivated')
  }

  function handleDelete(id: string) {
    const tenant = tenants.find((item) => item.id === id)!
    setConfirm({
      title: `Delete ${tenant.name}?`,
      body: `The tenant, its ${tenant.users} user ${tenant.users === 1 ? 'account' : 'accounts'} and its data are removed for good. To keep the data, cancel the subscription instead.`,
      confirmLabel: 'Delete Tenant',
      destructive: true,
      onConfirm: () => {
        deleteTenantRequest(id)
          .unwrap()
          .then(() => setToast(`${tenant.name} deleted`))
          .catch((error: unknown) => setToast(failureMessage(error, `${tenant.name} wasn’t deleted.`)))
      },
    })
  }

  function handleCancel(id: string) {
    const tenant = tenants.find((item) => item.id === id)!
    setConfirm({
      title: `Cancel ${tenant.name}'s subscription?`,
      body: `${tenant.users} users lose access and billing stops. Their data is kept, and the tenant can be reactivated later.`,
      confirmLabel: 'Cancel Subscription',
      destructive: true,
      onConfirm: () => {
        void changeStatus(tenant, 'cancelled', 'cancelled')
      },
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Tenants</h1>
          <p className="text-xs text-muted">
            Businesses subscribed to the platform, their plans and their status.
          </p>
        </div>
        <button type="button" onClick={() => setForm({ mode: 'create' })} className={primaryButton}>
          <Plus className="size-4" aria-hidden="true" />
          Add Tenant
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Building2} label="Tenants" value={String(tenants.length)} note={`${tenants.filter(({ status }) => status === 'cancelled').length} cancelled`} />
        <Kpi icon={ShieldCheck} label="Active" value={String(active)} note={`${tenants.filter(({ status }) => status === 'suspended').length} suspended`} />
        <Kpi icon={Hourglass} label="On trial" value={String(trials.length)} note={`${endingSoon} ending within 3 days`} />
        <Kpi icon={CircleDollarSign} label="Monthly recurring revenue" value={formatXaf(getMrr(tenants, plans))} note="Active tenants only" />
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search tenants"
            placeholder="Search by name, workspace, owner, email or city…"
            value={filters.query}
            onChange={(event) => patchFilters({ query: event.target.value })}
            className={`${fieldClass} h-10 pl-9`}
          />
        </div>
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => patchFilters({ status: event.target.value as TenantStatus | '' })}
          className={`${fieldClass} w-auto!`}
        >
          <option value="">All statuses</option>
          {(Object.keys(TENANT_STATUSES) as TenantStatus[]).map((status) => (
            <option key={status} value={status}>{TENANT_STATUSES[status].label}</option>
          ))}
        </select>
        <select
          aria-label="Plan"
          value={filters.plan}
          onChange={(event) => patchFilters({ plan: event.target.value })}
          className={`${fieldClass} w-auto!`}
        >
          <option value="">All plans</option>
          {plans.map(({ code, name }) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_TENANT_FILTERS)}
            className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Reset Filters
          </button>
        )}
      </section>

      {isLoading ? (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line" aria-busy="true">
          <p className="sr-only" role="status">Loading tenants…</p>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-md bg-field" />
          ))}
        </div>
      ) : isError && tenants.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the tenants</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ??
              (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No tenants yet</h2>
          <p className="text-xs text-muted">Businesses you add appear here.</p>
          <button type="button" onClick={() => setForm({ mode: 'create' })} className={`${secondaryButton} mt-2`}>
            <Plus className="size-3.5" aria-hidden="true" />
            Add Tenant
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No tenants match these filters</h2>
          <p className="text-xs text-muted">Try a different search, status or plan.</p>
          <button type="button" onClick={() => setFilters(EMPTY_TENANT_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : (
        <TenantsTable
          tenants={filtered}
          now={now}
          onEdit={(id) => setForm({ mode: 'edit', id })}
          onSuspend={setSuspendingId}
          onReactivate={handleReactivate}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
          {toast}
        </p>
      )}

      {form?.mode === 'edit' && loadingTenant && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          Loading tenant…
        </p>
      )}
      {form && (form.mode === 'create' || (editing && !loadingTenant)) && (
        <TenantFormDialog
          key={editing?.id ?? 'new'}
          initial={editing}
          takenHostnames={tenants.filter(({ id }) => id !== editing?.id).map(({ hostname }) => hostname)}
          // TODO: the backend is the real check; this only catches known tenant owners
          takenUsernames={tenants.map(({ owner }) => owner.username)}
          error={
            editing
              ? (updateMessage ??
                (tenantLoadFailed
                  ? 'Couldn’t load the latest details from the server. Showing the last saved copy.'
                  : null))
              : createMessage
          }
          onClose={() => {
            resetCreate()
            resetUpdate()
            setForm(null)
          }}
          onSave={handleSave}
        />
      )}
      {suspending && (
        <SuspendTenantDialog tenant={suspending} onClose={() => setSuspendingId(null)} onConfirm={handleSuspend} />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default TenantsPage
