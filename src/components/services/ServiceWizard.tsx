import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import {
  ADD_ONS,
  MACHINE_TYPES,
  MATERIALS,
  PRICING_MODELS,
  SERVICE_ICONS,
  SERVICE_OPTIONS,
  STAFF_SKILLS,
  VISIBILITIES,
  WORKFLOW_STAGES,
} from '../../constants/services'
import type {
  LaundryService,
  PricingModel,
  ServiceVisibility,
} from '../../types/service'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import type { BranchSetting } from '../../types/service'
import { formatXaf } from '../../utils/orders'
import { formatDays, formatHours, parseDays, parseHours, WEEK_DAYS } from '../../utils/serviceMapping'
import { formatPrice, generateCode } from '../../utils/services'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../orders/styles'
import FormAlert from '../ui/FormAlert'
import Modal from '../ui/Modal'
import { ServiceIcon, WorkflowChain } from './ServiceBits'
import FormField from '../ui/FormField'

const STEPS = [
  'Basic',
  'Pricing',
  'Workflow',
  'Resources',
  'Availability',
  'Options',
  'Review',
]

function createBlankService(category: string): LaundryService {
  return {
    id: '',
    name: '',
    category,
    description: '',
    icon: SERVICE_ICONS[0],
    status: 'draft',
    statusReason: '',
    pricingModel: 'item',
    basePrice: 0,
    minQty: 1,
    maxQty: null,
    itemPrices: [],
    standardHours: 24,
    express: { enabled: false, hours: 8, surchargePct: 30, cutoff: '14:00', minQty: 1 },
    workflow: ['Received', 'Quality Check', 'Ready'],
    machines: [],
    staffSkill: STAFF_SKILLS[0],
    consumption: [],
    addOnIds: [],
    options: [],
    // Filled from the connected tenant's branches (see `branchRows`)
    branches: [],
    visibility: 'visible',
    availableDays: 'Monday–Saturday',
    availableHours: '08:00–18:00',
    dailyCapacity: null,
    currentLoad: 0,
    capacityUnit: 'kg',
    includes: [],
    stats: {
      orders: 0,
      revenue: 0,
      growthPct: 0,
      avgHours: 0,
      satisfaction: 0,
      qualityPass: 0,
      reprocessRate: 0,
      lateRate: 0,
      complaints: 0,
    },
    monthlyOrders: Array<number>(12).fill(0),
    monthlyRevenue: Array<number>(12).fill(0),
    promotions: [],
    audit: [],
  }
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

const checkRowClass =
  'flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink'

type ServiceWizardProps = {
  // Present when editing
  service?: LaundryService
  initialStep?: number
  categories: string[]
  existing: LaundryService[]
  // The server's reasons the last save failed, shown above the steps
  error?: string | null
  onClose: () => void
  // publish=false saves as draft. The wizard stays busy until it resolves
  onSave: (service: LaundryService, publish: boolean) => void | Promise<void>
}

function ServiceWizard({
  service,
  initialStep = 0,
  categories,
  existing,
  error,
  onClose,
  onSave,
}: ServiceWizardProps) {
  const [step, setStep] = useState(initialStep)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<LaundryService>(
    () => service ?? createBlankService(categories[0]),
  )
  // A new service's code follows its name until the user types their own
  const [codeEdited, setCodeEdited] = useState(Boolean(service))
  const [stageToAdd, setStageToAdd] = useState('')

  const patch = (change: Partial<LaundryService>) =>
    setDraft((current) => ({ ...current, ...change }))
  // The branches that can offer the service: the connected user's own, as
  // scoped by GET /branch/dropdown. A branch keeps its earlier setting (matched
  // by uuid, or by name for older data); a new one starts offered at the
  // global price.
  const branchList = useGetBranchDropdownQuery()
  const branchRows: BranchSetting[] = (branchList.data ?? []).map(({ uuid, name }) => {
    const saved = draft.branches.find(
      ({ branchId, branch }) => branchId === uuid || (!branchId && branch === name),
    )
    return {
      branch: name,
      branchId: uuid,
      available: saved?.available ?? true,
      priceOverride: saved?.priceOverride ?? null,
    }
  })
  const code =
    codeEdited || !draft.name.trim() ? draft.id : generateCode(draft.name, existing)
  const numeric = (value: string) => Math.max(0, Number(value) || 0)
  const custom = draft.pricingModel === 'custom'
  const unit = PRICING_MODELS.find(({ id }) => id === draft.pricingModel)!.unit
  const unusedStages = WORKFLOW_STAGES.filter(
    (stage) => !draft.workflow.includes(stage),
  )

  const days = parseDays(draft.availableDays) ?? []
  const hours = parseHours(draft.availableHours) ?? { open: '08:00', close: '18:00' }

  const problems = [
    !draft.name.trim() && 'Service name is required (Basic).',
    !code.trim() && 'Service code is required (Basic).',
    code.trim() &&
      !/^[A-Z]{3}-\d{3,}$/.test(code.trim().toUpperCase()) &&
      'The code must look like WAF-001: three letters, a dash and three or more digits (Basic).',
    existing.some(({ id }) => id === code && id !== service?.id) &&
      `Code ${code} is already used by another service (Basic).`,
    !custom && draft.basePrice <= 0 && 'Base price must be above zero (Pricing).',
    custom &&
      draft.itemPrices.filter(({ item }) => item.trim()).length === 0 &&
      'Add at least one priced item (Pricing).',
    draft.workflow.length < 2 && 'The workflow needs at least two stages (Workflow).',
    days.length === 0 && 'Pick at least one available day (Availability).',
    hours.open >= hours.close && 'The closing time must be after the opening time (Availability).',
    !branchRows.some(({ available }) => available) &&
      (branchList.isLoading
        ? 'The branches are still loading (Availability).'
        : branchList.isError
          ? 'The branches couldn’t be loaded (Availability).'
          : branchRows.length === 0
            ? 'There are no branches to offer the service at yet (Availability).'
            : 'Offer the service at one branch or more (Availability).'),
  ].filter((problem): problem is string => Boolean(problem))

  function moveStage(index: number, offset: number) {
    const workflow = [...draft.workflow]
    const [stage] = workflow.splice(index, 1)
    workflow.splice(index + offset, 0, stage)
    patch({ workflow })
  }

  async function finish(publish: boolean) {
    setSaving(true)
    try {
      await onSave(
        {
          ...draft,
          id: code.trim().toUpperCase(),
          name: draft.name.trim(),
          itemPrices: draft.itemPrices.filter(({ item }) => item.trim()),
          branches: branchRows,
          availableDays: formatDays(days),
          availableHours: formatHours(hours.open, hours.close),
        },
        publish,
      )
    } finally {
      setSaving(false)
    }
  }

  const editingLive = service && service.status !== 'draft'
  const review: [string, ReactNode][] = [
    ['Name', draft.name || '—'],
    ['Code', code || '—'],
    ['Category', draft.category],
    ['Price', formatPrice({ ...draft, itemPrices: draft.itemPrices })],
    ['Processing', `${draft.standardHours} hours`],
    [
      'Express',
      draft.express.enabled
        ? `${draft.express.hours} hours (+${draft.express.surchargePct}%), cutoff ${draft.express.cutoff}`
        : 'Not offered',
    ],
    [
      'Branches',
      `${branchRows.filter(({ available }) => available).length} of ${branchRows.length}`,
    ],
    [
      'Resources',
      [...draft.machines, ...draft.consumption.map(({ material }) => material)].join(', ') ||
        'None',
    ],
    [
      'Add-ons',
      ADD_ONS.filter(({ id }) => draft.addOnIds.includes(id))
        .map(({ name }) => name)
        .join(', ') || 'None',
    ],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={service ? `Edit ${service.name}` : 'Add Service'}
      subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
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
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className={primaryButton}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : editingLive ? (
            <button
              type="button"
              disabled={problems.length > 0 || saving}
              onClick={() => void finish(true)}
              className={primaryButton}
            >
              <Check className="size-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!draft.name.trim() || !code.trim() || saving}
                onClick={() => void finish(false)}
                className={secondaryButton}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                disabled={problems.length > 0 || saving}
                onClick={() => void finish(true)}
                className={primaryButton}
              >
                <Check className="size-4" aria-hidden="true" />
                Publish Service
              </button>
            </>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Wizard steps">
        {STEPS.map((label, index) => (
          <li key={label} className="min-w-16 flex-1">
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => setStep(index)}
              className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span
                className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`}
              />
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
          <FormField label="Service name" htmlFor="service-name">
            <input
              id="service-name"
              autoFocus
              autoComplete="off"
              placeholder="e.g. Wash & Fold"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              className={fieldClass}
            />
          </FormField>
          <FormField label="Service code" htmlFor="service-code">
            <div className="flex gap-1">
              <input
                id="service-code"
                autoComplete="off"
                placeholder="Generated from the name"
                // The code identifies the service, so it is fixed once created
                readOnly={Boolean(service)}
                value={code}
                onChange={(event) => {
                  setCodeEdited(true)
                  patch({ id: event.target.value.toUpperCase() })
                }}
                className={`${fieldClass} font-mono`}
              />
              <button
                type="button"
                onClick={() => {
                  setCodeEdited(false)
                  patch({ id: '' })
                }}
                disabled={Boolean(service)}
                aria-label="Generate code from name"
                title="Generate code from name"
                className={`${iconButton} size-9 bg-field disabled:opacity-40`}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
              </button>
            </div>
          </FormField>
          <FormField label="Category" htmlFor="service-category">
            <select
              id="service-category"
              value={draft.category}
              onChange={(event) => patch({ category: event.target.value })}
              className={fieldClass}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </FormField>
          <fieldset>
            <legend className={labelClass}>Icon</legend>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-label={`${icon} icon`}
                  aria-pressed={draft.icon === icon}
                  onClick={() => patch({ icon })}
                  className={`rounded-lg p-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                    draft.icon === icon ? 'ring-2 ring-brand' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <ServiceIcon icon={icon} />
                </button>
              ))}
            </div>
          </fieldset>
          <FormField label="Description" htmlFor="service-description" wide>
            <textarea
              id="service-description"
              rows={3}
              placeholder="e.g. Professional washing, drying and folding of everyday clothing."
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              className={`${fieldClass} h-auto py-2`}
            />
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Pricing model" htmlFor="service-model">
              <select
                id="service-model"
                value={draft.pricingModel}
                onChange={(event) =>
                  patch({ pricingModel: event.target.value as PricingModel })
                }
                className={fieldClass}
              >
                {PRICING_MODELS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            {!custom && (
              <FormField label={`Base price (XAF per ${unit})`} htmlFor="service-price">
                <input
                  id="service-price"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draft.basePrice || ''}
                  onChange={(event) => patch({ basePrice: numeric(event.target.value) })}
                  className={fieldClass}
                />
              </FormField>
            )}
            <FormField label={`Minimum quantity (${unit})`} htmlFor="service-min">
              <input
                id="service-min"
                type="number"
                min="1"
                inputMode="numeric"
                value={draft.minQty}
                onChange={(event) =>
                  patch({ minQty: Math.max(1, numeric(event.target.value)) })
                }
                className={fieldClass}
              />
            </FormField>
            <FormField label="Maximum quantity (optional)" htmlFor="service-max">
              <input
                id="service-max"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="No limit"
                value={draft.maxQty ?? ''}
                onChange={(event) =>
                  patch({ maxQty: event.target.value ? numeric(event.target.value) : null })
                }
                className={fieldClass}
              />
            </FormField>
          </div>

          {custom && (
            <section>
              <h3 className={sectionTitle}>Item pricing table</h3>
              <ul className="mt-2 space-y-2">
                {draft.itemPrices.map((row, index) => {
                  const update = (change: Partial<typeof row>) =>
                    patch({
                      itemPrices: draft.itemPrices.map((current, position) =>
                        position === index ? { ...current, ...change } : current,
                      ),
                    })
                  return (
                    <li
                      key={index}
                      className="grid grid-cols-[1fr_2rem] gap-2 rounded-lg bg-field p-2 sm:grid-cols-[1fr_8rem_8rem_2rem]"
                    >
                      <input
                        aria-label="Item name"
                        placeholder="Item, e.g. Shirt"
                        value={row.item}
                        onChange={(event) => update({ item: event.target.value })}
                        className={`${fieldClass} bg-white`}
                      />
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-label={`Price for ${row.item || 'item'} in XAF`}
                        placeholder="Price"
                        value={row.price || ''}
                        onChange={(event) => update({ price: numeric(event.target.value) })}
                        className={`${fieldClass} bg-white max-sm:col-start-1`}
                      />
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-label={`Express price for ${row.item || 'item'} in XAF`}
                        placeholder="Express price"
                        value={row.expressPrice || ''}
                        onChange={(event) =>
                          update({ expressPrice: numeric(event.target.value) })
                        }
                        className={`${fieldClass} bg-white max-sm:col-start-1`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            itemPrices: draft.itemPrices.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                        aria-label={`Remove ${row.item || 'item'}`}
                        className={`${iconButton} max-sm:col-start-2 max-sm:row-start-1`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() =>
                  patch({
                    itemPrices: [
                      ...draft.itemPrices,
                      { item: '', price: 0, expressPrice: 0 },
                    ],
                  })
                }
                className={`${secondaryButton} mt-2`}
              >
                <Plus className="size-4 text-muted" aria-hidden="true" />
                Add Item
              </button>
            </section>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <section>
            <h3 className={sectionTitle}>Processing stages</h3>
            <ol className="mt-2 flex flex-wrap items-stretch gap-2">
              {draft.workflow.map((stage, index) => (
                <li
                  key={stage}
                  className="flex items-center gap-1 rounded-lg bg-field py-1.5 pr-1 pl-2.5 ring-1 ring-line"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="px-1 text-xs font-semibold text-ink">{stage}</span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveStage(index, -1)}
                    aria-label={`Move ${stage} earlier`}
                    className={`${iconButton} size-6 disabled:opacity-30`}
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.workflow.length - 1}
                    onClick={() => moveStage(index, 1)}
                    aria-label={`Move ${stage} later`}
                    className={`${iconButton} size-6 disabled:opacity-30`}
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        workflow: draft.workflow.filter((current) => current !== stage),
                      })
                    }
                    aria-label={`Remove ${stage}`}
                    className={`${iconButton} size-6 hover:text-danger`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Stage to add"
                value={stageToAdd}
                onChange={(event) => setStageToAdd(event.target.value)}
                className={`${fieldClass} sm:w-56`}
              >
                <option value="">Choose a stage…</option>
                {unusedStages.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!stageToAdd}
                onClick={() => {
                  // New stages go in just before the final stage
                  const workflow = [...draft.workflow]
                  workflow.splice(Math.max(0, workflow.length - 1), 0, stageToAdd)
                  patch({ workflow })
                  setStageToAdd('')
                }}
                className={secondaryButton}
              >
                <Plus className="size-4 text-muted" aria-hidden="true" />
                Add Stage
              </button>
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Standard processing time (hours)" htmlFor="service-hours">
              <input
                id="service-hours"
                type="number"
                min="1"
                inputMode="numeric"
                value={draft.standardHours}
                onChange={(event) =>
                  patch({ standardHours: Math.max(1, numeric(event.target.value)) })
                }
                className={fieldClass}
              />
            </FormField>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <fieldset>
            <legend className={sectionTitle}>Required machines</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {MACHINE_TYPES.map(({ name, available, capacity }) => (
                <label key={name} className={checkRowClass}>
                  <input
                    type="checkbox"
                    checked={draft.machines.includes(name)}
                    onChange={() => patch({ machines: toggle(draft.machines, name) })}
                    className="size-4 accent-brand"
                  />
                  <span>
                    {name}
                    <span className="block text-[10px] font-normal text-muted">
                      {available} available · {capacity}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Staff skill" htmlFor="service-skill">
              <select
                id="service-skill"
                value={draft.staffSkill}
                onChange={(event) => patch({ staffSkill: event.target.value })}
                className={fieldClass}
              >
                {STAFF_SKILLS.map((skill) => (
                  <option key={skill}>{skill}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Daily capacity (optional)" htmlFor="service-capacity">
              <input
                id="service-capacity"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="No limit"
                value={draft.dailyCapacity ?? ''}
                onChange={(event) =>
                  patch({
                    dailyCapacity: event.target.value ? numeric(event.target.value) : null,
                  })
                }
                className={fieldClass}
              />
            </FormField>
            <FormField label="Capacity unit" htmlFor="service-capacity-unit">
              <input
                id="service-capacity-unit"
                placeholder="kg, pieces…"
                value={draft.capacityUnit}
                onChange={(event) => patch({ capacityUnit: event.target.value })}
                className={fieldClass}
              />
            </FormField>
          </div>

          <section>
            <h3 className={sectionTitle}>
              Inventory consumption (per {unit})
            </h3>
            <ul className="mt-2 space-y-2">
              {draft.consumption.map((row, index) => {
                const update = (change: Partial<typeof row>) =>
                  patch({
                    consumption: draft.consumption.map((current, position) =>
                      position === index ? { ...current, ...change } : current,
                    ),
                  })
                return (
                  <li key={index} className="flex items-center gap-2">
                    <select
                      aria-label="Material"
                      value={row.material}
                      onChange={(event) =>
                        update({
                          material: event.target.value,
                          unit: MATERIALS.find(({ name }) => name === event.target.value)!.unit,
                        })
                      }
                      className={fieldClass}
                    >
                      {MATERIALS.map(({ name }) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      aria-label={`Amount of ${row.material}`}
                      value={row.amount || ''}
                      onChange={(event) => update({ amount: numeric(event.target.value) })}
                      className={`${fieldClass} w-24!`}
                    />
                    <span className="w-10 shrink-0 text-xs text-muted">{row.unit}</span>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          consumption: draft.consumption.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                      aria-label={`Remove ${row.material}`}
                      className={iconButton}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() =>
                patch({
                  consumption: [
                    ...draft.consumption,
                    { material: MATERIALS[0].name, amount: 0, unit: MATERIALS[0].unit },
                  ],
                })
              }
              className={`${secondaryButton} mt-2`}
            >
              <Plus className="size-4 text-muted" aria-hidden="true" />
              Add Material
            </button>
          </section>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <section>
            <h3 className={sectionTitle}>Branch availability & pricing</h3>
            {branchList.isLoading && (
              <div className="mt-2 space-y-2" aria-busy="true">
                <p className="sr-only" role="status">Loading branches…</p>
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-12 animate-pulse rounded-lg bg-field" />
                ))}
              </div>
            )}
            {branchList.isError && (
              <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger/5 px-3 py-2.5 text-xs font-semibold text-danger">
                Couldn’t load your branches.
                <button
                  type="button"
                  onClick={() => void branchList.refetch()}
                  disabled={branchList.isFetching}
                  className="rounded-sm text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {branchList.isFetching ? 'Retrying…' : 'Retry'}
                </button>
              </p>
            )}
            {branchList.isSuccess && branchRows.length === 0 && (
              <p className="mt-2 rounded-lg bg-field px-3 py-2.5 text-xs text-muted">
                You have no branches yet. Create a branch first, then offer the service there.
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {branchRows.map((setting, index) => {
                const update = (change: Partial<BranchSetting>) =>
                  patch({
                    branches: branchRows.map((current, position) =>
                      position === index ? { ...current, ...change } : current,
                    ),
                  })
                return (
                  <li
                    key={setting.branchId ?? setting.branch}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-field px-3 py-2"
                  >
                    <label className="flex min-w-40 flex-1 cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={setting.available}
                        onChange={(event) => update({ available: event.target.checked })}
                        className="size-4 accent-brand"
                      />
                      {setting.branch}
                    </label>
                    {!custom && (
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        disabled={!setting.available}
                        aria-label={`Price override for ${setting.branch} in XAF`}
                        placeholder={`Global: ${formatXaf(draft.basePrice)}`}
                        value={setting.priceOverride ?? ''}
                        onChange={(event) =>
                          update({
                            priceOverride: event.target.value
                              ? numeric(event.target.value)
                              : null,
                          })
                        }
                        className={`${fieldClass} w-44! bg-white`}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-1.5 text-[11px] text-muted">
              Leave a price empty to use the global price at that branch.
            </p>
          </section>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Customer visibility" htmlFor="service-visibility">
              <select
                id="service-visibility"
                value={draft.visibility}
                onChange={(event) =>
                  patch({ visibility: event.target.value as ServiceVisibility })
                }
                className={fieldClass}
              >
                {VISIBILITIES.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <fieldset className="sm:col-span-2">
              <legend className={labelClass}>Available days</legend>
              <div className="flex flex-wrap gap-1">
                {WEEK_DAYS.map(({ value, label, short }) => {
                  const on = days.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      aria-label={label}
                      onClick={() =>
                        patch({
                          availableDays: formatDays(on ? days.filter((day) => day !== value) : [...days, value]),
                        })
                      }
                      className={`h-9 min-w-11 rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                        on ? 'bg-brand text-white' : 'bg-field text-muted hover:text-ink'
                      }`}
                    >
                      {short}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Available hours</legend>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  aria-label="Opening time"
                  value={hours.open}
                  onChange={(event) =>
                    event.target.value && patch({ availableHours: formatHours(event.target.value, hours.close) })
                  }
                  className={fieldClass}
                />
                <span className="text-xs text-muted" aria-hidden="true">–</span>
                <input
                  type="time"
                  aria-label="Closing time"
                  value={hours.close}
                  onChange={(event) =>
                    event.target.value && patch({ availableHours: formatHours(hours.open, event.target.value) })
                  }
                  className={fieldClass}
                />
              </div>
            </fieldset>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <section>
            <label className={`${checkRowClass} font-semibold`}>
              <input
                type="checkbox"
                checked={draft.express.enabled}
                onChange={(event) =>
                  patch({ express: { ...draft.express, enabled: event.target.checked } })
                }
                className="size-4 accent-brand"
              />
              Express service available
            </label>
            {draft.express.enabled && (
              <div className="mt-2 grid gap-3 sm:grid-cols-4">
                <FormField label="Express time (hours)" htmlFor="express-hours">
                  <input
                    id="express-hours"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={draft.express.hours}
                    onChange={(event) =>
                      patch({
                        express: {
                          ...draft.express,
                          hours: Math.max(1, numeric(event.target.value)),
                        },
                      })
                    }
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Surcharge (%)" htmlFor="express-surcharge">
                  <input
                    id="express-surcharge"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={draft.express.surchargePct}
                    onChange={(event) =>
                      patch({
                        express: {
                          ...draft.express,
                          surchargePct: numeric(event.target.value),
                        },
                      })
                    }
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Cutoff time" htmlFor="express-cutoff">
                  <input
                    id="express-cutoff"
                    type="time"
                    value={draft.express.cutoff}
                    onChange={(event) =>
                      patch({ express: { ...draft.express, cutoff: event.target.value } })
                    }
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Minimum quantity" htmlFor="express-min">
                  <input
                    id="express-min"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={draft.express.minQty}
                    onChange={(event) =>
                      patch({
                        express: {
                          ...draft.express,
                          minQty: Math.max(1, numeric(event.target.value)),
                        },
                      })
                    }
                    className={fieldClass}
                  />
                </FormField>
              </div>
            )}
          </section>

          <fieldset>
            <legend className={sectionTitle}>Add-ons</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ADD_ONS.map(({ id, name, price, description }) => (
                <label key={id} className={checkRowClass}>
                  <input
                    type="checkbox"
                    checked={draft.addOnIds.includes(id)}
                    onChange={() => patch({ addOnIds: toggle(draft.addOnIds, id) })}
                    className="size-4 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    {name}
                    <span className="block truncate text-[10px] font-normal text-muted">
                      {description}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    +{formatXaf(price)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={sectionTitle}>Options offered at order creation</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((option) => {
                const selected = draft.options.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => patch({ options: toggle(draft.options, option) })}
                    className={`h-7 rounded-full px-3 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                      selected ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-brand/10'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <h3 className={sectionTitle}>Service summary</h3>
          <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-field p-3 text-xs sm:grid-cols-2">
            {review.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] text-muted">{label}</dt>
                <dd className="font-semibold break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-1.5 text-[10px] text-muted">Workflow</p>
            <WorkflowChain stages={draft.workflow} />
          </div>
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

export default ServiceWizard
