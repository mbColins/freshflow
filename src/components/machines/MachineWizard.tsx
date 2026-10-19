import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react'
import { MACHINE_TYPES, MACHINE_WIZARD_STEPS } from '../../constants/machines'
import type { MachineProfile, MachineSpecs, MachineType } from '../../types/machine'
import { getMachineType, getProfileProblems, nextMachineId } from '../../utils/machines'
import { formatXaf } from '../../utils/orders'
import { fieldClass, primaryButton, secondaryButton } from '../orders/styles'
import Modal from '../ui/Modal'
import FormField from '../ui/FormField'

type TextKey = 'name' | 'id' | 'manufacturer' | 'model' | 'serial' | 'description' | 'area' | 'zone'

const SPEC_FIELDS: [keyof MachineSpecs, string, string][] = [
  ['capacityKg', 'Capacity', 'kg'],
  ['powerKw', 'Power consumption', 'kW'],
  ['waterL', 'Water consumption', 'L / cycle'],
  ['voltage', 'Voltage', 'V'],
  ['maxTemp', 'Maximum temperature', '°C'],
  ['cycleMin', 'Cycle duration', 'min'],
]

function MachineWizard({
  initial,
  mode,
  takenIds,
  branches,
  onClose,
  onSave,
}: {
  initial: MachineProfile
  mode: 'create' | 'edit'
  takenIds: string[]
  branches: { id: string; name: string }[]
  onClose: () => void
  onSave: (profile: MachineProfile) => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(initial)
  // A new machine's ID follows its type until the user types their own
  const [idEdited, setIdEdited] = useState(mode === 'edit')
  const patch = (change: Partial<MachineProfile>) => setDraft((current) => ({ ...current, ...change }))
  const problems = getProfileProblems(draft, takenIds)
  const last = MACHINE_WIZARD_STEPS.length - 1
  const typeMeta = getMachineType(draft.type)

  const text = (id: string, label: string, key: TextKey, options: { placeholder?: string; wide?: boolean; disabled?: boolean; hint?: string } = {}) => (
    <FormField label={label} htmlFor={id} wide={options.wide} hint={options.hint}>
      <input
        id={id}
        autoComplete="off"
        disabled={options.disabled}
        placeholder={options.placeholder}
        value={draft[key]}
        onChange={(event) => {
          if (key === 'id') setIdEdited(true)
          patch({ [key]: key === 'id' ? event.target.value.toUpperCase() : event.target.value })
        }}
        className={`${fieldClass} disabled:opacity-60`}
      />
    </FormField>
  )

  function chooseType(type: MachineType) {
    const meta = getMachineType(type)
    patch({
      type,
      area: meta.area,
      capabilities: meta.capabilities,
      ...(idEdited ? {} : { id: nextMachineId(type, takenIds.map((id) => ({ id }))) }),
    })
  }

  const review: [string, string][] = [
    ['Machine', `${draft.name || 'Unnamed'} · ${draft.id} · ${draft.type}`],
    ['Make and model', [draft.manufacturer, draft.model].filter(Boolean).join(' ') || 'Not set'],
    ['Serial number', draft.serial || 'Not set'],
    ['Purchased', `${draft.yearPurchased}${draft.purchaseCost > 0 ? ` · ${formatXaf(draft.purchaseCost)}` : ''}`],
    ['Location', [branches.find(({ id }) => id === draft.branchId)?.name, draft.area, draft.zone].filter(Boolean).join(' · ')],
    ['Specifications', `${draft.specs.capacityKg} kg · ${draft.specs.powerKw} kW · ${draft.specs.waterL} L/cycle · ${draft.specs.voltage} V · ${draft.specs.cycleMin} min cycle`],
    ['Warranty', draft.specs.warrantyEnd ? `Until ${draft.specs.warrantyEnd}` : 'None recorded'],
    ['Capabilities', draft.capabilities.join(', ') || 'None'],
    ['Maintenance', `Every ${draft.maintenanceEveryDays} days`],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={mode === 'create' ? 'Add Machine' : `Edit ${initial.name}`}
      subtitle={`Step ${step + 1} of ${MACHINE_WIZARD_STEPS.length}: ${MACHINE_WIZARD_STEPS[step]}`}
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
          ) : (
            <button type="button" disabled={problems.length > 0} onClick={() => onSave(draft)} className={primaryButton}>
              <Check className="size-4" aria-hidden="true" />
              {mode === 'create' ? 'Add Machine' : 'Save Changes'}
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1 overflow-x-auto" aria-label="Wizard steps">
        {MACHINE_WIZARD_STEPS.map((label, index) => (
          <li key={label} className="min-w-16 flex-1">
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
          {text('machine-name', 'Machine name', 'name', { placeholder: 'e.g. Washer #15' })}
          <FormField label="Machine type" htmlFor="machine-type">
            <select id="machine-type" value={draft.type} onChange={(event) => chooseType(event.target.value as MachineType)} className={fieldClass}>
              {MACHINE_TYPES.map(({ value }) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </FormField>
          {text('machine-id', 'Machine ID', 'id', { disabled: mode === 'edit', hint: mode === 'create' ? 'Suggested from the type; change it if you label machines differently.' : undefined })}
          {text('machine-serial', 'Serial number', 'serial', { placeholder: 'SN-9283847' })}
          {text('machine-maker', 'Manufacturer', 'manufacturer')}
          {text('machine-model', 'Model', 'model')}
          <FormField label="Year purchased" htmlFor="machine-year">
            <input id="machine-year" type="number" min={1990} max={2100} value={draft.yearPurchased} onChange={(event) => patch({ yearPurchased: Number(event.target.value) })} className={fieldClass} />
          </FormField>
          <FormField label="Purchase cost (XAF)" htmlFor="machine-cost">
            <input id="machine-cost" type="number" min={0} step={50_000} value={draft.purchaseCost} onChange={(event) => patch({ purchaseCost: Math.max(0, Number(event.target.value)) })} className={fieldClass} />
          </FormField>
          <FormField label="Description" htmlFor="machine-description" wide>
            <textarea id="machine-description" rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} className={`${fieldClass} h-auto py-2`} />
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Branch" htmlFor="machine-branch" hint={mode === 'edit' ? 'Use Transfer Machine to move it to another branch, so the move is recorded.' : undefined}>
            <select id="machine-branch" disabled={mode === 'edit'} value={draft.branchId} onChange={(event) => patch({ branchId: event.target.value })} className={`${fieldClass} disabled:opacity-60`}>
              {branches.map(({ id, name }) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </FormField>
          {text('machine-area', 'Department / area', 'area', { placeholder: 'e.g. Washing Area' })}
          {text('machine-zone', 'Zone and position', 'zone', { placeholder: 'e.g. Zone A / Station 03', wide: true })}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {SPEC_FIELDS.map(([key, label, unit]) => (
            <FormField key={key} label={`${label} (${unit})`} htmlFor={`spec-${key}`}>
              <input
                id={`spec-${key}`}
                type="number"
                min={0}
                value={draft.specs[key]}
                onChange={(event) => patch({ specs: { ...draft.specs, [key]: Math.max(0, Number(event.target.value)) } })}
                className={fieldClass}
              />
            </FormField>
          ))}
          <FormField label="Warranty ends" htmlFor="spec-warranty">
            <input id="spec-warranty" type="date" value={draft.specs.warrantyEnd} onChange={(event) => patch({ specs: { ...draft.specs, warrantyEnd: event.target.value } })} className={fieldClass} />
          </FormField>
          <FormField label="Preventive maintenance every (days)" htmlFor="spec-frequency">
            <input id="spec-frequency" type="number" min={1} value={draft.maintenanceEveryDays} onChange={(event) => patch({ maintenanceEveryDays: Math.max(1, Number(event.target.value)) })} className={fieldClass} />
          </FormField>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-2 text-[11px] text-muted">What this {draft.type.toLowerCase()} can do. The list depends on the machine type.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {typeMeta.capabilities.map((capability) => (
              <li key={capability}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={draft.capabilities.includes(capability)}
                    onChange={(event) =>
                      patch({
                        capabilities: event.target.checked
                          ? typeMeta.capabilities.filter((item) => item === capability || draft.capabilities.includes(item))
                          : draft.capabilities.filter((item) => item !== capability),
                      })
                    }
                    className="size-4 accent-brand"
                  />
                  {capability}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === last && (
        <div className="space-y-3">
          <dl className="divide-y divide-line rounded-lg bg-field px-3 text-xs">
            {review.map(([label, value]) => (
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
            mode === 'create' && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                The machine is added as Available and its first preventive maintenance is planned {draft.maintenanceEveryDays} days from today.
              </p>
            )
          )}
        </div>
      )}
    </Modal>
  )
}

export default MachineWizard
