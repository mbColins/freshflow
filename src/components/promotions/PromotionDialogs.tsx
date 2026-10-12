import { useState } from 'react'
import { Copy, Pause, Pencil, Play, Calculator } from 'lucide-react'
import { BRANCH_SERVICES } from '../../constants/branches'
import {
  ASSUMED_GROSS_MARGIN,
  AUDIENCES,
  DELIVERY_FEE,
  STACKING_MODES,
} from '../../constants/promotions'
import type { PromotionPermissions } from '../../constants/promotions'
import type { Audience, Promotion, StackingPolicy } from '../../types/promotion'
import { formatDate } from '../../utils/customers'
import { formatTime, formatXaf } from '../../utils/orders'
import {
  formatBranches,
  formatDays,
  formatDelta,
  formatOffer,
  formatServices,
  formatValidity,
  getAudienceLabel,
  getChannelBreakdown,
  getConversion,
  getCountdown,
  getPromotionStatus,
  getTypeMeta,
  simulate,
} from '../../utils/promotions'
import { formatCompactXaf } from '../../utils/services'
import { fieldClass, labelClass, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Modal from '../ui/Modal'
import Panel from '../ui/Panel'
import SegmentedControl from '../ui/SegmentedControl'
import { PromotionCode, PromotionStatusBadge, UsageBar } from './PromotionBits'

// Validated chart colour for single-series bars
const BAR_COLOR = '#2a78d6'

const DRAWER_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'performance', label: 'Performance' },
  { value: 'history', label: 'History' },
] as const

// ---------- Campaign drawer ----------

export function PromotionDrawer({
  promotion,
  now,
  permissions,
  branches,
  onClose,
  onEdit,
  onTogglePause,
  onDuplicate,
}: {
  promotion: Promotion | null
  now: number
  permissions: PromotionPermissions
  branches: { id: string; name: string }[]
  onClose: () => void
  onEdit: (id: string) => void
  onTogglePause: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const [tab, setTab] = useState<(typeof DRAWER_TABS)[number]['value']>('overview')
  if (!promotion) return null
  const status = getPromotionStatus(promotion, now)
  const { stats, previous } = promotion
  const pausable = status === 'active' || status === 'scheduled' || status === 'paused'
  const channels = getChannelBreakdown(promotion)
  const topChannel = Math.max(...channels.map(({ redemptions }) => redemptions), 1)

  const rules: [string, string][] = [
    ['Offer', `${formatOffer(promotion)}${promotion.maxDiscount ? ` · capped at ${formatXaf(promotion.maxDiscount)} per order` : ''}`],
    ['Type', getTypeMeta(promotion.type).label],
    ...(promotion.bundleNote ? ([['Bundle', promotion.bundleNote]] as [string, string][]) : []),
    ...(promotion.tiers.length > 0 && promotion.discountKind === 'tiered'
      ? ([['Tiers', promotion.tiers.map(({ minSpend, percent }) => `${formatXaf(minSpend)}+ → ${percent}%`).join(' · ')]] as [string, string][])
      : []),
    ['Applies to', formatServices(promotion)],
    ['Customers', promotion.audience === 'specific' ? promotion.customers : getAudienceLabel(promotion.audience)],
    ['Branches', promotion.branches.length === 0 ? 'All branches' : promotion.branches.map((id) => branches.find((branch) => branch.id === id)?.name ?? id).join(', ')],
    ['Minimum order', promotion.minOrder > 0 ? formatXaf(promotion.minOrder) : 'None'],
    ['Valid', formatValidity(promotion)],
    ['Days', formatDays(promotion.days)],
    ['Usage limit', promotion.usageLimit ? `${promotion.usageLimit.toLocaleString('en-US')} orders` : 'No limit'],
    ['Per customer', promotion.perCustomerLimit ? `${promotion.perCustomerLimit} ${promotion.perCustomerLimit === 1 ? 'use' : 'uses'}` : 'No limit'],
    ['Stacking', promotion.stackable ? 'Stackable' : 'Does not combine'],
    ['Channels', promotion.channels.join(', ') || 'Not announced'],
    ['Created', `${formatDate(promotion.createdAt)} by ${promotion.createdBy}`],
  ]

  const figures: [string, string, string][] = [
    ['Orders', stats.uses.toLocaleString('en-US'), formatDelta(stats.uses, previous.uses)],
    ['Conversion', `${getConversion(stats).toFixed(1)}%`, formatDelta(getConversion(stats), getConversion(previous), true)],
    ...(permissions.financials
      ? ([
          ['Revenue', formatCompactXaf(stats.revenue), formatDelta(stats.revenue, previous.revenue)],
          ['Discount given', formatCompactXaf(stats.discount), formatDelta(stats.discount, previous.discount)],
        ] as [string, string, string][])
      : []),
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      title={promotion.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <PromotionStatusBadge status={status} />
          <PromotionCode promotion={promotion} />
          <span className="font-mono">{promotion.id}</span>
          {getCountdown(promotion, now) && <span>{getCountdown(promotion, now)}</span>}
        </span>
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close Drawer
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-2xl font-extrabold text-ink">{formatOffer(promotion)}</p>
        <p className="text-xs text-muted">{promotion.description}</p>

        {permissions.manage && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(promotion.id)} className={primaryButton}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            {pausable && (
              <button type="button" onClick={() => onTogglePause(promotion.id)} className={secondaryButton}>
                {status === 'paused' ? <Play className="size-4 text-success" aria-hidden="true" /> : <Pause className="size-4 text-muted" aria-hidden="true" />}
                {status === 'paused' ? 'Resume' : 'Pause'}
              </button>
            )}
            <button type="button" onClick={() => onDuplicate(promotion.id)} className={secondaryButton}>
              <Copy className="size-4 text-muted" aria-hidden="true" />
              Duplicate
            </button>
          </div>
        )}

        <SegmentedControl label="Campaign sections" options={DRAWER_TABS} value={tab} onChange={setTab} />

        {tab === 'overview' && (
          <>
            <dl className="divide-y divide-line text-xs">
              {rules.map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2">
                  <dt className="w-28 shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 break-words font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {promotion.notes && (
              <div className="rounded-lg bg-field px-3 py-2">
                <p className={sectionTitle}>Internal notes</p>
                <p className="mt-1 text-xs text-ink">{promotion.notes}</p>
              </div>
            )}
          </>
        )}

        {tab === 'performance' && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2">
              {figures.map(([label, value, delta]) => (
                <div key={label} className="rounded-lg bg-field px-3 py-2">
                  <dt className="text-[10px] font-semibold text-muted">{label}</dt>
                  <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
                  <dd className="text-[10px] text-muted">{delta} vs previous period</dd>
                </div>
              ))}
            </dl>
            <UsageBar promotion={promotion} />
            {permissions.financials && promotion.budget !== null && (
              <p className="text-xs text-muted">
                Budget: <span className="font-semibold text-ink">{formatXaf(stats.discount)}</span> of {formatXaf(promotion.budget)} used ({((stats.discount / promotion.budget) * 100).toFixed(0)}%).
              </p>
            )}
            <div>
              <p className={sectionTitle}>Redemptions by channel</p>
              {stats.uses === 0 ? (
                <p className="mt-2 rounded-lg bg-field px-3 py-4 text-center text-xs text-muted">No redemptions yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {channels.map(({ channel, redemptions }) => (
                    <li key={channel} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-2 text-xs" title={`${channel}: ${redemptions} redemptions`}>
                      <span className="text-muted">{channel}</span>
                      <span className="h-4 rounded-sm bg-field">
                        <span className="block h-full rounded-r" style={{ width: `${(redemptions / topChannel) * 100}%`, background: BAR_COLOR }} />
                      </span>
                      <span className="text-right font-bold text-ink tabular-nums">{redemptions}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10px] text-muted">Channel split is estimated from the channels the campaign uses.</p>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <ol className="space-y-3 border-l border-line pl-4">
            {promotion.history.map((event, index) => (
              <li key={`${event.at}-${index}`} className="relative text-xs">
                <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden="true" />
                <p className="font-semibold text-ink">{event.text}</p>
                <p className="text-[11px] text-muted">
                  {event.user} · {formatDate(event.at)}, {formatTime(event.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  )
}

// ---------- Stacking rules ----------

export function StackingDialog({
  policy,
  onClose,
  onSave,
}: {
  policy: StackingPolicy
  onClose: () => void
  onSave: (policy: StackingPolicy) => void
}) {
  const [draft, setDraft] = useState(policy)
  return (
    <Modal
      open
      onClose={onClose}
      title="Stacking Rules"
      subtitle="How promotions combine on a single order, across all branches."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(draft)} className={primaryButton}>
            Save Rules
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Stacking rule" className="space-y-2">
          {STACKING_MODES.map(({ value, label, detail }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 ${
                draft.mode === value ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field'
              }`}
            >
              <input
                type="radio"
                name="stacking-mode"
                checked={draft.mode === value}
                onChange={() => setDraft({ ...draft, mode: value })}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                <span className="block text-xs font-bold text-ink">{label}</span>
                <span className="block text-[11px] text-muted">{detail}</span>
              </span>
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="stacking-max" className={labelClass}>
            Highest combined discount (% of the order)
          </label>
          <input
            id="stacking-max"
            type="number"
            min={1}
            max={100}
            disabled={draft.mode === 'none'}
            value={draft.maxCombined}
            onChange={(event) => setDraft({ ...draft, maxCombined: Math.min(100, Math.max(1, Number(event.target.value))) })}
            className={`${fieldClass} w-32! disabled:opacity-60`}
          />
        </div>
      </div>
    </Modal>
  )
}

// ---------- Discount simulator ----------

export function DiscountSimulator({
  promotions,
  branches,
  now,
  showMargin,
}: {
  promotions: Promotion[]
  branches: { id: string; name: string }[]
  now: number
  showMargin: boolean
}) {
  const options = promotions.filter((promotion) => {
    const status = getPromotionStatus(promotion, now)
    return status === 'active' || status === 'scheduled' || status === 'paused'
  })
  const [promotionId, setPromotionId] = useState(options[0]?.id ?? '')
  const [basket, setBasket] = useState(25_000)
  const [audience, setAudience] = useState<Audience>('all')
  const [branch, setBranch] = useState(branches[0]?.id ?? '')
  const [service, setService] = useState(BRANCH_SERVICES[0].name)
  const [delivery, setDelivery] = useState(true)
  const promotion = options.find(({ id }) => id === promotionId) ?? options[0]

  if (!promotion) {
    return (
      <Panel title="Discount Simulator" icon={Calculator}>
        <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">
          Publish a promotion to test it against a sample order.
        </p>
      </Panel>
    )
  }

  const result = simulate(promotion, { basket, audience, branch, service, delivery }, now)
  const select = (id: string, label: string, value: string, onChange: (value: string) => void, items: [string, string][]) => (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        {items.map(([itemValue, itemLabel]) => (
          <option key={itemValue} value={itemValue}>{itemLabel}</option>
        ))}
      </select>
    </div>
  )
  const lines: [string, string, string][] = [
    ['Order subtotal', formatXaf(basket), 'text-ink'],
    ['Discount', result.discount > 0 ? `− ${formatXaf(result.discount)}${result.capped ? ' (capped)' : ''}` : formatXaf(0), result.discount > 0 ? 'text-danger' : 'text-ink'],
    ['Pickup & delivery', !delivery ? 'Not requested' : result.deliveryWaived > 0 ? `${formatXaf(0)} (waived)` : formatXaf(result.deliveryFee), result.deliveryWaived > 0 ? 'text-success' : 'text-ink'],
  ]

  return (
    <Panel title="Discount Simulator" subtitle="Test a promotion against a sample order" icon={Calculator}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {select('sim-promo', 'Promotion', promotion.id, setPromotionId, options.map(({ id, name, code }) => [id, `${name}${code ? ` (${code})` : ''}`]))}
          <div>
            <label htmlFor="sim-basket" className={labelClass}>Order subtotal (XAF)</label>
            <input id="sim-basket" type="number" min={0} step={500} value={basket} onChange={(event) => setBasket(Math.max(0, Number(event.target.value)))} className={fieldClass} />
          </div>
          {select('sim-audience', 'Customer', audience, (value) => setAudience(value as Audience), AUDIENCES.filter(({ value }) => value !== 'specific').map(({ value, label }) => [value, value === 'all' ? 'Regular customer' : label]))}
          {select('sim-branch', 'Branch', branch, setBranch, branches.map(({ id, name }) => [id, name]))}
          {select('sim-service', 'Service', service, setService, BRANCH_SERVICES.map(({ name }) => [name, name]))}
          <label className="flex cursor-pointer items-center gap-2 self-end rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
            <input type="checkbox" checked={delivery} onChange={(event) => setDelivery(event.target.checked)} className="size-4 accent-brand" />
            Pickup &amp; delivery ({formatXaf(DELIVERY_FEE)})
          </label>
        </div>

        <div className="rounded-lg bg-field p-3" aria-live="polite">
          <dl className="space-y-1 text-xs">
            {lines.map(([label, value, tone]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className={`font-semibold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <dt className="text-sm font-bold text-ink">Customer pays</dt>
              <dd className="text-lg font-extrabold text-brand tabular-nums">{formatXaf(result.payable)}</dd>
            </div>
          </dl>
          {result.eligible ? (
            <p className="mt-2 rounded-md bg-success/10 px-2.5 py-1.5 text-[11px] font-semibold text-success">
              Eligible: {formatOffer(promotion)} applies
              {promotion.branches.length > 0 && ` at ${formatBranches(promotion, branches).toLowerCase()}`}.
            </p>
          ) : (
            <div className="mt-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
              <p className="font-semibold">Not eligible, so nothing is discounted:</p>
              <ul className="mt-0.5 list-disc pl-4">
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {showMargin && (
            <p className="mt-2 text-[11px] text-muted">
              Margin after the promotion: <span className="font-bold text-ink">{result.margin.toFixed(1)}%</span> (without it: {result.baseMargin.toFixed(1)}%). Assumes a {ASSUMED_GROSS_MARGIN * 100}% gross margin on services and delivery charged at cost.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}
