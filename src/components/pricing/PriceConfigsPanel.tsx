import { useState } from 'react'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { ARTICLE_TYPES, articleLabel } from '../../constants/articleTypes'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import {
  useCreatePriceConfigMutation,
  useDeletePriceConfigMutation,
  useListPriceConfigsQuery,
  useUpdatePriceConfigMutation,
} from '../../services/priceConfigApi'
import type { PriceConfig } from '../../services/priceConfigApi'
import { useGetServiceDropdownQuery } from '../../services/serviceApi'
import { describeError } from '../../utils/apiReasons'
import { formatXaf } from '../../utils/orders'
import { ConfirmDialog } from '../orders/OrderDialogs'
import type { ConfirmRequest } from '../orders/OrderDialogs'
import { fieldClass, labelClass, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import Panel from '../ui/Panel'

type Form = {
  id: string
  code: string
  name: string
  description: string
  price: string
  active: boolean
  articleType: string
  branchId: string
  serviceId: string
}

const blank = (branchId: string): Form => ({
  id: '',
  code: '',
  name: '',
  description: '',
  price: '',
  active: true,
  articleType: ARTICLE_TYPES[0].id,
  branchId,
  serviceId: '',
})

function ConfigDialog({
  initial,
  editing,
  onClose,
  onToast,
}: {
  initial: Form
  editing: boolean
  onClose: () => void
  onToast: (message: string) => void
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const branches = useGetBranchDropdownQuery().data ?? []
  const services = useGetServiceDropdownQuery().data ?? []
  const [create, { isLoading: creating }] = useCreatePriceConfigMutation()
  const [update, { isLoading: updating }] = useUpdatePriceConfigMutation()
  const set = (change: Partial<Form>) => setForm({ ...form, ...change })
  const branchId = form.branchId || branches[0]?.uuid || ''
  const valid = form.code.trim() !== '' && form.name.trim() !== '' && Number(form.price) >= 0 && form.price !== '' && branchId !== ''

  async function handleSave() {
    setError(null)
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      active: form.active,
      articleType: form.articleType,
      ...(form.serviceId ? { serviceId: form.serviceId } : {}),
    }
    try {
      if (editing) await update({ id: form.id, changes: body }).unwrap()
      else await create({ ...body, branchId }).unwrap()
      onToast(editing ? `${body.name} updated` : `${body.name} added`)
      onClose()
    } catch (caught) {
      setError(describeError(caught, 'The price wasn’t saved.'))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit Price' : 'New Price'}
      subtitle="What a kind of article costs under a service, at a branch."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!valid || creating || updating} onClick={() => void handleSave()} className={primaryButton}>
            {creating || updating ? 'Saving…' : 'Save Price'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="price-code" className={labelClass}>Code</label>
          <input id="price-code" value={form.code} onChange={(event) => set({ code: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="price-name" className={labelClass}>Name</label>
          <input id="price-name" value={form.name} onChange={(event) => set({ name: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="price-article" className={labelClass}>Article</label>
          <select id="price-article" value={form.articleType} onChange={(event) => set({ articleType: event.target.value })} className={fieldClass}>
            {ARTICLE_TYPES.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price-amount" className={labelClass}>Price (XAF)</label>
          <input id="price-amount" type="number" min="0" inputMode="numeric" value={form.price} onChange={(event) => set({ price: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="price-branch" className={labelClass}>Branch</label>
          <select id="price-branch" value={branchId} disabled={editing} onChange={(event) => set({ branchId: event.target.value })} className={`${fieldClass} disabled:opacity-60`}>
            {branches.map(({ uuid, name }) => (
              <option key={uuid} value={uuid}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price-service" className={labelClass}>Service</label>
          <select id="price-service" value={form.serviceId} onChange={(event) => set({ serviceId: event.target.value })} className={fieldClass}>
            <option value="">The branch’s only service</option>
            {services.map(({ uuid, name }) => (
              <option key={uuid} value={uuid}>{name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="price-description" className={labelClass}>Description</label>
          <input id="price-description" value={form.description} onChange={(event) => set({ description: event.target.value })} className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink sm:col-span-2">
          <input type="checkbox" checked={form.active} onChange={(event) => set({ active: event.target.checked })} className="size-4 accent-brand" />
          Active
        </label>
      </div>
    </Modal>
  )
}

// The article price list, from /price-configs
function PriceConfigsPanel({ canManage, onToast }: { canManage: boolean; onToast: (message: string) => void }) {
  const { data: configs = [], isLoading, isError } = useListPriceConfigsQuery()
  const [remove] = useDeletePriceConfigMutation()
  const [form, setForm] = useState<{ initial: Form; editing: boolean } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  return (
    <Panel
      title="Article Price List"
      subtitle="What each kind of article costs, by branch and service"
      icon={Tag}
      action={
        canManage && (
          <button type="button" onClick={() => setForm({ initial: blank(''), editing: false })} className={secondaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            New Price
          </button>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading prices…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-9 animate-pulse rounded-md bg-field" />
          ))}
        </div>
      ) : isError ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-3 text-xs font-semibold text-danger">Couldn’t load the price list.</p>
      ) : configs.length === 0 ? (
        <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">No article prices yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[9px] font-bold tracking-wider text-muted uppercase">
              <tr>
                <th scope="col" className="py-1.5 pr-3">Code</th>
                <th scope="col" className="py-1.5 pr-3">Article</th>
                <th scope="col" className="py-1.5 pr-3">Service</th>
                <th scope="col" className="py-1.5 pr-3">Branch</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Price</th>
                <th scope="col" className="py-1.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config: PriceConfig) => (
                <tr key={config.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-mono text-[11px] text-ink">{config.code}</td>
                  <td className="py-2 pr-3">
                    <span className="block font-semibold text-ink">{config.name}</span>
                    <span className="text-[11px] text-muted">{articleLabel(config.articleType)}</span>
                  </td>
                  <td className="py-2 pr-3 text-ink">{config.serviceName}</td>
                  <td className="py-2 pr-3 text-ink">{config.branchName}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-ink tabular-nums">
                    {formatXaf(config.price)} {!config.active && <Badge>Inactive</Badge>}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${config.name}`}
                          onClick={() =>
                            setForm({
                              editing: true,
                              initial: {
                                id: config.id,
                                code: config.code,
                                name: config.name,
                                description: config.description,
                                price: String(config.price),
                                active: config.active,
                                articleType: config.articleType || ARTICLE_TYPES[0].id,
                                branchId: '',
                                serviceId: config.serviceId,
                              },
                            })
                          }
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-field hover:text-ink"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${config.name}`}
                          onClick={() =>
                            setConfirm({
                              title: `Delete ${config.name}?`,
                              body: 'The price is removed for good.',
                              confirmLabel: 'Delete Price',
                              destructive: true,
                              onConfirm: () => {
                                remove(config.id)
                                  .unwrap()
                                  .then(() => onToast(`${config.name} deleted`))
                                  .catch((error) => onToast(describeError(error, 'The price wasn’t deleted.')))
                              },
                            })
                          }
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-field hover:text-danger"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && <ConfigDialog initial={form.initial} editing={form.editing} onClose={() => setForm(null)} onToast={onToast} />}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </Panel>
  )
}

export default PriceConfigsPanel
