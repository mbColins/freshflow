import { useEffect, useState } from 'react'
import { Building2, Check, CircleDollarSign, Ellipsis, Hourglass, Layers, Plus, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import PlatformPlanDialog from '../components/tenants/PlatformPlanDialog'
import Badge from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import { PLATFORM_MODULES } from '../constants/platformPlans'
import { usePlatformPlansQuery } from '../hooks/usePlatformPlans'
import useTenants from '../hooks/useTenants'
import {
  useCreatePlatformPlanMutation,
  useDeletePlatformPlanMutation,
  useUpdatePlatformPlanMutation,
} from '../services/platformPlanApi'
import type { PlatformPlan } from '../types/platformPlan'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { formatXaf } from '../utils/orders'
import { annualSavingPct, limitLabel } from '../utils/platformPlans'
import { getMrr } from '../utils/tenants'

const TOAST_MS = 4000
const NO_PLANS: PlatformPlan[] = []

// An empty code creates a new plan
type FormState = { code: string }

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected)

function Kpi({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{note}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold text-muted">{label}</dt>
      <dd className="text-sm font-bold text-ink tabular-nums">{value}</dd>
    </div>
  )
}

// Platform admin: the plans tenants subscribe to
// TODO: show only to platform admins once the API exposes the user's role
function PlatformPlansPage() {
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = usePlatformPlansQuery()
  const plans = data?.items ?? NO_PLANS
  const tenants = useTenants()
  const [form, setForm] = useState<FormState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createPlan, { error: createError, reset: resetCreate }] = useCreatePlatformPlanMutation()
  const [updatePlan, { error: updateError, reset: resetUpdate }] = useUpdatePlatformPlanMutation()
  const [deletePlan] = useDeletePlatformPlanMutation()

  // Cancelled tenants no longer hold a plan
  const live = tenants.filter(({ status }) => status !== 'cancelled')
  const subscribersOf = (code: string) => live.filter((tenant) => tenant.plan === code)
  const editing = form?.code ? plans.find(({ code }) => code === form.code) : undefined
  const saveError = form
    ? editing
      ? updateError && failure(updateError, 'The server rejected these changes. Check the fields and try again.')
      : createError && failure(createError, 'The server rejected this plan. Check the fields and try again.')
    : null

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function closeForm() {
    resetCreate()
    resetUpdate()
    setForm(null)
  }

  async function handleSave(plan: PlatformPlan) {
    try {
      if (editing) {
        await updatePlan(plan).unwrap()
        setToast(`${plan.name} updated`)
      } else {
        // The list refetches on its own once the mutation succeeds
        await createPlan(plan).unwrap()
        setToast(`${plan.name} created`)
      }
      closeForm()
    } catch {
      // The mutation's error drives the message in the dialog
    }
  }

  async function setActive(plan: PlatformPlan, active: boolean) {
    try {
      await updatePlan({ code: plan.code, active }).unwrap()
      setToast(`${plan.name} ${active ? 'activated' : 'deactivated'}`)
    } catch (error) {
      setToast(failure(error, `Couldn’t ${active ? 'activate' : 'deactivate'} ${plan.name}.`))
    } finally {
      resetUpdate()
    }
  }

  function handleDelete(plan: PlatformPlan) {
    const subscribers = subscribersOf(plan.code).length
    if (subscribers > 0) {
      // The backend should refuse this too; tenants would be left without a plan
      setConfirm({
        title: `${plan.name} still has tenants`,
        body: `${subscribers} ${subscribers === 1 ? 'tenant is' : 'tenants are'} on this plan. Move them to another plan before deleting it${
          plan.active ? ', or deactivate it so no new tenants can choose it' : ''
        }.`,
        confirmLabel: plan.active ? 'Deactivate Instead' : 'OK',
        onConfirm: () => {
          if (plan.active) void setActive(plan, false)
        },
      })
      return
    }
    setConfirm({
      title: `Delete ${plan.name}?`,
      body: `The ${plan.code} plan is removed for good. No active or trial tenants are on it.`,
      confirmLabel: 'Delete Plan',
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePlan(plan.code).unwrap()
          setToast(`${plan.name} deleted`)
        } catch (error) {
          setToast(failure(error, `Couldn’t delete ${plan.name}.`))
        }
      },
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Subscription Plans</h1>
          <p className="text-xs text-muted">The plans businesses subscribe to on the platform, what they include and what they bring in.</p>
        </div>
        <button type="button" onClick={() => setForm({ code: '' })} className={primaryButton}>
          <Plus className="size-4" aria-hidden="true" />
          New Plan
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Layers} label="Plans" value={String(plans.length)} note={`${plans.filter(({ active }) => !active).length} inactive`} />
        <Kpi icon={Building2} label="Subscribed tenants" value={String(live.length)} note={`${tenants.length - live.length} cancelled`} />
        <Kpi icon={Hourglass} label="On trial" value={String(live.filter(({ status }) => status === 'trial').length)} note="Not billed yet" />
        <Kpi icon={CircleDollarSign} label="Monthly recurring revenue" value={formatXaf(getMrr(tenants, plans))} note="Active tenants only" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <p className="sr-only" role="status">Loading plans…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-72 animate-pulse rounded-xl bg-white ring-1 ring-line" />
          ))}
        </div>
      ) : isError && plans.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the plans</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ??
              (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No plans yet</h2>
          <p className="text-xs text-muted">Create a plan before adding tenants.</p>
          <button type="button" onClick={() => setForm({ code: '' })} className={`${secondaryButton} mt-2`}>
            New Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const subscribers = subscribersOf(plan.code)
            const active = subscribers.filter(({ status }) => status === 'active').length
            const trial = subscribers.filter(({ status }) => status === 'trial').length
            const saving = annualSavingPct(plan)
            return (
              <article
                key={plan.code}
                className={`flex flex-col gap-4 rounded-xl bg-white p-4 ring-1 ring-line ${plan.active ? '' : 'opacity-75'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                      {plan.name}
                      {!plan.active && <Badge>Inactive</Badge>}
                    </h2>
                    <p className="font-mono text-[10px] text-muted">{plan.code}</p>
                  </div>
                  <Menu
                    label={`Actions for ${plan.name}`}
                    trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                    triggerClassName={iconButton}
                  >
                    {(close) => (
                      <>
                        <MenuItem onSelect={() => { close(); setForm({ code: plan.code }) }}>Edit plan</MenuItem>
                        <MenuItem onSelect={() => { close(); void setActive(plan, !plan.active) }}>
                          {plan.active ? 'Deactivate' : 'Activate'}
                        </MenuItem>
                        <MenuItem destructive onSelect={() => { close(); handleDelete(plan) }}>
                          Delete plan
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>

                <div>
                  <p className="text-2xl font-bold text-ink tabular-nums">
                    {formatXaf(plan.monthlyPrice)}
                    <span className="text-xs font-semibold text-muted"> /month</span>
                  </p>
                  <p className="text-[11px] text-muted">
                    {plan.annualPrice === null
                      ? 'Monthly billing only'
                      : `or ${formatXaf(plan.annualPrice)} /year${saving ? ` (save ${saving}%)` : ''}`}
                    {' · '}
                    {plan.trialPeriodDays > 0 ? `${plan.trialPeriodDays}-day trial` : 'No trial'}
                  </p>
                </div>

                <ul className="space-y-1 text-xs text-ink">
                  {[limitLabel(plan.maxShops, 'shops'), limitLabel(plan.maxStaff, 'staff'), limitLabel(plan.maxOrdersPerMonth, 'orders / month')].map(
                    (line) => (
                      <li key={line} className="font-semibold">{line}</li>
                    ),
                  )}
                </ul>

                <ul className="flex flex-wrap gap-1.5" aria-label="Modules">
                  {plan.enabledFeatures.map((module) => (
                    <li key={module} className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      <Check className="size-3" aria-hidden="true" />
                      {PLATFORM_MODULES[module] ?? module}
                    </li>
                  ))}
                </ul>

                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <Stat label="Active" value={String(active)} />
                  <Stat label="Trial" value={String(trial)} />
                  <Stat label="MRR" value={formatXaf(active * plan.monthlyPrice)} />
                </dl>
              </article>
            )
          })}
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {form && (!form.code || editing) && (
        <PlatformPlanDialog
          key={editing?.code ?? 'new'}
          initial={editing}
          takenCodes={plans.filter(({ code }) => code !== editing?.code).map(({ code }) => code)}
          subscribers={editing ? subscribersOf(editing.code) : []}
          error={saveError}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default PlatformPlansPage
