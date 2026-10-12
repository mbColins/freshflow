import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarClock,
  Check,
  CircleCheck,
  HeartPulse,
  History,
  Megaphone,
  Plus,
  RotateCcw,
  Table2,
  Trash2,
  TriangleAlert,
  Truck,
  Workflow,
} from 'lucide-react'
import { SPEEDS } from '../../constants/pricing'
import type {
  PriceChange,
  PricingConfig,
  QuoteInput,
  ScheduledChange,
  Speed,
} from '../../types/pricing'
import type { Promotion } from '../../types/promotion'
import type { LaundryService } from '../../types/service'
import { formatDate } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import { calculateQuote, getGlobalPrice, getUnit } from '../../utils/pricing'
import type { PricingIssue } from '../../utils/pricing'
import {
  dayNumber,
  formatDay,
  formatOffer,
  formatValidity,
  getPromotionStatus,
  toDateKey,
} from '../../utils/promotions'
import { formatCompactXaf } from '../../utils/services'
import { fieldClass, iconButton, labelClass, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'

// Validated chart colour for single-series bars
const BAR_COLOR = '#2a78d6'
const headClass = 'text-[10px] font-bold tracking-wider text-muted uppercase'

// ---------- Branch pricing matrix ----------

export function BranchMatrix({
  services,
  canManage,
  onOverride,
}: {
  services: LaundryService[]
  canManage: boolean
  // null resets the branch to the global price
  onOverride: (serviceId: string, branch: string, price: number | null) => void
}) {
  const [editing, setEditing] = useState<{ serviceId: string; branch: string; value: string } | null>(null)
  const branches = services[0]?.branches.map(({ branch }) => branch) ?? []
  const overrides = services.reduce(
    (count, service) => count + service.branches.filter(({ available, priceOverride }) => available && priceOverride !== null).length,
    0,
  )

  function commit() {
    if (!editing) return
    const price = Number(editing.value)
    if (editing.value !== '' && price > 0) onOverride(editing.serviceId, editing.branch, price)
    setEditing(null)
  }

  return (
    <Panel
      title="Branch Pricing Matrix"
      subtitle={canManage ? 'Click a price to give that branch its own rate' : 'Global price and each branch’s rate'}
      icon={Table2}
      badge={<Badge tone={overrides > 0 ? 'brand' : 'neutral'}>{overrides} branch {overrides === 1 ? 'override' : 'overrides'}</Badge>}
    >
      {services.length === 0 ? (
        <PanelEmpty>No services match the current filters.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className={headClass}>
              <tr>
                <th scope="col" className="py-2 pr-3">Service</th>
                <th scope="col" className="py-2 pr-3 text-right">Global</th>
                {branches.map((branch) => (
                  <th key={branch} scope="col" className="py-2 pr-3 text-right">{branch}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {services.map((service) => {
                const custom = service.pricingModel === 'custom'
                const global = getGlobalPrice(service)
                return (
                  <tr key={service.id}>
                    <th scope="row" className="py-2 pr-3 font-semibold text-ink">
                      {service.name}
                      <span className="block font-mono text-[10px] font-normal text-muted">
                        {service.id} · per {getUnit(service)}
                      </span>
                    </th>
                    <td className="py-2 pr-3 text-right font-bold whitespace-nowrap text-ink tabular-nums">
                      {custom && <span className="mr-1 font-normal text-muted">from</span>}
                      {formatXaf(global)}
                    </td>
                    {service.branches.map(({ branch, available, priceOverride }) => {
                      const active = editing?.serviceId === service.id && editing.branch === branch
                      const gap = priceOverride !== null && global > 0 ? ((priceOverride - global) / global) * 100 : 0
                      return (
                        <td key={branch} className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          {!available ? (
                            <span className="text-muted">Not offered</span>
                          ) : custom ? (
                            <span className="text-muted">Item prices</span>
                          ) : active ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                autoFocus
                                aria-label={`${service.name} price at ${branch}`}
                                value={editing.value}
                                onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') commit()
                                  if (event.key === 'Escape') setEditing(null)
                                }}
                                className={`${fieldClass} h-7 w-24! text-right`}
                              />
                              <button type="button" aria-label="Save branch price" onClick={commit} className={`${iconButton} size-7 text-success`}>
                                <Check className="size-3.5" aria-hidden="true" />
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1">
                              {canManage ? (
                                <button
                                  type="button"
                                  title="Override branch price"
                                  onClick={() => setEditing({ serviceId: service.id, branch, value: String(priceOverride ?? global) })}
                                  className={`rounded px-1.5 py-0.5 hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                                    priceOverride !== null ? 'bg-brand/10 font-bold text-brand' : 'text-muted'
                                  }`}
                                >
                                  {formatXaf(priceOverride ?? global)}
                                </button>
                              ) : (
                                <span className={priceOverride !== null ? 'font-bold text-brand' : 'text-muted'}>
                                  {formatXaf(priceOverride ?? global)}
                                </span>
                              )}
                              {priceOverride !== null && (
                                <>
                                  <span className={`text-[10px] font-semibold ${gap >= 0 ? 'text-warning' : 'text-success'}`}>
                                    {gap >= 0 ? '+' : '−'}{Math.abs(gap).toFixed(1)}%
                                  </span>
                                  {canManage && (
                                    <button
                                      type="button"
                                      aria-label={`Reset ${service.name} at ${branch} to the global price`}
                                      title="Reset to global price"
                                      onClick={() => onOverride(service.id, branch, null)}
                                      className={`${iconButton} size-6`}
                                    >
                                      <RotateCcw className="size-3" aria-hidden="true" />
                                    </button>
                                  )}
                                </>
                              )}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted">
            Highlighted prices differ from the global price; the percentage shows by how much. Grey prices follow the global price.
          </p>
        </div>
      )}
    </Panel>
  )
}

// ---------- Price calculator ----------

export function PriceCalculator({ services, config }: { services: LaundryService[]; config: PricingConfig }) {
  const orderable = services.filter(({ status }) => status === 'active')
  const [input, setInput] = useState<QuoteInput>(() => ({
    serviceId: orderable[0]?.id ?? '',
    itemIndex: 0,
    quantity: 8,
    groupId: config.groups[0]?.id ?? '',
    speed: 'standard',
    branch: orderable[0]?.branches[0]?.branch ?? '',
    zoneId: '',
    surchargeIds: [],
  }))
  const service = orderable.find(({ id }) => id === input.serviceId) ?? orderable[0]
  const patch = (change: Partial<QuoteInput>) => setInput({ ...input, ...change })

  if (!service) {
    return (
      <Panel title="Price Calculator" icon={Calculator}>
        <PanelEmpty>Activate a service to preview its price.</PanelEmpty>
      </Panel>
    )
  }

  const quote = calculateQuote(service, config, input)
  const unit = getUnit(service)
  const optional = config.surcharges.filter(({ id, enabled }) => enabled && id !== 'sameday')
  const tones = { base: 'text-ink', discount: 'text-success', surcharge: 'text-warning', delivery: 'text-ink', tax: 'text-ink' }

  return (
    <Panel title="Price Calculator" subtitle="Preview what a customer would pay" icon={Calculator}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="calc-service" className={labelClass}>Service</label>
            <select id="calc-service" value={service.id} onChange={(event) => patch({ serviceId: event.target.value, itemIndex: 0 })} className={fieldClass}>
              {orderable.map(({ id, name }) => (
                <option key={id} value={id}>{name} ({id})</option>
              ))}
            </select>
          </div>
          {service.pricingModel === 'custom' && (
            <div>
              <label htmlFor="calc-item" className={labelClass}>Item</label>
              <select id="calc-item" value={input.itemIndex} onChange={(event) => patch({ itemIndex: Number(event.target.value) })} className={fieldClass}>
                {service.itemPrices.map(({ item }, index) => (
                  <option key={item} value={index}>{item}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="calc-quantity" className={labelClass}>Quantity ({unit})</label>
            <input id="calc-quantity" type="number" min={0} step={unit === 'kg' ? 0.5 : 1} value={input.quantity} onChange={(event) => patch({ quantity: Math.max(0, Number(event.target.value)) })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="calc-group" className={labelClass}>Customer</label>
            <select id="calc-group" value={input.groupId} onChange={(event) => patch({ groupId: event.target.value })} className={fieldClass}>
              {config.groups.map(({ id, name, discountPct }) => (
                <option key={id} value={id}>{name}{discountPct > 0 ? ` (−${discountPct}%)` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="calc-speed" className={labelClass}>Speed</label>
            <select id="calc-speed" value={input.speed} onChange={(event) => patch({ speed: event.target.value as Speed })} className={fieldClass}>
              {SPEEDS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="calc-branch" className={labelClass}>Branch</label>
            <select id="calc-branch" value={input.branch} onChange={(event) => patch({ branch: event.target.value })} className={fieldClass}>
              {service.branches.map(({ branch }) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="calc-zone" className={labelClass}>Pickup &amp; delivery</label>
            <select id="calc-zone" value={input.zoneId} onChange={(event) => patch({ zoneId: event.target.value })} className={fieldClass}>
              <option value="">Counter drop-off (none)</option>
              {config.zones.map(({ id, name, distance }) => (
                <option key={id} value={id}>{name} ({distance})</option>
              ))}
            </select>
          </div>
        </div>
        {optional.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {optional.map(({ id, name }) => {
              const on = input.surchargeIds.includes(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ surchargeIds: on ? input.surchargeIds.filter((current) => current !== id) : [...input.surchargeIds, id] })}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                      on ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-line'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="rounded-lg bg-field p-3" aria-live="polite">
          <dl className="space-y-1.5 text-xs">
            {quote.lines.map(({ label, amount, kind, note }) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="min-w-0 text-muted">
                  {label}
                  {note && <span className="block text-[10px]">{note}</span>}
                </dt>
                <dd className={`font-semibold whitespace-nowrap tabular-nums ${tones[kind]}`}>
                  {amount < 0 ? `− ${formatXaf(-amount)}` : kind === 'base' ? formatXaf(amount) : `+ ${formatXaf(amount)}`}
                </dd>
              </div>
            ))}
            {quote.tax === 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tax</dt>
                <dd className="font-semibold text-ink tabular-nums">{formatXaf(0)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <dt className="text-sm font-bold text-ink">Final price</dt>
              <dd className="text-xl font-extrabold text-brand tabular-nums">{formatXaf(quote.total)}</dd>
            </div>
          </dl>
          {quote.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
              {quote.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ---------- Rules ----------

export function RulesPanel({ rules }: { rules: { when: string; then: string; source: string }[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rules : rules.slice(0, 8)
  return (
    <Panel
      title="Pricing Rules"
      subtitle="Every rule the price engine applies, built from the settings on this page"
      icon={Workflow}
      badge={<Badge tone="brand">{rules.length}</Badge>}
    >
      {rules.length === 0 ? (
        <PanelEmpty>No pricing rules yet. Add tiers, surcharges or customer discounts.</PanelEmpty>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map(({ when, then, source }) => (
              <li key={`${source}-${when}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs">
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted ring-1 ring-line">IF</span>
                <span className="min-w-0 text-ink">{when}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">THEN</span>
                <span className="font-semibold text-ink">{then}</span>
                <span className="ml-auto text-[10px] text-muted">{source}</span>
              </li>
            ))}
          </ul>
          {rules.length > 8 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className={`${secondaryButton} mt-2`}>
              {showAll ? 'Show fewer' : `Show all ${rules.length} rules`}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

// ---------- Editable configuration lists ----------

type Column<T> = {
  key: keyof T & string
  label: string
  type: 'text' | 'number' | 'toggle' | 'kind'
  suffix?: string
}

function EditableRows<T extends { id: string; name: string }>({
  rows,
  columns,
  canEdit,
  onChange,
  createRow,
  addLabel,
}: {
  rows: T[]
  columns: Column<T>[]
  canEdit: boolean
  onChange: (rows: T[]) => void
  createRow: () => T
  addLabel: string
}) {
  const update = (id: string, key: string, value: unknown) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  const display = (row: T, { key, type, suffix }: Column<T>) => {
    const value = row[key]
    if (type === 'toggle') return value ? 'On' : 'Off'
    if (type === 'kind') return value === 'percent' ? 'Percentage' : 'Fixed amount'
    return `${typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}${suffix ?? ''}`
  }
  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className={headClass}>
            <tr>
              {columns.map(({ key, label, type }) => (
                <th key={key} scope="col" className={`py-2 pr-2 ${type === 'number' ? 'text-right' : ''}`}>{label}</th>
              ))}
              {canEdit && <th scope="col" className="py-2"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => {
                  const { key, label, type } = column
                  const name = `${row.name}: ${label}`
                  return (
                    <td key={key} className={`py-1.5 pr-2 ${type === 'number' ? 'text-right tabular-nums' : ''}`}>
                      {!canEdit ? (
                        <span className={key === 'name' ? 'font-semibold text-ink' : 'text-muted'}>{display(row, column)}</span>
                      ) : type === 'toggle' ? (
                        <input type="checkbox" aria-label={name} checked={Boolean(row[key])} onChange={(event) => update(row.id, key, event.target.checked)} className="size-4 accent-brand" />
                      ) : type === 'kind' ? (
                        <select aria-label={name} value={String(row[key])} onChange={(event) => update(row.id, key, event.target.value)} className={`${fieldClass} h-8 w-24!`}>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      ) : type === 'number' ? (
                        <input type="number" min={0} aria-label={name} value={Number(row[key])} onChange={(event) => update(row.id, key, Math.max(0, Number(event.target.value)))} className={`${fieldClass} h-8 w-24! text-right`} />
                      ) : (
                        <input type="text" aria-label={name} value={String(row[key])} onChange={(event) => update(row.id, key, event.target.value)} className={`${fieldClass} h-8 min-w-24 ${key === 'name' ? 'font-semibold' : ''}`} />
                      )}
                    </td>
                  )
                })}
                {canEdit && (
                  <td className="py-1.5 text-right">
                    <button type="button" aria-label={`Remove ${row.name}`} onClick={() => onChange(rows.filter(({ id }) => id !== row.id))} className={iconButton}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <PanelEmpty>Nothing configured.</PanelEmpty>}
      {canEdit && (
        <button type="button" onClick={() => onChange([...rows, createRow()])} className={`${secondaryButton} mt-2`}>
          <Plus className="size-3.5 text-muted" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </>
  )
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`

export function ConfigPanels({
  config,
  canManage,
  onChange,
}: {
  config: PricingConfig
  canManage: boolean
  onChange: (patch: Partial<PricingConfig>) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Customer Group Pricing" subtitle="Discount each group gets off the service subtotal">
        <EditableRows
          rows={config.groups}
          canEdit={canManage}
          onChange={(groups) => onChange({ groups })}
          createRow={() => ({ id: newId('group'), name: 'New group', discountPct: 0, note: '' })}
          addLabel="Add group"
          columns={[
            { key: 'name', label: 'Group', type: 'text' },
            { key: 'discountPct', label: 'Discount %', type: 'number', suffix: '%' },
            { key: 'note', label: 'Who it covers', type: 'text' },
          ]}
        />
      </Panel>

      <Panel title="Surcharges" subtitle="Express surcharges are set per service; these apply across services">
        <EditableRows
          rows={config.surcharges}
          canEdit={canManage}
          onChange={(surcharges) => onChange({ surcharges })}
          createRow={() => ({ id: newId('surcharge'), name: 'New surcharge', kind: 'fixed' as const, value: 0, when: '', enabled: false })}
          addLabel="Add surcharge"
          columns={[
            { key: 'name', label: 'Surcharge', type: 'text' },
            { key: 'kind', label: 'Type', type: 'kind' },
            { key: 'value', label: 'Value', type: 'number' },
            { key: 'when', label: 'Applies when', type: 'text' },
            { key: 'enabled', label: 'On', type: 'toggle' },
          ]}
        />
      </Panel>

      <Panel title="Pickup & Delivery Zones" icon={Truck} subtitle="Fees by distance from the branch">
        <EditableRows
          rows={config.zones}
          canEdit={canManage}
          onChange={(zones) => onChange({ zones })}
          createRow={() => ({ id: newId('zone'), name: `Zone ${String.fromCharCode(65 + config.zones.length)}`, distance: '', deliveryFee: 0, pickupFee: 0, minOrder: 0 })}
          addLabel="Add zone"
          columns={[
            { key: 'name', label: 'Zone', type: 'text' },
            { key: 'distance', label: 'Distance', type: 'text' },
            { key: 'deliveryFee', label: 'Delivery', type: 'number' },
            { key: 'pickupFee', label: 'Pickup', type: 'number' },
            { key: 'minOrder', label: 'Min. order', type: 'number' },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-ink">
          <label htmlFor="free-delivery">Free delivery for orders from</label>
          {canManage ? (
            <input
              id="free-delivery"
              type="number"
              min={0}
              step={500}
              value={config.freeDeliveryAbove}
              onChange={(event) => onChange({ freeDeliveryAbove: Math.max(0, Number(event.target.value)) })}
              className={`${fieldClass} h-8 w-28! text-right`}
            />
          ) : (
            <span className="font-bold">{formatXaf(config.freeDeliveryAbove)}</span>
          )}
          <span className="text-muted">(0 turns it off)</span>
        </div>
      </Panel>

      <Panel title="Taxes" subtitle="Set the taxes your jurisdiction requires; none are assumed">
        <EditableRows
          rows={config.taxes}
          canEdit={canManage}
          onChange={(taxes) => onChange({ taxes })}
          createRow={() => ({ id: newId('tax'), name: 'New tax', rate: 0, appliesTo: 'All services', enabled: false })}
          addLabel="Add tax"
          columns={[
            { key: 'name', label: 'Tax', type: 'text' },
            { key: 'rate', label: 'Rate %', type: 'number', suffix: '%' },
            { key: 'appliesTo', label: 'Applies to', type: 'text' },
            { key: 'enabled', label: 'Active', type: 'toggle' },
          ]}
        />
      </Panel>
    </div>
  )
}

// ---------- Scheduled changes and history ----------

export function ScheduledChangesPanel({
  scheduled,
  services,
  now,
  canManage,
  onApply,
  onCancel,
}: {
  scheduled: ScheduledChange[]
  services: LaundryService[]
  now: number
  canManage: boolean
  onApply: (id: string) => void
  onCancel: (id: string) => void
}) {
  const today = dayNumber(toDateKey(now))
  const rows = [...scheduled].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
  return (
    <Panel title="Scheduled Price Changes" icon={CalendarClock} badge={rows.length > 0 && <Badge tone="brand">{rows.length}</Badge>}>
      {rows.length === 0 ? (
        <PanelEmpty>No scheduled price changes.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {rows.map((change) => {
            const service = services.find(({ id }) => id === change.serviceId)
            if (!service) return null
            const days = dayNumber(change.effectiveAt) - today
            const pct = service.basePrice > 0 ? ((change.newPrice - service.basePrice) / service.basePrice) * 100 : 0
            return (
              <li key={change.id} className="rounded-lg bg-field p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{service.name}</p>
                    <p className="mt-0.5 text-xs tabular-nums">
                      <span className="text-muted line-through">{formatXaf(service.basePrice)}</span>
                      <ArrowRight className="mx-1 inline size-3 text-muted" aria-label="changes to" />
                      <span className="font-bold text-ink">{formatXaf(change.newPrice)}</span>
                      <span className="ml-1.5 text-[11px] text-muted">({pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%) / {getUnit(service)}</span>
                    </p>
                  </div>
                  <Badge tone={days <= 0 ? 'danger' : days <= 3 ? 'warning' : 'brand'}>
                    {days <= 0 ? 'Due' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  Effective {formatDay(change.effectiveAt, true)} · {change.reason} · by {change.by}
                </p>
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onApply(change.id)} className={`${secondaryButton} h-8`}>
                      Apply now
                    </button>
                    <button type="button" onClick={() => onCancel(change.id)} className={`${secondaryButton} h-8 text-danger`}>
                      Cancel change
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function PriceHistoryPanel({ changes }: { changes: PriceChange[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? changes : changes.slice(0, 5)
  return (
    <Panel title="Price History" subtitle="A record of every price change; entries cannot be edited" icon={History}>
      {changes.length === 0 ? (
        <PanelEmpty>No pricing history yet.</PanelEmpty>
      ) : (
        <>
          <ol className="space-y-2">
            {visible.map((change) => (
              <li key={change.id} className="rounded-lg bg-field px-3 py-2 text-xs">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-bold text-ink">
                    {change.serviceName}
                    <span className="ml-1.5 font-normal text-muted">{change.scope}</span>
                  </span>
                  <span className="tabular-nums">
                    <span className="text-muted">{formatXaf(change.from)}</span>
                    <ArrowRight className="mx-1 inline size-3 text-muted" aria-label="changed to" />
                    <span className="font-bold text-ink">{formatXaf(change.to)}</span>
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {change.by} · {formatDate(change.at)} · {change.reason}
                </p>
              </li>
            ))}
          </ol>
          {changes.length > 5 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className={`${secondaryButton} mt-2`}>
              {showAll ? 'Show recent only' : `View full history (${changes.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

// ---------- Pricing health ----------

export function HealthPanel({
  health,
  onReview,
}: {
  health: { issues: PricingIssue[]; problems: number; score: number }
  onReview: (serviceId: string) => void
}) {
  const { issues, problems, score } = health
  const tone = problems === 0 ? 'text-success' : score >= 90 ? 'text-warning' : 'text-danger'
  return (
    <Panel title="Pricing Health" icon={HeartPulse} subtitle="Checks for missing, inconsistent or conflicting prices">
      <p className="flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold tabular-nums ${tone}`}>{score}%</span>
        <span className="text-xs text-muted">
          {problems === 0 ? 'No issues need attention' : `${problems} ${problems === 1 ? 'issue needs' : 'issues need'} attention`}
        </span>
      </p>
      {issues.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-3 text-xs text-success">
          <CircleCheck className="size-4" aria-hidden="true" />
          Every active service has a valid, consistent price.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {issues.map(({ level, text, serviceId }) => (
            <li
              key={text}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${level === 'problem' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-ink">
                <span className="sr-only">{level === 'problem' ? 'Problem: ' : 'Notice: '}</span>
                {text}
              </span>
              {serviceId && (
                <button type="button" onClick={() => onReview(serviceId)} className="shrink-0 rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  Review
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Analytics ----------

export function PricingAnalytics({ services, changes }: { services: LaundryService[]; changes: PriceChange[] }) {
  const ranked = services.filter(({ stats }) => stats.revenue > 0).sort((a, b) => b.stats.revenue - a.stats.revenue)
  const top = Math.max(...ranked.map(({ stats }) => stats.revenue), 1)
  const orders = ranked.reduce((sum, { stats }) => sum + stats.orders, 0)
  const revenue = ranked.reduce((sum, { stats }) => sum + stats.revenue, 0)
  // Latest global change per service, set against how order volume moved
  const moves = ranked.flatMap((service) => {
    const change = changes.find(({ serviceId, scope }) => serviceId === service.id && scope === 'Global')
    return change && change.from > 0 ? [{ service, pct: ((change.to - change.from) / change.from) * 100 }] : []
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Revenue by Service"
        subtitle={`${formatCompactXaf(revenue)} from ${orders.toLocaleString('en-US')} orders · average order ${formatXaf(orders ? Math.round(revenue / orders) : 0)}`}
        icon={BarChart3}
      >
        {ranked.length === 0 ? (
          <PanelEmpty>No revenue recorded yet.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {ranked.map(({ id, name, stats }) => (
              <li key={id} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 text-xs" title={`${name}: ${formatXaf(stats.revenue)} from ${stats.orders} orders`}>
                <span className="truncate text-muted">{name}</span>
                <span className="h-4 rounded-sm bg-field">
                  <span className="block h-full rounded-r" style={{ width: `${(stats.revenue / top) * 100}%`, background: BAR_COLOR }} />
                </span>
                <span className="text-right font-bold whitespace-nowrap text-ink tabular-nums">{formatCompactXaf(stats.revenue).replace('XAF ', '')}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Price vs Volume" subtitle="Latest global price change next to the order trend since">
        {moves.length === 0 ? (
          <PanelEmpty>No global price changes to compare yet.</PanelEmpty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-xs">
              <thead className={headClass}>
                <tr>
                  <th scope="col" className="py-2 pr-3">Service</th>
                  <th scope="col" className="py-2 pr-3 text-right">Price change</th>
                  <th scope="col" className="py-2 pr-3 text-right">Order volume</th>
                  <th scope="col" className="py-2">Reading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {moves.map(({ service, pct }) => {
                  const volume = service.stats.growthPct
                  const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
                  return (
                    <tr key={service.id}>
                      <th scope="row" className="py-2 pr-3 font-semibold text-ink">{service.name}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{signed(pct)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${volume < 0 ? 'text-danger' : 'text-success'}`}>{signed(volume)}</td>
                      <td className="py-2 text-muted">
                        {pct > 0 && volume < 0 ? 'Demand fell after the increase' : pct > 0 ? 'Demand held after the increase' : 'Demand after a price cut'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-muted">
          Order volume is each service’s month-on-month trend. It shows what happened alongside the change, not that the change caused it.
        </p>
      </Panel>
    </div>
  )
}

// ---------- Active campaigns ----------

export function CampaignsPanel({ promotions, now }: { promotions: Promotion[]; now: number }) {
  const active = promotions.filter((promotion) => getPromotionStatus(promotion, now) === 'active')
  const discount = active.reduce((sum, { stats }) => sum + stats.discount, 0)
  const orders = active.reduce((sum, { stats }) => sum + stats.uses, 0)
  return (
    <Panel
      title="Active Promotions"
      subtitle={`${orders.toLocaleString('en-US')} discounted orders · ${formatCompactXaf(discount)} discount given`}
      icon={Megaphone}
      action={
        <Link to="/promotions" className={secondaryButton}>
          Manage Promotions
        </Link>
      }
    >
      {active.length === 0 ? (
        <PanelEmpty>No promotions are running.</PanelEmpty>
      ) : (
        <ul className="space-y-1.5">
          {active.slice(0, 6).map((promotion) => (
            <li key={promotion.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-field px-3 py-2 text-xs">
              <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand">
                {promotion.code || 'AUTO'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{promotion.name}</span>
                <span className="ml-1.5 text-muted">{formatOffer(promotion)} · {promotion.services.join(', ') || 'whole order'}</span>
              </span>
              <span className="text-[11px] text-muted">{formatValidity(promotion)}</span>
            </li>
          ))}
          {active.length > 6 && <li className="text-[11px] text-muted">+ {active.length - 6} more running</li>}
        </ul>
      )}
    </Panel>
  )
}
