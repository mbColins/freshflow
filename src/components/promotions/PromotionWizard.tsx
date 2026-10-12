import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Send, Trash2, TriangleAlert, Wand2 } from 'lucide-react'
import { BRANCH_SERVICES } from '../../constants/branches'
import {
  AUDIENCES,
  BANNERS,
  CHANNELS,
  DISCOUNT_KIND_LABELS,
  PROMOTION_TYPES,
  PROMO_WIZARD_STEPS,
  WEEKDAYS,
} from '../../constants/promotions'
import type { Audience, DiscountKind, PromotionDraft, PromotionType } from '../../types/promotion'
import { formatXaf } from '../../utils/orders'
import {
  formatBranches,
  formatDays,
  formatOffer,
  formatServices,
  formatValidity,
  getAudienceLabel,
  getBannerClass,
  getDraftProblems,
  getTypeMeta,
  suggestCode,
  toDateKey,
} from '../../utils/promotions'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import Modal from '../ui/Modal'
import { PromotionCode } from './PromotionBits'

function Field({ label, htmlFor, wide = false, hint, children }: { label: string; htmlFor: string; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

const checkRow = 'flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink'

function toggle<T>(list: T[], item: T, order: T[]) {
  return list.includes(item) ? list.filter((current) => current !== item) : order.filter((current) => current === item || list.includes(current))
}

function PromotionWizard({
  initial,
  mode,
  takenCodes,
  branches,
  now,
  onClose,
  onSave,
}: {
  initial: PromotionDraft
  mode: 'create' | 'edit'
  takenCodes: string[]
  branches: { id: string; name: string }[]
  now: number
  onClose: () => void
  // publish = go live on the start date; otherwise keep the current state (draft when new)
  onSave: (draft: PromotionDraft, publish: boolean) => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(initial)
  const patch = (change: Partial<PromotionDraft>) => setDraft((current) => ({ ...current, ...change }))
  const problems = getDraftProblems(draft, takenCodes)
  const last = PROMO_WIZARD_STEPS.length - 1
  const typeMeta = getTypeMeta(draft.type)
  const published = initial.state === 'published' || initial.state === 'paused'
  const startsLater = draft.startAt > toDateKey(now)

  const optionalNumber = (id: string, label: string, key: 'maxDiscount' | 'usageLimit' | 'perCustomerLimit' | 'budget', hint: string) => (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="number"
        min={1}
        placeholder="No limit"
        value={draft[key] ?? ''}
        onChange={(event) => patch({ [key]: event.target.value === '' ? null : Math.max(1, Number(event.target.value)) })}
        className={fieldClass}
      />
    </Field>
  )

  function chooseType(type: PromotionType) {
    const [kind] = PROMOTION_TYPES.find(({ value }) => value === type)!.kinds
    patch({
      type,
      discountKind: kind,
      value: kind === 'percent' ? 10 : kind === 'amount' ? 2000 : 0,
      ...(type === 'firstOrder' ? { audience: 'new' as Audience, perCustomerLimit: 1 } : {}),
      ...(type === 'loyalty' ? { audience: 'loyalty' as Audience } : {}),
      ...(type === 'referral' ? { audience: 'referred' as Audience } : {}),
    })
  }

  const summary: [string, string][] = [
    ['Offer', `${formatOffer(draft)}${draft.maxDiscount ? ` · capped at ${formatXaf(draft.maxDiscount)}` : ''}`],
    ['Type', typeMeta.label],
    ['Applies to', formatServices(draft)],
    ['Customers', draft.audience === 'specific' ? draft.customers || 'Specific customers' : getAudienceLabel(draft.audience)],
    ['Branches', formatBranches(draft, branches)],
    ['Minimum order', draft.minOrder > 0 ? formatXaf(draft.minOrder) : 'None'],
    ['Schedule', `${formatValidity(draft)} · ${formatDays(draft.days)}`],
    ['Limits', [draft.usageLimit && `${draft.usageLimit} uses in total`, draft.perCustomerLimit && `${draft.perCustomerLimit} per customer`, draft.budget && `${formatXaf(draft.budget)} discount budget`].filter(Boolean).join(' · ') || 'No limits'],
    ['Stacking', draft.stackable ? 'Can combine with other stackable promotions' : 'Cannot combine with other promotions'],
    ['Channels', draft.channels.join(', ') || 'Not announced'],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={mode === 'create' ? 'Create Promotion' : `Edit ${initial.name}`}
      subtitle={`Step ${step + 1} of ${PROMO_WIZARD_STEPS.length}: ${PROMO_WIZARD_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={`${secondaryButton} mr-auto`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step < last ? (
            <button type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : published ? (
            <button type="button" disabled={problems.length > 0} onClick={() => onSave(draft, false)} className={primaryButton}>
              <Check className="size-4" aria-hidden="true" />
              Save Changes
            </button>
          ) : (
            <>
              <button type="button" disabled={!draft.name.trim()} onClick={() => onSave(draft, false)} className={secondaryButton}>
                Save as Draft
              </button>
              <button type="button" disabled={problems.length > 0} onClick={() => onSave(draft, true)} className={primaryButton}>
                <Send className="size-4" aria-hidden="true" />
                {startsLater ? 'Schedule Promotion' : 'Publish Now'}
              </button>
            </>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Wizard steps">
        {PROMO_WIZARD_STEPS.map((label, index) => (
          <li key={label} className="min-w-14 flex-1">
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => setStep(index)}
              className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`} />
              <span className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}>
                {index + 1} {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Promotion name" htmlFor="promo-name">
            <input id="promo-name" autoComplete="off" placeholder="e.g. Weekend Fresh" value={draft.name} onChange={(event) => patch({ name: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Promotion code" htmlFor="promo-code" hint={draft.automatic ? 'Applied at checkout without a code.' : 'What customers type or staff enter at the counter.'}>
            <div className="flex gap-2">
              <input
                id="promo-code"
                autoComplete="off"
                disabled={draft.automatic}
                placeholder={draft.automatic ? 'No code needed' : 'e.g. WEEKEND20'}
                value={draft.code}
                onChange={(event) => patch({ code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) })}
                className={`${fieldClass} font-mono disabled:opacity-60`}
              />
              <button
                type="button"
                disabled={draft.automatic || !draft.name.trim()}
                title="Suggest a code from the name"
                onClick={() => patch({ code: suggestCode(draft.name, draft.discountKind === 'percent' ? draft.value : 0, takenCodes) })}
                className={secondaryButton}
              >
                <Wand2 className="size-3.5 text-muted" aria-hidden="true" />
                Suggest
              </button>
            </div>
          </Field>
          <label className={`${checkRow} sm:col-span-2`}>
            <input
              type="checkbox"
              checked={draft.automatic}
              onChange={(event) => patch({ automatic: event.target.checked, code: event.target.checked ? '' : draft.code })}
              className="size-4 accent-brand"
            />
            Automatic promotion: apply to every eligible order without a code
          </label>
          <Field label="Description (shown to customers)" htmlFor="promo-description" wide>
            <textarea id="promo-description" rows={2} placeholder="e.g. 20% off Wash & Fold every weekend." value={draft.description} onChange={(event) => patch({ description: event.target.value })} className={`${fieldClass} h-auto py-2`} />
          </Field>
          <Field label="Internal notes (staff only)" htmlFor="promo-notes" wide>
            <textarea id="promo-notes" rows={2} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} className={`${fieldClass} h-auto py-2`} />
          </Field>
          <div className="sm:col-span-2">
            <p className={labelClass}>Campaign banner</p>
            <div role="radiogroup" aria-label="Campaign banner" className="flex flex-wrap gap-2">
              {BANNERS.map(({ value, label, className }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.banner === value}
                  onClick={() => patch({ banner: value })}
                  className={`h-10 w-20 rounded-md text-[10px] font-bold text-white ${className} focus-visible:outline-none ${
                    draft.banner === value ? 'ring-2 ring-brand ring-offset-2' : 'opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div role="radiogroup" aria-label="Promotion type" className="grid gap-2 sm:grid-cols-3">
          {PROMOTION_TYPES.map(({ value, label, example, icon: Icon }) => {
            const selected = draft.type === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseType(value)}
                className={`rounded-lg p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'
                }`}
              >
                <Icon className={`size-5 ${selected ? 'text-brand' : 'text-muted'}`} aria-hidden="true" />
                <span className="mt-2 block text-xs font-bold text-ink">{label}</span>
                <span className="block text-[11px] text-muted">{example}</span>
              </button>
            )
          })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How the discount is calculated" htmlFor="promo-kind">
              <select
                id="promo-kind"
                value={draft.discountKind}
                disabled={typeMeta.kinds.length === 1}
                onChange={(event) => patch({ discountKind: event.target.value as DiscountKind, value: event.target.value === 'percent' ? 10 : 2000 })}
                className={`${fieldClass} disabled:opacity-60`}
              >
                {typeMeta.kinds.map((kind) => (
                  <option key={kind} value={kind}>{DISCOUNT_KIND_LABELS[kind]}</option>
                ))}
              </select>
            </Field>
            {(draft.discountKind === 'percent' || draft.discountKind === 'amount') && (
              <Field label={draft.discountKind === 'percent' ? 'Percentage off (%)' : 'Amount off (XAF)'} htmlFor="promo-value">
                <input
                  id="promo-value"
                  type="number"
                  min={1}
                  max={draft.discountKind === 'percent' ? 100 : undefined}
                  step={draft.discountKind === 'percent' ? 1 : 100}
                  value={draft.value}
                  onChange={(event) => patch({ value: Number(event.target.value) })}
                  className={fieldClass}
                />
              </Field>
            )}
            {draft.discountKind !== 'freeDelivery' && draft.discountKind !== 'amount' &&
              optionalNumber('promo-max', 'Maximum discount per order (XAF)', 'maxDiscount', 'Caps what a single large order can take off.')}
            {draft.type === 'bundle' && (
              <Field label="What the bundle contains" htmlFor="promo-bundle" wide>
                <input id="promo-bundle" placeholder="e.g. 2 suits + 3 pressed shirts" value={draft.bundleNote} onChange={(event) => patch({ bundleNote: event.target.value })} className={fieldClass} />
              </Field>
            )}
          </div>
          {draft.discountKind === 'freeDelivery' && (
            <p className="rounded-lg bg-field px-3 py-3 text-xs text-muted">
              The pickup and delivery fee is waived on eligible orders. Nothing else is discounted.
            </p>
          )}
          {draft.discountKind === 'tiered' && (
            <div>
              <p className={sectionTitle}>Spend tiers</p>
              <ul className="mt-2 space-y-1.5">
                {draft.tiers.map((tier, index) => {
                  const change = (next: Partial<typeof tier>) =>
                    patch({ tiers: draft.tiers.map((current, position) => (position === index ? { ...current, ...next } : current)) })
                  return (
                    <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-field px-3 py-2 text-xs text-muted">
                      Spend at least
                      <input type="number" min={0} step={1000} aria-label={`Tier ${index + 1} minimum spend in XAF`} value={tier.minSpend} onChange={(event) => change({ minSpend: Number(event.target.value) })} className={`${fieldClass} h-8 w-28! bg-white`} />
                      XAF, get
                      <input type="number" min={1} max={100} aria-label={`Tier ${index + 1} percent off`} value={tier.percent} onChange={(event) => change({ percent: Number(event.target.value) })} className={`${fieldClass} h-8 w-20! bg-white`} />
                      % off
                      <button type="button" aria-label={`Remove tier ${index + 1}`} onClick={() => patch({ tiers: draft.tiers.filter((_, position) => position !== index) })} className={`${iconButton} ml-auto`}>
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  const top = draft.tiers.at(-1)
                  patch({ tiers: [...draft.tiers, { minSpend: (top?.minSpend ?? 0) + 15_000, percent: Math.min(100, (top?.percent ?? 0) + 5) }] })
                }}
                className={`${secondaryButton} mt-2`}
              >
                <Plus className="size-3.5 text-muted" aria-hidden="true" />
                Add tier
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who can use it" htmlFor="promo-audience">
              <select id="promo-audience" value={draft.audience} onChange={(event) => patch({ audience: event.target.value as Audience })} className={fieldClass}>
                {AUDIENCES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            {draft.audience === 'specific' && (
              <Field label="Customers (names or phone numbers, comma separated)" htmlFor="promo-customers">
                <input id="promo-customers" value={draft.customers} onChange={(event) => patch({ customers: event.target.value })} className={fieldClass} />
              </Field>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={sectionTitle}>Branches</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                <input type="checkbox" checked={draft.branches.length === 0} onChange={(event) => patch({ branches: event.target.checked ? [] : branches.map(({ id }) => id) })} className="size-4 accent-brand" />
                All branches, including new ones
              </label>
            </div>
            {draft.branches.length > 0 && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {branches.map(({ id, name }) => (
                  <li key={id}>
                    <label className={checkRow}>
                      <input type="checkbox" checked={draft.branches.includes(id)} onChange={() => patch({ branches: toggle(draft.branches, id, branches.map((branch) => branch.id)) })} className="size-4 accent-brand" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="font-mono text-[10px] text-muted">{id}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={sectionTitle}>What it applies to</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                <input type="checkbox" checked={draft.services.length === 0} onChange={(event) => patch({ services: event.target.checked ? [] : [BRANCH_SERVICES[0].name] })} className="size-4 accent-brand" />
                The whole order
              </label>
            </div>
            {draft.services.length > 0 && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {BRANCH_SERVICES.map(({ name }) => (
                  <li key={name}>
                    <label className={checkRow}>
                      <input type="checkbox" checked={draft.services.includes(name)} onChange={() => patch({ services: toggle(draft.services, name, BRANCH_SERVICES.map((service) => service.name)) })} className="size-4 accent-brand" />
                      {name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum order (XAF)" htmlFor="promo-min" hint="0 means no minimum.">
              <input id="promo-min" type="number" min={0} step={500} value={draft.minOrder} onChange={(event) => patch({ minOrder: Math.max(0, Number(event.target.value)) })} className={fieldClass} />
            </Field>
          </div>
          <label className={checkRow}>
            <input type="checkbox" checked={draft.stackable} onChange={(event) => patch({ stackable: event.target.checked })} className="size-4 accent-brand" />
            Stackable: may combine with other promotions when the stacking rule allows it
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date" htmlFor="promo-start">
              <input id="promo-start" type="date" value={draft.startAt} onChange={(event) => patch({ startAt: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="End date" htmlFor="promo-end">
              <input id="promo-end" type="date" disabled={draft.endAt === null} min={draft.startAt} value={draft.endAt ?? ''} onChange={(event) => patch({ endAt: event.target.value || draft.startAt })} className={`${fieldClass} disabled:opacity-60`} />
            </Field>
          </div>
          <label className={checkRow}>
            <input type="checkbox" checked={draft.endAt === null} onChange={(event) => patch({ endAt: event.target.checked ? null : draft.startAt })} className="size-4 accent-brand" />
            No end date: runs until paused or archived
          </label>
          <div>
            <p className={sectionTitle}>Recurring days</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, index) => {
                const on = draft.days.includes(index)
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ days: toggle(draft.days, index, [0, 1, 2, 3, 4, 5, 6]) })}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                      on ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-line'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              {draft.days.length === 0 ? 'No days selected: the promotion runs every day in its date range.' : `Runs only on ${formatDays(draft.days)} within its date range.`}
            </p>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {optionalNumber('promo-limit', 'Total usage limit', 'usageLimit', 'The promotion expires once this many orders have used it.')}
          {optionalNumber('promo-per-customer', 'Uses per customer', 'perCustomerLimit', 'How many times one customer can redeem it.')}
          {optionalNumber('promo-budget', 'Discount budget (XAF)', 'budget', 'Tracked against the discount given; shown on the stacking banner.')}
        </div>
      )}

      {step === 7 && (
        <div>
          <p className="mb-2 text-[11px] text-muted">Where the promotion is announced. Messages are prepared, not sent, until messaging is connected.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((channel) => (
              <li key={channel}>
                <label className={checkRow}>
                  <input type="checkbox" checked={draft.channels.includes(channel)} onChange={() => patch({ channels: toggle(draft.channels, channel, CHANNELS) })} className="size-4 accent-brand" />
                  {channel}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 8 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={sectionTitle}>Customer card</p>
            <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-line">
              <div className={`px-4 py-4 text-white ${getBannerClass(draft.banner)}`}>
                <p className="text-[10px] font-bold tracking-wider text-white/85 uppercase">{typeMeta.label}</p>
                <p className="mt-1 text-base font-bold uppercase">{draft.name || 'Promotion name'}</p>
                <p className="text-2xl font-extrabold">{formatOffer(draft)}</p>
              </div>
              <div className="space-y-2 p-4">
                <p className="text-xs text-ink">{draft.description || 'Add a description in step 1.'}</p>
                <PromotionCode promotion={draft} />
                <p className="text-[11px] text-muted">{formatValidity(draft)} · {formatDays(draft.days)}</p>
              </div>
            </div>
          </div>
          <div>
            <p className={sectionTitle}>Message preview</p>
            <p className="mt-2 rounded-xl bg-field p-4 text-xs leading-relaxed text-ink">
              FreshFlow: {draft.name || 'New offer'}! {formatOffer(draft)} on {formatServices(draft).toLowerCase()}
              {draft.minOrder > 0 && ` for orders from ${formatXaf(draft.minOrder)}`}.{' '}
              {draft.automatic ? 'Applied automatically at checkout.' : `Use code ${draft.code || '———'}.`}{' '}
              {draft.endAt ? `Valid until ${draft.endAt}.` : ''}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Goes out on: {draft.channels.join(', ') || 'no channel selected'}.
            </p>
          </div>
        </div>
      )}

      {step === last && (
        <div className="space-y-3">
          <dl className="divide-y divide-line rounded-lg bg-field px-3 text-xs">
            {summary.map(([label, value]) => (
              <div key={label} className="flex gap-3 py-2">
                <dt className="w-28 shrink-0 font-semibold text-ink">{label}</dt>
                <dd className="min-w-0 break-words text-muted">{value}</dd>
              </div>
            ))}
          </dl>
          {problems.length > 0 ? (
            <ul className="space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {problem}
                </li>
              ))}
            </ul>
          ) : (
            !published && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                {startsLater
                  ? `Ready to schedule: it goes live automatically on ${draft.startAt}.`
                  : 'Ready to publish: it goes live as soon as you publish.'}
              </p>
            )
          )}
        </div>
      )}
    </Modal>
  )
}

export default PromotionWizard
