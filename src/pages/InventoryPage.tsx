import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ClipboardList,
  Download,
  Flame,
  PackagePlus,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import {
  ItemWizard,
  PurchaseOrderDialog,
  StockDialog,
  TransferDialog,
} from '../components/inventory/InventoryDialogs'
import type {
  PurchaseOrderInput,
  StockChange,
  TransferInput,
} from '../components/inventory/InventoryDialogs'
import {
  CategoryCards,
  ConsumptionPanel,
  EfficiencyPanel,
  ExpiringPanel,
  InventoryHealth,
  InventoryKpis,
  MovementsPanel,
  PurchaseOrdersPanel,
  ReplenishmentQueue,
  ServiceImpact,
  SuppliersPanel,
  TransfersPanel,
} from '../components/inventory/InventoryPanels'
import InventoryTable from '../components/inventory/InventoryTable'
import type { StockAction } from '../components/inventory/InventoryTable'
import ItemDrawer from '../components/inventory/ItemDrawer'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import { EMPTY_INVENTORY_FILTERS } from '../constants/inventory'
import type { InventoryPermissions } from '../constants/inventory'
import useCurrentUser from '../hooks/useCurrentUser'
import useNow from '../hooks/useNow'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import {
  useCreateInventoryItemMutation,
  useListInventoryItemsQuery,
  useListStockMovementsQuery,
  useRecordStockMovementMutation,
  useUpdateInventoryItemMutation,
} from '../services/inventoryApi'
import type { StockMovementRequest } from '../services/inventoryApi'
import type {
  InventoryFilters,
  InventoryItem,
  PurchaseOrder,
  StockTransfer,
} from '../types/inventory'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import {
  formatQty,
  getStockStatus,
  itemsToCsv,
  matchesInventoryFilters,
} from '../utils/inventory'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000
// TODO: page through the list if a tenant ever stocks more than this
const ALL_ITEMS = { page: 0, size: 500 }
const RECENT_MOVEMENTS = { page: 0, size: 200 }
const NO_ITEMS: InventoryItem[] = []

const failure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected) ?? NETWORK_ERROR_MESSAGE

// The API's movement for what the stock dialog asked for. `quantity` is the
// amount moved, or the counted level for an adjustment
function toMovementRequest(change: StockChange, quantity: number): StockMovementRequest {
  switch (change.type) {
    case 'Stock received':
      return { type: 'RECEIPT', quantity, unitCost: change.unitCost, reference: change.reference }
    case 'Consumption':
      return { type: 'USAGE', quantity, reference: change.reference }
    case 'Adjustment':
      return { type: 'ADJUSTMENT', quantity, reference: change.reference, note: change.reference }
    default:
      // Damage, expiry and loss are all waste to the server
      return { type: 'WASTE', quantity, reference: change.reference, note: `${change.type}: ${change.reference}` }
  }
}

type DialogState =
  | { name: 'stock'; action: StockAction; itemId: string }
  | { name: 'transfer'; itemId: string }
  | { name: 'po'; itemIds: string[] }
  | { name: 'item' }

// Most urgent statuses first in the table
const STATUS_ORDER = ['out', 'expired', 'critical', 'low', 'expiring', 'overstocked', 'healthy']

function InventoryPage() {
  const now = useNow()
  const { name: actor, can } = useCurrentUser()
  const [branch, setBranch] = useState('')
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const itemsQuery = useListInventoryItemsQuery({ ...ALL_ITEMS, ...(branch ? { branch } : {}) })
  const movementsQuery = useListStockMovementsQuery({ ...RECENT_MOVEMENTS, ...(branch ? { branch } : {}) })
  const items = itemsQuery.data ?? NO_ITEMS
  const movements = movementsQuery.data ?? []
  const [recordMovement] = useRecordStockMovementMutation()
  const [updateItem] = useUpdateInventoryItemMutation()
  const [createItem, { error: createError, reset: resetCreate }] = useCreateInventoryItemMutation()
  // The server has no purchase orders or transfers yet, so these live only
  // until the page is left. Receiving an order does record real stock
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_INVENTORY_FILTERS)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // From the role's permissions; everything is allowed until the profile says otherwise
  const manage = can('INVENTORY:MANAGE_ITEMS') || can('INVENTORY:ADD_STOCK')
  const permissions: InventoryPermissions = {
    costs: manage || can('INVENTORY:PURCHASE'),
    consume: manage,
    manage,
  }
  const filtered = items
    .filter((item) => matchesInventoryFilters(item, filters, now))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(getStockStatus(a, now)) -
          STATUS_ORDER.indexOf(getStockStatus(b, now)) || a.name.localeCompare(b.name),
    )
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openItem = items.find(({ id }) => id === openItemId) ?? null

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

  function showInTable(patch: Partial<InventoryFilters>) {
    setFilters({ ...EMPTY_INVENTORY_FILTERS, ...patch })
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleStockChange(change: StockChange) {
    const item = items.find(({ id }) => id === change.itemId)
    if (!item) return
    const quantity = change.type === 'Adjustment' ? item.stock + change.delta : Math.abs(change.delta)
    try {
      await recordMovement({ itemId: item.id, movement: toMovementRequest(change, quantity) }).unwrap()
      // Batch and expiry belong to the item, not to the movement
      if (change.batch || change.expiresAt) {
        await updateItem({
          id: item.id,
          changes: {
            ...(change.batch ? { batch: change.batch } : {}),
            ...(change.expiresAt ? { expiresAt: change.expiresAt.slice(0, 10) } : {}),
          },
        }).unwrap()
      }
      setDialog(null)
      setToast(
        `${item.name}: ${change.delta > 0 ? '+' : '−'}${formatQty(Math.abs(change.delta), item.unit)} (${change.type.toLowerCase()})`,
      )
    } catch (error) {
      setToast(failure(error, 'Couldn’t record the stock change.'))
    }
  }

  // Not stored yet: the record stays on this page and stock isn't moved
  function handleTransfer(input: TransferInput) {
    const id = `TRF-${String(transfers.length + 1).padStart(4, '0')}`
    const mine = items.find((item) => item.id === input.itemId)?.branchName ?? ''
    setTransfers([
      {
        id,
        itemId: input.itemId,
        from: input.incoming ? input.otherBranch : mine,
        to: input.incoming ? mine : input.otherBranch,
        qty: input.qty,
        status: 'In Transit',
        requestedBy: actor,
        at: new Date().toISOString(),
      },
      ...transfers,
    ])
    setDialog(null)
    setToast(`Transfer ${id} noted. Transfers aren’t stored or applied to stock yet.`)
  }

  function handleReceiveTransfer(id: string) {
    setTransfers(transfers.map((item) => (item.id === id ? { ...item, status: 'Received' } : item)))
    setToast(`Transfer ${id} marked received. Stock wasn’t changed.`)
  }

  function handleCreateOrder(input: PurchaseOrderInput) {
    const id = `PO-${String(orders.length + 1).padStart(4, '0')}`
    setOrders([
      {
        id,
        ...input,
        createdAt: new Date().toISOString(),
        status: 'Draft',
        createdBy: actor,
      },
      ...orders,
    ])
    setDialog(null)
    setToast(`${id} saved as a draft on this page; purchase orders aren’t stored yet`)
  }

  async function handleReceiveOrder(id: string) {
    const order = orders.find((item) => item.id === id)
    if (!order) return
    try {
      for (const { itemId, qty, unitCost } of order.lines) {
        await recordMovement({
          itemId,
          movement: { type: 'RECEIPT', quantity: qty, unitCost, reference: id },
        }).unwrap()
      }
      setOrders(orders.map((item) => (item.id === id ? { ...item, status: 'Received' } : item)))
      setToast(`${id} received in full; stock updated`)
    } catch (error) {
      setToast(failure(error, `Couldn’t receive ${id}. Some lines may already be in stock.`))
    }
  }

  async function handleCreateItem(item: InventoryItem) {
    try {
      await createItem({
        name: item.name,
        category: item.category,
        description: item.description,
        unit: item.unit,
        location: item.location,
        stock: item.stock,
        reorder: item.reorder,
        safety: item.safety,
        max: item.max,
        unitCost: item.unitCost,
        supplier: item.supplier,
        dailyUse: item.dailyUse,
        batch: item.batch,
        ...(item.expiresAt ? { expiresAt: item.expiresAt.slice(0, 10) } : {}),
        branch: item.branchId,
      }).unwrap()
      setDialog(null)
      setToast(`${item.name} added`)
    } catch {
      // The mutation's error is shown in the wizard
    }
  }

  const openStock = (action: StockAction, itemId = '') =>
    setDialog({ name: 'stock', action, itemId })

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Inventory</h1>
            <p className="text-xs text-muted">
              Monitor stock, consumption, suppliers, purchasing, and inventory movements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadFile(
                  'inventory.csv',
                  itemsToCsv(filtered, now, permissions.costs),
                  'text/csv;charset=utf-8',
                )
                setToast(`Exported ${filtered.length} items`)
              }}
              className={secondaryButton}
            >
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {(permissions.consume || permissions.manage) && (
              <button type="button" onClick={() => openStock('consume')} className={secondaryButton}>
                <Flame className="size-4 text-muted" aria-hidden="true" />
                Record Consumption
              </button>
            )}
            {permissions.manage && (
              <>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'transfer', itemId: '' })}
                  className={secondaryButton}
                >
                  <ArrowLeftRight className="size-4 text-muted" aria-hidden="true" />
                  Stock Transfer
                </button>
                <button type="button" onClick={() => openStock('adjust')} className={secondaryButton}>
                  <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
                  Stock Count
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'po', itemIds: [] })}
                  className={secondaryButton}
                >
                  <ClipboardList className="size-4 text-muted" aria-hidden="true" />
                  Purchase Order
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ name: 'item' })}
                  className={secondaryButton}
                >
                  <Plus className="size-4 text-muted" aria-hidden="true" />
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => openStock('add')}
                  className={`${primaryButton} max-md:hidden`}
                >
                  <PackagePlus className="size-4" aria-hidden="true" />
                  Add Stock
                </button>
              </>
            )}
          </div>
        </div>
        {branches.length > 1 && (
          <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
            Branch
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className={`${fieldClass} h-8 w-auto!`}
            >
              <option value="">All branches</option>
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {itemsQuery.isLoading ? (
        <div className="animate-pulse space-y-4" aria-busy="true">
          <p className="sr-only" role="status">Loading inventory…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-white ring-1 ring-line" />
          <div className="h-96 rounded-xl bg-white ring-1 ring-line" />
        </div>
      ) : itemsQuery.isError && items.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the inventory</h2>
          <p className="max-w-md text-xs text-muted">{failure(itemsQuery.error, 'The server refused the request.')}</p>
          <button type="button" onClick={() => void itemsQuery.refetch()} disabled={itemsQuery.isFetching} className={`${secondaryButton} mt-2`}>
            {itemsQuery.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : (
      <>
      <InventoryKpis
        items={items}
        now={now}
        movements={movements}
        orders={orders}
        filters={filters}
        onSelect={(patch) => showInTable(patch)}
        showCosts={permissions.costs}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <InventoryHealth
            items={items}
            now={now}
            onSelect={(status) => showInTable({ status })}
          />
          <CategoryCards
            items={items}
            now={now}
            selected={filters.category}
            onSelect={(category) => setFilters({ ...filters, category })}
            showCosts={permissions.costs}
          />
        </div>
        <ServiceImpact items={items} now={now} />
      </div>

      <div ref={tableRef} className="scroll-mt-20">
        <InventoryTable
          searchRef={searchRef}
          items={filtered}
          totalCount={items.length}
          now={now}
          filters={filters}
          filtersActive={filtersActive}
          onChange={(patch) => setFilters({ ...filters, ...patch })}
          onReset={() => setFilters(EMPTY_INVENTORY_FILTERS)}
          permissions={permissions}
          onOpen={setOpenItemId}
          onStock={openStock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ReplenishmentQueue
            items={items}
            now={now}
            canManage={permissions.manage}
            onOrder={(itemIds) => setDialog({ name: 'po', itemIds })}
            onTransfer={(itemId) => setDialog({ name: 'transfer', itemId })}
            onOpen={setOpenItemId}
          />
        </div>
        <ExpiringPanel items={items} now={now} onOpen={setOpenItemId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConsumptionPanel />
        <div className="min-w-0 space-y-4">
          <PurchaseOrdersPanel
            orders={orders}
            items={items}
            canManage={permissions.manage}
            showCosts={permissions.costs}
            onCreate={() => setDialog({ name: 'po', itemIds: [] })}
            onReceive={(id) => void handleReceiveOrder(id)}
            onAdvance={(id) =>
              setOrders(
                orders.map((order) =>
                  order.id === id
                    ? { ...order, status: order.status === 'Draft' ? 'Approved' : 'Ordered' }
                    : order,
                ),
              )
            }
          />
          <TransfersPanel
            transfers={transfers}
            items={items}
            canManage={permissions.manage}
            onReceive={handleReceiveTransfer}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SuppliersPanel items={items} />
        <EfficiencyPanel
          items={items}
          now={now}
          movements={movements}
          showCosts={permissions.costs}
          onOpen={setOpenItemId}
        />
      </div>

      <MovementsPanel movements={movements} items={items} />
      </>
      )}

      {permissions.manage && (
        <button
          type="button"
          onClick={() => openStock('add')}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <PackagePlus className="size-4" aria-hidden="true" />
          Add Stock
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

      <ItemDrawer
        item={openItem}
        movements={movements}
        now={now}
        permissions={permissions}
        onClose={() => setOpenItemId(null)}
        onStock={openStock}
      />
      {dialog?.name === 'stock' && (
        <StockDialog
          action={dialog.action}
          items={items}
          initialItemId={dialog.itemId}
          onClose={() => setDialog(null)}
          onSubmit={(change) => void handleStockChange(change)}
        />
      )}
      {dialog?.name === 'transfer' && (
        <TransferDialog
          items={items}
          initialItemId={dialog.itemId}
          onClose={() => setDialog(null)}
          onCreate={handleTransfer}
        />
      )}
      {dialog?.name === 'po' && (
        <PurchaseOrderDialog
          items={items}
          initialItemIds={dialog.itemIds}
          showCosts={permissions.costs}
          onClose={() => setDialog(null)}
          onCreate={handleCreateOrder}
        />
      )}
      {dialog?.name === 'item' && (
        <ItemWizard
          existing={items}
          branches={branches}
          defaultBranch={branch}
          error={createError ? failure(createError, 'The server rejected this item.') : null}
          onClose={() => {
            resetCreate()
            setDialog(null)
          }}
          onCreate={(item) => void handleCreateItem(item)}
        />
      )}
    </>
  )
}

export default InventoryPage
