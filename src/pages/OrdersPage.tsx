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
import CancelOrderDialog from '../components/orders/CancelOrderDialog'
import ImportOrdersDialog from '../components/orders/ImportOrdersDialog'
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
import { EMPTY_FILTERS, OPTIONAL_COLUMNS } from '../constants/orders'
import type { Permissions, PreviewState } from '../constants/orders'
import useCurrentUser from '../hooks/useCurrentUser'
import useCustomers from '../hooks/useCustomers'
import useStaff from '../hooks/useStaff'
import useLocalStorage from '../hooks/useLocalStorage'
import { useChangeOrders, useOrdersQuery } from '../hooks/useOrders'
import {
  useAssignOrderMutation,
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useGetOrderQuery,
  useQualityCheckMutation,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
} from '../services/orderApi'
import type { OrderPatch } from '../services/orderApi'
import { useRecordPaymentMutation } from '../services/paymentApi'
import { describeError } from '../utils/apiReasons'
import { toApiStatus } from '../utils/orderMapping'
import useNow from '../hooks/useNow'
import type {
  FulfilmentMethod,
  Order,
  OrderFilters,
  OrderStatus,
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

type DialogName = 'new' | 'scan' | 'filters' | 'prefs' | 'import'

function OrdersPage() {
  const now = useNow()
  const ordersQuery = useOrdersQuery()
  const orders = ordersQuery.items
  const changeOrders = useChangeOrders()
  const [updateStatus] = useUpdateOrderStatusMutation()
  const [patchOrder] = useUpdateOrderMutation()
  const [assignOrder] = useAssignOrderMutation()
  const [cancelOrder] = useCancelOrderMutation()
  const [qualityCheck] = useQualityCheckMutation()
  const [completeOrder] = useCompleteOrderMutation()
  const [recordPayment] = useRecordPaymentMutation()
  const staff = useStaff()
  const { can, name: actor } = useCurrentUser()
  // The orders being cancelled, while the reason is asked for
  const [cancelIds, setCancelIds] = useState<string[] | null>(null)
  // Why the last change was refused, for the toast
  const refusal = useRef('')
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

  // From the role's permissions; everything is allowed until the profile says otherwise
  const permissions: Permissions = {
    create: can('ORDERS:CREATE'),
    updateStatus: can('ORDERS:EDIT'),
    assign: can('ORDERS:ASSIGN'),
    payments: can('PAYMENTS:VIEW'),
    cancel: can('ORDERS:CANCEL'),
    financials: can('PAYMENTS:VIEW'),
    configure: can('SETTINGS:EDIT_BUSINESS'),
    assignedOnly: false,
  }

  const shown: PreviewState = ordersQuery.isLoading
    ? 'loading'
    : ordersQuery.isError && orders.length === 0
      ? 'error'
      : 'normal'

  // The server scopes the list to what the person may see
  const visibleOrders = orders
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
  const openId = openOrderId ?? requestedOrderId
  // The single-order read carries the timeline, which the list leaves out
  const { data: openDetail } = useGetOrderQuery(openId ?? '', { skip: !openId })
  const listedOpen = visibleOrders.find(({ id }) => id === openId) ?? null
  const openOrder = listedOpen ? (openDetail?.id === listedOpen.id ? openDetail : listedOpen) : null
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

  // Shows a change at once and sends it with `send`, if given; the toast says
  // `done`, plus how many orders the server refused (those are put back).
  // Without `send` the change has no endpoint yet and stays on screen only.
  async function updateOrders(
    ids: string[],
    update: (order: Order) => Order,
    done: string,
    send?: (order: Order) => Promise<unknown>,
  ) {
    const targets = orders.filter(({ id }) => ids.includes(id))
    refusal.current = ''
    const refused = await changeOrders(
      targets,
      update,
      send &&
        (async (order) => {
          try {
            return await send(order)
          } catch (error) {
            refusal.current = describeError(error, 'The server refused this change.')
            throw error
          }
        }),
    )
    setToast(
      refused === 0
        ? done
        : refused === targets.length
          ? refusal.current || 'The server refused this change. Nothing was saved, try again.'
          : `${done}, but ${refused} of ${targets.length} orders couldn’t be saved. ${refusal.current}`.trim(),
    )
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

  // PATCH /order/{orderNumber} with any of the fields the backend's update reads
  const patch = (order: Order, changes: OrderPatch) =>
    patchOrder({ orderNumber: order.id, changes }).unwrap()

  // PATCH /order/{orderNumber} with the new status. The backend only allows
  // forward moves (and cancelling), so moving an order back is refused
  function applyStatus(ids: string[], status: OrderStatus) {
    // Cancelling needs a reason
    if (status === 'cancelled') {
      requestCancel(ids)
      return
    }
    const label = getStatus(status).label
    void updateOrders(
      ids,
      (order) =>
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
              `Moved to ${label}`,
            ),
      ids.length === 1 ? `Order #${ids[0]} moved to ${label}` : `${ids.length} orders moved to ${label}`,
      (order) =>
        order.status === status
          ? Promise.resolve()
          : status === 'completed'
            ? completeOrder(order.id).unwrap()
            : updateStatus({ orderNumber: order.id, status: toApiStatus(status) }).unwrap(),
    )
  }

  function requestCancel(ids: string[]) {
    setCancelIds(ids)
  }

  // One request per order; the server decides who may cancel and when
  async function handleCancel(ids: string[], reason: string) {
    let cancelled = 0
    let refundDue = 0
    try {
      for (const id of ids) {
        const order = await cancelOrder({ orderNumber: id, reason }).unwrap()
        cancelled += 1
        refundDue += order?.refundDue ?? 0
      }
    } catch (error) {
      if (cancelled === 0) throw new Error(describeError(error, 'The cancellation wasn’t saved.'), { cause: error })
      setToast(`${cancelled} cancelled, then stopped: ${describeError(error, 'The server refused.')}`)
      setCancelIds(null)
      setSelectedIds([])
      return
    }
    setCancelIds(null)
    setSelectedIds([])
    setToast(
      `${cancelled === 1 ? `Order #${ids[0]}` : `${cancelled} orders`} cancelled${
        refundDue > 0 ? `. ${formatXaf(refundDue)} was already paid and waits for a refund on the Payments page` : ''
      }`,
    )
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

  // Staff are picked by name; the order API takes their uuid
  function handleAssign(ids: string[], name: string) {
    const person = staff.find((member) => member.name === name)
    if (!person) return
    void updateOrders(
      ids,
      (order) =>
        order.assignedToId === person.uuid
          ? order
          : withEvent({ ...order, assignedTo: person.name, assignedToId: person.uuid }, `Assigned to ${person.name}`),
      `Assigned to ${person.name}`,
      (order) =>
        order.assignedToId === person.uuid
          ? Promise.resolve()
          : assignOrder({ orderNumber: order.id, assignedTo: person.uuid }).unwrap(),
    )
  }

  // One cash payment for each order's balance, recorded like any other payment
  // (it needs an open cash register)
  async function handleMarkPaid(ids: string[]) {
    let recorded = 0
    try {
      for (const order of orders.filter(({ id }) => ids.includes(id))) {
        const balance = order.status === 'cancelled' ? 0 : getBalance(order)
        if (balance <= 0) continue
        await recordPayment({ order: order.id, amount: balance, method: 'CASH' }).unwrap()
        recorded += 1
      }
      setToast(recorded === 0 ? 'Nothing was owing' : `${recorded} cash ${recorded === 1 ? 'payment' : 'payments'} recorded`)
    } catch (error) {
      setToast(`${recorded} recorded, then stopped: ${describeError(error, 'The payment wasn’t recorded.')}`)
    }
  }

  // Pickup or delivery is the order's deliveryOptions; a delivery needs an address
  function handleSchedule(ids: string[], method: FulfilmentMethod) {
    const missing = method === 'delivery' ? orders.find((order) => ids.includes(order.id) && !order.address) : undefined
    const address = missing ? window.prompt(`Delivery address for order #${missing.id}`)?.trim() : undefined
    if (missing && !address) {
      setToast('A delivery order needs an address.')
      return
    }
    void updateOrders(
      ids,
      (order) =>
        withEvent(
          { ...order, method, address: order.address ?? address },
          method === 'delivery' ? 'Delivery scheduled' : 'Pickup scheduled',
        ),
      method === 'delivery' ? 'Delivery scheduled' : 'Pickup scheduled',
      (order) =>
        order.method === method
          ? Promise.resolve()
          : patch(order, {
              deliveryOptions: method === 'delivery' ? 'DELIVERY' : 'PICKUP',
              ...(method === 'delivery' ? { deliveryAddress: order.address ?? address } : {}),
            }),
    )
  }

  // POST /order/{orderNumber}/quality-check: a pass moves the order to Ready, a
  // failure sends it back to Washing or Ironing, and the checks are kept
  function handleQualityResult(id: string, qc: QualityCheck) {
    const passed = qc.result === 'passed'
    const backTo = qc.sendBackTo === 'IRONING' ? 'ironing' : 'washing'
    void updateOrders(
      [id],
      (order) =>
        withEvent(
          { ...order, qc, status: passed ? 'ready' : backTo },
          passed
            ? 'Quality check passed, moved to Ready'
            : `Quality check failed, sent back to ${getStatus(backTo).label}`,
          qc.reason,
        ),
      passed
        ? `Order #${id} passed quality check`
        : `Order #${id} sent back to ${getStatus(backTo).label}`,
      (order) =>
        qualityCheck({
          orderNumber: order.id,
          checks: qc.checks,
          result: passed ? 'PASSED' : 'FAILED',
          ...(passed ? {} : { reason: qc.reason, sendBackTo: qc.sendBackTo ?? 'WASHING' }),
        }).unwrap(),
    )
  }

  function clearRequest() {
    if (searchParams.size > 0) setSearchParams({}, { replace: true })
  }

  function closeNewOrder() {
    setDialog(null)
    if (newOrderRequested) clearRequest()
  }

  // The dialog has created the order; `order` is what the server sent back
  // (null when the response had no order). The list reloads on its own.
  function handleCreated(order: Order | null, after: AfterCreate) {
    closeNewOrder()
    if (order && after === 'print') setReceiptId(order.id)
    const label = order ? `Order #${order.id}` : 'The order'
    setToast(
      after === 'send'
        ? `${label} created. Sending confirmations isn’t connected yet.`
        : after === 'print' && !order
          ? 'The order was created, but the server didn’t send it back to print. Open it from the list.'
          : `${label} created`,
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

  const selectedOrders = orders.filter(({ id }) => selectedIds.includes(id))

  return (
    <>
      <OrdersHeader
        permissions={permissions}
        canImport={can('ORDERS:IMPORT')}
        onImport={() => setDialog('import')}
        confirmMoves={confirmMoves}
        onConfirmMovesChange={setConfirmMoves}
        onNewOrder={() => setDialog('new')}
        onScan={() => setDialog('scan')}
        onExportCsv={() => handleExport(filtered)}
        onOpenNotificationPrefs={() => setDialog('prefs')}
      />

      {shown === 'loading' && <OrdersSkeleton />}
      {shown === 'error' && (
        <OrdersErrorState
          onRetry={() => void ordersQuery.refetch()}
        />
      )}

      {shown === 'normal' && (
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
              onMarkPaid={() => void handleMarkPaid(selectedIds)}
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
          initialCustomer={
            requestedCustomer && toOrderCustomer(requestedCustomer)
          }
          initialHandling={requestedCustomer?.laundry.instructions}
          onCreated={handleCreated}
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
      {cancelIds && (
        <CancelOrderDialog orders={cancelIds} onClose={() => setCancelIds(null)} onConfirm={(reason) => handleCancel(cancelIds, reason)} />
      )}
      {dialog === 'import' && (
        <ImportOrdersDialog
          onClose={() => setDialog(null)}
          onDone={(created) => {
            setDialog(null)
            setToast(`Imported ${created} ${created === 1 ? 'order' : 'orders'}`)
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default OrdersPage
