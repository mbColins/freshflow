import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { BranchOption } from '../../services/branchApi'
import type { Role, RoleRequest } from '../../services/roleApi'
import type { TenantOption } from '../../services/tenantApi'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'

const FORM_ID = 'role-form'
const invalidClass = 'aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

// Who is creating the role decides which scopes are on offer:
// admin = platform admin, owner = tenant owner, manager = a branch manager
export type RoleEditor = 'admin' | 'owner' | 'manager'

type Scope = 'PLATFORM' | 'TENANT' | 'BRANCH'

type RoleFormValues = {
  name: string
  description: string
  scope: Scope
  tenantUuid: string
  branch: string
}

const SCOPE_LABELS: Record<Scope, string> = {
  PLATFORM: 'Platform default',
  TENANT: 'Whole business',
  BRANCH: 'One branch',
}

type RoleDialogProps = {
  // Present when editing; then only the name and description can change
  initial?: Role
  editor: RoleEditor
  branches: BranchOption[]
  // Platform admin only
  tenants: TenantOption[]
  // Names other roles already use in the same place, to catch duplicates early
  takenNames: string[]
  error?: string | null
  onClose: () => void
  onSave: (role: RoleRequest) => Promise<void>
}

function RoleDialog({ initial, editor, branches, tenants, takenNames, error, onClose, onSave }: RoleDialogProps) {
  const id = useId()
  const editing = initial !== undefined
  const fieldId = (name: keyof RoleFormValues) => `${id}-${name}`
  const scopes: Scope[] = editor === 'admin' ? ['PLATFORM', 'TENANT', 'BRANCH'] : editor === 'owner' ? ['TENANT', 'BRANCH'] : ['BRANCH']
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      scope: initial?.scope ?? scopes[0],
      tenantUuid: '',
      branch: initial?.branchId ?? (branches.length === 1 ? branches[0].uuid : ''),
    },
  })
  const scope = useWatch({ control, name: 'scope' })

  const describedBy = (name: keyof RoleFormValues) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${fieldId(name)}-error` } : {}

  function toRequest(values: RoleFormValues): RoleRequest {
    const base = { name: values.name.trim(), description: values.description.trim() }
    if (editing) return base
    if (editor === 'manager') return base
    return {
      ...base,
      ...(editor === 'admin' && values.scope !== 'PLATFORM' ? { tenantUuid: values.tenantUuid } : {}),
      ...(values.scope === 'BRANCH' ? { branch: values.branch } : {}),
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name}` : 'New role'}
      subtitle={
        editing
          ? `${SCOPE_LABELS[initial.scope]}${initial.branchName ? ` · ${initial.branchName}` : ''}. Where a role applies can’t change once it exists.`
          : 'A role groups what staff are allowed to do. Give it to staff from the Staff page.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? 'Saving…' : editing ? 'Save Role' : 'Create Role'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((values) => onSave(toRequest(values)))} className="space-y-3">
        {error && <FormAlert>{error}</FormAlert>}

        <FormField label="Role name" htmlFor={fieldId('name')} error={errors.name?.message}>
          <input
            id={fieldId('name')}
            autoComplete="off"
            placeholder="e.g. Shift Supervisor"
            {...describedBy('name')}
            {...register('name', {
              validate: (value) => {
                const name = value.trim()
                if (!name) return 'Role name is required.'
                return !takenNames.some((taken) => taken.toLowerCase() === name.toLowerCase()) || 'A role with this name already exists.'
              },
            })}
            className={`${fieldClass} ${invalidClass}`}
          />
        </FormField>

        <FormField label="Description" htmlFor={fieldId('description')} hint="Optional. What this role is for.">
          <textarea
            id={fieldId('description')}
            rows={3}
            {...register('description')}
            className={`${fieldClass} h-auto py-2`}
          />
        </FormField>

        {!editing && editor === 'manager' && (
          <p className="rounded-md bg-field px-3 py-2 text-[11px] text-muted">
            The role is created for your branch only.
          </p>
        )}

        {!editing && scopes.length > 1 && (
          <fieldset>
            <legend className="mb-1 text-[11px] font-semibold text-ink">Applies to</legend>
            <div className="flex flex-wrap gap-4">
              {scopes.map((option) => (
                <label key={option} className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <input type="radio" value={option} {...register('scope')} className="size-4 accent-brand" />
                  {SCOPE_LABELS[option]}
                </label>
              ))}
            </div>
            {scope === 'PLATFORM' && (
              <p className="mt-1 text-[11px] text-muted">A default every business starts with. Only platform admins see it.</p>
            )}
          </fieldset>
        )}

        {!editing && editor === 'admin' && scope !== 'PLATFORM' && (
          <FormField label="Business" htmlFor={fieldId('tenantUuid')} error={errors.tenantUuid?.message}>
            <select
              id={fieldId('tenantUuid')}
              {...describedBy('tenantUuid')}
              {...register('tenantUuid', {
                validate: (value, values) => values.scope === 'PLATFORM' || value !== '' || 'Choose a business.',
              })}
              className={`${fieldClass} ${invalidClass}`}
            >
              <option value="">Choose a business</option>
              {tenants.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {!editing && editor !== 'manager' && scope === 'BRANCH' && (
          <FormField label="Branch" htmlFor={fieldId('branch')} error={errors.branch?.message}>
            <select
              id={fieldId('branch')}
              {...describedBy('branch')}
              {...register('branch', {
                validate: (value, values) => values.scope !== 'BRANCH' || value !== '' || 'Choose a branch.',
              })}
              className={`${fieldClass} ${invalidClass}`}
            >
              <option value="">Choose a branch</option>
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </form>
    </Modal>
  )
}

export default RoleDialog
