import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import BulkActionBar from '../components/orders/BulkActionBar'
import MoreFiltersDialog from '../components/orders/MoreFiltersDialog'
import NewOrderDialog from '../components/orders/NewOrderDialog'
import type { AfterCreate } from '../components/orders/NewOrderDialog'
import {
  ConfirmDialog,
  NotificationPrefsDialog,
  ReceiptDialog,
  ScanOrderDialog,
} from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import OrderDrawer from '../components/orders/OrderDrawer'
import OrderPipeline from '../components/orders/OrderPipeline'
import OrderStats from '../components/orders/OrderStats'
import OrderSummaryCards from '../components/orders/OrderSummaryCards'
import OrdersHeader from '../components/orders/OrdersHeader'
import OrdersKanban from '../components/orders/OrdersKanban'
import {
  OrdersEmptyState,
  OrdersErrorState,
  OrdersSkeleton,
} from '../components/orders/OrdersStates'
import OrdersTable from '../components/orders/OrdersTable'
import type { SortState } from '../components/orders/OrdersTable'
import OrdersToolbar from '../components/orders/OrdersToolbar'
import type { OrdersView } from '../components/orders/OrdersToolbar'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import {
  CURRENT_USER,
  EMPTY_FILTERS,
  OPTIONAL_COLUMNS,
  PERMISSIONS,
  STAFF_PERSPECTIVE_USER,
} from '../constants/orders'
import type { PreviewState } from '../constants/orders'
import { SAMPLE_ORDERS } from '../constants/sampleOrders'
import useCustomers from '../hooks/useCustomers'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type {
  FulfilmentMethod,
  Order,
  OrderFilters,
  OrderRole,
  OrderStatus,
  PaymentMethod,
  QualityCheck,
  SavedView,
} from '../types/order'
import {
  compareOrders,
  countActiveFilters,
  downloadFile,
  findOrderByCode,
  formatXaf,
  getBalance,
  getStatus,
  matchesFilters,
  ordersToCsv,
} from '../utils/orders'
import type { SortKey } from '../utils/orders'
import { toOrderCustomer } from '../utils/customers'

const PAGE_SIZES = [10, 25, 50]
const TOAST_MS = 4000

type DialogName = 'new' | 'scan' | 'filters' | 'prefs'

function OrdersPage() {
  const now = useNow()
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS)
  const [role, setRole] = useState<OrderRole>('manager')
  const [preview, setPreview] = useState<PreviewState>('normal')
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useLocalStorage<OrdersView>('orders.view', 'table')
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(
    'orders.savedViews',
    [],
  )
  const [confirmMoves, setConfirmMoves] = useLocalStorage(
    'orders.confirmMoves',
    true,
  )
  const [hiddenColumns, setHiddenColumns] = useLocalStorage<string[]>(
    'orders.hiddenColumns',
    [],
  )

  // The top bar's New Order button links here with ?new=1
  const [searchParams, setSearchParams] = useSearchParams()
  const newOrderRequested = searchParams.get('new') === '1'
  // Customer profiles link here with ?customer=<id> and ?order=<id>
  const crmCustomers = useCustomers()
  const requestedCustomer = crmCustomers.find(
    ({ id, archived }) => id === searchParams.get('customer') && !archived,
  )
  const requestedOrderId = searchParams.get('order')

  const permissions = PERMISSIONS[role]
  const actor = role === 'staff' ? STAFF_PERSPECTIVE_USER : CURRENT_USER

  // Everything the current role may see, before filters
  const visibleOrders =
    preview === 'empty'
      ? []
      : permissions.assignedOnly
        ? orders.filter(({ assignedTo }) => assignedTo === STAFF_PERSPECTIVE_USER)
        : orders
  const filtered = visibleOrders
    .filter((order) => matchesFilters(order, filters, now))
    .sort(
      (a, b) =>
        compareOrders(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1),
    )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const openOrder =
    visibleOrders.find(
      ({ id }) => id === (openOrderId ?? requestedOrderId),
    ) ?? null
  const receiptOrder = orders.find(({ id }) => id === receiptId)
  const columns = OPTIONAL_COLUMNS.filter(
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
      } else if (event.key === 'N' && event.shiftKey && permissions.create) {
        event.preventDefault()
        setDialog('new')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [permissions.create])

  function patchFilters(patch: Partial<OrderFilters>) {
    setFilters({ ...filters, ...patch })
    setPage(1)
    setSelectedIds([])
  }

  function replaceFilters(next: OrderFilters) {
    setFilters(next)
    setPage(1)
    setSelectedIds([])
  }

  function handleSort(key: SortKey) {
    setSort({
      key,
      direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
    })
  }

  function handleRoleChange(next: OrderRole) {
    setRole(next)
    setSelectedIds([])
    setOpenOrderId(null)
  }

  // TODO: replace these in-memory updates with calls to the orders API
  function updateOrders(ids: string[], update: (order: Order) => Order) {
    setOrders(orders.map((order) => (ids.includes(order.id) ? update(order) : order)))
  }

  function withEvent(order: Order, action: string, note?: string): Order {
    return {
      ...order,
      timeline: [
        ...order.timeline,
        { at: new Date().toISOString(), action, by: actor, note },
      ],
    }
  }

  function applyStatus(ids: string[], status: OrderStatus) {
    const label = getStatus(status).label
    updateOrders(ids, (order) =>
      order.status === status
        ? order
        : withEvent(
            {
              ...order,
              status,
              completedAt:
                status === 'completed'
                  ? new Date().toISOString()
                  : order.completedAt,
            },
            status === 'cancelled' ? 'Order cancelled' : `Moved to ${label}`,
          ),
    )
    setToast(
      ids.length === 1
        ? `Order #${ids[0]} ${status === 'cancelled' ? 'cancelled' : `moved to ${label}`}`
        : `${ids.length} orders ${status === 'cancelled' ? 'cancelled' : `moved to ${label}`}`,
    )
  }

  function requestCancel(ids: string[]) {
    setConfirm({
      title: ids.length === 1 ? `Cancel order #${ids[0]}?` : `Cancel ${ids.length} orders?`,
      body: 'Cancelled orders leave the processing pipeline. Any payment already recorded stays on the order and has to be refunded separately.',
      confirmLabel: ids.length === 1 ? 'Cancel Order' : 'Cancel Orders',
      destructive: true,
      onConfirm: () => {
        applyStatus(ids, 'cancelled')
        setSelectedIds([])
      },
    })
  }

  function handleKanbanMove(id: string, status: OrderStatus) {
    const order = orders.find((candidate) => candidate.id === id)
    if (!order) return
    if (!confirmMoves) {
      applyStatus([id], status)
      return
    }
    setConfirm({
      title: 'Move order?',
      body: `Move Order #${id} from ${getStatus(order.status).label} to ${getStatus(status).label}?`,
      confirmLabel: 'Move Order',
      onConfirm: () => applyStatus([id], status),
    })
  }

  function handleAssign(ids: string[], staff: string) {
    updateOrders(ids, (order) =>
      order.assignedTo === staff
        ? order
        : withEvent({ ...order, assignedTo: staff }, `Assigned to ${staff}`),
    )
    setToast(`Assigned to ${staff}`)
  }

  function handleRecordPayment(
    id: string,
    payment: { amount: number; method: PaymentMethod; reference: string },
  ) {
    updateOrders([id], (order) =>
      withEvent(
        {
          ...order,
          payments: [
            ...order.payments,
            { ...payment, at: new Date().toISOString(), by: actor },
          ],
        },
        `Payment received (${formatXaf(payment.amount)}, ${payment.method})`,
      ),
    )
    setToast(`Payment of ${formatXaf(payment.amount)} recorded`)
  }

  function handleMarkPaid(ids: string[]) {
    updateOrders(ids, (order) => {
      const balance = getBalance(order)
      if (balance <= 0 || order.status === 'cancelled') return order
      return withEvent(
        {
          ...order,
          payments: [
            ...order.payments,
            {
              amount: balance,
              method: 'Cash',
              reference: '',
              at: new Date().toISOString(),
              by: actor,
            },
          ],
        },
        `Marked as paid (${formatXaf(balance)})`,
      )
    })
    setToast('Outstanding balances marked as paid')
  }

  function handleSchedule(ids: string[], method: FulfilmentMethod) {
    updateOrders(ids, (order) =>
      withEvent(
        { ...order, method },
        method === 'delivery' ? 'Delivery scheduled' : 'Pickup scheduled',
      ),
    )
    setToast(method === 'delivery' ? 'Delivery scheduled' : 'Pickup scheduled')
  }

  function handleQualityResult(id: string, qc: QualityCheck) {
    const passed = qc.result === 'passed'
    updateOrders([id], (order) =>
      withEvent(
        { ...order, qc, status: passed ? 'ready' : 'washing' },
        passed
          ? 'Quality check passed, moved to Ready'
          : 'Quality check failed, sent back to Washing',
        qc.reason,
      ),
    )
    setToast(
      passed
        ? `Order #${id} passed quality check`
        : `Order #${id} sent back to Washing`,
    )
  }

  function clearRequest() {
    if (searchParams.size > 0) setSearchParams({}, { replace: true })
  }

  function closeNewOrder() {
    setDialog(null)
    if (newOrderRequested) clearRequest()
  }

  function handleCreate(order: Order, after: AfterCreate) {
    setOrders([order, ...orders])
    closeNewOrder()
    if (after === 'print') setReceiptId(order.id)
    setToast(
      after === 'send'
        ? `Order #${order.id} created. Sending confirmations isn’t connected yet.`
        : `Order #${order.id} created`,
    )
  }

  function handleExport(list: Order[]) {
    downloadFile(
      'orders.csv',
      ordersToCsv(list, now, permissions.financials),
      'text/csv;charset=utf-8',
    )
    setToast(`Exported ${list.length} ${list.length === 1 ? 'order' : 'orders'}`)
  }

  function handleScan(code: string) {
    const match = findOrderByCode(visibleOrders, code)
    if (!match) return false
    setDialog(null)
    setOpenOrderId(match.id)
    return true
  }

  // Customers known from orders, overlaid with the customer directory
  const customers = [
    ...new Map([
      ...orders.map(({ customer }) => [customer.phone, customer] as const),
      ...crmCustomers
        .filter(({ archived, status }) => !archived && status !== 'suspended')
        .map((customer) => [customer.phone, toOrderCustomer(customer)] as const),
    ]).values(),
  ]
  const nextNumber =
    Math.max(...orders.map(({ id }) => Number(id.replace(/\D/g, '')))) + 1
  const selectedOrders = orders.filter(({ id }) => selectedIds.includes(id))

  return (
    <>
      <OrdersHeader
        role={role}
        onRoleChange={handleRoleChange}
        permissions={permissions}
        preview={preview}
        onPreviewChange={setPreview}
        confirmMoves={confirmMoves}
        onConfirmMovesChange={setConfirmMoves}
        onNewOrder={() => setDialog('new')}
        onScan={() => setDialog('scan')}
        onExportCsv={() => handleExport(filtered)}
        onOpenNotificationPrefs={() => setDialog('prefs')}
      />

      {preview === 'loading' && <OrdersSkeleton />}
      {preview === 'error' && (
        <OrdersErrorState onRetry={() => setPreview('normal')} />
      )}

      {(preview === 'normal' || preview === 'empty') && (
        <>
          <OrderStats
            orders={visibleOrders}
            now={now}
            showFinancials={permissions.financials}
          />
          <OrderSummaryCards
            orders={visibleOrders}
            now={now}
            filters={filters}
            onSelect={patchFilters}
            showFinancials={permissions.financials}
          />
          <OrderPipeline
            orders={visibleOrders}
            selected={filters.group ? '' : filters.status}
            onSelect={(status) => patchFilters({ status, group: '' })}
          />
          <OrdersToolbar
            searchRef={searchRef}
            filters={filters}
            onChange={patchFilters}
            onApplyView={replaceFilters}
            onReset={() => replaceFilters(EMPTY_FILTERS)}
            onOpenMoreFilters={() => setDialog('filters')}
            view={view}
            onViewChange={setView}
            savedViews={savedViews}
            onSaveView={(name) =>
              setSavedViews([
                ...savedViews.filter((saved) => saved.name !== name),
                { name, filters },
              ])
            }
            onDeleteView={(name) =>
              setSavedViews(savedViews.filter((saved) => saved.name !== name))
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
          />

          {selectedOrders.length > 0 && view === 'table' && (
            <BulkActionBar
              count={selectedOrders.length}
              permissions={permissions}
              onClear={() => setSelectedIds([])}
              onSetStatus={(status) => applyStatus(selectedIds, status)}
              onAssign={(staff) => handleAssign(selectedIds, staff)}
              onMarkPaid={() => handleMarkPaid(selectedIds)}
              onSchedule={(method) => handleSchedule(selectedIds, method)}
              onExport={() => handleExport(selectedOrders)}
              onCancel={() => requestCancel(selectedIds)}
            />
          )}

          {filtered.length === 0 ? (
            <OrdersEmptyState
              filtered={countActiveFilters(filters) > 0}
              canCreate={permissions.create}
              onClearFilters={() => replaceFilters(EMPTY_FILTERS)}
              onNewOrder={() => setDialog('new')}
            />
          ) : view === 'kanban' ? (
            <OrdersKanban
              orders={filtered}
              now={now}
              permissions={permissions}
              onOpen={setOpenOrderId}
              onMove={handleKanbanMove}
            />
          ) : (
            <>
              <OrdersTable
                orders={paged}
                now={now}
                sort={sort}
                onSort={handleSort}
                selectedIds={selectedIds}
                onToggle={(id) =>
                  setSelectedIds(
                    selectedIds.includes(id)
                      ? selectedIds.filter((selected) => selected !== id)
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
                onOpen={setOpenOrderId}
                onPrint={setReceiptId}
                onCancel={(id) => requestCancel([id])}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <p>
                  Showing{' '}
                  <span className="font-bold text-ink">
                    {(currentPage - 1) * pageSize + 1} to{' '}
                    {(currentPage - 1) * pageSize + paged.length}
                  </span>{' '}
                  of <span className="font-bold text-ink">{filtered.length}</span>{' '}
                  orders
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

      {permissions.create && (
        <button
          type="button"
          onClick={() => setDialog('new')}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          New Order
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

      <OrderDrawer
        order={openOrder}
        now={now}
        permissions={permissions}
        onClose={() => {
          setOpenOrderId(null)
          clearRequest()
        }}
        onSetStatus={(id, status) => applyStatus([id], status)}
        onAssign={(id, staff) => handleAssign([id], staff)}
        onRecordPayment={handleRecordPayment}
        onQualityResult={handleQualityResult}
        onPrint={setReceiptId}
        onCancel={(id) => requestCancel([id])}
      />
      <MoreFiltersDialog
        open={dialog === 'filters'}
        onClose={() => setDialog(null)}
        filters={filters}
        onChange={patchFilters}
        onReset={() => replaceFilters(EMPTY_FILTERS)}
        showFinancials={permissions.financials}
        resultCount={filtered.length}
      />
      {(dialog === 'new' || newOrderRequested) && permissions.create && (
        <NewOrderDialog
          onClose={closeNewOrder}
          customers={customers}
          initialCustomer={
            requestedCustomer && toOrderCustomer(requestedCustomer)
          }
          initialHandling={requestedCustomer?.laundry.instructions}
          nextNumber={nextNumber}
          onCreate={handleCreate}
        />
      )}
      {dialog === 'scan' && (
        <ScanOrderDialog onClose={() => setDialog(null)} onFind={handleScan} />
      )}
      {dialog === 'prefs' && (
        <NotificationPrefsDialog onClose={() => setDialog(null)} />
      )}
      {receiptOrder && (
        <ReceiptDialog
          order={receiptOrder}
          now={now}
          onClose={() => setReceiptId(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default OrdersPage
