import { Fragment, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, History, RotateCcw } from 'lucide-react'
import { fieldClass, secondaryButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import { AUDIT_ENTITY_TYPES, useListAuditQuery } from '../services/auditApi'
import type { AuditEntityType, AuditEntry } from '../services/auditApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'

const PAGE_SIZE = 20

const label = (code: string) => code.toLowerCase().replace(/_/g, ' ')
const formatWhen = (iso: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const show = (value: unknown) =>
  value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)

// The fields that differ between the two snapshots; with only one snapshot,
// all of its fields
function changes(entry: AuditEntry) {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }))
}

function EntryDetails({ entry }: { entry: AuditEntry }) {
  const rows = changes(entry)
  if (rows.length === 0) {
    return <p className="text-[11px] text-muted">No field-level detail was recorded for this entry.</p>
  }
  return (
    <table className="w-full max-w-3xl text-left text-[11px]">
      <thead className="text-muted">
        <tr>
          <th scope="col" className="py-1 pr-3 font-bold">Field</th>
          <th scope="col" className="py-1 pr-3 font-bold">Before</th>
          <th scope="col" className="py-1 font-bold">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(({ key, before, after }) => (
          <tr key={key} className="align-top">
            <th scope="row" className="py-1 pr-3 font-semibold text-ink">{key}</th>
            <td className="py-1 pr-3 break-all text-muted">{show(before)}</td>
            <td className="py-1 break-all text-ink">{show(after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Who changed what and when, newest first
function AuditLogPage() {
  const [entityType, setEntityType] = useState<AuditEntityType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading, isError, isFetching, error, refetch } = useListAuditQuery({
    entityType,
    from,
    to,
    page,
    size: PAGE_SIZE,
  })
  const entries = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const filtersActive = entityType !== '' || from !== '' || to !== ''

  // A new filter starts again from the first page
  const filter = (apply: () => void) => {
    apply()
    setPage(0)
    setOpenId(null)
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-ink">Audit Log</h1>
        <p className="text-xs text-muted">Who changed what, and when. Entries can’t be edited or deleted.</p>
      </div>

      <section className="rounded-xl bg-white ring-1 ring-line">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <label className="text-[11px] font-semibold text-ink">
            Type
            <select
              value={entityType}
              onChange={(event) => filter(() => setEntityType(event.target.value as AuditEntityType | ''))}
              className={`${fieldClass} mt-1 w-44 capitalize`}
            >
              <option value="">All types</option>
              {AUDIT_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{label(type)}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-ink">
            From
            <input type="date" value={from} max={to || undefined} onChange={(event) => filter(() => setFrom(event.target.value))} className={`${fieldClass} mt-1`} />
          </label>
          <label className="text-[11px] font-semibold text-ink">
            To
            <input type="date" value={to} min={from || undefined} onChange={(event) => filter(() => setTo(event.target.value))} className={`${fieldClass} mt-1`} />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => filter(() => { setEntityType(''); setFrom(''); setTo('') })}
              className={secondaryButton}
            >
              Clear filters
            </button>
          )}
          <p className="ml-auto text-[11px] text-muted" aria-live="polite">
            {data ? `${data.total} ${data.total === 1 ? 'entry' : 'entries'}` : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="animate-pulse divide-y divide-line" aria-busy="true">
            <p className="sr-only" role="status">Loading the audit log…</p>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-4">
                <div className="h-3 w-28 rounded bg-field" />
                <div className="h-3 w-24 rounded bg-field" />
                <div className="h-5 w-16 rounded bg-field" />
                <div className="h-3 flex-1 rounded bg-field" />
              </div>
            ))}
          </div>
        ) : isError && entries.length === 0 ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <h2 className="text-sm font-bold text-ink">Couldn’t load the audit log</h2>
            <p className="max-w-md text-xs text-muted">
              {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
            </p>
            <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {isFetching ? 'Retrying…' : 'Try Again'}
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <History className="size-6 text-muted" aria-hidden="true" />
            <h2 className="text-sm font-bold text-ink">{filtersActive ? 'No entries match' : 'Nothing recorded yet'}</h2>
            <p className="max-w-sm text-xs text-muted">
              {filtersActive ? 'Try another type or a wider date range.' : 'Changes to roles, orders, payments and more appear here as they happen.'}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">When</th>
                  <th scope="col" className="px-3 py-2 font-bold">Who</th>
                  <th scope="col" className="px-3 py-2 font-bold">Type</th>
                  <th scope="col" className="px-3 py-2 font-bold">What happened</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((entry) => {
                  const open = openId === entry.id
                  return (
                    <Fragment key={entry.id}>
                      <tr className="align-top">
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatWhen(entry.at)}</td>
                        <td className="px-3 py-2.5 font-semibold text-ink">{entry.actor || 'System'}</td>
                        <td className="px-3 py-2.5"><Badge tone="brand">{label(entry.entityType)}</Badge></td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-ink capitalize">{label(entry.action)}</p>
                          {entry.summary && <p className="max-w-lg text-[11px] text-muted">{entry.summary}</p>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {(entry.before || entry.after) && (
                            <button
                              type="button"
                              onClick={() => setOpenId(open ? null : entry.id)}
                              aria-expanded={open}
                              aria-label={`${open ? 'Hide' : 'Show'} details`}
                              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                            >
                              <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-field/50">
                          <td colSpan={5} className="px-3 py-3"><EntryDetails entry={entry} /></td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-muted">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0 || isFetching} className={secondaryButton}>
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages || isFetching} className={secondaryButton}>
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

export default AuditLogPage
