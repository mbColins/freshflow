import { useState } from 'react'
import { CalendarCheck, CalendarClock, Ellipsis, Eye, Inbox, ListChecks, Search } from 'lucide-react'
import DemoRequestDrawer from '../components/requests/DemoRequestDrawer'
import DemoStatusDialog from '../components/requests/DemoStatusDialog'
import { Kpi, ListEmpty, ListError, ListLoading, Pager, Toast } from '../components/requests/RequestParts'
import { fieldClass, iconButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import {
  DEMO_ACTION_LABELS,
  DEMO_BUSINESS_TYPES,
  DEMO_NEXT_STATUSES,
  DEMO_REQUEST_STATUSES,
  DEMO_WINDOWS,
  PAGE_SIZE,
} from '../constants/requests'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { useChangeDemoRequestStatusMutation, useListDemoRequestsQuery } from '../services/demoRequestApi'
import type { DemoRequest, DemoRequestStatus } from '../types/demoRequest'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatDateTime, formatPlainDate, requestFailure } from '../utils/requests'

const NO_REQUESTS: DemoRequest[] = []

// One tiny query per status, only for the totals in the KPI tiles
const useStatusCount = (status: DemoRequestStatus | '') =>
  useListDemoRequestsQuery({ status, page: 0, size: 1 }).data?.total

const DONE: Record<DemoRequestStatus, string> = {
  NEW: 'reopened',
  CONTACTED: 'marked as contacted',
  SCHEDULED: 'scheduled',
  COMPLETED: 'marked as completed',
  CANCELLED: 'cancelled',
}

// Platform admin: visitors who asked for a guided demo on the website
function DemoRequestsPage() {
  const [status, setStatus] = useState<DemoRequestStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<DemoRequest | null>(null)
  const [moving, setMoving] = useState<{ request: DemoRequest; target: DemoRequestStatus } | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useListDemoRequestsQuery({
    status,
    search,
    page,
    size: PAGE_SIZE,
  })
  const requests = data?.items ?? NO_REQUESTS
  const [changeStatus, { isLoading: saving }] = useChangeDemoRequestStatusMutation()

  const newCount = useStatusCount('NEW')
  const scheduledCount = useStatusCount('SCHEDULED')
  const completedCount = useStatusCount('COMPLETED')
  const allCount = useStatusCount('')
  const show = (count: number | undefined) => (count === undefined ? '—' : String(count))
  const filtersActive = status !== '' || searchInput.trim() !== ''

  function resetFilters() {
    setStatus('')
    setSearchInput('')
    setPage(0)
  }

  function startMove(request: DemoRequest, target: DemoRequestStatus) {
    setDialogError(null)
    setMoving({ request, target })
  }

  async function handleMove(values: { scheduledFor?: string; note?: string }) {
    if (!moving) return
    const { request, target } = moving
    try {
      const updated = await changeStatus({ uuid: request.uuid, status: target, ...values }).unwrap()
      setToast(`${request.company} ${DONE[target]}.`)
      setMoving(null)
      // Keep the drawer open on the fresh copy, so the next move is one click away
      setSelected(DEMO_NEXT_STATUSES[updated.status].length > 0 ? updated : null)
    } catch (error) {
      setDialogError(requestFailure(error, 'The request wasn’t updated.'))
    }
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-ink">Demo Requests</h1>
        <p className="text-xs text-muted">Visitors who asked for a guided demo from the website. Contact them, then schedule it.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ListChecks} label="All requests" value={show(allCount)} note="Since the form opened" />
        <Kpi icon={Inbox} label="New" value={show(newCount)} note="Not contacted yet" />
        <Kpi icon={CalendarClock} label="Scheduled" value={show(scheduledCount)} note="Demo date set" />
        <Kpi icon={CalendarCheck} label="Completed" value={show(completedCount)} note="Demos given" />
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search demo requests"
            placeholder="Search by name, email, company or reference…"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(0)
            }}
            className={`${fieldClass} h-10 pl-9`}
          />
        </div>
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as DemoRequestStatus | '')
            setPage(0)
          }}
          className={`${fieldClass} w-auto!`}
        >
          <option value="">All statuses</option>
          {(Object.keys(DEMO_REQUEST_STATUSES) as DemoRequestStatus[]).map((key) => (
            <option key={key} value={key}>{DEMO_REQUEST_STATUSES[key].label}</option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Reset Filters
          </button>
        )}
      </section>

      {isLoading ? (
        <ListLoading label="Loading demo requests…" />
      ) : isError && requests.length === 0 ? (
        <ListError
          title="Couldn’t load the demo requests"
          message={serverMessage(loadError) ?? (errorMessage(loadError as Parameters<typeof errorMessage>[0], 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : requests.length === 0 ? (
        filtersActive ? (
          <ListEmpty title="No requests match these filters" text="Try a different search or status." action={{ label: 'Reset Filters', onClick: resetFilters }} />
        ) : (
          <ListEmpty title="No demo requests yet" text="Requests from the website’s “Book a demo” form appear here." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-field text-[11px] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-bold">Company</th>
                <th scope="col" className="px-3 py-2 font-bold">Contact</th>
                <th scope="col" className="px-3 py-2 font-bold">Interested in</th>
                <th scope="col" className="px-3 py-2 font-bold">Preferred time</th>
                <th scope="col" className="px-3 py-2 font-bold">Status</th>
                <th scope="col" className="px-3 py-2 font-bold">Submitted</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((request) => {
                const badge = DEMO_REQUEST_STATUSES[request.status]
                const moves = DEMO_NEXT_STATUSES[request.status]
                return (
                  <tr key={request.uuid} className="align-top hover:bg-field/60">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected(request)}
                        className="rounded-sm text-left font-bold text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        {request.company}
                      </button>
                      <p className="font-mono text-[10px] text-muted">{request.reference}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{request.name}</p>
                      <p className="text-[11px] text-muted">{request.email}</p>
                      {request.phone && <p className="text-[11px] text-muted">{request.phone}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-ink">
                      {DEMO_BUSINESS_TYPES[request.businessType] ?? request.businessType}
                      {request.branchCount !== null && (
                        <p className="text-[11px] text-muted">{request.branchCount} {request.branchCount === 1 ? 'branch' : 'branches'}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink">
                      {request.preferredDate ? formatPlainDate(request.preferredDate) : 'No date given'}
                      <p className="text-[11px] text-muted">{DEMO_WINDOWS[request.preferredWindow] ?? request.preferredWindow}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {request.scheduledFor && (
                        <p className="mt-1 text-[11px] font-semibold text-ink">{formatDateTime(request.scheduledFor)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDateTime(request.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Menu
                        label={`Actions for ${request.company}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => (
                          <>
                            <MenuItem onSelect={() => { close(); setSelected(request) }}>
                              <span className="flex items-center gap-2"><Eye className="size-3.5" aria-hidden="true" />View details</span>
                            </MenuItem>
                            {moves.map((move) => (
                              <MenuItem key={move} destructive={move === 'CANCELLED'} onSelect={() => { close(); startMove(request, move) }}>
                                {DEMO_ACTION_LABELS[move]}
                              </MenuItem>
                            ))}
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} busy={isFetching} onPage={setPage} />

      <Toast message={toast} onDone={() => setToast(null)} />

      {selected && !moving && (
        <DemoRequestDrawer request={selected} onClose={() => setSelected(null)} onMove={(target) => startMove(selected, target)} />
      )}
      {moving && (
        <DemoStatusDialog
          key={`${moving.request.uuid}-${moving.target}`}
          request={moving.request}
          target={moving.target}
          error={dialogError}
          submitting={saving}
          onClose={() => setMoving(null)}
          onSubmit={(values) => void handleMove(values)}
        />
      )}
    </>
  )
}

export default DemoRequestsPage
