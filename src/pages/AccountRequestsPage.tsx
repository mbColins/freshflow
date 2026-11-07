import { useState } from 'react'
import { Check, Ellipsis, Eye, Hourglass, ListChecks, Search, ShieldCheck, X, XCircle } from 'lucide-react'
import ApproveAccountDialog from '../components/requests/ApproveAccountDialog'
import AccountRequestDrawer from '../components/requests/AccountRequestDrawer'
import RejectRequestDialog from '../components/requests/RejectRequestDialog'
import { Kpi, ListEmpty, ListError, ListLoading, Pager, Toast } from '../components/requests/RequestParts'
import { fieldClass, iconButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import { ACCOUNT_REQUEST_STATUSES, PAGE_SIZE } from '../constants/requests'
import useDebouncedValue from '../hooks/useDebouncedValue'
import {
  useApproveAccountRequestMutation,
  useListAccountRequestsQuery,
  useRejectAccountRequestMutation,
} from '../services/accountRequestApi'
import type { AccountRequest, AccountRequestStatus } from '../types/accountRequest'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatDateTime, requestFailure } from '../utils/requests'

const NO_REQUESTS: AccountRequest[] = []

// One tiny query per status, only for the totals in the KPI tiles
const useStatusCount = (status: AccountRequestStatus | '') =>
  useListAccountRequestsQuery({ status, page: 0, size: 1 }).data?.total

// Platform admin: businesses asking for a workspace from the public website
function AccountRequestsPage() {
  const [status, setStatus] = useState<AccountRequestStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AccountRequest | null>(null)
  const [approving, setApproving] = useState<AccountRequest | null>(null)
  const [rejecting, setRejecting] = useState<AccountRequest | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useListAccountRequestsQuery({
    status,
    search,
    page,
    size: PAGE_SIZE,
  })
  const requests = data?.items ?? NO_REQUESTS
  const [approve, { isLoading: approvingNow }] = useApproveAccountRequestMutation()
  const [reject, { isLoading: rejectingNow }] = useRejectAccountRequestMutation()

  const pendingCount = useStatusCount('PENDING')
  const approvedCount = useStatusCount('APPROVED')
  const rejectedCount = useStatusCount('REJECTED')
  // PENDING, APPROVED and REJECTED are every status there is, so no fourth query for the total
  const allCount =
    pendingCount === undefined || approvedCount === undefined || rejectedCount === undefined
      ? undefined
      : pendingCount + approvedCount + rejectedCount
  const show = (count: number | undefined) => (count === undefined ? '—' : String(count))
  const filtersActive = status !== '' || searchInput.trim() !== ''

  function resetFilters() {
    setStatus('')
    setSearchInput('')
    setPage(0)
  }

  function openApprove(request: AccountRequest) {
    setDialogError(null)
    setApproving(request)
  }
  function openReject(request: AccountRequest) {
    setDialogError(null)
    setRejecting(request)
  }

  async function handleApprove(request: AccountRequest, values: { subscriptionPlan: string; username?: string }) {
    try {
      await approve({ uuid: request.uuid, ...values }).unwrap()
      setToast(`${request.legalName} approved. The owner was emailed their sign-in details.`)
      setApproving(null)
      setSelected(null)
    } catch (error) {
      setDialogError(requestFailure(error, 'The request wasn’t approved.'))
    }
  }

  async function handleReject(request: AccountRequest, reason: string) {
    try {
      await reject({ uuid: request.uuid, reason }).unwrap()
      setToast(`${request.legalName} rejected.`)
      setRejecting(null)
      setSelected(null)
    } catch (error) {
      setDialogError(requestFailure(error, 'The request wasn’t rejected.'))
    }
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-ink">Account Requests</h1>
        <p className="text-xs text-muted">Businesses that asked for a workspace from the website. Approving one creates its tenant.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ListChecks} label="All requests" value={show(allCount)} note="Since the form opened" />
        <Kpi icon={Hourglass} label="Pending" value={show(pendingCount)} note="Waiting for a decision" />
        <Kpi icon={ShieldCheck} label="Approved" value={show(approvedCount)} note="Tenants created" />
        <Kpi icon={XCircle} label="Rejected" value={show(rejectedCount)} note="Declined with a reason" />
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search account requests"
            placeholder="Search by business, applicant, email or reference…"
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
            setStatus(event.target.value as AccountRequestStatus | '')
            setPage(0)
          }}
          className={`${fieldClass} w-auto!`}
        >
          <option value="">All statuses</option>
          {(Object.keys(ACCOUNT_REQUEST_STATUSES) as AccountRequestStatus[]).map((key) => (
            <option key={key} value={key}>{ACCOUNT_REQUEST_STATUSES[key].label}</option>
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
        <ListLoading label="Loading account requests…" />
      ) : isError && requests.length === 0 ? (
        <ListError
          title="Couldn’t load the account requests"
          message={serverMessage(loadError) ?? (errorMessage(loadError as Parameters<typeof errorMessage>[0], 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : requests.length === 0 ? (
        filtersActive ? (
          <ListEmpty title="No requests match these filters" text="Try a different search or status." action={{ label: 'Reset Filters', onClick: resetFilters }} />
        ) : (
          <ListEmpty title="No account requests yet" text="Applications from the website’s “Request an account” form appear here." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-field text-[11px] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-bold">Business</th>
                <th scope="col" className="px-3 py-2 font-bold">Applicant</th>
                <th scope="col" className="px-3 py-2 font-bold">Plan</th>
                <th scope="col" className="px-3 py-2 font-bold">Status</th>
                <th scope="col" className="px-3 py-2 font-bold">Submitted</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((request) => {
                const badge = ACCOUNT_REQUEST_STATUSES[request.status]
                const pending = request.status === 'PENDING'
                return (
                  <tr key={request.uuid} className="align-top hover:bg-field/60">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected(request)}
                        className="rounded-sm text-left font-bold text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        {request.legalName}
                      </button>
                      <p className="font-mono text-[10px] text-muted">{request.reference}</p>
                      <p className="text-[11px] text-muted">
                        {[request.industry, request.country].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{request.adminName}</p>
                      <p className="text-[11px] text-muted">{request.adminEmail}</p>
                      <p className="text-[11px] text-muted">{request.adminPhone}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-ink">{request.preferredPlan ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {request.rejectionReason && (
                        <p className="mt-1 max-w-48 text-[11px] text-muted">{request.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDateTime(request.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Menu
                        label={`Actions for ${request.legalName}`}
                        trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                        triggerClassName={iconButton}
                      >
                        {(close) => (
                          <>
                            <MenuItem onSelect={() => { close(); setSelected(request) }}>
                              <span className="flex items-center gap-2"><Eye className="size-3.5" aria-hidden="true" />View details</span>
                            </MenuItem>
                            {pending && (
                              <>
                                <MenuItem onSelect={() => { close(); openApprove(request) }}>
                                  <span className="flex items-center gap-2"><Check className="size-3.5" aria-hidden="true" />Approve</span>
                                </MenuItem>
                                <MenuItem destructive onSelect={() => { close(); openReject(request) }}>
                                  <span className="flex items-center gap-2"><X className="size-3.5" aria-hidden="true" />Reject</span>
                                </MenuItem>
                              </>
                            )}
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

      {selected && !approving && !rejecting && (
        <AccountRequestDrawer
          request={selected}
          onClose={() => setSelected(null)}
          onApprove={() => openApprove(selected)}
          onReject={() => openReject(selected)}
        />
      )}
      {approving && (
        <ApproveAccountDialog
          key={approving.uuid}
          request={approving}
          error={dialogError}
          submitting={approvingNow}
          onClose={() => setApproving(null)}
          onApprove={(values) => void handleApprove(approving, values)}
        />
      )}
      {rejecting && (
        <RejectRequestDialog
          key={rejecting.uuid}
          businessName={rejecting.legalName}
          error={dialogError}
          submitting={rejectingNow}
          onClose={() => setRejecting(null)}
          onReject={(reason) => void handleReject(rejecting, reason)}
        />
      )}
    </>
  )
}

export default AccountRequestsPage
