import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  useGetPermissionCatalogQuery,
  useGetRolePermissionsQuery,
  useSetRolePermissionsMutation,
} from '../../services/roleApi'
import type { PermissionMenu, Role } from '../../services/roleApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { primaryButton, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import Modal from '../ui/Modal'

type RolePermissionsDialogProps = {
  role: Role
  // False shows the set without letting it change
  editable: boolean
  onClose: () => void
  onSaved: (message: string) => void
}

const humanize = (action: string) => action.toLowerCase().replace(/_/g, ' ')

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <p className="sr-only" role="status">Loading permissions…</p>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-24 rounded-lg bg-field" />
      ))}
    </div>
  )
}

// What a role may do, as a checkbox per MENU:ACTION code grouped by menu
function RolePermissionsDialog({ role, editable, onClose, onSaved }: RolePermissionsDialogProps) {
  const catalog = useGetPermissionCatalogQuery()
  const held = useGetRolePermissionsQuery(role.id)
  const [setPermissions, { isLoading: saving }] = useSetRolePermissionsMutation()
  // Null until the person changes something, so the saved set shows until then
  const [edited, setEdited] = useState<Set<string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = edited ?? new Set(held.data ?? [])
  // A tenant's role can't hold the platform menus; the server rejects them
  const menus: PermissionMenu[] = (catalog.data ?? []).filter((menu) => !menu.platformOnly || role.scope === 'PLATFORM')
  const total = menus.reduce((sum, menu) => sum + menu.actions.length, 0)
  const loading = catalog.isLoading || held.isLoading
  const failed = catalog.isError || held.isError
  const dirty = edited !== null

  function change(update: (next: Set<string>) => void) {
    const next = new Set(selected)
    update(next)
    setEdited(next)
    setError(null)
  }

  const toggleCode = (code: string, checked: boolean) =>
    change((next) => {
      if (checked) next.add(code)
      else next.delete(code)
    })

  const toggleMenu = (menu: PermissionMenu, checked: boolean) =>
    change((next) => {
      for (const { code } of menu.actions) {
        if (checked) next.add(code)
        else next.delete(code)
      }
    })

  async function handleSave() {
    setError(null)
    try {
      // Keep the catalog's order, and any code the role holds that this list hides
      const hidden = [...selected].filter((code) => !menus.some((menu) => menu.actions.some((action) => action.code === code)))
      const visible = menus.flatMap((menu) => menu.actions.map(({ code }) => code)).filter((code) => selected.has(code))
      await setPermissions({ id: role.id, permissions: [...visible, ...hidden] }).unwrap()
      onSaved(`${role.name} permissions saved`)
    } catch (caught) {
      setError(
        serverMessage(caught) ??
          errorMessage(caught as Parameters<typeof errorMessage>[0], 'The server rejected these permissions.') ??
          NETWORK_ERROR_MESSAGE,
      )
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={`${role.name} permissions`}
      subtitle={
        editable
          ? `${selected.size} of ${total} selected. You can only add a permission you hold yourself. Changes apply on each holder’s next request.`
          : `${selected.size} of ${total} granted. You can view this role but not change it.`
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            {editable ? 'Cancel' : 'Close'}
          </button>
          {editable && (
            <button type="button" onClick={() => void handleSave()} disabled={saving || loading || failed || !dirty} className={primaryButton}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          )}
        </>
      }
    >
      {error && <div className="mb-3"><FormAlert>{error}</FormAlert></div>}

      {loading ? (
        <Skeleton />
      ) : failed ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-lg bg-field px-4 py-10 text-center">
          <p className="text-sm font-bold text-ink">Couldn’t load the permissions</p>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(catalog.error ?? held.error) ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => {
              void catalog.refetch()
              void held.refetch()
            }}
            className={`${secondaryButton} mt-1`}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Try Again
          </button>
        </div>
      ) : menus.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted">
          The permission catalog is only shown to platform admins, business owners and managers.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {menus.map((menu) => {
            const count = menu.actions.filter(({ code }) => selected.has(code)).length
            const all = count === menu.actions.length
            return (
              <fieldset key={menu.menu} className="rounded-lg ring-1 ring-line">
                <legend className="sr-only">{menu.name}</legend>
                <div className="flex items-center justify-between gap-2 border-b border-line bg-field px-3 py-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={all}
                      ref={(input) => {
                        if (input) input.indeterminate = count > 0 && !all
                      }}
                      disabled={!editable}
                      onChange={(event) => toggleMenu(menu, event.target.checked)}
                      className="size-4 accent-brand"
                    />
                    {menu.name}
                  </label>
                  <span className="text-[11px] tabular-nums text-muted">
                    {count}/{menu.actions.length}
                  </span>
                </div>
                <ul className="space-y-1.5 px-3 py-2.5">
                  {menu.actions.map(({ code, action, description }) => (
                    <li key={code}>
                      <label className="flex items-start gap-2 text-xs text-ink">
                        <input
                          type="checkbox"
                          checked={selected.has(code)}
                          disabled={!editable}
                          onChange={(event) => toggleCode(code, event.target.checked)}
                          className="mt-0.5 size-4 shrink-0 accent-brand"
                        />
                        <span>
                          <span className="font-semibold capitalize">{humanize(action)}</span>
                          {description && <span className="block text-[11px] text-muted">{description}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default RolePermissionsDialog
