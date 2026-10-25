import { useEffect, useState } from 'react'
import { Check, Ellipsis, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import { PLATFORM_MODULES } from '../constants/platformPlans'
import useCurrentUser from '../hooks/useCurrentUser'
import { usePlatformPlansQuery } from '../hooks/usePlatformPlans'
import {
  useListSubscriptionsQuery,
  useSetSubscriptionStatusMutation,
  useSubscribeMutation,
} from '../services/subscriptionApi'
import type { Subscription, SubscriptionStatus } from '../services/subscriptionApi'
import type { PlatformPlan } from '../types/platformPlan'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatXaf } from '../utils/orders'
import { annualSavingPct, limitLabel } from '../utils/platformPlans'

const TOAST_MS = 5000
const NO_SUBSCRIPTIONS: Subscription[] = []
const NO_PLANS: PlatformPlan[] = []
const HISTORY = { page: 0, size: 50 }

const STATUS: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  TRIAL: { label: 'Trial', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'success' },
  SCHEDULED: { label: 'Scheduled', tone: 'brand' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  PAST_DUE: { label: 'Past due', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

// The statuses a platform admin can set directly
const SETTABLE: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'SCHEDULED', 'EXPIRED']

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

const formatDate = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

// What subscribing will do, so the owner knows before confirming
function outcome(plan: PlatformPlan, running: Subscription | undefined, everSubscribed: boolean) {
  if (running) {
    const ends = formatDate(running.status === 'TRIAL' ? running.trialEndsAt : running.endsAt)
    return `${plan.name} starts when your current ${STATUS[running.status].label.toLowerCase()} period ends on ${ends}. Nothing changes until then.`
  }
  return everSubscribed
    ? `${plan.name} starts today at ${formatXaf(plan.monthlyPrice)} a month.`
    : plan.trialPeriodDays > 0
      ? `${plan.name} starts today with a ${plan.trialPeriodDays}-day trial.`
      : `${plan.name} starts today.`
}

// The business owner's plan on the platform: what runs now, what is queued,
// the plans on offer and the history. A platform admin sees every tenant's history
function BillingPage() {
  const { user, isPlatformAdmin } = useCurrentUser()
  const isOwner = user?.userType === 'TENANT'
  const subscriptions = useListSubscriptionsQuery(HISTORY)
  const history = subscriptions.data?.items ?? NO_SUBSCRIPTIONS
  const plansQuery = usePlatformPlansQuery()
  const plans = (plansQuery.data?.items ?? NO_PLANS).filter(({ active }) => active)
  const [subscribe, { isLoading: subscribing }] = useSubscribeMutation()
  const [setStatus] = useSetSubscriptionStatusMutation()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const running = history.find(({ status }) => status === 'TRIAL' || status === 'ACTIVE')
  const scheduled = history.find(({ status }) => status === 'SCHEDULED')
  const expired = !running && history.length > 0
  const runningPlan = plans.find(({ code }) => code === running?.plan)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function requestSubscribe(plan: PlatformPlan) {
    setConfirm({
      title: `Subscribe to ${plan.name}?`,
      body: outcome(plan, running, history.length > 0),
      confirmLabel: running ? 'Schedule Plan' : 'Subscribe',
      onConfirm: async () => {
        try {
          await subscribe({ plan: plan.code }).unwrap()
          setToast(running ? `${plan.name} scheduled` : `Subscribed to ${plan.name}`)
        } catch (error) {
          setToast(failure(error, `Couldn’t subscribe to ${plan.name}.`))
        }
      },
    })
  }

  async function changeStatus(entry: Subscription, status: SubscriptionStatus) {
    try {
      await setStatus({ id: entry.id, status }).unwrap()
      setToast(`${entry.tenant || 'Subscription'} set to ${STATUS[status].label.toLowerCase()}`)
    } catch (error) {
      setToast(failure(error, 'Couldn’t change the status. A tenant can have only one trial or active subscription.'))
    }
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-ink">Subscription</h1>
        <p className="text-xs text-muted">
          {isPlatformAdmin ? 'Every business’s subscription history.' : 'Your plan on the platform, and the plans you can move to.'}
        </p>
      </div>

      {subscriptions.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-white ring-1 ring-line" aria-busy="true">
          <p className="sr-only" role="status">Loading your subscription…</p>
        </div>
      ) : subscriptions.isError && history.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-10 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the subscription</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(subscriptions.error) ?? (errorMessage(subscriptions.error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void subscriptions.refetch()} disabled={subscriptions.isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {subscriptions.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : (
        !isPlatformAdmin && (
          <section className="rounded-xl bg-white p-4 ring-1 ring-line" aria-label="Current subscription">
            {running ? (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                  {runningPlan?.name ?? running.plan}
                  <Badge tone={STATUS[running.status].tone}>{STATUS[running.status].label}</Badge>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {running.status === 'TRIAL'
                    ? `Your trial ends on ${formatDate(running.trialEndsAt)}.`
                    : `Renews or ends on ${formatDate(running.endsAt)}.`}
                  {scheduled && ` Next: ${plans.find(({ code }) => code === scheduled.plan)?.name ?? scheduled.plan}, from ${formatDate(scheduled.startsAt)}.`}
                </p>
              </>
            ) : expired ? (
              <>
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  Your subscription has expired <Badge tone="danger">Expired</Badge>
                </p>
                <p className="mt-1 text-xs text-muted">Most of the app is frozen until you subscribe to a plan below.</p>
              </>
            ) : (
              <p className="text-xs text-muted">You haven’t subscribed to a plan yet. Pick one below to get started.</p>
            )}
          </section>
        )
      )}

      {!isPlatformAdmin && (
        <section aria-label="Plans">
          {plansQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              <p className="sr-only" role="status">Loading plans…</p>
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-64 animate-pulse rounded-xl bg-white ring-1 ring-line" />
              ))}
            </div>
          ) : plansQuery.isError ? (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
              Couldn’t load the plans. {serverMessage(plansQuery.error) ?? NETWORK_ERROR_MESSAGE}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => {
                const current = running?.plan === plan.code
                const queued = scheduled?.plan === plan.code
                const saving = annualSavingPct(plan)
                return (
                  <article key={plan.code} className={`flex flex-col gap-4 rounded-xl bg-white p-4 ring-1 ${current ? 'ring-2 ring-brand' : 'ring-line'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-bold text-ink">{plan.name}</h2>
                      {current && <Badge tone="success">Current plan</Badge>}
                      {queued && <Badge tone="brand">Scheduled</Badge>}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-ink tabular-nums">
                        {formatXaf(plan.monthlyPrice)}
                        <span className="text-xs font-semibold text-muted"> /month</span>
                      </p>
                      <p className="text-[11px] text-muted">
                        {plan.annualPrice === null ? 'Monthly billing only' : `or ${formatXaf(plan.annualPrice)} /year${saving ? ` (save ${saving}%)` : ''}`}
                        {' · '}
                        {plan.trialPeriodDays > 0 ? `${plan.trialPeriodDays}-day trial` : 'No trial'}
                      </p>
                    </div>
                    <ul className="space-y-1 text-xs font-semibold text-ink">
                      <li>{limitLabel(plan.maxShops, 'shops')}</li>
                      <li>{limitLabel(plan.maxStaff, 'staff')}</li>
                      <li>{limitLabel(plan.maxOrdersPerMonth, 'orders / month')}</li>
                    </ul>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Modules">
                      {plan.enabledFeatures.map((module) => (
                        <li key={module} className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          <Check className="size-3" aria-hidden="true" />
                          {PLATFORM_MODULES[module] ?? module}
                        </li>
                      ))}
                    </ul>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => requestSubscribe(plan)}
                        disabled={subscribing || Boolean(scheduled) || queued}
                        title={scheduled ? 'Another plan is already scheduled' : undefined}
                        className={`${current ? secondaryButton : primaryButton} mt-auto justify-center`}
                      >
                        {queued ? 'Scheduled' : current ? 'Renew after this period' : running ? 'Switch after this period' : expired ? 'Resubscribe' : 'Subscribe'}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          )}
          {!isOwner && !plansQuery.isLoading && (
            <p className="mt-2 text-[11px] text-muted">Only the business owner can subscribe.</p>
          )}
        </section>
      )}

      <section className="rounded-xl bg-white ring-1 ring-line" aria-label="History">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-ink">History</h2>
        {subscriptions.isLoading ? (
          <div className="animate-pulse space-y-2 p-4" aria-busy="true">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-8 rounded-md bg-field" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted">No subscriptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-field text-[11px] text-muted">
                <tr>
                  {isPlatformAdmin && <th scope="col" className="px-3 py-2 font-bold">Business</th>}
                  <th scope="col" className="px-3 py-2 font-bold">Plan</th>
                  <th scope="col" className="px-3 py-2 font-bold">Status</th>
                  <th scope="col" className="px-3 py-2 font-bold">Starts</th>
                  <th scope="col" className="px-3 py-2 font-bold">Ends</th>
                  {isPlatformAdmin && <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    {isPlatformAdmin && <td className="px-3 py-2.5 font-semibold text-ink">{entry.tenant}</td>}
                    <td className="px-3 py-2.5 font-mono text-ink">{entry.plan}</td>
                    <td className="px-3 py-2.5"><Badge tone={STATUS[entry.status]?.tone}>{STATUS[entry.status]?.label ?? entry.status}</Badge></td>
                    <td className="px-3 py-2.5 text-muted">{formatDate(entry.startsAt)}</td>
                    <td className="px-3 py-2.5 text-muted">{formatDate(entry.status === 'TRIAL' ? entry.trialEndsAt : entry.endsAt)}</td>
                    {isPlatformAdmin && (
                      <td className="px-3 py-1.5 text-right">
                        <Menu label={`Actions for ${entry.tenant}`} trigger={<Ellipsis className="size-4" aria-hidden="true" />} triggerClassName={iconButton}>
                          {(close) => (
                            <>
                              {SETTABLE.filter((status) => status !== entry.status).map((status) => (
                                <MenuItem key={status} onSelect={() => { close(); void changeStatus(entry, status) }}>
                                  Set {STATUS[status].label.toLowerCase()}
                                </MenuItem>
                              ))}
                            </>
                          )}
                        </Menu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && (
        <p role="status" className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default BillingPage
