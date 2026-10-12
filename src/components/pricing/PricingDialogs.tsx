import { useState } from 'react'
import { ArrowRight, Plus, Trash2, TriangleAlert } from 'lucide-react'
import type {
  BulkAdjustment,
  PriceTier,
  ScheduledChange,
} from '../../types/pricing'
import type { LaundryService } from '../../types/service'
import { formatXaf } from '../../utils/orders'
import { getOverrides, getTierBands, getUnit, previewBulk } from '../../utils/pricing'
import type { ImportRow } from '../../utils/pricing'
import { formatDay, toDateKey } from '../../utils/promotions'
import { formatCompactXaf } from '../../utils/services'
import {
  dangerButton,
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'

const signedPct = (from: number, to: number) => {
  if (from <= 0) return ''
  const pct = ((to - from) / from) * 100
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
}

function Change({ from, to }: { from: number; to: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-muted">{formatXaf(from)}</span>
      <ArrowRight className="mx-1 inline size-3 text-muted" aria-label="changes to" />
      <span className="font-bold text-ink">{formatXaf(to)}</span>
      <span className={`ml-1.5 text-[11px] font-semibold ${to >= from ? 'text-warning' : 'text-success'}`}>{signedPct(from, to)}</span>
    </span>
  )
}

// ---------- Change or schedule one price ----------

export function PriceChangeDialog({
  service,
  scheduled,
  now,
  onClose,
  onSubmit,
}: {
  service: LaundryService
  scheduled: ScheduledChange[]
  now: number
  onClose: () => void
  onSubmit: (price: number, effectiveAt: string, reason: string) => void
}) {
  const today = toDateKey(now)
  const [price, setPrice] = useState(String(service.basePrice))
  const [effectiveAt, setEffectiveAt] = useState(today)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const next = Number(price)
  const valid = price !== '' && next > 0 && next !== service.basePrice
  const later = effectiveAt > today
  const overrides = getOverrides(service)
  const following = service.branches.filter(({ available, priceOverride }) => available && priceOverride === null)
  const pending = scheduled.filter(({ serviceId }) => serviceId === service.id)
  const unit = getUnit(service)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change price: ${service.name}`}
      subtitle={`${service.id} · current price ${formatXaf(service.basePrice)} / ${unit}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || !reason.trim() || !confirmed || effectiveAt < today}
            onClick={() => onSubmit(next, effectiveAt, reason.trim())}
            className={primaryButton}
          >
            {later ? 'Schedule Change' : 'Apply Price Now'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="change-price" className={labelClass}>New global price (XAF / {unit})</label>
            <input id="change-price" type="number" min={1} value={price} onChange={(event) => { setPrice(event.target.value); setConfirmed(false) }} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="change-date" className={labelClass}>Effective from</label>
            <input id="change-date" type="date" min={today} value={effectiveAt} onChange={(event) => { setEffectiveAt(event.target.value || today); setConfirmed(false) }} className={fieldClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="change-reason" className={labelClass}>Reason (kept in the price history)</label>
            <input id="change-reason" placeholder="e.g. Supplier cost increase" value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="rounded-lg bg-field p-3 text-xs">
          <p className={sectionTitle}>What will change</p>
          {valid ? (
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Global price</dt>
                <dd><Change from={service.basePrice} to={next} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Effective</dt>
                <dd className="font-semibold text-ink">{later ? formatDay(effectiveAt, true) : 'Immediately'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Branches affected</dt>
                <dd className="text-right font-semibold text-ink">
                  {following.length === 0 ? 'None' : following.map(({ branch }) => branch).join(', ')}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-muted">Enter a new price that differs from the current one.</p>
          )}
        </div>

        {(overrides.length > 0 || pending.length > 0) && (
          <ul className="space-y-1 rounded-lg bg-warning/10 px-3 py-2 text-[11px] text-ink">
            {overrides.map(({ branch, priceOverride }) => (
              <li key={branch} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
                {branch} keeps its own price of {formatXaf(priceOverride!)} and will not change.
              </li>
            ))}
            {pending.map((change) => (
              <li key={change.id} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
                A change to {formatXaf(change.newPrice)} is already scheduled for {formatDay(change.effectiveAt, true)}.
              </li>
            ))}
          </ul>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-ink">
          <input type="checkbox" checked={confirmed} disabled={!valid} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-brand" />
          I have checked the old price, the new price, the branches affected and the effective date.
        </label>
      </div>
    </Modal>
  )
}

// ---------- Bulk price update ----------

export function BulkUpdateDialog({
  services,
  categories,
  onClose,
  onApply,
}: {
  services: LaundryService[]
  categories: string[]
  onClose: () => void
  onApply: (adjustment: BulkAdjustment) => void
}) {
  const [adjustment, setAdjustment] = useState<BulkAdjustment>({
    category: '',
    direction: 'increase',
    kind: 'percent',
    value: 5,
    roundTo: 50,
    includeOverrides: true,
    reason: '',
  })
  const [reviewing, setReviewing] = useState(false)
  const patch = (change: Partial<BulkAdjustment>) => {
    setAdjustment({ ...adjustment, ...change })
    setReviewing(false)
  }
  const preview = previewBulk(services, adjustment)
  const ready = adjustment.value > 0 && preview.rows.length > 0 && adjustment.reason.trim() !== ''

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Bulk Price Update"
      subtitle="Adjust many prices at once. Nothing changes until you confirm."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          {reviewing ? (
            <button type="button" onClick={() => onApply(adjustment)} className={dangerButton}>
              Confirm: update {preview.rows.length} {preview.rows.length === 1 ? 'price' : 'prices'}
            </button>
          ) : (
            <button type="button" disabled={!ready} onClick={() => setReviewing(true)} className={primaryButton}>
              Review Changes
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="bulk-category" className={labelClass}>Services</label>
            <select id="bulk-category" value={adjustment.category} onChange={(event) => patch({ category: event.target.value })} className={fieldClass}>
              <option value="">All services</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bulk-direction" className={labelClass}>Change</label>
            <select id="bulk-direction" value={`${adjustment.direction}-${adjustment.kind}`} onChange={(event) => { const [direction, kind] = event.target.value.split('-'); patch({ direction: direction as BulkAdjustment['direction'], kind: kind as BulkAdjustment['kind'] }) }} className={fieldClass}>
              <option value="increase-percent">Increase by %</option>
              <option value="decrease-percent">Decrease by %</option>
              <option value="increase-fixed">Increase by XAF</option>
              <option value="decrease-fixed">Decrease by XAF</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-value" className={labelClass}>{adjustment.kind === 'percent' ? 'Percent' : 'Amount (XAF)'}</label>
            <input id="bulk-value" type="number" min={0} value={adjustment.value} onChange={(event) => patch({ value: Math.max(0, Number(event.target.value)) })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="bulk-round" className={labelClass}>Round to nearest</label>
            <select id="bulk-round" value={adjustment.roundTo} onChange={(event) => patch({ roundTo: Number(event.target.value) })} className={fieldClass}>
              <option value={1}>No rounding</option>
              <option value={50}>XAF 50</option>
              <option value={100}>XAF 100</option>
              <option value={500}>XAF 500</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="bulk-reason" className={labelClass}>Reason (kept in the price history)</label>
            <input id="bulk-reason" placeholder="e.g. Annual price review" value={adjustment.reason} onChange={(event) => patch({ reason: event.target.value })} className={fieldClass} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink sm:col-span-4">
            <input type="checkbox" checked={adjustment.includeOverrides} onChange={(event) => patch({ includeOverrides: event.target.checked })} className="size-4 accent-brand" />
            Also adjust branch-specific prices by the same rule
          </label>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {(
            [
              ['Services affected', String(preview.rows.length)],
              ['Branches affected', String(preview.branches)],
              ['Estimated revenue impact', `${preview.monthlyImpact >= 0 ? '+' : '−'}${formatCompactXaf(Math.abs(preview.monthlyImpact))} / month`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg bg-field px-3 py-2">
              <dt className="truncate text-[10px] font-semibold text-muted">{label}</dt>
              <dd className="truncate text-sm font-bold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-muted">
          The estimate assumes order volume stays the same.
          {preview.skipped > 0 && ` ${preview.skipped} item-priced ${preview.skipped === 1 ? 'service is' : 'services are'} skipped; edit their item prices in the service editor.`}
        </p>

        {preview.rows.length === 0 ? (
          <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">No prices would change with these settings.</p>
        ) : (
          <div className="relative max-h-64 overflow-auto rounded-lg ring-1 ring-line">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="sticky top-0 bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">Service</th>
                  <th scope="col" className="px-3 py-2">Scope</th>
                  <th scope="col" className="px-3 py-2 text-right">Old → new</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.flatMap(({ service, from, to, overrides }) => [
                  <tr key={service.id}>
                    <th scope="row" className="px-3 py-2 font-semibold text-ink">{service.name}</th>
                    <td className="px-3 py-2 text-muted">Global</td>
                    <td className="px-3 py-2 text-right"><Change from={from} to={to} /></td>
                  </tr>,
                  ...overrides.map((override) => (
                    <tr key={`${service.id}-${override.branch}`}>
                      <th scope="row" className="px-3 py-2 pl-6 font-normal text-muted">{service.name}</th>
                      <td className="px-3 py-2 text-muted">{override.branch}</td>
                      <td className="px-3 py-2 text-right"><Change from={override.from} to={override.to} /></td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        )}

        {reviewing && (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
            These prices take effect immediately for new orders at every affected branch. Check the list above, then confirm.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------- Quantity tiers ----------

export function TiersDialog({
  service,
  tiers: initial,
  onClose,
  onSave,
}: {
  service: LaundryService
  tiers: PriceTier[]
  onClose: () => void
  onSave: (tiers: PriceTier[]) => void
}) {
  const [tiers, setTiers] = useState(initial)
  const unit = getUnit(service)
  const sorted = [...tiers].sort((a, b) => a.from - b.from)
  const problems = [
    ...(tiers.some(({ from, price }) => from <= Math.max(service.minQty, 1) || price <= 0) ? ['Each tier needs a starting quantity above the minimum and a price above zero.'] : []),
    ...(new Set(tiers.map(({ from }) => from)).size !== tiers.length ? ['Two tiers start at the same quantity.'] : []),
    ...(sorted.some(({ price }, index) => price >= (index === 0 ? service.basePrice : sorted[index - 1].price)) ? ['Each tier should be cheaper than the one before it.'] : []),
  ]
  const change = (index: number, next: Partial<PriceTier>) =>
    setTiers(tiers.map((tier, position) => (position === index ? { ...tier, ...next } : tier)))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Quantity tiers: ${service.name}`}
      subtitle={`Base price ${formatXaf(service.basePrice)} / ${unit}. Larger orders can pay less per ${unit}.`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={problems.length > 0} onClick={() => onSave(sorted)} className={primaryButton}>
            Save Tiers
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-lg bg-field px-3 py-2 text-xs text-muted">
          <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-line">IF</span>
          quantity is below the first tier
          <span className="mx-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">THEN</span>
          <span className="font-semibold text-ink">{formatXaf(service.basePrice)} / {unit}</span>
        </p>
        <ul className="space-y-1.5">
          {tiers.map((tier, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-field px-3 py-2 text-xs text-muted">
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-line">IF</span>
              quantity is at least
              <input type="number" min={1} aria-label={`Tier ${index + 1} starts at`} value={tier.from} onChange={(event) => change(index, { from: Number(event.target.value) })} className={`${fieldClass} h-8 w-20! bg-white`} />
              {unit}
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">THEN</span>
              <input type="number" min={1} step={50} aria-label={`Tier ${index + 1} price`} value={tier.price} onChange={(event) => change(index, { price: Number(event.target.value) })} className={`${fieldClass} h-8 w-24! bg-white`} />
              XAF / {unit}
              <button type="button" aria-label={`Remove tier ${index + 1}`} onClick={() => setTiers(tiers.filter((_, position) => position !== index))} className={`${iconButton} ml-auto`}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            const top = sorted.at(-1)
            setTiers([...tiers, { from: (top?.from ?? Math.max(service.minQty, 1)) + 5, price: Math.max(50, Math.round(((top?.price ?? service.basePrice) * 0.9) / 50) * 50) }])
          }}
          className={secondaryButton}
        >
          <Plus className="size-3.5 text-muted" aria-hidden="true" />
          Add tier
        </button>

        {problems.length > 0 ? (
          <ul className="space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : (
          sorted.length > 0 && (
            <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {getTierBands(service, sorted).map(({ range, price }) => (
                <div key={range} className="rounded-md bg-brand/5 px-2 py-1.5 text-center">
                  <dt className="text-[10px] text-muted">{range} {unit}</dt>
                  <dd className="text-xs font-bold text-ink tabular-nums">{formatXaf(price)}</dd>
                </div>
              ))}
            </dl>
          )
        )}
      </div>
    </Modal>
  )
}

// ---------- Import preview ----------

const IMPORT_STATUS: Record<ImportRow['status'], { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  valid: { label: 'Will update', tone: 'success' },
  unchanged: { label: 'No change', tone: 'neutral' },
  duplicate: { label: 'Duplicate row', tone: 'warning' },
  unknown: { label: 'Unknown code', tone: 'danger' },
  invalid: { label: 'Invalid price', tone: 'danger' },
}

export function ImportPreviewDialog({
  rows,
  onClose,
  onApply,
}: {
  rows: ImportRow[]
  onClose: () => void
  onApply: (rows: ImportRow[]) => void
}) {
  const count = (...statuses: ImportRow['status'][]) => rows.filter(({ status }) => statuses.includes(status)).length
  const valid = rows.filter(({ status }) => status === 'valid')
  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Import Prices"
      subtitle="Review the file before anything is changed."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={valid.length === 0} onClick={() => onApply(valid)} className={primaryButton}>
            Import {valid.length} {valid.length === 1 ? 'price' : 'prices'}
          </button>
        </>
      }
    >
      <ul className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        <li className="rounded-md bg-success/10 px-2.5 py-1 text-success">{count('valid')} valid</li>
        <li className="rounded-md bg-field px-2.5 py-1 text-muted">{count('unchanged')} unchanged</li>
        <li className="rounded-md bg-warning/10 px-2.5 py-1 text-warning">{count('duplicate')} duplicate</li>
        <li className="rounded-md bg-danger/10 px-2.5 py-1 text-danger">{count('unknown', 'invalid')} with errors</li>
      </ul>
      <div className="relative max-h-80 overflow-auto rounded-lg ring-1 ring-line">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="sticky top-0 bg-field text-[10px] font-bold tracking-wider text-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2">Code</th>
              <th scope="col" className="px-3 py-2">Service</th>
              <th scope="col" className="px-3 py-2 text-right">Old price</th>
              <th scope="col" className="px-3 py-2 text-right">New price</th>
              <th scope="col" className="px-3 py-2">Validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={`${row.code}-${index}`}>
                <td className="px-3 py-2 font-mono text-[11px]">{row.code || '—'}</td>
                <td className="px-3 py-2 text-ink">{row.name || '—'}</td>
                <td className="px-3 py-2 text-right text-muted tabular-nums">{row.from === null ? '—' : formatXaf(row.from)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.to === null ? '—' : formatXaf(row.to)}</td>
                <td className="px-3 py-2"><Badge tone={IMPORT_STATUS[row.status].tone}>{IMPORT_STATUS[row.status].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">Only rows marked “Will update” are imported. Item-priced services can’t be updated from a file.</p>
    </Modal>
  )
}
