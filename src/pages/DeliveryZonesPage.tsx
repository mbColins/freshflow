import { useEffect, useState } from 'react'
import { Ellipsis, MapPinned, Plus, RotateCcw, Search } from 'lucide-react'
import DeliveryZoneDialog from '../components/logistics/DeliveryZoneDialog'
import LogisticsSettingsPanel from '../components/logistics/LogisticsSettingsPanel'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import Menu, { MenuItem } from '../components/ui/Menu'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import {
  useCreateDeliveryZoneMutation,
  useDeleteDeliveryZoneMutation,
  useListDeliveryZonesQuery,
  useUpdateDeliveryZoneMutation,
} from '../services/deliveryZoneApi'
import type { ZoneListParams } from '../services/deliveryZoneApi'
import type { DeliveryZone, DeliveryZoneRequest } from '../types/deliveryZone'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatXaf } from '../utils/orders'

const TOAST_MS = 4000
// TODO: page through the list if a tenant ever has more zones than this
const ALL_ZONES: ZoneListParams = { filter: '', search: '', page: 0, size: 100 }
const NO_ZONES: DeliveryZone[] = []

// An empty id creates a new zone
type FormState = { id: string }

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

// The response may come without a name; the first neighborhood stands in
const zoneName = (zone: DeliveryZone) => zone.name || zone.neighborhoods[0] || 'Unnamed zone'

// Pickup & Delivery > Delivery Zones: where each branch collects and delivers, and the fees
function DeliveryZonesPage() {
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useListDeliveryZonesQuery(ALL_ZONES)
  const zones = data?.items ?? NO_ZONES
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createZone, { error: createError, reset: resetCreate }] = useCreateDeliveryZoneMutation()
  const [updateZone, { error: updateError, reset: resetUpdate }] = useUpdateDeliveryZoneMutation()
  const [deleteZone] = useDeleteDeliveryZoneMutation()

  const editing = form?.id ? zones.find(({ id }) => id === form.id) : undefined
  const saveError = form
    ? editing
      ? updateError && failure(updateError, 'The server rejected these changes. Check the fields and try again.')
      : createError && failure(createError, 'The server rejected this zone. Check the fields and try again.')
    : null

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? zones.filter((zone) =>
        [zone.name, zone.branchName, ...zone.neighborhoods].some((text) => text.toLowerCase().includes(needle)),
      )
    : zones

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

  async function handleSave(zone: DeliveryZoneRequest) {
    try {
      if (editing) {
        await updateZone({ id: editing.id, zone }).unwrap()
        setToast(`${zone.name} updated`)
      } else {
        // The list refetches on its own once the mutation succeeds
        await createZone(zone).unwrap()
        setToast(`${zone.name} created`)
      }
      closeForm()
    } catch {
      // The mutation's error drives the message in the dialog
    }
  }

  function handleDelete(zone: DeliveryZone) {
    const name = zoneName(zone)
    setConfirm({
      title: `Delete ${name}?`,
      body: `Pickups and deliveries to ${zone.neighborhoods.join(', ') || 'this zone'} will no longer have a fee from ${zone.branchName || 'this branch'}.`,
      confirmLabel: 'Delete Zone',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteZone(zone.id).unwrap()
          setToast(`${name} deleted`)
        } catch (error) {
          setToast(failure(error, `Couldn’t delete ${name}.`))
        }
      },
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Delivery Zones</h1>
          <p className="text-xs text-muted">The neighborhoods each branch serves, and what a pickup or delivery there costs.</p>
        </div>
        <button type="button" onClick={() => setForm({ id: '' })} className={primaryButton}>
          <Plus className="size-4" aria-hidden="true" />
          New Zone
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading zones…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-xl bg-white ring-1 ring-line" />
          ))}
        </div>
      ) : isError && zones.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the delivery zones</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ?? (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : zones.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <MapPinned className="size-6 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">No delivery zones yet</h2>
          <p className="max-w-sm text-xs text-muted">Add a zone to set the pickup and delivery fees for the neighborhoods a branch serves.</p>
          <button type="button" onClick={() => setForm({ id: '' })} className={`${secondaryButton} mt-2`}>
            New Zone
          </button>
        </div>
      ) : (
        <section className="rounded-xl bg-white ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search zone, branch or neighborhood"
                aria-label="Search delivery zones"
                className={`${fieldClass} pl-9`}
              />
            </div>
            <p className="text-[11px] text-muted" role="status">
              {shown.length} of {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Zone</th>
                  <th scope="col" className="px-3 py-2 font-bold">Branch</th>
                  <th scope="col" className="px-3 py-2 font-bold">Neighborhoods</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Collection fee</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Delivery fee</th>
                  <th scope="col" className="px-3 py-2 font-bold">Created by</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((zone) => (
                  <tr key={zone.id} className="align-top">
                    <td className="px-3 py-2.5 font-bold text-ink">{zoneName(zone)}</td>
                    <td className="px-3 py-2.5 text-ink">{zone.branchName || '—'}</td>
                    <td className="px-3 py-2.5">
                      <ul className="flex flex-wrap gap-1" aria-label={`Neighborhoods in ${zoneName(zone)}`}>
                        {zone.neighborhoods.map((name) => (
                          <li key={name} className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            {name}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">{formatXaf(zone.collectionFee)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">{formatXaf(zone.deliveryFee)}</td>
                    <td className="px-3 py-2.5 text-muted">{zone.createdBy || '—'}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Menu
                        label={`Actions for ${zoneName(zone)}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => (
                          <>
                            <MenuItem onSelect={() => { close(); setForm({ id: zone.id }) }}>Edit zone</MenuItem>
                            <MenuItem destructive onSelect={() => { close(); handleDelete(zone) }}>
                              Delete zone
                            </MenuItem>
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-xs text-muted">
                      No zones match “{query.trim()}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <LogisticsSettingsPanel branches={branches} />

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {form && (!form.id || editing) && (
        <DeliveryZoneDialog
          key={editing?.id ?? 'new'}
          initial={editing}
          branches={branches}
          error={saveError}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default DeliveryZonesPage
