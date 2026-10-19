import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Pencil, Plus, Zap } from 'lucide-react'
import {
  ADD_ONS,
  MACHINE_TYPES,
  PRICING_MODELS,
  PROMOTION_TYPES,
  VISIBILITIES,
} from '../../constants/services'
import type { ServicePermissions } from '../../constants/services'
import type { LaundryService, Promotion } from '../../types/service'
import { formatDate } from '../../utils/customers'
import { formatXaf } from '../../utils/orders'
import { formatHours, formatPrice } from '../../utils/services'
import CustomerActivityChart from '../customers/CustomerActivityChart'
import {
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { CapacityMeter, WorkflowChain } from './ServiceBits'
import { PanelEmpty } from '../ui/Panel'
import { DetailGrid } from '../ui/Details'

export type ServiceTabProps = {
  service: LaundryService
  now: number
  permissions: ServicePermissions
  // Opens the wizard on the given step
  onEditStep: (step: number) => void
  onChange: (change: (service: LaundryService) => LaundryService, audit: string) => void
  onCreatePromotion: () => void
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl bg-white p-4 ring-1 ring-line">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {action}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function EditButton({
  step,
  permissions,
  onEditStep,
}: Pick<ServiceTabProps, 'permissions' | 'onEditStep'> & { step: number }) {
  if (!permissions.edit) return null
  return (
    <button
      type="button"
      onClick={() => onEditStep(step)}
      className={`${secondaryButton} h-8`}
    >
      <Pencil className="size-3.5 text-muted" aria-hidden="true" />
      Edit
    </button>
  )
}

export function OverviewTab(props: ServiceTabProps) {
  const { service, permissions, onCreatePromotion } = props
  const visibility = VISIBILITIES.find(({ id }) => id === service.visibility)!

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <Panel title="Service information" action={<EditButton step={0} {...props} />}>
          <p className="text-xs leading-relaxed text-muted">{service.description}</p>
          <div className="mt-3">
            <DetailGrid
              rows={[
                ['Category', service.category],
                ['Service code', <span className="font-mono">{service.id}</span>],
                ['Processing time', formatHours(service.standardHours)],
                [
                  'Express',
                  service.express.enabled
                    ? `${service.express.hours} hours, +${service.express.surchargePct}%`
                    : 'Not offered',
                ],
                ['Customer visibility', `${visibility.label} (${visibility.help})`],
                ['Available', `${service.availableDays}, ${service.availableHours}`],
              ]}
            />
          </div>
          {service.includes.length > 0 && (
            <p className="mt-3 rounded-lg bg-field p-3 text-xs text-ink">
              <span className="block text-[10px] text-muted">Bundle includes</span>
              {service.includes.join(' + ')}
            </p>
          )}
        </Panel>

        <Panel title="Processing workflow" action={<EditButton step={2} {...props} />}>
          <WorkflowChain stages={service.workflow} />
        </Panel>
      </div>

      <div className="min-w-0 space-y-4">
        {service.dailyCapacity && (
          <Panel title="Service capacity">
            <CapacityMeter service={service} />
          </Panel>
        )}

        <Panel
          title="Promotions"
          action={
            permissions.edit && (
              <button
                type="button"
                onClick={onCreatePromotion}
                className={`${secondaryButton} h-8`}
              >
                <Plus className="size-3.5 text-muted" aria-hidden="true" />
                Create Promotion
              </button>
            )
          }
        >
          {service.promotions.length === 0 ? (
            <PanelEmpty>No active promotions.</PanelEmpty>
          ) : (
            <ul className="space-y-2">
              {service.promotions.map((promotion) => (
                <li key={promotion.name} className="rounded-lg bg-field p-3 text-xs">
                  <p className="font-semibold text-ink">
                    {promotion.value} {promotion.name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {promotion.type} · {promotion.from} to {promotion.to}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

export function PricingTab(props: ServiceTabProps) {
  const { service } = props
  const model = PRICING_MODELS.find(({ id }) => id === service.pricingModel)!

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pricing configuration" action={<EditButton step={1} {...props} />}>
        <p className="text-xl font-bold text-ink">{formatPrice(service)}</p>
        <div className="mt-3">
          <DetailGrid
            rows={[
              ['Pricing model', model.label],
              ['Pricing unit', model.unit],
              ['Minimum quantity', `${service.minQty} ${model.unit}`],
              ['Maximum quantity', service.maxQty ? `${service.maxQty} ${model.unit}` : 'No limit'],
            ]}
          />
        </div>
        {service.itemPrices.length > 0 && (
          <div className="relative mt-4 overflow-x-auto rounded-lg ring-1 ring-line">
            <table className="w-full min-w-[360px] text-left text-xs">
              <caption className="sr-only">Item pricing table</caption>
              <thead>
                <tr className="bg-field text-[9px] font-bold tracking-wider text-muted uppercase">
                  <th scope="col" className="px-3 py-2">Item</th>
                  <th scope="col" className="px-3 py-2">Unit</th>
                  <th scope="col" className="px-3 py-2 text-right">Price</th>
                  <th scope="col" className="px-3 py-2 text-right">Express price</th>
                </tr>
              </thead>
              <tbody>
                {service.itemPrices.map(({ item, price, expressPrice }) => (
                  <tr key={item} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">{item}</td>
                    <td className="px-3 py-2">Piece</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatXaf(price)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {service.express.enabled ? formatXaf(expressPrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Express service" action={<EditButton step={5} {...props} />}>
        {service.express.enabled ? (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Zap className="size-4 text-brand" aria-hidden="true" />
              Express Available
            </p>
            <div className="mt-3">
              <DetailGrid
                rows={[
                  ['Normal', formatHours(service.standardHours)],
                  ['Express', formatHours(service.express.hours)],
                  ['Express surcharge', `+${service.express.surchargePct}%`],
                  ['Minimum quantity', service.express.minQty],
                ]}
              />
            </div>
            <p className="mt-3 rounded-lg bg-field p-3 text-xs text-ink">
              Express orders accepted before {service.express.cutoff}.
            </p>
          </>
        ) : (
          <PanelEmpty>Express processing is not offered for this service.</PanelEmpty>
        )}
      </Panel>
    </div>
  )
}

export function WorkflowTab(props: ServiceTabProps) {
  const { service } = props
  return (
    <Panel title="Processing workflow" action={<EditButton step={2} {...props} />}>
      <ol className="space-y-2">
        {service.workflow.map((stage, index) => (
          <li key={stage} className="flex items-center gap-3 rounded-lg bg-field px-3 py-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <span className="text-xs font-semibold text-ink">{stage}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted">
        Standard processing: {formatHours(service.standardHours)}. Estimated
        completion is counted from order creation; branch hours and queue load
        are not yet factored in.
      </p>
    </Panel>
  )
}

export function AddOnsTab(props: ServiceTabProps) {
  const { service, permissions } = props
  const addOns = ADD_ONS.filter(({ id }) => service.addOnIds.includes(id))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Add-ons" action={<EditButton step={5} {...props} />}>
        {addOns.length === 0 ? (
          <PanelEmpty>No add-ons configured for this service.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {addOns.map(({ id, name, price, description }) => (
              <li key={id} className="flex items-center gap-3 rounded-lg bg-field p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{name}</p>
                  <p className="text-[11px] text-muted">{description}</p>
                </div>
                {permissions.pricing && (
                  <span className="shrink-0 font-bold text-brand tabular-nums">
                    +{formatXaf(price)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Options at order creation" action={<EditButton step={5} {...props} />}>
        {service.options.length === 0 ? (
          <PanelEmpty>No selectable options.</PanelEmpty>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {service.options.map((option) => (
              <li
                key={option}
                className="rounded-full bg-field px-3 py-1 text-[11px] font-semibold text-ink"
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export function MachinesTab(props: ServiceTabProps) {
  const { service } = props
  const machines = MACHINE_TYPES.filter(({ name }) => service.machines.includes(name))
  return (
    <Panel title="Machines & staff" action={<EditButton step={3} {...props} />}>
      {machines.length === 0 ? (
        <PanelEmpty>This service does not need any machine.</PanelEmpty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {machines.map(({ name, available, capacity }) => (
            <li key={name} className="rounded-lg bg-field p-3 text-xs">
              <p className="font-semibold text-ink">{name}</p>
              <p className="text-[11px] text-muted">
                {available} available · capacity {capacity}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Staff skill required:{' '}
        <span className="font-semibold text-ink">{service.staffSkill}</span>
      </p>
    </Panel>
  )
}

export function InventoryTab(props: ServiceTabProps) {
  const { service } = props
  const unit = PRICING_MODELS.find(({ id }) => id === service.pricingModel)!.unit
  return (
    <Panel title="Inventory consumption" action={<EditButton step={3} {...props} />}>
      {service.consumption.length === 0 ? (
        <PanelEmpty>No materials configured for this service.</PanelEmpty>
      ) : (
        <>
          <p className="text-[11px] text-muted">Expected usage per 1 {unit}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {service.consumption.map(({ material, amount, unit: materialUnit }) => (
              <li key={material} className="rounded-lg bg-field p-3 text-center">
                <p className="text-[10px] text-muted">{material}</p>
                <p className="text-sm font-bold text-ink">
                  {amount} {materialUnit}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

export function BranchesTab({ service, permissions, onChange }: ServiceTabProps) {
  const custom = service.pricingModel === 'custom'

  function update(
    branch: string,
    change: Partial<LaundryService['branches'][number]>,
    audit: string,
  ) {
    onChange(
      (current) => ({
        ...current,
        branches: current.branches.map((setting) =>
          setting.branch === branch ? { ...setting, ...change } : setting,
        ),
      }),
      audit,
    )
  }

  return (
    <Panel title="Branch availability & pricing">
      <ul className="space-y-2">
        {service.branches.map((setting) => (
          <li
            key={setting.branch}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-field px-3 py-2.5 text-xs"
          >
            <label className="flex min-w-40 flex-1 items-center gap-2 font-semibold text-ink">
              <input
                type="checkbox"
                disabled={!permissions.edit}
                checked={setting.available}
                onChange={(event) =>
                  update(
                    setting.branch,
                    { available: event.target.checked },
                    `${event.target.checked ? 'Enabled' : 'Disabled'} ${setting.branch} availability`,
                  )
                }
                className="size-4 accent-brand"
              />
              {setting.branch}
            </label>
            <Badge tone={setting.available ? 'success' : 'neutral'}>
              {setting.available ? 'Available' : 'Not offered'}
            </Badge>
            {permissions.pricing && !custom && (
              <span className="flex items-center gap-2">
                {setting.priceOverride === null ? (
                  <span className="text-muted">
                    Global price: {formatXaf(service.basePrice)}
                  </span>
                ) : (
                  <span className="font-semibold text-ink">
                    Override: {formatXaf(setting.priceOverride)}
                  </span>
                )}
                {permissions.edit && setting.available && (
                  <input
                    key={`${setting.branch}-${setting.priceOverride}`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-label={`Price override for ${setting.branch} in XAF`}
                    placeholder="Override price"
                    defaultValue={setting.priceOverride ?? ''}
                    onBlur={(event) => {
                      const next = event.target.value ? Number(event.target.value) : null
                      if (next === setting.priceOverride) return
                      update(
                        setting.branch,
                        { priceOverride: next },
                        next === null
                          ? `${setting.branch} now uses the global price`
                          : `Set ${setting.branch} price to ${formatXaf(next)}`,
                      )
                    }}
                    className={`${fieldClass} h-8 w-36! bg-white`}
                  />
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {permissions.edit && !custom && (
        <p className="mt-2 text-[11px] text-muted">
          Clear an override to go back to the global price. Changes save when you
          leave the field.
        </p>
      )}
    </Panel>
  )
}

export function PerformanceTab({ service, now, permissions }: ServiceTabProps) {
  const { stats } = service
  if (!permissions.financials) {
    return <PanelEmpty>Performance figures are not available for your role.</PanelEmpty>
  }
  if (stats.orders === 0) {
    return <PanelEmpty>No orders yet, so there is nothing to measure.</PanelEmpty>
  }

  const offered = service.branches.filter(({ available }) => available)
  // Sample split: no per-branch order data exists yet, so the total is shared by position
  const weights = offered.map((_, index) => offered.length - index * 0.6)
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <Panel title="Orders & revenue over time">
          <CustomerActivityChart
            monthlyOrders={service.monthlyOrders}
            monthlySpend={service.monthlyRevenue}
            now={now}
            showFinancials
            moneyLabel="Revenue"
            moneyVerb="revenue"
          />
        </Panel>
        <Panel title="Branch performance">
          <ul className="space-y-3">
            {offered.map(({ branch }, index) => {
              const share = weights[index] / weightTotal
              return (
                <li key={branch} className="text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-ink">{branch}</span>
                    <span className="text-muted tabular-nums">
                      {Math.round(stats.orders * share)} orders
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(share / (weights[0] / weightTotal)) * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[10px] text-muted">
            Illustrative split; per-branch order data is not recorded yet.
          </p>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4">
        <Panel title="Service performance">
          <DetailGrid
            rows={[
              ['Orders', stats.orders],
              ['Revenue', formatXaf(stats.revenue)],
              ['Average order value', formatXaf(stats.revenue / stats.orders)],
              ['Average processing time', `${stats.avgHours}h`],
              ['Customer satisfaction', `${stats.satisfaction}%`],
              ['Growth vs last period', `${stats.growthPct > 0 ? '+' : ''}${stats.growthPct}%`],
            ]}
          />
        </Panel>
        <Panel title="Quality metrics">
          <DetailGrid
            rows={[
              ['Quality pass rate', `${stats.qualityPass}%`],
              ['Late completion', `${stats.lateRate}%`],
              ['Reprocessing rate', `${stats.reprocessRate}%`],
              ['Customer complaints', stats.complaints],
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}

export function HistoryTab({ service }: ServiceTabProps) {
  return (
    <Panel title="Audit history">
      {service.audit.length === 0 ? (
        <PanelEmpty>No changes recorded yet.</PanelEmpty>
      ) : (
        <ol className="space-y-3 border-l border-line pl-4">
          {service.audit.map((entry, index) => (
            <li key={entry.at + index} className="relative text-xs">
              <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
              <time className="block text-[10px] text-muted">{formatDate(entry.at)}</time>
              <p className="font-semibold text-ink">
                {entry.by}: {entry.change}
              </p>
              {entry.from && entry.to && (
                <p className="text-[11px] text-muted">
                  {entry.from} → <span className="font-semibold text-ink">{entry.to}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function PromotionDialog({
  serviceName,
  onClose,
  onSave,
}: {
  serviceName: string
  onClose: () => void
  onSave: (promotion: Promotion) => void
}) {
  const { register, handleSubmit, control } = useForm<Promotion>({
    defaultValues: { name: '', type: PROMOTION_TYPES[0], value: '', from: '', to: '' },
  })
  const [name, from, to] = useWatch({ control, name: ['name', 'from', 'to'] })
  const valid = name.trim() !== '' && from !== '' && to !== '' && from <= to

  function onSubmit(values: Promotion) {
    if (valid) onSave({ ...values, name: values.name.trim(), value: values.value.trim() })
  }

  return (
    <Modal open onClose={onClose} title="Create Promotion" subtitle={serviceName}>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="promotion-name" className={labelClass}>
            Promotion name
          </label>
          <input
            id="promotion-name"
            autoFocus
            placeholder="e.g. Weekend Discount"
            {...register('name')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="promotion-type" className={labelClass}>
            Type
          </label>
          <select
            id="promotion-type"
            {...register('type')}
            className={fieldClass}
          >
            {PROMOTION_TYPES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="promotion-value" className={labelClass}>
            Value
          </label>
          <input
            id="promotion-value"
            placeholder="e.g. 10% or XAF 500"
            {...register('value')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="promotion-from" className={labelClass}>
            Starts
          </label>
          <input
            id="promotion-from"
            type="date"
            {...register('from')}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="promotion-to" className={labelClass}>
            Ends
          </label>
          <input
            id="promotion-to"
            type="date"
            {...register('to')}
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          disabled={!valid}
          className={`${primaryButton} sm:col-span-2`}
        >
          Create Promotion
        </button>
      </form>
    </Modal>
  )
}
