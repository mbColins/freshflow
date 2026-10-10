import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  CirclePause,
  CirclePlay,
  Pencil,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import { ServiceIcon, ServiceStatusBadge } from '../components/services/ServiceBits'
import {
  AddOnsTab,
  BranchesTab,
  HistoryTab,
  InventoryTab,
  MachinesTab,
  OverviewTab,
  PerformanceTab,
  PricingTab,
  PromotionDialog,
  WorkflowTab,
} from '../components/services/ServiceDetailTabs'
import type { ServiceTabProps } from '../components/services/ServiceDetailTabs'
import ServiceWizard from '../components/services/ServiceWizard'
import { CURRENT_USER, PERMISSIONS } from '../constants/orders'
import { DEFAULT_CATEGORIES, SERVICE_PERMISSIONS } from '../constants/services'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import useServices, { serviceStore } from '../hooks/useServices'
import type { OrderRole } from '../types/order'
import type { LaundryService } from '../types/service'
import { formatCompactXaf, formatPrice, withAudit } from '../utils/services'

const TABS = [
  { id: 'overview', label: 'Overview', panel: OverviewTab, needs: null },
  { id: 'pricing', label: 'Pricing', panel: PricingTab, needs: 'pricing' },
  { id: 'workflow', label: 'Workflow', panel: WorkflowTab, needs: null },
  { id: 'addons', label: 'Add-ons', panel: AddOnsTab, needs: null },
  { id: 'machines', label: 'Machines', panel: MachinesTab, needs: null },
  { id: 'inventory', label: 'Inventory', panel: InventoryTab, needs: null },
  { id: 'branches', label: 'Branches', panel: BranchesTab, needs: null },
  { id: 'performance', label: 'Performance', panel: PerformanceTab, needs: 'financials' },
  { id: 'history', label: 'History', panel: HistoryTab, needs: 'edit' },
] as const

const TOAST_MS = 4000

function ServiceDetailPage() {
  const { serviceId } = useParams()
  const now = useNow()
  const services = useServices()
  const service = services.find(({ id }) => id === serviceId)
  const [role] = useLocalStorage<OrderRole>('services.role', 'manager')
  const [customCategories] = useLocalStorage<string[]>('services.categories', [])
  const [tab, setTab] = useState<string>('overview')
  const [wizardStep, setWizardStep] = useState<number | null>(null)
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const permissions = SERVICE_PERMISSIONS[role]

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!service || (service.status === 'draft' && !permissions.edit)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
        <h1 className="text-sm font-bold text-ink">Service not found</h1>
        <p className="text-xs text-muted">
          This service doesn’t exist or isn’t available to your role.
        </p>
        <Link to="/services" className={`${primaryButton} mt-2`}>
          Back to Services
        </Link>
      </div>
    )
  }

  const tabs = TABS.filter(({ needs }) => needs === null || permissions[needs])
  const activeTab = tabs.find(({ id }) => id === tab) ?? tabs[0]
  const ActivePanel = activeTab.panel
  const active = service.status === 'active'
  const categories = [
    ...new Set([...DEFAULT_CATEGORIES, ...customCategories, service.category]),
  ]

  function setActive(next: boolean) {
    serviceStore.update([service!.id], (current) =>
      withAudit(
        { ...current, status: next ? 'active' : 'inactive', statusReason: '' },
        CURRENT_USER,
        { change: next ? 'Activated service' : 'Deactivated service' },
      ),
    )
    setToast(next ? 'Service activated' : 'Service deactivated')
  }

  const tabProps: ServiceTabProps = {
    service,
    now,
    permissions,
    onEditStep: setWizardStep,
    onChange: (change, audit) =>
      serviceStore.update([service.id], (current) =>
        withAudit(change(current), CURRENT_USER, { change: audit }),
      ),
    onCreatePromotion: () => setPromotionOpen(true),
  }

  const summary: [string, string][] = [
    ...(permissions.pricing ? ([['Price', formatPrice(service)]] as [string, string][]) : []),
    ['Processing', `${service.standardHours} hours`],
    ['Express', service.express.enabled ? `${service.express.hours} hours` : 'Not offered'],
    [
      'Branches',
      `${service.branches.filter(({ available }) => available).length} / ${service.branches.length}`,
    ],
    ...(permissions.financials
      ? ([
          ['Orders', String(service.stats.orders)],
          ['Revenue', formatCompactXaf(service.stats.revenue)],
        ] as [string, string][])
      : []),
  ]

  return (
    <>
      <Link
        to="/services"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Services
      </Link>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-start gap-4">
          <ServiceIcon icon={service.icon} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{service.name}</h1>
              <ServiceStatusBadge status={service.status} />
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {service.id} · {service.category}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active && PERMISSIONS[role].create && (
              <Link to="/orders?new=1" className={primaryButton}>
                <ShoppingCart className="size-4" aria-hidden="true" />
                New Order
              </Link>
            )}
            {permissions.edit && (
              <>
                <button
                  type="button"
                  onClick={() => setWizardStep(0)}
                  className={secondaryButton}
                >
                  <Pencil className="size-4 text-muted" aria-hidden="true" />
                  Edit
                </button>
                {service.status !== 'draft' && (
                  <button
                    type="button"
                    onClick={() =>
                      active
                        ? setConfirm({
                            title: `Deactivate ${service.name}?`,
                            body: 'Deactivated services can no longer be selected for new orders. Orders already in progress and past orders are not affected.',
                            confirmLabel: 'Deactivate',
                            destructive: true,
                            onConfirm: () => setActive(false),
                          })
                        : setActive(true)
                    }
                    className={secondaryButton}
                  >
                    {active ? (
                      <CirclePause className="size-4 text-danger" aria-hidden="true" />
                    ) : (
                      <CirclePlay className="size-4 text-success" aria-hidden="true" />
                    )}
                    {active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {service.statusReason && !active && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger/5 p-3 text-xs font-semibold text-danger ring-1 ring-danger/20">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            {service.statusReason}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-field px-3 py-2">
              <dt className="text-[10px] font-semibold text-muted">{label}</dt>
              <dd className="truncate text-sm font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div
        role="tablist"
        aria-label="Service sections"
        className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`service-tab-${id}`}
            aria-selected={id === activeTab.id}
            aria-controls="service-tabpanel"
            onClick={() => setTab(id)}
            className={`h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              id === activeTab.id
                ? 'bg-brand text-white'
                : 'text-muted hover:bg-field hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="service-tabpanel"
        role="tabpanel"
        aria-labelledby={`service-tab-${activeTab.id}`}
      >
        <ActivePanel {...tabProps} />
      </div>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {wizardStep !== null && (
        <ServiceWizard
          service={service}
          initialStep={wizardStep}
          categories={categories}
          existing={services}
          onClose={() => setWizardStep(null)}
          onSave={(saved: LaundryService, publish) => {
            serviceStore.save(
              withAudit(
                {
                  ...saved,
                  status: !publish
                    ? 'draft'
                    : service.status === 'draft'
                      ? 'active'
                      : service.status,
                },
                CURRENT_USER,
                {
                  change:
                    service.status === 'draft' && publish
                      ? 'Published service'
                      : 'Updated configuration',
                  ...(saved.basePrice !== service.basePrice
                    ? { from: formatPrice(service), to: formatPrice(saved) }
                    : {}),
                },
              ),
            )
            setWizardStep(null)
            setToast('Service updated')
          }}
        />
      )}
      {promotionOpen && (
        <PromotionDialog
          serviceName={service.name}
          onClose={() => setPromotionOpen(false)}
          onSave={(promotion) => {
            serviceStore.update([service.id], (current) =>
              withAudit(
                { ...current, promotions: [...current.promotions, promotion] },
                CURRENT_USER,
                { change: `Created promotion “${promotion.name}”` },
              ),
            )
            setPromotionOpen(false)
            setToast('Promotion created')
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default ServiceDetailPage
