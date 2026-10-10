import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  CampaignDialog,
  CustomerImportDialog,
  CustomerPaymentDialog,
} from '../components/customers/CustomerDialogs'
import CustomerFormDialog from '../components/customers/CustomerFormDialog'
import CustomerKpiCards from '../components/customers/CustomerKpiCards'
import CustomersHeader from '../components/customers/CustomersHeader'
import CustomersTable, {
  CustomerBulkBar,
} from '../components/customers/CustomersTable'
import type { CustomerSort } from '../components/customers/CustomersTable'
import CustomersToolbar, {
  CustomerFiltersDialog,
} from '../components/customers/CustomersToolbar'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { OrdersSkeleton } from '../components/orders/OrdersStates'
import {
  fieldClass,
  primaryButton,
  secondaryButton,
} from '../components/orders/styles'
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_PERMISSIONS,
  EMPTY_CUSTOMER_FILTERS,
} from '../constants/customers'
import { CURRENT_USER, PERMISSIONS } from '../constants/orders'
import type { PreviewState } from '../constants/orders'
import { getSampleOrders } from '../constants/sampleCustomers'
import useCustomers, { customerStore } from '../hooks/useCustomers'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type {
  CrmCustomer,
  CustomSegment,
  CustomerFilters,
  CustomerStatus,
} from '../types/customer'
import type { OrderRole } from '../types/order'
import {
  applyPayment,
  compareCustomers,
  countCustomerFilters,
  customersToCsv,
  matchesCustomerFilters,
} from '../utils/customers'
import type { CustomerSortKey } from '../utils/customers'
import { downloadFile, formatXaf } from '../utils/orders'

const PAGE_SIZES = [10, 25, 50]
const TOAST_MS = 4000

type DialogName = 'add' | 'import' | 'campaign' | 'filters'

function CustomersPage() {
  const now = useNow()
  const navigate = useNavigate()
  const allCustomers = useCustomers()
  const [role, setRole] = useLocalStorage<OrderRole>('customers.role', 'manager')
  const [preview, setPreview] = useState<PreviewState>('normal')
  const [filters, setFilters] = useState<CustomerFilters>(EMPTY_CUSTOMER_FILTERS)
  const [sort, setSort] = useState<CustomerSort>({
    key: 'lastOrder',
    direction: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [hiddenColumns, setHiddenColumns] = useLocalStorage<string[]>(
    'customers.hiddenColumns',
    [],
  )
  const [customSegments, setCustomSegments] = useLocalStorage<CustomSegment[]>(
    'customers.segments',
    [],
  )

  const permissions = CUSTOMER_PERMISSIONS[role]
  const canCreateOrder = PERMISSIONS[role].create

  const customers =
    preview === 'empty' ? [] : allCustomers.filter(({ archived }) => !archived)
  const filtered = customers
    .filter((customer) =>
      matchesCustomerFilters(
        customer,
        filters,
        now,
        getSampleOrders(customer.phone).map(({ id }) => id),
      ),
    )
    .sort(
      (a, b) =>
        compareCustomers(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1),
    )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const selected = customers.filter(({ id }) => selectedIds.includes(id))
  const paymentCustomer = customers.find(({ id }) => id === paymentId)
  const columns = CUSTOMER_COLUMNS.filter(
    ({ financial }) => permissions.financials || !financial,
  )

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

  function replaceFilters(next: CustomerFilters) {
    setFilters(next)
    setPage(1)
    setSelectedIds([])
  }

  const patchFilters = (patch: Partial<CustomerFilters>) =>
    replaceFilters({ ...filters, ...patch })

  function handleSort(key: CustomerSortKey) {
    setSort({
      key,
      direction: sort.key === key && sort.direction === 'desc' ? 'asc' : 'desc',
    })
  }

  function handleSave(customer: CrmCustomer, createOrder: boolean) {
    customerStore.add([customer])
    setDialog(null)
    if (createOrder) {
      navigate(`/orders?new=1&customer=${customer.id}`)
      return
    }
    setToast(`${customer.name} added as ${customer.id}`)
  }

  function requestArchive(ids: string[]) {
    setConfirm({
      title:
        ids.length === 1 ? 'Archive this customer?' : `Archive ${ids.length} customers?`,
      body: 'Archived customers disappear from the list and can no longer be selected for new orders. Their order and payment history is kept.',
      confirmLabel: 'Archive',
      destructive: true,
      onConfirm: () => {
        customerStore.update(ids, (customer) => ({ ...customer, archived: true }))
        setSelectedIds([])
        setToast(
          ids.length === 1 ? 'Customer archived' : `${ids.length} customers archived`,
        )
      },
    })
  }

  function applyStatus(status: CustomerStatus) {
    customerStore.update(selectedIds, (customer) => ({ ...customer, status }))
    setToast(`Status changed for ${selectedIds.length} customers`)
  }

  function handleChangeStatus(status: CustomerStatus) {
    if (status !== 'suspended') {
      applyStatus(status)
      return
    }
    setConfirm({
      title: `Suspend ${selectedIds.length} ${selectedIds.length === 1 ? 'customer' : 'customers'}?`,
      body: 'Suspended accounts cannot place new orders until management reactivates them.',
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: () => applyStatus('suspended'),
    })
  }

  function handleExport(list: CrmCustomer[]) {
    downloadFile(
      'customers.csv',
      customersToCsv(list, permissions.financials),
      'text/csv;charset=utf-8',
    )
    setToast(
      `Exported ${list.length} ${list.length === 1 ? 'customer' : 'customers'}`,
    )
  }

  return (
    <>
      <CustomersHeader
        role={role}
        onRoleChange={(next) => {
          setRole(next)
          setSelectedIds([])
        }}
        permissions={permissions}
        preview={preview}
        onPreviewChange={setPreview}
        onAdd={() => setDialog('add')}
        onImport={() => setDialog('import')}
        onExport={() => handleExport(filtered)}
        onCampaign={() => setDialog('campaign')}
      />

      {preview === 'loading' && <OrdersSkeleton />}
      {preview === 'error' && (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line"
        >
          <CircleAlert className="size-8 text-danger" aria-hidden="true" />
          <h2 className="text-sm font-bold text-ink">
            Unable to load customer information.
          </h2>
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
          <CustomerKpiCards
            customers={customers}
            selected={filters.segment}
            filtersActive={countCustomerFilters(filters) > 0}
            onSelect={(segment) =>
              replaceFilters({ ...EMPTY_CUSTOMER_FILTERS, segment })
            }
            showFinancials={permissions.financials}
          />
          <CustomersToolbar
            searchRef={searchRef}
            results={filtered}
            now={now}
            filters={filters}
            onChange={patchFilters}
            onReset={() => replaceFilters(EMPTY_CUSTOMER_FILTERS)}
            onOpenMoreFilters={() => setDialog('filters')}
            customSegments={customSegments}
            onApplySegment={replaceFilters}
            onSaveSegment={(name) =>
              setCustomSegments([
                ...customSegments.filter((segment) => segment.name !== name),
                { name, filters },
              ])
            }
            onDeleteSegment={(name) =>
              setCustomSegments(
                customSegments.filter((segment) => segment.name !== name),
              )
            }
            columns={columns}
            hiddenColumns={hiddenColumns}
            onToggleColumn={(key) =>
              setHiddenColumns(
                hiddenColumns.includes(key)
                  ? hiddenColumns.filter((hidden) => hidden !== key)
                  : [...hiddenColumns, key],
              )
            }
            showFinancials={permissions.financials}
            canCreateOrder={canCreateOrder}
          />

          {selected.length > 0 && (
            <CustomerBulkBar
              count={selected.length}
              permissions={permissions}
              onClear={() => setSelectedIds([])}
              onMessage={() => setDialog('campaign')}
              onExport={() => handleExport(selected)}
              onAssignBranch={(branch) => {
                customerStore.update(selectedIds, (customer) => ({
                  ...customer,
                  branch,
                }))
                setToast(`${selectedIds.length} customers assigned to ${branch}`)
              }}
              onChangeStatus={handleChangeStatus}
              onAddTag={(tag) => {
                customerStore.update(selectedIds, (customer) =>
                  customer.tags.includes(tag)
                    ? customer
                    : { ...customer, tags: [...customer.tags, tag] },
                )
                setToast(`Tag “${tag}” added to ${selectedIds.length} customers`)
              }}
              onArchive={() => requestArchive(selectedIds)}
            />
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
              <Users className="size-8 text-muted/60" aria-hidden="true" />
              <h2 className="text-sm font-bold text-ink">
                {customers.length === 0 ? 'No Customers' : 'No Search Results'}
              </h2>
              <p className="text-xs text-muted">
                {customers.length === 0
                  ? 'You don’t have any customers yet.'
                  : 'No customers match your search.'}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => replaceFilters(EMPTY_CUSTOMER_FILTERS)}
                    className={secondaryButton}
                  >
                    Clear Search
                  </button>
                )}
                {permissions.edit && (
                  <button
                    type="button"
                    onClick={() => setDialog('add')}
                    className={primaryButton}
                  >
                    <UserPlus className="size-4" aria-hidden="true" />
                    Add Customer
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <CustomersTable
                customers={paged}
                now={now}
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
                hiddenColumns={hiddenColumns}
                permissions={permissions}
                canCreateOrder={canCreateOrder}
                onRecordPayment={setPaymentId}
                onArchive={(id) => requestArchive([id])}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <p>
                  Showing{' '}
                  <span className="font-bold text-ink">
                    {(currentPage - 1) * pageSize + 1} to{' '}
                    {(currentPage - 1) * pageSize + paged.length}
                  </span>{' '}
                  of <span className="font-bold text-ink">{filtered.length}</span>{' '}
                  customers
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
        </>
      )}

      {permissions.edit && (
        <button
          type="button"
          onClick={() => setDialog('add')}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Add Customer
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

      <CustomerFiltersDialog
        open={dialog === 'filters'}
        onClose={() => setDialog(null)}
        filters={filters}
        onChange={patchFilters}
        onReset={() => replaceFilters(EMPTY_CUSTOMER_FILTERS)}
        showFinancials={permissions.financials}
        resultCount={filtered.length}
      />
      {dialog === 'add' && (
        <CustomerFormDialog
          canManage={permissions.manage}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      )}
      {dialog === 'import' && (
        <CustomerImportDialog
          existing={allCustomers}
          onClose={() => setDialog(null)}
          onImport={(imported) => {
            customerStore.add(imported)
            setDialog(null)
            setToast(`${imported.length} customers imported`)
          }}
        />
      )}
      {dialog === 'campaign' && (
        <CampaignDialog
          customers={filtered}
          selected={selected}
          onClose={() => setDialog(null)}
          onSend={(recipients, channel, scheduled) => {
            setDialog(null)
            setToast(
              `${channel} campaign for ${recipients} customers ${scheduled ? 'scheduled' : 'prepared'}. Sending isn’t connected yet.`,
            )
          }}
        />
      )}
      {paymentCustomer && (
        <CustomerPaymentDialog
          customer={paymentCustomer}
          onClose={() => setPaymentId(null)}
          onSubmit={(amount, method, reference) => {
            customerStore.update([paymentCustomer.id], (customer) =>
              applyPayment(customer, amount, method, reference, CURRENT_USER),
            )
            setPaymentId(null)
            setToast(`Payment of ${formatXaf(amount)} recorded`)
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default CustomersPage
