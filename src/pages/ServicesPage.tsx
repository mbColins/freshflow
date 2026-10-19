import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileDown,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { OrdersSkeleton } from '../components/orders/OrdersStates'
import {
  fieldClass,
  primaryButton,
  secondaryButton,
} from '../components/orders/styles'
import ServiceWizard from '../components/services/ServiceWizard'
import {
  CategoryNav,
  ServiceAlerts,
  ServiceKpiCards,
  ServiceRankingAndPackages,
  ServicesToolbar,
} from '../components/services/ServicesListParts'
import type { ServicesView } from '../components/services/ServicesListParts'
import ServicesTable, {
  ServiceBulkBar,
  ServiceCards,
} from '../components/services/ServicesTable'
import type { ServiceSort } from '../components/services/ServicesTable'
import Menu, { MenuItem } from '../components/ui/Menu'
import SegmentedControl from '../components/ui/SegmentedControl'
import {
  BRANCHES,
  CURRENT_USER,
  ORDER_ROLES,
  PREVIEW_STATES,
} from '../constants/orders'
import type { PreviewState } from '../constants/orders'
import {
  DEFAULT_CATEGORIES,
  EMPTY_SERVICE_FILTERS,
  SERVICE_PERMISSIONS,
} from '../constants/services'
import useLocalStorage from '../hooks/useLocalStorage'
import { serviceStore, useServicesQuery } from '../hooks/useServices'
import { serviceErrorMessage } from '../services/serviceApi'
import type { OrderRole } from '../types/order'
import type { LaundryService, ServiceFilters } from '../types/service'
import { downloadFile } from '../utils/orders'
import {
  compareServices,
  countServiceFilters,
  matchesServiceFilters,
  servicesToCsv,
  withAudit,
} from '../utils/services'
import type { ServiceSortKey } from '../utils/services'

const PAGE_SIZES = [10, 25, 50]
const TOAST_MS = 4000
const NO_SERVICES: LaundryService[] = []

function ServicesPage() {
  const servicesQuery = useServicesQuery()
  const allServices = servicesQuery.data?.items ?? NO_SERVICES
  const [role, setRole] = useLocalStorage<OrderRole>('services.role', 'manager')
  const [preview, setPreview] = useState<PreviewState>('normal')
  const [filters, setFilters] = useState<ServiceFilters>(EMPTY_SERVICE_FILTERS)
  const [sort, setSort] = useState<ServiceSort>({ key: 'orders', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // null = closed, '' = new service, otherwise the code being edited
  const [wizardId, setWizardId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useLocalStorage<ServicesView>('services.view', 'table')
  const [customCategories, setCustomCategories] = useLocalStorage<string[]>(
    'services.categories',
    [],
  )

  const permissions = SERVICE_PERMISSIONS[role]
  // Roles that cannot edit only see what can actually be ordered or processed
  const services =
    preview === 'empty'
      ? []
      : permissions.edit
        ? allServices
        : allServices.filter(({ status }) => status !== 'draft')
  const categories = [
    ...new Set([
      ...DEFAULT_CATEGORIES,
      ...customCategories,
      ...allServices.map(({ category }) => category),
    ]),
  ]
  const filtered = services
    .filter((service) => matchesServiceFilters(service, filters))
    .sort(
      (a, b) =>
        compareServices(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1),
    )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selected = services.filter(({ id }) => selectedIds.includes(id))
  const editing = allServices.find(({ id }) => id === wizardId)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function replaceFilters(next: ServiceFilters) {
    setFilters(next)
    setPage(1)
    setSelectedIds([])
  }
  const patchFilters = (patch: Partial<ServiceFilters>) =>
    replaceFilters({ ...filters, ...patch })

  function handleSort(key: ServiceSortKey) {
    setSort({
      key,
      direction: sort.key === key && sort.direction === 'desc' ? 'asc' : 'desc',
    })
  }

  // A save the server refused is undone; say why
  const reportFailure = (error: string | null) => {
    if (error) setToast(error)
  }

  function setActive(ids: string[], active: boolean) {
    void serviceStore
      .update(ids, (service) =>
        withAudit(
          {
            ...service,
            status: active ? 'active' : 'inactive',
            // The API requires a reason for INACTIVE
            statusReason: active ? '' : `Deactivated by ${CURRENT_USER} from the services list`,
          },
          CURRENT_USER,
          { change: active ? 'Activated service' : 'Deactivated service' },
        ),
      )
      .then(reportFailure)
    setSelectedIds([])
    setToast(
      `${ids.length} ${ids.length === 1 ? 'service' : 'services'} ${active ? 'activated' : 'deactivated'}`,
    )
  }

  function requestDeactivate(ids: string[]) {
    setConfirm({
      title:
        ids.length === 1 ? 'Deactivate this service?' : `Deactivate ${ids.length} services?`,
      body: 'Deactivated services can no longer be selected for new orders. Orders already in progress and past orders are not affected.',
      confirmLabel: 'Deactivate',
      destructive: true,
      onConfirm: () => setActive(ids, false),
    })
  }

  function handleToggleActive(id: string) {
    const service = allServices.find((candidate) => candidate.id === id)
    if (service?.status === 'active') requestDeactivate([id])
    else setActive([id], true)
  }

  async function handleSave(service: LaundryService, publish: boolean) {
    const existing = allServices.find(({ id }) => id === service.id)
    const status = !publish
      ? 'draft'
      : existing && existing.status !== 'draft'
        ? existing.status
        : 'active'
    setSaveError(null)
    const error = await serviceStore.save(
      withAudit({ ...service, status }, CURRENT_USER, {
        change: !existing
          ? publish
            ? 'Created and published service'
            : 'Created draft service'
          : existing.status === 'draft' && publish
            ? 'Published service'
            : 'Updated configuration',
      }),
    )
    if (error) {
      setSaveError(error)
      return
    }
    setWizardId(null)
    setToast(
      publish ? `${service.name} saved and published` : `${service.name} saved as draft`,
    )
  }

  function handleExport(list: LaundryService[]) {
    downloadFile(
      'services.csv',
      servicesToCsv(list, permissions.financials),
      'text/csv;charset=utf-8',
    )
    setToast(`Exported ${list.length} ${list.length === 1 ? 'service' : 'services'}`)
  }

  const listProps = {
    permissions,
    branchTotal: BRANCHES.length,
    onEdit: setWizardId,
    onToggleActive: handleToggleActive,
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Services</h1>
            <p className="text-xs text-muted">
              Manage laundry services, pricing, availability and processing rules
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {permissions.edit && (
              // TODO: needs an agreed file format and an import endpoint
              <button type="button" disabled className={secondaryButton}>
                <Upload className="size-4 text-muted" aria-hidden="true" />
                Import Services
              </button>
            )}
            <Menu
              trigger={
                <>
                  <Download className="size-4 text-muted" aria-hidden="true" />
                  Export
                </>
              }
              triggerClassName={secondaryButton}
            >
              {(close) => (
                <>
                  <MenuItem
                    onSelect={() => {
                      close()
                      handleExport(filtered)
                    }}
                  >
                    <FileDown className="size-4 text-muted" aria-hidden="true" />
                    CSV / Excel (current filters)
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      close()
                      window.print()
                    }}
                  >
                    <Printer className="size-4 text-muted" aria-hidden="true" />
                    Print / Save as PDF
                  </MenuItem>
                </>
              )}
            </Menu>
            {permissions.edit && (
              <button
                type="button"
                onClick={() => setWizardId('')}
                className={`${primaryButton} max-md:hidden`}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Service
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <label className="flex items-center gap-2 whitespace-nowrap">
            Viewing as
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as OrderRole)
                setSelectedIds([])
              }}
              className={`${fieldClass} h-8 w-auto!`}
            >
              {ORDER_ROLES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <SegmentedControl
            label="Page state preview"
            options={PREVIEW_STATES}
            value={preview}
            onChange={setPreview}
          />
        </div>
      </div>

      {preview === 'loading' && <OrdersSkeleton />}
      {preview === 'error' && (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line"
        >
          <CircleAlert className="size-8 text-danger" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">Unable to load services.</h2>
          <p className="text-xs text-muted">
            Something went wrong while retrieving service information.
          </p>
          <button
            type="button"
            onClick={() => setPreview('normal')}
            className={`${primaryButton} mt-2`}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {(preview === 'normal' || preview === 'empty') && (
        <>
          <ServiceAlerts services={services} />
          <ServiceKpiCards
            services={services}
            status={filters.status}
            filtersActive={countServiceFilters(filters) > 0}
            onSelectStatus={(status) =>
              replaceFilters({ ...EMPTY_SERVICE_FILTERS, status })
            }
            permissions={permissions}
          />
          <CategoryNav
            services={services}
            categories={categories}
            selected={filters.category}
            onSelect={(category) => patchFilters({ category })}
            canEdit={permissions.edit}
            showFinancials={permissions.financials}
            onAddCategory={(name) =>
              setCustomCategories([...new Set([...customCategories, name])])
            }
          />
          <ServicesToolbar
            searchRef={searchRef}
            filters={filters}
            onChange={patchFilters}
            onReset={() => replaceFilters(EMPTY_SERVICE_FILTERS)}
            view={view}
            onViewChange={setView}
            resultCount={filtered.length}
          />

          {selected.length > 0 && view === 'table' && (
            <ServiceBulkBar
              count={selected.length}
              canEdit={permissions.edit}
              categories={categories}
              onClear={() => setSelectedIds([])}
              onActivate={() => setActive(selectedIds, true)}
              onDeactivate={() => requestDeactivate(selectedIds)}
              onAssignCategory={(category) => {
                void serviceStore
                  .update(selectedIds, (service) =>
                    withAudit({ ...service, category }, CURRENT_USER, {
                      change: 'Changed category',
                      from: service.category,
                      to: category,
                    }),
                  )
                  .then(reportFailure)
                setToast(`${selectedIds.length} services moved to ${category}`)
              }}
              onExport={() => handleExport(selected)}
            />
          )}

          {servicesQuery.isLoading ? (
            <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line" aria-busy="true">
              <p className="sr-only" role="status">Loading services…</p>
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-md bg-field" />
              ))}
            </div>
          ) : servicesQuery.isError ? (
            <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
              <h2 className="text-sm font-bold text-ink">Couldn’t load the services</h2>
              <p className="text-xs text-muted">{serviceErrorMessage(servicesQuery.error)}</p>
              <button
                type="button"
                onClick={() => void servicesQuery.refetch()}
                disabled={servicesQuery.isFetching}
                className={`${secondaryButton} mt-2`}
              >
                {servicesQuery.isFetching ? 'Retrying…' : 'Try Again'}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
              <Layers className="size-8 text-muted/60" aria-hidden="true" />
              <h2 className="text-sm font-bold text-ink">
                {services.length === 0 ? 'No Services' : 'No Search Results'}
              </h2>
              <p className="text-xs text-muted">
                {services.length === 0
                  ? 'No services have been configured yet.'
                  : 'No services match your search.'}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {services.length > 0 && (
                  <button
                    type="button"
                    onClick={() => replaceFilters(EMPTY_SERVICE_FILTERS)}
                    className={secondaryButton}
                  >
                    Clear Filters
                  </button>
                )}
                {permissions.edit && (
                  <button
                    type="button"
                    onClick={() => setWizardId('')}
                    className={primaryButton}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add Service
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {view === 'cards' ? (
                <ServiceCards services={paged} {...listProps} />
              ) : (
                <ServicesTable
                  services={paged}
                  {...listProps}
                  sort={sort}
                  onSort={handleSort}
                  selectedIds={selectedIds}
                  onToggle={(id) =>
                    setSelectedIds(
                      selectedIds.includes(id)
                        ? selectedIds.filter((current) => current !== id)
                        : [...selectedIds, id],
                    )
                  }
                  onToggleAll={(checked) => {
                    const pageIds = paged.map(({ id }) => id)
                    setSelectedIds(
                      checked
                        ? [...new Set([...selectedIds, ...pageIds])]
                        : selectedIds.filter((id) => !pageIds.includes(id)),
                    )
                  }}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <p>
                  Showing{' '}
                  <span className="font-bold text-ink">
                    {(currentPage - 1) * pageSize + 1} to{' '}
                    {(currentPage - 1) * pageSize + paged.length}
                  </span>{' '}
                  of <span className="font-bold text-ink">{filtered.length}</span>{' '}
                  services
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    Rows per page
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value))
                        setPage(1)
                      }}
                      className={`${fieldClass} h-8 w-auto! bg-white ring-1 ring-line`}
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className={`${secondaryButton} h-8 w-8 px-0`}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <span className="font-semibold text-ink tabular-nums">
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === pageCount}
                    aria-label="Next page"
                    className={`${secondaryButton} h-8 w-8 px-0`}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}

          {services.length > 0 && (
            <ServiceRankingAndPackages services={services} permissions={permissions} />
          )}
        </>
      )}

      {permissions.edit && (
        <button
          type="button"
          onClick={() => setWizardId('')}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Service
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      {wizardId !== null && (
        <ServiceWizard
          service={editing}
          categories={categories}
          existing={allServices}
          error={saveError}
          onClose={() => {
            setSaveError(null)
            setWizardId(null)
          }}
          onSave={handleSave}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default ServicesPage
