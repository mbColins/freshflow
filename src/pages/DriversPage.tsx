import { useEffect, useState } from 'react'
import { Ellipsis, MapPin, Plus, RotateCcw, Search, Star, Truck } from 'lucide-react'
import DriverDialog from '../components/logistics/DriverDialog'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import { DRIVER_AVAILABILITY } from '../constants/drivers'
import useCurrentUser from '../hooks/useCurrentUser'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import {
  useCreateDriverMutation,
  useDeleteDriverMutation,
  useListDriversQuery,
  useUpdateDriverMutation,
  useUpdateDriverStatusMutation,
} from '../services/driverApi'
import type { DriverListParams } from '../services/driverApi'
import { useListUsersQuery } from '../services/userApi'
import type { UserListParams } from '../services/userApi'
import type { DeliveryDriver, DriverAvailability, DriverRequest } from '../types/driver'
import type { AppUser } from '../types/user'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'

const TOAST_MS = 4000
// TODO: page through these lists once a tenant has more than this
const ALL_DRIVERS: DriverListParams = { filter: '', search: '', page: 0, size: 100 }
const DELIVERY_AGENTS: UserListParams = { filter: 'userType', search: 'DELIVERY_AGENT', page: 0, size: 100 }
const NO_DRIVERS: DeliveryDriver[] = []
const NO_USERS: AppUser[] = []

// An empty id creates a new driver
type FormState = { id: string }

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

const availability = (status: DriverAvailability) => DRIVER_AVAILABILITY.find(({ id }) => id === status)!
const driverName = (driver: DeliveryDriver) => driver.name || 'Unnamed driver'

function formatSeen(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Pickup & Delivery > Drivers: delivery agents' vehicles and availability
function DriversPage() {
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useListDriversQuery(ALL_DRIVERS)
  const drivers = data?.items ?? NO_DRIVERS
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DriverAvailability | ''>('')
  const [form, setForm] = useState<FormState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { isPlatformAdmin } = useCurrentUser()
  // Only needed while the form is open: the logins a driver can be linked to
  const { data: agentPage, isLoading: agentsLoading } = useListUsersQuery(DELIVERY_AGENTS, { skip: !form })
  const [createDriver, { error: createError, reset: resetCreate }] = useCreateDriverMutation()
  const [updateDriver, { error: updateError, reset: resetUpdate }] = useUpdateDriverMutation()
  const [updateStatus] = useUpdateDriverStatusMutation()
  const [deleteDriver] = useDeleteDriverMutation()

  const branchName = (driver: DeliveryDriver) =>
    driver.allBranches
      ? 'Every branch'
      : driver.branchName || branches.find(({ uuid }) => uuid === driver.branchId)?.name || 'Unknown branch'
  const editing = form?.id ? drivers.find(({ id }) => id === form.id) : undefined
  // Delivery agents not already another driver's login. The user type is
  // re-checked here in case the backend ignores the filter
  const agents = (agentPage?.items ?? NO_USERS).filter(
    (user) =>
      user.userType === 'DELIVERY_AGENT' &&
      !drivers.some(({ id, userId }) => userId === user.uuid && id !== editing?.id),
  )
  const saveError = form
    ? editing
      ? updateError && failure(updateError, 'The server rejected these changes. Check the fields and try again.')
      : createError && failure(createError, 'The server rejected this driver. Check the fields and try again.')
    : null

  const needle = query.trim().toLowerCase()
  const shown = drivers.filter(
    (driver) =>
      (!statusFilter || driver.status === statusFilter) &&
      (!needle ||
        [driver.name, driver.phone, driver.email, driver.vehiclePlate, driver.vehicleModel, driver.vehicleType, branchName(driver)].some(
          (text) => text.toLowerCase().includes(needle),
        )),
  )

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

  async function handleSave(driver: DriverRequest) {
    try {
      if (editing) {
        await updateDriver({ id: editing.id, changes: driver }).unwrap()
        setToast(`${driverName(editing)} updated`)
      } else {
        const created = await createDriver(driver).unwrap()
        setToast(`${created.name || 'Driver'} added`)
      }
      closeForm()
    } catch {
      // The mutation's error drives the message in the dialog
    }
  }

  async function setStatus(driver: DeliveryDriver, status: DriverAvailability) {
    try {
      await updateStatus({ id: driver.id, status }).unwrap()
      setToast(`${driverName(driver)} is now ${availability(status).label.toLowerCase()}`)
    } catch (error) {
      setToast(failure(error, `Couldn’t change ${driverName(driver)}’s status.`))
    }
  }

  function handleDelete(driver: DeliveryDriver) {
    const name = driverName(driver)
    setConfirm({
      title: `Remove ${name} as a driver?`,
      body: `${name} is deleted and can no longer be given pickups or deliveries.${
        driver.userId ? ' Their app login stays as a user account.' : ''
      } A driver who already has jobs can't be removed; mark them off duty instead.`,
      confirmLabel: 'Remove Driver',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteDriver(driver.id).unwrap()
          setToast(`${name} removed as a driver`)
        } catch (error) {
          setToast(failure(error, `Couldn’t remove ${name}.`))
        }
      },
    })
  }

  const count = (status: DriverAvailability) => drivers.filter((driver) => driver.status === status).length

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Drivers</h1>
          <p className="text-xs text-muted">Delivery agents, their vehicles and who is free to take a job.</p>
        </div>
        <button type="button" onClick={() => setForm({ id: '' })} className={primaryButton}>
          <Plus className="size-4" aria-hidden="true" />
          New Driver
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading drivers…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-xl bg-white ring-1 ring-line" />
          ))}
        </div>
      ) : isError && drivers.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the drivers</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ?? (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <Truck className="size-6 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">No drivers yet</h2>
          <p className="max-w-sm text-xs text-muted">Add the people who do your pickups and deliveries so they can be given jobs.</p>
          <button type="button" onClick={() => setForm({ id: '' })} className={`${secondaryButton} mt-2`}>
            New Driver
          </button>
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
                placeholder="Search name, phone, plate or branch"
                aria-label="Search drivers"
                className={`${fieldClass} pl-9`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {[{ id: '' as const, label: 'All', total: drivers.length }, ...DRIVER_AVAILABILITY.map(({ id, label }) => ({ id, label, total: count(id) }))].map(
                ({ id, label, total }) => (
                  <button
                    key={id || 'all'}
                    type="button"
                    aria-pressed={statusFilter === id}
                    onClick={() => setStatusFilter(id)}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold transition ${
                      statusFilter === id ? 'bg-ink text-white' : 'bg-field text-muted hover:text-ink'
                    }`}
                  >
                    {label} <span className="tabular-nums">{total}</span>
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Driver</th>
                  <th scope="col" className="px-3 py-2 font-bold">Branch</th>
                  <th scope="col" className="px-3 py-2 font-bold">Vehicle</th>
                  <th scope="col" className="px-3 py-2 font-bold">Status</th>
                  <th scope="col" className="px-3 py-2 font-bold">Last location</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Score</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((driver) => {
                  const { label, tone } = availability(driver.status)
                  const located = driver.latitude !== null && driver.longitude !== null
                  return (
                    <tr key={driver.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-ink">{driverName(driver)}</p>
                        <p className="text-[11px] text-muted">{[driver.phone, driver.email].filter(Boolean).join(' · ') || 'No contact'}</p>
                        {!driver.userId && <p className="text-[10px] text-muted italic">No app login</p>}
                      </td>
                      <td className={`px-3 py-2.5 ${driver.allBranches ? 'text-muted' : 'text-ink'}`}>{branchName(driver)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-ink">{[driver.vehicleType, driver.vehicleModel].filter(Boolean).join(' · ') || '—'}</p>
                        <p className="font-mono text-[11px] text-muted">{driver.vehiclePlate}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {located ? (
                          <>
                            <a
                              href={`https://www.google.com/maps?q=${driver.latitude},${driver.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                            >
                              <MapPin className="size-3.5" aria-hidden="true" />
                              View on map
                            </a>
                            {formatSeen(driver.locationUpdatedAt) && (
                              <p className="text-[11px] text-muted">{formatSeen(driver.locationUpdatedAt)}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">Not reported</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {driver.score === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-ink">
                            <Star className="size-3.5 text-warning" aria-hidden="true" />
                            {driver.score.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Menu
                          label={`Actions for ${driverName(driver)}`}
                          trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                          triggerClassName={iconButton}
                        >
                          {(close) => (
                            <>
                              <MenuItem onSelect={() => { close(); setForm({ id: driver.id }) }}>Edit driver</MenuItem>
                              {DRIVER_AVAILABILITY.filter(({ id }) => id !== driver.status).map(({ id, label: next }) => (
                                <MenuItem key={id} onSelect={() => { close(); void setStatus(driver, id) }}>
                                  Mark {next.toLowerCase()}
                                </MenuItem>
                              ))}
                              <MenuItem destructive onSelect={() => { close(); handleDelete(driver) }}>
                                Remove driver
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  )
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-xs text-muted">
                      No drivers match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

      {form && (!form.id || editing) && (
        <DriverDialog
          key={editing?.id ?? 'new'}
          initial={editing}
          branches={branches}
          agents={agents}
          agentsLoading={agentsLoading}
          requireBranch={isPlatformAdmin}
          error={saveError}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default DriversPage
