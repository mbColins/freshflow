import { useState } from 'react'
import { useListDuplicatesQuery, useMergeCustomersMutation } from '../../services/customerApi'
import type { DuplicateGroup } from '../../services/customerApi'
import { saveFailureMessage } from '../../utils/apiErrors'
import { formatDate } from '../../utils/customers'
import { primaryButton, secondaryButton } from '../orders/styles'
import Modal from '../ui/Modal'

// Customers sharing a phone number or an email. Pick the record to keep; the
// others' orders, payments, messages, notes and points move to it and they are
// archived. A merge cannot be undone.
export default function CustomerDuplicatesDialog({ onClose, onMerged }: { onClose: () => void; onMerged: (message: string) => void }) {
  const duplicates = useListDuplicatesQuery()
  const [merge, merging] = useMergeCustomersMutation()
  // The record kept in each group, by group key
  const [keep, setKeep] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const groups = duplicates.data ?? []

  const keyOf = (group: DuplicateGroup) => `${group.matchedOn}:${group.value}`

  async function handleMerge(group: DuplicateGroup) {
    const target = keep[keyOf(group)] ?? group.customers[0]?.id
    const sources = group.customers.filter(({ id }) => id !== target)
    const name = group.customers.find(({ id }) => id === target)?.name ?? 'the kept customer'
    if (!target || sources.length === 0) return
    if (!window.confirm(`Merge ${sources.length} duplicate ${sources.length === 1 ? 'record' : 'records'} into ${name}? This can’t be undone.`)) return
    setError(null)
    try {
      for (const source of sources) await merge({ id: source.id, into: target }).unwrap()
      onMerged(`Merged ${sources.length} ${sources.length === 1 ? 'record' : 'records'} into ${name}`)
    } catch (failure) {
      setError(
        saveFailureMessage(failure, 'The customers weren’t merged.', 'These customers belong to different businesses or one is already archived.'),
      )
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Duplicate Customers"
      subtitle="Customers who share a phone number or an email."
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close
        </button>
      }
    >
      <div className="space-y-3">
        {duplicates.isLoading ? (
          <p className="py-8 text-center text-xs text-muted">Looking for duplicates…</p>
        ) : duplicates.isError && !duplicates.data ? (
          <p role="alert" className="py-8 text-center text-xs text-danger">
            Couldn’t load the duplicates. Only managers and the owner can.
          </p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">No duplicates found.</p>
        ) : (
          groups.map((group) => {
            const key = keyOf(group)
            const chosen = keep[key] ?? group.customers[0]?.id
            return (
              <fieldset key={key} className="rounded-lg bg-field p-3">
                <legend className="px-1 text-[11px] font-bold text-ink">
                  Same {group.matchedOn}: {group.value}
                </legend>
                <ul className="space-y-1.5">
                  {group.customers.map((customer) => (
                    <li key={customer.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-xs ring-1 ring-line">
                        <input
                          type="radio"
                          name={key}
                          checked={chosen === customer.id}
                          onChange={() => setKeep({ ...keep, [key]: customer.id })}
                          className="size-4 accent-brand"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-ink">{customer.name}</span>
                          <span className="block text-[11px] text-muted">
                            {[customer.phone, customer.email, customer.branch].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] text-muted">
                          {customer.orders} {customer.orders === 1 ? 'order' : 'orders'}
                          <span className="block">since {formatDate(customer.registeredAt)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted">The selected record is kept.</p>
                  <button type="button" disabled={merging.isLoading} onClick={() => void handleMerge(group)} className={primaryButton}>
                    {merging.isLoading ? 'Merging…' : 'Merge into selected'}
                  </button>
                </div>
              </fieldset>
            )
          })
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
