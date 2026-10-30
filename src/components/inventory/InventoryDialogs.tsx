import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import {
  ADJUSTMENT_APPROVAL_RATIO,
  ADJUSTMENT_REASONS,
  CONSUMPTION_REASONS,
  INVENTORY_CATEGORIES,
  UNITS,
} from '../../constants/inventory'
import type { SupplierRequest } from '../../services/purchasingApi'
import type { InventoryItem, MovementType, Supplier } from '../../types/inventory'
import {
  formatQty,
  getAvailable,
  getRecommendedOrder,
} from '../../utils/inventory'
import { formatXaf } from '../../utils/orders'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Modal from '../ui/Modal'
import type { StockAction } from './InventoryTable'
import FormField from '../ui/FormField'

function ItemSelect({
  id,
  items,
  value,
  onChange,
}: {
  id: string
  items: InventoryItem[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={fieldClass}
    >
      <option value="">Choose an item…</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}{item.branchName ? ` · ${item.branchName}` : ''} ({formatQty(item.stock, item.unit)})
        </option>
      ))}
    </select>
  )
}

const numeric = (value: string) => Math.max(0, Number(value) || 0)
const inDays = (count: number) =>
  new Date(Date.now() + count * 86_400_000).toISOString().slice(0, 10)

// ---------- Add stock / record consumption / adjust ----------

export type StockChange = {
  itemId: string
  type: MovementType
  // Signed change to stock
  delta: number
  reference: string
  unitCost?: number
  batch?: string
  expiresAt?: string
}

// Form state: numbers stay as typed text until submit
type StockValues = {
  itemId: string
  quantity: string
  reason: string
  reference: string
  unitCost: string
  batch: string
  expiresAt: string
}

const STOCK_TITLES: Record<StockAction, string> = {
  add: 'Add Stock',
  consume: 'Record Consumption',
  adjust: 'Count & Adjust Stock',
}

export function StockDialog({
  action,
  items,
  initialItemId,
  onClose,
  onSubmit,
}: {
  action: StockAction
  items: InventoryItem[]
  initialItemId: string
  onClose: () => void
  onSubmit: (change: StockChange) => void
}) {
  const { register, handleSubmit, control } = useForm<StockValues>({
    defaultValues: {
      itemId: initialItemId,
      quantity: '',
      reason: action === 'consume' ? CONSUMPTION_REASONS[0].label : ADJUSTMENT_REASONS[0],
      reference: '',
      unitCost: '',
      batch: '',
      expiresAt: '',
    },
  })
  const [itemId, quantity, unitCost] = useWatch({
    control,
    name: ['itemId', 'quantity', 'unitCost'],
  })

  const item = items.find(({ id }) => id === itemId)
  const value = numeric(quantity)
  const cost = unitCost === '' ? (item?.unitCost ?? 0) : numeric(unitCost)
  const delta =
    !item || quantity === ''
      ? 0
      : action === 'add'
        ? value
        : action === 'consume'
          ? -value
          : value - item.stock
  const overdrawn = action === 'consume' && item !== undefined && value > item.stock
  const large =
    action === 'adjust' &&
    item !== undefined &&
    Math.abs(delta) > Math.max(1, item.stock * ADJUSTMENT_APPROVAL_RATIO)
  const valid =
    item !== undefined &&
    quantity !== '' &&
    !overdrawn &&
    (action === 'adjust' ? delta !== 0 : value > 0)

  function onValid({ reason, reference, batch, expiresAt }: StockValues) {
    if (!valid || !item) return
    onSubmit({
      itemId: item.id,
      type:
        action === 'add'
          ? 'Stock received'
          : action === 'adjust'
            ? 'Adjustment'
            : CONSUMPTION_REASONS.find(({ label }) => label === reason)!.type,
      delta,
      reference: reference.trim() || reason,
      ...(action === 'add'
        ? { unitCost: cost, batch: batch.trim() || undefined, expiresAt: expiresAt || undefined }
        : {}),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={STOCK_TITLES[action]}
      footer={
        <>
          {item && quantity !== '' && (
            <p className="mr-auto text-xs text-muted">
              {action === 'add' && (
                <>
                  Total cost:{' '}
                  <span className="font-bold text-ink">{formatXaf(value * cost)}</span> ·{' '}
                </>
              )}
              New stock:{' '}
              <span className="font-bold text-ink">
                {formatQty(item.stock + delta, item.unit)}
              </span>
            </p>
          )}
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="stock-form" disabled={!valid} className={primaryButton}>
            {STOCK_TITLES[action]}
          </button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit(onValid)} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Item" htmlFor="stock-item" wide>
          <Controller
            control={control}
            name="itemId"
            render={({ field }) => (
              <ItemSelect id="stock-item" items={items} value={field.value} onChange={field.onChange} />
            )}
          />
        </FormField>
        <FormField
          label={
            action === 'adjust'
              ? `Actual quantity counted${item ? ` (${item.unit})` : ''}`
              : `Quantity${item ? ` (${item.unit})` : ''}`
          }
          htmlFor="stock-quantity"
        >
          <input
            id="stock-quantity"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            {...register('quantity')}
            className={fieldClass}
          />
          {overdrawn && item && (
            <p className="mt-1 text-[11px] font-semibold text-danger">
              Only {formatQty(item.stock, item.unit)} in stock.
            </p>
          )}
          {action === 'adjust' && item && quantity !== '' && (
            <p className="mt-1 text-[11px] text-muted">
              System: {formatQty(item.stock, item.unit)} · variance{' '}
              <span className={`font-bold ${delta === 0 ? 'text-success' : 'text-danger'}`}>
                {delta > 0 ? '+' : ''}
                {formatQty(delta, item.unit)}
              </span>
            </p>
          )}
        </FormField>

        {action === 'add' ? (
          <>
            <FormField label="Unit cost (XAF)" htmlFor="stock-cost">
              <input
                id="stock-cost"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={item ? String(item.unitCost) : ''}
                {...register('unitCost')}
                className={fieldClass}
              />
            </FormField>
            <FormField label="Purchase order / reference" htmlFor="stock-reference">
              <input
                id="stock-reference"
                placeholder="e.g. PO-0405"
                {...register('reference')}
                className={fieldClass}
              />
            </FormField>
            <FormField label="Batch / lot number" htmlFor="stock-batch">
              <input id="stock-batch" {...register('batch')} className={fieldClass} />
            </FormField>
            <FormField label="Expiration date (optional)" htmlFor="stock-expiry">
              <input id="stock-expiry" type="date" {...register('expiresAt')} className={fieldClass} />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Reason" htmlFor="stock-reason">
              <select id="stock-reason" {...register('reason')} className={fieldClass}>
                {(action === 'consume'
                  ? CONSUMPTION_REASONS.map(({ label }) => label)
                  : ADJUSTMENT_REASONS
                ).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FormField>
            <FormField
              label={action === 'consume' ? 'Related order or service (optional)' : 'Notes (optional)'}
              htmlFor="stock-reference"
              wide
            >
              <input
                id="stock-reference"
                placeholder={action === 'consume' ? 'e.g. ORD-10521' : ''}
                {...register('reference')}
                className={fieldClass}
              />
            </FormField>
          </>
        )}

        {large && (
          <p className="rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning sm:col-span-2">
            This changes stock by more than {ADJUSTMENT_APPROVAL_RATIO * 100}%. It is recorded
            as a manager-authorized adjustment in the movement log.
          </p>
        )}
      </form>
    </Modal>
  )
}

// ---------- Transfer ----------

export type TransferInput = {
  itemId: string
  qty: number
  // Destination branch uuid
  toBranch: string
  notes: string
}

// Ships stock from the item's branch to another branch. The stock leaves at
// once; the other branch books it in when it arrives
export function TransferDialog({
  items,
  branches,
  initialItemId,
  error,
  busy,
  onClose,
  onCreate,
}: {
  items: InventoryItem[]
  // Every branch of the business
  branches: { uuid: string; name: string }[]
  initialItemId: string
  error: string | null
  busy: boolean
  onClose: () => void
  onCreate: (input: TransferInput) => void
}) {
  const [itemId, setItemId] = useState(initialItemId)
  const [toBranch, setToBranch] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const item = items.find(({ id }) => id === itemId)
  const destinations = branches.filter(({ uuid }) => uuid !== item?.branchId)
  const destination = destinations.find(({ uuid }) => uuid === toBranch)
  const value = numeric(quantity)
  const free = item ? getAvailable(item) : 0
  const valid = item !== undefined && destination !== undefined && value > 0 && value <= free

  return (
    <Modal
      open
      onClose={onClose}
      title="Stock Transfer"
      subtitle="Send stock to another branch"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => item && onCreate({ itemId: item.id, qty: value, toBranch, notes: notes.trim() })}
            className={primaryButton}
          >
            {busy ? 'Sending…' : 'Create Transfer'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Item" htmlFor="transfer-item" wide>
          <ItemSelect
            id="transfer-item"
            items={items}
            value={itemId}
            onChange={(next) => {
              setItemId(next)
              setToBranch('')
            }}
          />
        </FormField>
        <FormField label="Destination branch" htmlFor="transfer-branch">
          <select
            id="transfer-branch"
            value={toBranch}
            onChange={(event) => setToBranch(event.target.value)}
            disabled={!item}
            className={fieldClass}
          >
            <option value="">{item ? 'Choose a branch…' : 'Choose an item first'}</option>
            {destinations.map(({ uuid, name }) => (
              <option key={uuid} value={uuid}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={`Transfer quantity${item ? ` (${item.unit})` : ''}`} htmlFor="transfer-quantity">
          <input
            id="transfer-quantity"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={fieldClass}
          />
          {item && value > free && (
            <p className="mt-1 text-[11px] font-semibold text-danger">
              Only {formatQty(free, item.unit)} is free to send; reserved stock cannot travel.
            </p>
          )}
        </FormField>
        <FormField label="Notes (optional)" htmlFor="transfer-notes" wide>
          <input
            id="transfer-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={fieldClass}
          />
        </FormField>
        {item && destination && value > 0 && (
          <dl className="space-y-1 rounded-lg bg-field p-3 text-xs sm:col-span-2">
            {(
              [
                ['From', item.branchName],
                ['To', destination.name],
                ['Item', item.name],
                ['Quantity', formatQty(value, item.unit)],
              ] as [string, string][]
            ).map(([label, text]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold text-ink">{text}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-[11px] text-muted sm:col-span-2">
          Stock leaves {item?.branchName || 'the source branch'} as soon as the transfer is created. The other branch
          marks it received when it arrives.
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Purchase order ----------

type PoLine = { key: number; itemId: string; qty: string; unitCost: string }

export type PurchaseOrderInput = {
  supplierId: string
  branchId: string
  // yyyy-MM-dd
  expectedAt: string
  notes: string
  lines: { itemId: string; qty: number; unitCost: number }[]
}

export function PurchaseOrderDialog({
  items,
  suppliers,
  branches,
  initialItemIds,
  defaultBranch,
  showCosts,
  error,
  busy,
  onClose,
  onCreate,
}: {
  items: InventoryItem[]
  // Active suppliers
  suppliers: Supplier[]
  branches: { uuid: string; name: string }[]
  initialItemIds: string[]
  defaultBranch: string
  showCosts: boolean
  error: string | null
  busy: boolean
  onClose: () => void
  onCreate: (input: PurchaseOrderInput) => void
}) {
  const seeded = items.filter(({ id }) => initialItemIds.includes(id))
  const [branchId, setBranchId] = useState(
    seeded[0]?.branchId || defaultBranch || (branches.length === 1 ? branches[0].uuid : ''),
  )
  const seededHere = seeded.filter((item) => item.branchId === branchId)
  const [supplierId, setSupplierId] = useState(
    () => suppliers.find(({ name }) => name === seededHere[0]?.supplier)?.id ?? suppliers[0]?.id ?? '',
  )
  const [expectedAt, setExpectedAt] = useState(() => inDays(2))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PoLine[]>(() =>
    seededHere.length > 0
      ? seededHere.map((item, key) => ({
          key,
          itemId: item.id,
          qty: String(getRecommendedOrder(item)),
          unitCost: String(item.unitCost),
        }))
      : [{ key: 0, itemId: '', qty: '', unitCost: '' }],
  )
  const [nextKey, setNextKey] = useState(lines.length)

  // Every item on an order is stocked by the branch the order is for
  const branchItems = items.filter((item) => item.branchId === branchId)
  const supplier = suppliers.find(({ id }) => id === supplierId)
  const update = (key: number, patch: Partial<PoLine>) =>
    setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const total = lines.reduce(
    (sum, line) => sum + numeric(line.qty) * numeric(line.unitCost),
    0,
  )
  const complete = lines.filter((line) => line.itemId && numeric(line.qty) > 0)
  const duplicated = new Set(complete.map(({ itemId }) => itemId)).size !== complete.length
  const otherSuppliers = complete.filter((line) => {
    const itemSupplier = items.find(({ id }) => id === line.itemId)?.supplier
    return itemSupplier && supplier && itemSupplier !== supplier.name
  }).length

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Create Purchase Order"
      subtitle="Saved as a draft for approval."
      footer={
        <>
          {showCosts && (
            <p className="mr-auto text-xs text-muted">
              Total: <span className="font-bold text-ink">{formatXaf(total)}</span>
            </p>
          )}
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={complete.length === 0 || duplicated || !supplierId || !branchId || busy}
            onClick={() =>
              onCreate({
                supplierId,
                branchId,
                expectedAt,
                notes: notes.trim(),
                lines: complete.map((line) => ({
                  itemId: line.itemId,
                  qty: numeric(line.qty),
                  unitCost: numeric(line.unitCost),
                })),
              })
            }
            className={primaryButton}
          >
            {busy ? 'Saving…' : 'Create Purchase Order'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {suppliers.length === 0 && (
          <p className="rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
            There is no active supplier yet. Add one under Suppliers first.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Supplier" htmlFor="po-supplier">
            <select
              id="po-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className={fieldClass}
            >
              {suppliers.map(({ id, name, leadTimeDays }) => (
                <option key={id} value={id}>
                  {name}
                  {leadTimeDays > 0 ? ` (${leadTimeDays}-day delivery)` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Branch" htmlFor="po-branch">
            <select
              id="po-branch"
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value)
                // The lines belonged to the other branch
                setLines([{ key: nextKey, itemId: '', qty: '', unitCost: '' }])
                setNextKey(nextKey + 1)
              }}
              disabled={branches.length <= 1}
              className={fieldClass}
            >
              {branches.length !== 1 && <option value="">Choose a branch…</option>}
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Expected delivery date" htmlFor="po-expected">
            <input
              id="po-expected"
              type="date"
              value={expectedAt}
              onChange={(event) => setExpectedAt(event.target.value)}
              className={fieldClass}
            />
          </FormField>
          <FormField label="Notes (optional)" htmlFor="po-notes">
            <input
              id="po-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={fieldClass}
            />
          </FormField>
        </div>

        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid grid-cols-[1fr_2rem] items-end gap-2 rounded-lg bg-field p-2 sm:grid-cols-[1fr_6rem_8rem_2rem]"
            >
              <div>
                <label htmlFor={`po-item-${line.key}`} className={labelClass}>
                  Item
                </label>
                <select
                  id={`po-item-${line.key}`}
                  value={line.itemId}
                  onChange={(event) => {
                    const item = items.find(({ id }) => id === event.target.value)
                    update(line.key, {
                      itemId: event.target.value,
                      qty: item ? String(getRecommendedOrder(item)) : line.qty,
                      unitCost: item ? String(item.unitCost) : line.unitCost,
                    })
                  }}
                  disabled={!branchId}
                  className={`${fieldClass} bg-white`}
                >
                  <option value="">{branchId ? 'Choose an item…' : 'Choose a branch first'}</option>
                  {branchItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-sm:col-start-1">
                <label htmlFor={`po-qty-${line.key}`} className={labelClass}>
                  Quantity
                </label>
                <input
                  id={`po-qty-${line.key}`}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={line.qty}
                  onChange={(event) => update(line.key, { qty: event.target.value })}
                  className={`${fieldClass} bg-white`}
                />
              </div>
              {showCosts && (
                <div className="max-sm:col-start-1">
                  <label htmlFor={`po-cost-${line.key}`} className={labelClass}>
                    Unit cost (XAF)
                  </label>
                  <input
                    id={`po-cost-${line.key}`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={line.unitCost}
                    onChange={(event) => update(line.key, { unitCost: event.target.value })}
                    className={`${fieldClass} bg-white`}
                  />
                </div>
              )}
              <button
                type="button"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter(({ key }) => key !== line.key))}
                aria-label="Remove line"
                className={`${iconButton} disabled:opacity-40 max-sm:col-start-2 max-sm:row-start-1`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setLines([...lines, { key: nextKey, itemId: '', qty: '', unitCost: '' }])
            setNextKey(nextKey + 1)
          }}
          className={secondaryButton}
        >
          <Plus className="size-4 text-muted" aria-hidden="true" />
          Add Item
        </button>
        {duplicated && (
          <p className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            An item can only be on the order once. Merge the lines.
          </p>
        )}
        {otherSuppliers > 0 && (
          <p className="rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
            {otherSuppliers} {otherSuppliers === 1 ? 'line is' : 'lines are'} usually bought
            from a different supplier. Check before sending this order.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Supplier ----------

type SupplierValues = {
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  paymentTerms: string
  leadTimeDays: string
  notes: string
  active: boolean
}

// Adds a supplier, or edits one (`supplier` set). An inactive supplier cannot
// take new purchase orders; one with orders can be deactivated, not deleted
export function SupplierDialog({
  supplier,
  error,
  busy,
  onClose,
  onSave,
}: {
  supplier: Supplier | null
  error: string | null
  busy: boolean
  onClose: () => void
  onSave: (changes: SupplierRequest) => void
}) {
  const [values, setValues] = useState<SupplierValues>({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    paymentTerms: supplier?.paymentTerms ?? '',
    leadTimeDays: supplier ? String(supplier.leadTimeDays) : '',
    notes: supplier?.notes ?? '',
    active: supplier?.active ?? true,
  })
  const set = (patch: Partial<SupplierValues>) => setValues({ ...values, ...patch })
  const text = (key: Exclude<keyof SupplierValues, 'active'>, label: string, wide = false) => (
    <FormField label={label} htmlFor={`supplier-${key}`} wide={wide}>
      <input
        id={`supplier-${key}`}
        value={values[key]}
        onChange={(event) => set({ [key]: event.target.value })}
        className={fieldClass}
      />
    </FormField>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? 'Edit Supplier' : 'Add Supplier'}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!values.name.trim() || busy}
            onClick={() =>
              onSave({
                name: values.name.trim(),
                contactName: values.contactName.trim(),
                phone: values.phone.trim(),
                email: values.email.trim(),
                address: values.address.trim(),
                paymentTerms: values.paymentTerms.trim(),
                leadTimeDays: numeric(values.leadTimeDays),
                notes: values.notes.trim(),
                active: values.active,
              })
            }
            className={primaryButton}
          >
            {busy ? 'Saving…' : supplier ? 'Save Supplier' : 'Add Supplier'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {text('name', 'Name', true)}
        {text('contactName', 'Contact person')}
        {text('phone', 'Phone')}
        {text('email', 'Email')}
        <FormField label="Delivery time (days)" htmlFor="supplier-leadTimeDays">
          <input
            id="supplier-leadTimeDays"
            type="number"
            min="0"
            inputMode="numeric"
            value={values.leadTimeDays}
            onChange={(event) => set({ leadTimeDays: event.target.value })}
            className={fieldClass}
          />
        </FormField>
        {text('paymentTerms', 'Payment terms')}
        {text('address', 'Address', true)}
        {text('notes', 'Notes', true)}
        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-semibold text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => set({ active: event.target.checked })}
            className="size-4 accent-brand"
          />
          Active (can be chosen on new purchase orders)
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Add item wizard ----------

const ITEM_STEPS = ['Basic', 'Stock', 'Cost', 'Expiration', 'Review']

export function ItemWizard({
  existing,
  branches,
  defaultBranch,
  suppliers,
  error,
  onClose,
  onCreate,
}: {
  existing: InventoryItem[]
  // The branches the person may stock; one is chosen for the new item
  branches: { uuid: string; name: string }[]
  defaultBranch: string
  // Supplier names to choose from
  suppliers: string[]
  error?: string | null
  onClose: () => void
  onCreate: (item: InventoryItem) => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<InventoryItem>(() => ({
    id: '',
    name: '',
    category: INVENTORY_CATEGORIES[0].name,
    description: '',
    unit: 'L',
    location: 'Central storage',
    stock: 0,
    reserved: 0,
    reorder: 0,
    safety: 0,
    max: 0,
    unitCost: 0,
    supplier: '',
    dailyUse: 0,
    batch: '',
    expiresAt: null,
    lastMovementAt: new Date().toISOString(),
    services: [],
    branchId: defaultBranch || (branches.length === 1 ? branches[0].uuid : ''),
    branchName: '',
    serviceIds: [],
  }))
  const patch = (change: Partial<InventoryItem>) => setDraft({ ...draft, ...change })

  const problems = [
    !draft.name.trim() && 'Item name is required (Basic).',
    !draft.branchId && 'Choose the branch that holds this item (Basic).',
    existing.some(
      ({ name, branchId, batch }) =>
        branchId === draft.branchId &&
        batch.trim().toLowerCase() === draft.batch.trim().toLowerCase() &&
        name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
    ) && 'This branch already has an item with this name and batch (Basic).',
    draft.max <= 0 && 'Maximum stock must be above zero (Stock).',
    draft.reorder > draft.max && 'Reorder level cannot be above the maximum (Stock).',
    draft.safety > draft.reorder && 'Safety stock cannot be above the reorder level (Stock).',
  ].filter((problem): problem is string => Boolean(problem))

  const number = (
    id: string,
    label: string,
    key: 'stock' | 'reorder' | 'safety' | 'max' | 'unitCost' | 'dailyUse',
  ) => (
    <FormField label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={draft[key] || ''}
        onChange={(event) => patch({ [key]: numeric(event.target.value) })}
        className={fieldClass}
      />
    </FormField>
  )

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Add Inventory Item"
      subtitle={`Step ${step + 1} of ${ITEM_STEPS.length}: ${ITEM_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`${secondaryButton} mr-auto`}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step < ITEM_STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={() => onCreate({ ...draft, name: draft.name.trim() })}
              className={primaryButton}
            >
              <Check className="size-4" aria-hidden="true" />
              Create Inventory Item
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1" aria-label="Wizard steps">
        {ITEM_STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => setStep(index)}
              className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`} />
              <span
                className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}
              >
                {index + 1} {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Item name" htmlFor="item-name">
            <input
              id="item-name"
              autoFocus
              autoComplete="off"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              className={fieldClass}
            />
          </FormField>
          <FormField label="Branch" htmlFor="item-branch">
            <select
              id="item-branch"
              value={draft.branchId}
              disabled={branches.length === 1}
              onChange={(event) => patch({ branchId: event.target.value })}
              className={fieldClass}
            >
              {branches.length !== 1 && <option value="">Choose a branch</option>}
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Category" htmlFor="item-category">
            <select
              id="item-category"
              value={draft.category}
              onChange={(event) => patch({ category: event.target.value })}
              className={fieldClass}
            >
              {INVENTORY_CATEGORIES.map(({ name }) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Unit of measurement" htmlFor="item-unit">
            <select
              id="item-unit"
              value={draft.unit}
              onChange={(event) => patch({ unit: event.target.value })}
              className={fieldClass}
            >
              {UNITS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Description" htmlFor="item-description" wide>
            <input
              id="item-description"
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              className={fieldClass}
            />
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {number('item-stock', `Opening quantity (${draft.unit})`, 'stock')}
          {number('item-max', `Maximum stock (${draft.unit})`, 'max')}
          {number('item-reorder', `Reorder level (${draft.unit})`, 'reorder')}
          {number('item-safety', `Safety stock (${draft.unit})`, 'safety')}
          {number('item-daily', `Expected daily use (${draft.unit})`, 'dailyUse')}
          <FormField label="Storage location" htmlFor="item-location">
            <input
              id="item-location"
              value={draft.location}
              onChange={(event) => patch({ location: event.target.value })}
              className={fieldClass}
            />
          </FormField>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {number('item-cost', 'Unit cost (XAF)', 'unitCost')}
          <FormField label="Supplier" htmlFor="item-supplier">
            <select
              id="item-supplier"
              value={draft.supplier}
              onChange={(event) => patch({ supplier: event.target.value })}
              className={fieldClass}
            >
              <option value="">No supplier</option>
              {suppliers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </FormField>
          <p className="rounded-lg bg-field p-3 text-xs text-ink sm:col-span-2">
            Inventory value = quantity × unit cost ={' '}
            <span className="font-bold">{formatXaf(draft.stock * draft.unitCost)}</span>
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-semibold text-ink sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.expiresAt !== null}
              onChange={(event) =>
                patch({
                  expiresAt: event.target.checked
                    ? new Date(inDays(180)).toISOString()
                    : null,
                })
              }
              className="size-4 accent-brand"
            />
            Track expiration (chemicals and other perishable products)
          </label>
          {draft.expiresAt !== null && (
            <FormField label="Expiration date" htmlFor="item-expiry">
              <input
                id="item-expiry"
                type="date"
                value={draft.expiresAt.slice(0, 10)}
                onChange={(event) =>
                  event.target.value &&
                  patch({ expiresAt: new Date(event.target.value).toISOString() })
                }
                className={fieldClass}
              />
            </FormField>
          )}
          <FormField label="Batch / lot number" htmlFor="item-batch">
            <input
              id="item-batch"
              value={draft.batch}
              onChange={(event) => patch({ batch: event.target.value })}
              className={fieldClass}
            />
          </FormField>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-field p-3 text-xs sm:grid-cols-2">
            {(
              [
                ['Item', draft.name || '—'],
                ['Branch', branches.find(({ uuid }) => uuid === draft.branchId)?.name ?? '—'],
                ['Category', draft.category],
                ['Opening stock', formatQty(draft.stock, draft.unit)],
                ['Reorder / safety / max', `${draft.reorder} / ${draft.safety} / ${draft.max} ${draft.unit}`],
                ['Unit cost', formatXaf(draft.unitCost)],
                ['Supplier', draft.supplier],
                ['Expiration', draft.expiresAt ? draft.expiresAt.slice(0, 10) : 'Not tracked'],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] text-muted">{label}</dt>
                <dd className="font-semibold break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/5 p-3 text-xs font-semibold text-danger ring-1 ring-danger/20">
              {error}
            </p>
          )}
          {problems.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-lg bg-danger/5 p-3 text-xs font-semibold text-danger ring-1 ring-danger/20"
            >
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
