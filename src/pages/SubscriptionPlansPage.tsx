import { useEffect, useState } from 'react'
import {
  Archive,
  CircleDollarSign,
  Copy,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Rocket,
  Search,
  Star,
  Trash2,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../components/orders/styles'
import SubscriptionPlanDialog from '../components/pricing/SubscriptionPlanDialog'
import Badge from '../components/ui/Badge'
import Menu, { MenuItem } from '../components/ui/Menu'
import SegmentedControl from '../components/ui/SegmentedControl'
import { BRANCHES, CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import { PRICING_PERMISSIONS } from '../constants/pricing'
import { BILLING_CYCLES, EMPTY_PLAN_FILTERS, PLAN_STATUSES } from '../constants/subscriptions'
import useLocalStorage from '../hooks/useLocalStorage'
import useServices from '../hooks/useServices'
import useSubscriptionPlans, { planStore } from '../hooks/useSubscriptionPlans'
import type { OrderRole } from '../types/order'
import type { BillingCycle, PlanFilters, PlanStatus, SubscriptionPlan } from '../types/subscription'
import { formatXaf } from '../utils/orders'
import { allowanceLabel, matchesPlanFilters, monthlyPrice, planMrr } from '../utils/subscriptions'

const TOAST_MS = 4000

// An empty id creates a new plan; templateId pre-fills it from another plan
type FormState = { planId: string; templateId?: string }

const CYCLE_OPTIONS = [
  { value: '', label: 'All' },
  ...(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((cycle) => ({ value: cycle, label: BILLING_CYCLES[cycle].label })),
] as const

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

type PlanCardProps = {
  plan: SubscriptionPlan
  serviceNames: string[]
  canManage: boolean
  showRevenue: boolean
  onEdit: () => void
  onDuplicate: () => void
  onStatus: (status: PlanStatus) => void
  onDelete: () => void
}

function PlanCard({ plan, serviceNames, canManage, showRevenue, onEdit, onDuplicate, onStatus, onDelete }: PlanCardProps) {
  const { label, tone } = PLAN_STATUSES[plan.status]
  const perks = [
    plan.freePickups > 0 && `${plan.freePickups} free ${plan.freePickups === 1 ? 'pickup' : 'pickups'} per ${BILLING_CYCLES[plan.cycle].per}`,
    plan.extrasDiscountPct > 0 && `${plan.extrasDiscountPct}% off other services`,
    plan.rollover && 'Unused allowance rolls over',
    plan.allowance !== null && plan.overageRate > 0 && `Extra at ${formatXaf(plan.overageRate)} each`,
    plan.trialDays > 0 && `${plan.trialDays}-day free trial`,
    plan.minCycles > 0 ? `${plan.minCycles}-${BILLING_CYCLES[plan.cycle].per} minimum` : 'Cancel anytime',
    plan.setupFee > 0 && `${formatXaf(plan.setupFee)} setup fee`,
  ].filter(Boolean) as string[]

  return (
    <article
      className={`flex min-w-0 flex-col gap-3 rounded-xl bg-white p-4 ring-1 ${
        plan.featured && plan.status === 'active' ? 'ring-2 ring-brand' : 'ring-line'
      } ${plan.status === 'archived' ? 'opacity-75' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={tone}>{label}</Badge>
            {plan.featured && (
              <Badge tone="brand">
                <Star className="size-3" aria-hidden="true" />
                Most popular
              </Badge>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-sm font-bold text-ink">{plan.name}</h3>
          <p className="text-[10px] text-muted">{plan.id}</p>
        </div>
        {canManage && (
          <Menu label={`Actions for ${plan.name}`} triggerClassName={iconButton} trigger={<MoreHorizontal className="size-4" aria-hidden="true" />}>
            {(close) => (
              <>
                <MenuItem onSelect={() => { close(); onEdit() }}>
                  <Pencil className="size-3.5" aria-hidden="true" /> Edit
                </MenuItem>
                <MenuItem onSelect={() => { close(); onDuplicate() }}>
                  <Copy className="size-3.5" aria-hidden="true" /> Duplicate
                </MenuItem>
                {plan.status === 'draft' && (
                  <MenuItem onSelect={() => { close(); onStatus('active') }}>
                    <Rocket className="size-3.5" aria-hidden="true" /> Publish
                  </MenuItem>
                )}
                {plan.status === 'active' && (
                  <MenuItem onSelect={() => { close(); onStatus('archived') }}>
                    <Archive className="size-3.5" aria-hidden="true" /> Archive
                  </MenuItem>
                )}
                {plan.status === 'archived' && (
                  <MenuItem onSelect={() => { close(); onStatus('active') }}>
                    <RotateCcw className="size-3.5" aria-hidden="true" /> Restore
                  </MenuItem>
                )}
                {plan.subscribers === 0 && (
                  <MenuItem destructive onSelect={() => { close(); onDelete() }}>
                    <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        )}
      </header>

      <div>
        <p className="text-xl font-bold text-ink tabular-nums">
          {formatXaf(plan.price)}
          <span className="text-xs font-semibold text-muted"> / {BILLING_CYCLES[plan.cycle].per}</span>
        </p>
        <p className="text-xs font-semibold text-brand">{allowanceLabel(plan)}</p>
        {plan.cycle !== 'monthly' && (
          <p className="text-[10px] text-muted">≈ {formatXaf(monthlyPrice(plan))} a month</p>
        )}
      </div>

      {plan.description && <p className="text-xs text-muted">{plan.description}</p>}

      <div className="flex flex-wrap gap-1">
        {serviceNames.map((name) => (
          <span key={name} className="rounded bg-field px-1.5 py-0.5 text-[10px] font-semibold text-ink">
            {name}
          </span>
        ))}
      </div>

      <ul className="space-y-1 text-[11px] text-ink">
        {perks.map((perk) => (
          <li key={perk} className="flex gap-1.5">
            <span className="text-success" aria-hidden="true">✓</span>
            {perk}
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          <span className="font-semibold text-ink tabular-nums">{plan.subscribers}</span> subscribers
          {showRevenue && plan.subscribers > 0 && <> · {formatXaf(planMrr(plan))}/mo</>}
        </span>
        <span>{plan.branches.length === 0 ? 'All branches' : plan.branches.join(', ')}</span>
      </footer>
    </article>
  )
}

function SubscriptionPlansPage() {
  const plans = useSubscriptionPlans()
  const services = useServices()
  const [filters, setFilters] = useState<PlanFilters>(EMPTY_PLAN_FILTERS)
  const [form, setForm] = useState<FormState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // Shared with the price list so both pages show the same perspective
  const [role, setRole] = useLocalStorage<OrderRole>('pricing.role', 'admin')

  const permissions = PRICING_PERMISSIONS[role]
  // People who can't manage pricing only see what customers can sign up for
  const visible = permissions.manage ? plans : plans.filter(({ status }) => status === 'active')
  const filtered = visible.filter((plan) => matchesPlanFilters(plan, filters))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const active = plans.filter(({ status }) => status === 'active')
  const subscribers = plans.reduce((sum, plan) => sum + plan.subscribers, 0)
  const mrr = plans.reduce((sum, plan) => sum + planMrr(plan), 0)
  const editing = form?.planId ? plans.find(({ id }) => id === form.planId) : undefined
  const template = form?.templateId ? plans.find(({ id }) => id === form.templateId) : undefined
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name ?? id
  const patchFilters = (patch: Partial<PlanFilters>) => setFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function handleSave(plan: SubscriptionPlan, publish: boolean) {
    const status = publish ? 'active' : plan.status
    planStore.save({ ...plan, status })
    setForm(null)
    setToast(
      editing
        ? publish ? `${plan.name} published` : `${plan.name} updated`
        : publish ? `${plan.name} published as ${plan.id}` : `${plan.name} saved as draft`,
    )
  }

  function setStatus(plan: SubscriptionPlan, status: PlanStatus) {
    const apply = () => {
      planStore.update(plan.id, (current) => ({ ...current, status, updatedAt: new Date().toISOString(), updatedBy: CURRENT_USER }))
      setToast(`${plan.name} ${status === 'archived' ? 'archived' : plan.status === 'draft' ? 'published' : 'restored'}`)
    }
    if (status !== 'archived') return apply()
    setConfirm({
      title: `Archive ${plan.name}?`,
      body:
        plan.subscribers > 0
          ? `New customers can no longer subscribe. The ${plan.subscribers} current subscribers keep the plan until they cancel or it ends.`
          : 'New customers can no longer subscribe. You can restore it later.',
      confirmLabel: 'Archive Plan',
      onConfirm: apply,
    })
  }

  function handleDelete(plan: SubscriptionPlan) {
    setConfirm({
      title: `Delete ${plan.name}?`,
      body: 'The plan is removed permanently. Nobody is subscribed to it.',
      confirmLabel: 'Delete Plan',
      destructive: true,
      onConfirm: () => {
        planStore.remove(plan.id)
        setToast(`${plan.name} deleted`)
      },
    })
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Subscription Plans</h1>
            <p className="text-xs text-muted">
              Recurring laundry packages customers pay for each week, month, quarter or year.
            </p>
          </div>
          {permissions.manage && (
            <button type="button" onClick={() => setForm({ planId: '' })} className={primaryButton}>
              <Plus className="size-4" aria-hidden="true" />
              New Plan
            </button>
          )}
        </div>
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select value={role} onChange={(event) => setRole(event.target.value as OrderRole)} className={`${fieldClass} h-8 w-auto!`}>
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Layers} label="Active plans" value={String(active.length)} note={`${plans.filter(({ status }) => status === 'draft').length} drafts`} />
        <Kpi icon={Users} label="Subscribers" value={subscribers.toLocaleString('en-US')} note="Across all plans" />
        {permissions.financials && (
          <Kpi icon={CircleDollarSign} label="Monthly recurring revenue" value={formatXaf(mrr)} note="Plan price × subscribers, per month" />
        )}
        <Kpi
          icon={Truck}
          label="Free pickups included"
          value={String(active.filter(({ freePickups }) => freePickups > 0).length)}
          note="Active plans with free pickup & delivery"
        />
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search plans"
            placeholder="Search by name, code or description…"
            value={filters.query}
            onChange={(event) => patchFilters({ query: event.target.value })}
            className={`${fieldClass} h-10 pl-9`}
          />
        </div>
        {permissions.manage && (
          <select
            aria-label="Status"
            value={filters.status}
            onChange={(event) => patchFilters({ status: event.target.value as PlanStatus | '' })}
            className={`${fieldClass} w-auto!`}
          >
            <option value="">All statuses</option>
            {(Object.keys(PLAN_STATUSES) as PlanStatus[]).map((status) => (
              <option key={status} value={status}>{PLAN_STATUSES[status].label}</option>
            ))}
          </select>
        )}
        <SegmentedControl
          label="Billing cycle"
          options={CYCLE_OPTIONS}
          value={filters.cycle}
          onChange={(cycle) => patchFilters({ cycle })}
        />
        {filtersActive && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_PLAN_FILTERS)}
            className="rounded-sm text-xs font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Reset Filters
          </button>
        )}
      </section>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No subscription plans yet</h2>
          <p className="text-xs text-muted">Bundle services into a recurring package customers can subscribe to.</p>
          {permissions.manage && (
            <button type="button" onClick={() => setForm({ planId: '' })} className={`${primaryButton} mt-2`}>
              <Plus className="size-4" aria-hidden="true" />
              New Plan
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No plans match these filters</h2>
          <button type="button" onClick={() => setFilters(EMPTY_PLAN_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              serviceNames={plan.serviceIds.map(serviceName)}
              canManage={permissions.manage}
              showRevenue={permissions.financials}
              onEdit={() => setForm({ planId: plan.id })}
              onDuplicate={() => setForm({ planId: '', templateId: plan.id })}
              onStatus={(status) => setStatus(plan, status)}
              onDelete={() => handleDelete(plan)}
            />
          ))}
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

      {form && (
        <SubscriptionPlanDialog
          key={form.planId || form.templateId || 'new'}
          plan={editing}
          template={template}
          nextId={planStore.nextId()}
          // Draft services can't be sold yet, unless the plan already includes one
          services={services.filter(({ id, status }) => status !== 'draft' || (editing ?? template)?.serviceIds.includes(id))}
          branches={BRANCHES}
          takenNames={plans.filter(({ id }) => id !== editing?.id).map(({ name }) => name)}
          onClose={() => setForm(null)}
          onSave={handleSave}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default SubscriptionPlansPage
