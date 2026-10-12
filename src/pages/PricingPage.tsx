import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Download,
  HeartPulse,
  History,
  LayoutGrid,
  Megaphone,
  Plus,
  SlidersHorizontal,
  Table2,
  Upload,
} from 'lucide-react'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import {
  CategoryTabs,
  PricingCards,
  PricingKpis,
  PricingTable,
  PricingToolbar,
} from '../components/pricing/PricingCatalog'
import type { PricingActions, PricingSort } from '../components/pricing/PricingCatalog'
import {
  BulkUpdateDialog,
  ImportPreviewDialog,
  PriceChangeDialog,
  TiersDialog,
} from '../components/pricing/PricingDialogs'
import {
  BranchMatrix,
  CampaignsPanel,
  ConfigPanels,
  HealthPanel,
  PriceCalculator,
  PriceHistoryPanel,
  PricingAnalytics,
  RulesPanel,
  ScheduledChangesPanel,
} from '../components/pricing/PricingPanels'
import ServiceWizard from '../components/services/ServiceWizard'
import { CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import {
  EMPTY_PRICING_FILTERS,
  PRICING_PERMISSIONS,
  SAMPLE_PRICE_CHANGES,
  SAMPLE_PRICING_CONFIG,
  SAMPLE_SCHEDULED_CHANGES,
} from '../constants/pricing'
import { SAMPLE_PROMOTIONS } from '../constants/samplePromotions'
import { DEFAULT_CATEGORIES } from '../constants/services'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import useServices, { serviceStore } from '../hooks/useServices'
import type { OrderRole } from '../types/order'
import type {
  BulkAdjustment,
  PriceChange,
  PricingConfig,
  PricingFilters,
} from '../types/pricing'
import type { LaundryService } from '../types/service'
import { downloadFile, formatXaf } from '../utils/orders'
import {
  getOverrides,
  getPricingHealth,
  getPricingRules,
  getSortValue,
  getTiers,
  getUnit,
  matchesPricingFilters,
  parsePriceImport,
  previewBulk,
  pricesToCsv,
} from '../utils/pricing'
import type { ImportRow, PricingSortKey } from '../utils/pricing'
import { getPromotionStatus, toDateKey } from '../utils/promotions'
import { withAudit } from '../utils/services'

const TOAST_MS = 4000

type PricingView = 'cards' | 'table'
type DialogState =
  | { name: 'price' | 'tiers'; serviceId: string }
  | { name: 'bulk' }
  | { name: 'import'; rows: ImportRow[] }
  // An empty id creates a new service
  | { name: 'wizard'; serviceId: string }

function PricingPage() {
  const now = useNow()
  const navigate = useNavigate()
  const allServices = useServices()
  // TODO: replace these in-memory lists with the pricing API
  const [config, setConfig] = useState<PricingConfig>(SAMPLE_PRICING_CONFIG)
  const [changes, setChanges] = useState(SAMPLE_PRICE_CHANGES)
  const [scheduled, setScheduled] = useState(SAMPLE_SCHEDULED_CHANGES)
  const [filters, setFilters] = useState<PricingFilters>(EMPTY_PRICING_FILTERS)
  const [sort, setSort] = useState<PricingSort>({ key: 'name', descending: false })
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('pricing.role', 'admin')
  const [view, setView] = useLocalStorage<PricingView>('pricing.view', 'cards')
  const [customCategories] = useLocalStorage<string[]>('services.categories', [])
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const healthRef = useRef<HTMLDivElement>(null)

  const permissions = PRICING_PERMISSIONS[role]
  // People who can't manage pricing only see what customers can order
  const services = permissions.manage ? allServices : allServices.filter(({ status }) => status === 'active')
  const filtered = services
    .filter((service) => matchesPricingFilters(service, filters))
    .sort((a, b) => {
      const [left, right] = [getSortValue(a, sort.key), getSortValue(b, sort.key)]
      return (left < right ? -1 : left > right ? 1 : 0) * (sort.descending ? -1 : 1)
    })
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const branches = allServices[0]?.branches.map(({ branch }) => branch) ?? []
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...customCategories, ...allServices.map(({ category }) => category)])]
  const rules = getPricingRules(services.filter(({ status }) => status === 'active'), config)
  const health = getPricingHealth(allServices, config, scheduled, SAMPLE_PROMOTIONS, now)
  const dialogService =
    dialog && 'serviceId' in dialog ? allServices.find(({ id }) => id === dialog.serviceId) : undefined
  const patchFilters = (patch: Partial<PricingFilters>) => setFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Records a price change in the history and on the service's own audit trail
  function logChanges(entries: Omit<PriceChange, 'id' | 'at' | 'by'>[]) {
    const at = new Date().toISOString()
    setChanges((current) => [
      ...entries.map((entry, index) => ({ ...entry, id: `PC-${current.length + entries.length - index + 103}`, at, by: CURRENT_USER })),
      ...current,
    ])
  }

  function applyGlobalPrice(service: LaundryService, price: number, reason: string) {
    const unit = getUnit(service)
    serviceStore.update([service.id], (current) =>
      withAudit({ ...current, basePrice: price }, CURRENT_USER, {
        change: `Changed price (${reason})`,
        from: `${formatXaf(current.basePrice)} / ${unit}`,
        to: `${formatXaf(price)} / ${unit}`,
      }),
    )
    return { serviceId: service.id, serviceName: service.name, scope: 'Global', from: service.basePrice, to: price, reason }
  }

  function handlePriceSubmit(price: number, effectiveAt: string, reason: string) {
    const service = dialogService!
    if (effectiveAt > toDateKey(now)) {
      setScheduled([...scheduled, { id: `SC-${scheduled.length + 23}`, serviceId: service.id, newPrice: price, effectiveAt, reason, by: CURRENT_USER }])
      setToast(`${service.name} price change scheduled for ${effectiveAt}`)
    } else {
      logChanges([applyGlobalPrice(service, price, reason)])
      setToast(`${service.name} is now ${formatXaf(price)} / ${getUnit(service)}`)
    }
    setDialog(null)
  }

  function handleApplyScheduled(id: string) {
    const change = scheduled.find((item) => item.id === id)!
    const service = allServices.find(({ id: serviceId }) => serviceId === change.serviceId)
    if (service) logChanges([applyGlobalPrice(service, change.newPrice, change.reason)])
    setScheduled(scheduled.filter((item) => item.id !== id))
    setToast(service ? `${service.name} is now ${formatXaf(change.newPrice)}` : 'Scheduled change removed')
  }

  function handleOverride(serviceId: string, branch: string, price: number | null) {
    const service = allServices.find(({ id }) => id === serviceId)!
    const before = service.branches.find((setting) => setting.branch === branch)?.priceOverride ?? service.basePrice
    const after = price ?? service.basePrice
    if (price === before && price !== null) return
    serviceStore.update([serviceId], (current) =>
      withAudit(
        { ...current, branches: current.branches.map((setting) => (setting.branch === branch ? { ...setting, priceOverride: price === current.basePrice ? null : price } : setting)) },
        CURRENT_USER,
        { change: price === null ? `Reset ${branch} to the global price` : `Set ${branch} price`, from: formatXaf(before), to: formatXaf(after) },
      ),
    )
    if (before !== after) {
      logChanges([{ serviceId, serviceName: service.name, scope: branch, from: before, to: after, reason: price === null ? 'Reset to global price' : 'Branch price override' }])
    }
    setToast(price === null || price === service.basePrice ? `${branch} now follows the global price for ${service.name}` : `${service.name} at ${branch} set to ${formatXaf(price)}`)
  }

  function handleBulk(adjustment: BulkAdjustment) {
    const { rows } = previewBulk(allServices, adjustment)
    const entries = rows.flatMap(({ service, from, to, overrides }) => {
      serviceStore.update([service.id], (current) =>
        withAudit(
          {
            ...current,
            basePrice: to,
            branches: current.branches.map((setting) => {
              const override = overrides.find(({ branch }) => branch === setting.branch)
              return override ? { ...setting, priceOverride: override.to } : setting
            }),
          },
          CURRENT_USER,
          { change: `Bulk price update (${adjustment.reason})`, from: formatXaf(from), to: formatXaf(to) },
        ),
      )
      return [
        { serviceId: service.id, serviceName: service.name, scope: 'Global', from, to, reason: adjustment.reason },
        ...overrides.map((override) => ({ serviceId: service.id, serviceName: service.name, scope: override.branch, from: override.from, to: override.to, reason: adjustment.reason })),
      ]
    })
    logChanges(entries)
    setDialog(null)
    setToast(`${rows.length} ${rows.length === 1 ? 'price' : 'prices'} updated`)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const rows = parsePriceImport(await file.text(), allServices)
    if (!rows) {
      setToast('Import failed: the file needs “code” and “price” columns')
      return
    }
    setDialog({ name: 'import', rows })
  }

  function handleImport(rows: ImportRow[]) {
    logChanges(
      rows.flatMap((row) => {
        const service = allServices.find(({ id }) => id === row.code)
        return service && row.to !== null ? [applyGlobalPrice(service, row.to, 'Price import')] : []
      }),
    )
    setDialog(null)
    setToast(`Imported ${rows.length} ${rows.length === 1 ? 'price' : 'prices'}`)
  }

  function handleSaveService(service: LaundryService, publish: boolean) {
    const existing = allServices.find(({ id }) => id === service.id)
    const status = !publish ? 'draft' : existing && existing.status !== 'draft' ? existing.status : 'active'
    serviceStore.save(
      withAudit({ ...service, status }, CURRENT_USER, {
        change: !existing ? (publish ? 'Created and published service' : 'Created draft service') : 'Updated configuration',
      }),
    )
    if (existing && existing.basePrice !== service.basePrice) {
      logChanges([{ serviceId: service.id, serviceName: service.name, scope: 'Global', from: existing.basePrice, to: service.basePrice, reason: 'Edited in the service editor' }])
    }
    setDialog(null)
    setToast(publish ? `${service.name} saved and published` : `${service.name} saved as draft`)
  }

  function handleSort(key: PricingSortKey) {
    setSort({ key, descending: sort.key === key ? !sort.descending : key === 'price' || key === 'changed' })
  }

  const live = services.filter(({ status }) => status === 'active')
  const orders = live.reduce((sum, { stats }) => sum + stats.orders, 0)
  const revenue = live.reduce((sum, { stats }) => sum + stats.revenue, 0)
  const customBranches = [...new Set(live.flatMap((service) => getOverrides(service).map(({ branch }) => branch)))]
  const activePromotions = SAMPLE_PROMOTIONS.filter((promotion) => getPromotionStatus(promotion, now) === 'active')
  const month = toDateKey(now).slice(0, 7)
  const changedThisMonth = changes.filter(({ at }) => toDateKey(new Date(at).getTime()).slice(0, 7) === month).length

  const actions: PricingActions = {
    permissions,
    config,
    onEdit: (serviceId) => setDialog({ name: 'wizard', serviceId }),
    onChangePrice: (serviceId) => setDialog({ name: 'price', serviceId }),
    onTiers: (serviceId) => setDialog({ name: 'tiers', serviceId }),
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Pricing &amp; Services</h1>
            <p className="text-xs text-muted">
              Manage laundry services, pricing rules, discounts, and branch-specific rates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => downloadFile('prices.csv', pricesToCsv(filtered, config), 'text/csv;charset=utf-8')} className={secondaryButton}>
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {permissions.financials && (
              <button type="button" onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
                <History className="size-4 text-muted" aria-hidden="true" />
                Price History
              </button>
            )}
            {permissions.manage && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} className={secondaryButton}>
                  <Upload className="size-4 text-muted" aria-hidden="true" />
                  Import Prices
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
                <button type="button" onClick={() => setDialog({ name: 'bulk' })} className={secondaryButton}>
                  <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
                  Bulk Update
                </button>
                <Link to="/promotions" className={secondaryButton}>
                  <Megaphone className="size-4 text-muted" aria-hidden="true" />
                  Create Promotion
                </Link>
                <button type="button" onClick={() => setDialog({ name: 'wizard', serviceId: '' })} className={`${primaryButton} max-md:hidden`}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Service
                </button>
              </>
            )}
          </div>
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

      <PricingKpis
        cards={[
          { label: 'Active Services', icon: 'services', value: String(live.length), note: `${new Set(live.map(({ category }) => category)).size} categories` },
          { label: 'Pricing Rules', icon: 'rules', value: String(rules.length), note: 'Tiers, surcharges, discounts' },
          { label: 'Branches With Custom Pricing', icon: 'branches', value: String(customBranches.length), note: customBranches.join(', ') || 'All follow global prices' },
          { label: 'Active Promotions', icon: 'promotions', value: String(activePromotions.length), note: 'From the Promotions module' },
          ...(permissions.financials
            ? [{ label: 'Average Order Value', icon: 'average' as const, value: formatXaf(orders ? Math.round(revenue / orders) : 0), note: `${orders.toLocaleString('en-US')} orders this month` }]
            : []),
          { label: 'Price Changes (Month)', icon: 'changes', value: String(changedThisMonth), note: `${scheduled.length} scheduled` },
        ]}
      />

      {permissions.manage && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl bg-brand/5 px-4 py-3 ring-1 ring-brand/20">
          <HeartPulse className={`size-5 shrink-0 ${health.problems === 0 ? 'text-success' : 'text-danger'}`} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs text-ink">
            <span className="font-bold">Pricing health: {health.score}%.</span>{' '}
            {health.problems === 0 ? 'No issues need attention' : `${health.problems} ${health.problems === 1 ? 'issue needs' : 'issues need'} attention`}
            {health.issues.length > health.problems && `, ${health.issues.length - health.problems} upcoming ${health.issues.length - health.problems === 1 ? 'notice' : 'notices'}`}.
          </p>
          <button type="button" onClick={() => healthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
            Review Issues
          </button>
        </section>
      )}

      <CategoryTabs services={services} selected={filters.category} onSelect={(category) => patchFilters({ category })} />

      <section className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Service Catalog{' '}
            <span className="font-normal text-muted">
              ({filtered.length} of {services.length})
            </span>
          </h2>
          <div role="group" aria-label="Catalog view" className="inline-flex gap-0.5 rounded-md bg-field p-0.5">
            {(
              [
                ['cards', 'Cards', LayoutGrid],
                ['table', 'Table', Table2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  view === value ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <PricingToolbar
          searchRef={searchRef}
          filters={filters}
          branches={branches}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => setFilters(EMPTY_PRICING_FILTERS)}
        />
      </section>

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No services configured</h2>
          <p className="text-xs text-muted">Create your first laundry service and define its pricing.</p>
          {permissions.manage && (
            <button type="button" onClick={() => setDialog({ name: 'wizard', serviceId: '' })} className={`${primaryButton} mt-2`}>
              <Plus className="size-4" aria-hidden="true" />
              Add Service
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No services match these filters</h2>
          <button type="button" onClick={() => setFilters(EMPTY_PRICING_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : view === 'cards' ? (
        <PricingCards services={filtered} {...actions} />
      ) : (
        <PricingTable services={filtered} sort={sort} onSort={handleSort} {...actions} />
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <BranchMatrix services={filtered} canManage={permissions.manage} onOverride={handleOverride} />
        </div>
        <PriceCalculator services={services} config={config} />
      </div>

      {permissions.manage && <RulesPanel rules={rules} />}

      <ConfigPanels config={config} canManage={permissions.manage} onChange={(patch) => setConfig({ ...config, ...patch })} />

      {permissions.financials && (
        <>
          <div ref={historyRef} className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
            <ScheduledChangesPanel
              scheduled={scheduled}
              services={allServices}
              now={now}
              canManage={permissions.manage}
              onApply={handleApplyScheduled}
              onCancel={(id) => {
                setScheduled(scheduled.filter((change) => change.id !== id))
                setToast('Scheduled price change cancelled')
              }}
            />
            <PriceHistoryPanel changes={changes} />
          </div>

          <PricingAnalytics services={services} changes={changes} />

          <div ref={healthRef} className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
            <HealthPanel health={health} onReview={(serviceId) => navigate(`/services/${serviceId}`)} />
            <CampaignsPanel promotions={SAMPLE_PROMOTIONS} now={now} />
          </div>
        </>
      )}

      {permissions.manage && (
        <button
          type="button"
          onClick={() => setDialog({ name: 'wizard', serviceId: '' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Service
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      {dialog?.name === 'price' && dialogService && (
        <PriceChangeDialog service={dialogService} scheduled={scheduled} now={now} onClose={() => setDialog(null)} onSubmit={handlePriceSubmit} />
      )}
      {dialog?.name === 'tiers' && dialogService && (
        <TiersDialog
          service={dialogService}
          tiers={getTiers(config, dialogService.id)}
          onClose={() => setDialog(null)}
          onSave={(tiers) => {
            setConfig({ ...config, tiers: { ...config.tiers, [dialogService.id]: tiers } })
            setDialog(null)
            setToast(`${dialogService.name} tiers saved`)
          }}
        />
      )}
      {dialog?.name === 'bulk' && (
        <BulkUpdateDialog
          services={allServices}
          categories={[...new Set(allServices.map(({ category }) => category))]}
          onClose={() => setDialog(null)}
          onApply={handleBulk}
        />
      )}
      {dialog?.name === 'import' && (
        <ImportPreviewDialog rows={dialog.rows} onClose={() => setDialog(null)} onApply={handleImport} />
      )}
      {dialog?.name === 'wizard' && (
        <ServiceWizard
          service={dialogService}
          initialStep={dialogService ? 1 : 0}
          categories={categories}
          existing={allServices}
          onClose={() => setDialog(null)}
          onSave={handleSaveService}
        />
      )}
    </>
  )
}

export default PricingPage
