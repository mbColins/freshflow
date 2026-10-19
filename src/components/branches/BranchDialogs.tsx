import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { MAX_COMPARE, MIN_COMPARE } from '../../constants/branches'
import type { BranchPermissions } from '../../constants/branches'
import type { Branch } from '../../types/branch'
import { COMPARE_METRICS, getPeriodStats } from '../../utils/branches'
import { fieldClass, labelClass, primaryButton, secondaryButton } from '../orders/styles'
import Modal from '../ui/Modal'

// ---------- Compare branches ----------

export function CompareDialog({
  branches,
  permissions,
  onClose,
}: {
  branches: Branch[]
  permissions: BranchPermissions
  onClose: () => void
}) {
  // Start with the busiest branches this month
  const [selectedIds, setSelectedIds] = useState(() =>
    [...branches]
      .sort((a, b) => getPeriodStats(b, 'month').orders - getPeriodStats(a, 'month').orders)
      .slice(0, 4)
      .map(({ id }) => id),
  )
  const selected = branches.filter(({ id }) => selectedIds.includes(id))
  const full = selectedIds.length >= MAX_COMPARE
  const metrics = COMPARE_METRICS.filter(({ financial }) => !financial || permissions.financials)

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Compare Branches"
      subtitle={`Select ${MIN_COMPARE}–${MAX_COMPARE} branches. ${selectedIds.length} selected.`}
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Done
        </button>
      }
    >
      <ul className="flex flex-wrap gap-1.5">
        {branches.map((branch) => {
          const checked = selectedIds.includes(branch.id)
          return (
            <li key={branch.id}>
              <button
                type="button"
                aria-pressed={checked}
                disabled={!checked && full}
                onClick={() =>
                  setSelectedIds(
                    checked ? selectedIds.filter((id) => id !== branch.id) : [...selectedIds, branch.id],
                  )
                }
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                  checked ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-line'
                }`}
              >
                {branch.name}
              </button>
            </li>
          )
        })}
      </ul>

      {selected.length < MIN_COMPARE ? (
        <p className="mt-4 rounded-lg bg-field px-3 py-8 text-center text-xs text-muted">
          Select at least {MIN_COMPARE} branches to compare.
        </p>
      ) : (
        <>
          <div className="relative mt-4 overflow-x-auto rounded-lg ring-1 ring-line">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Metric</th>
                  {selected.map((branch) => (
                    <th key={branch.id} scope="col" className="px-3 py-2 text-right font-bold text-ink">
                      {branch.name}
                      <span className="block font-mono text-[10px] font-normal text-muted">{branch.id}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map(({ label, get, format }) => {
                  const values = selected.map(get)
                  const known = values.filter((value): value is number => value !== null)
                  const best = Math.max(...known)
                  const worst = Math.min(...known)
                  const spread = known.length >= 2 && best !== worst
                  return (
                    <tr key={label}>
                      <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-ink">{label}</th>
                      {values.map((value, index) => {
                        const isBest = spread && value === best
                        const isWorst = spread && value === worst
                        return (
                          <td
                            key={selected[index].id}
                            className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${
                              isBest ? 'bg-success/10 font-bold text-success' : isWorst ? 'bg-danger/10 font-bold text-danger' : 'text-ink'
                            }`}
                          >
                            {value === null ? (
                              <span className="text-muted">n/a</span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {isBest && <ArrowUp className="size-3" aria-label="Strongest" />}
                                {isWorst && <ArrowDown className="size-3" aria-label="Weakest" />}
                                {format(value)}
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
          </div>
          <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1 text-success"><ArrowUp className="size-3" aria-hidden="true" /> Strongest in the row</span>
            <span className="inline-flex items-center gap-1 text-danger"><ArrowDown className="size-3" aria-hidden="true" /> Weakest in the row</span>
            <span>n/a = the branch has no machines or isn’t operating</span>
          </p>
        </>
      )}
    </Modal>
  )
}

// ---------- Small add form (assign staff, add machine) ----------

export function QuickAddDialog({
  title,
  nameLabel,
  namePlaceholder,
  kindLabel,
  kinds,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  nameLabel: string
  namePlaceholder: string
  kindLabel: string
  kinds: string[]
  submitLabel: string
  onClose: () => void
  onSubmit: (name: string, kind: string) => void
}) {
  const { register, handleSubmit, control } = useForm<{ name: string; kind: string }>({
    defaultValues: { name: '', kind: kinds[0] },
  })
  const name = useWatch({ control, name: 'name' })
  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="quick-add" disabled={!name.trim()} className={primaryButton}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form
        id="quick-add"
        className="space-y-3"
        onSubmit={handleSubmit((values) => onSubmit(values.name.trim(), values.kind))}
      >
        <div>
          <label htmlFor="quick-name" className={labelClass}>{nameLabel}</label>
          <input
            id="quick-name"
            autoComplete="off"
            placeholder={namePlaceholder}
            {...register('name', { validate: (value) => value.trim() !== '' })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="quick-kind" className={labelClass}>{kindLabel}</label>
          <select id="quick-kind" {...register('kind')} className={fieldClass}>
            {kinds.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}
