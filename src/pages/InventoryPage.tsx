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
import {
  EMPTY_INVENTORY_FILTERS,
  INVENTORY_PERMISSIONS,
} from '../constants/inventory'
import { BRANCHES, CURRENT_USER, ORDER_ROLES, STAFF_PERSPECTIVE_USER } from '../constants/orders'
import {
  SAMPLE_ITEMS,
  SAMPLE_MOVEMENTS,
  SAMPLE_PURCHASE_ORDERS,
  SAMPLE_TRANSFERS,
} from '../constants/sampleInventory'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type {
  InventoryFilters,
  InventoryItem,
  Movement,
  MovementType,
} from '../types/inventory'
import type { OrderRole } from '../types/order'
import {
  formatQty,
  getStockStatus,
  itemsToCsv,
  matchesInventoryFilters,
} from '../utils/inventory'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000

type DialogState =
  | { name: 'stock'; action: StockAction; itemId: string }
  | { name: 'transfer'; itemId: string }
  | { name: 'po'; itemIds: string[] }
  | { name: 'item' }

// Most urgent statuses first in the table
const STATUS_ORDER = ['out', 'expired', 'critical', 'low', 'expiring', 'overstocked', 'healthy']

function InventoryPage() {
  const now = useNow()
  // TODO: replace these in-memory lists with the inventory API
  const [items, setItems] = useState(SAMPLE_ITEMS)
  const [movements, setMovements] = useState(SAMPLE_MOVEMENTS)
  const [orders, setOrders] = useState(SAMPLE_PURCHASE_ORDERS)
  const [transfers, setTransfers] = useState(SAMPLE_TRANSFERS)
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_INVENTORY_FILTERS)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('inventory.role', 'manager')
  const searchRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const permissions = INVENTORY_PERMISSIONS[role]
  const actor = role === 'staff' ? STAFF_PERSPECTIVE_USER : CURRENT_USER
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

  // Applies signed stock changes and writes one movement-log entry per change
  function moveStock(
    changes: {
      itemId: string
      delta: number
      type: MovementType
      reference: string
      patch?: Partial<InventoryItem>
    }[],
  ) {
    const at = new Date().toISOString()
    const entries: Movement[] = []
    setItems(
      items.map((item) => {
        const change = changes.find(({ itemId }) => itemId === item.id)
        if (!change) return item
        const after = Math.max(0, Math.round((item.stock + change.delta) * 100) / 100)
        entries.push({
          at,
          itemId: item.id,
          type: change.type,
          qty: after - item.stock,
          before: item.stock,
          after,
          user: actor,
          reference: change.reference,
        })
        return { ...item, ...change.patch, stock: after, lastMovementAt: at }
      }),
    )
    setMovements([...entries, ...movements])
  }

  function handleStockChange(change: StockChange) {
    const item = items.find(({ id }) => id === change.itemId)!
    moveStock([
      {
        itemId: change.itemId,
        delta: change.delta,
        type: change.type,
        reference: change.reference,
        patch: {
          ...(change.unitCost !== undefined ? { unitCost: change.unitCost } : {}),
          ...(change.batch ? { batch: change.batch } : {}),
          ...(change.expiresAt
            ? { expiresAt: new Date(change.expiresAt).toISOString() }
            : {}),
        },
      },
    ])
    setDialog(null)
    setToast(
      `${item.name}: ${change.delta > 0 ? '+' : '−'}${formatQty(Math.abs(change.delta), item.unit)} (${change.type.toLowerCase()})`,
    )
  }

  function handleTransfer(input: TransferInput) {
    const id = `TRF-0${22 + transfers.length - 2}`
    setTransfers([
      {
        id,
        itemId: input.itemId,
        from: input.incoming ? input.otherBranch : BRANCHES[0],
        to: input.incoming ? BRANCHES[0] : input.otherBranch,
        qty: input.qty,
        status: 'In Transit',
        requestedBy: actor,
        at: new Date().toISOString(),
      },
      ...transfers,
    ])
    if (!input.incoming) {
      moveStock([{ itemId: input.itemId, delta: -input.qty, type: 'Transfer', reference: id }])
    }
    setDialog(null)
    setToast(`Transfer ${id} created`)
  }

  function handleReceiveTransfer(id: string) {
    const transfer = transfers.find((item) => item.id === id)!
    setTransfers(
      transfers.map((item) => (item.id === id ? { ...item, status: 'Received' } : item)),
    )
    if (transfer.to === BRANCHES[0]) {
      moveStock([{ itemId: transfer.itemId, delta: transfer.qty, type: 'Transfer', reference: id }])
    }
    setToast(`Transfer ${id} received`)
  }

  function handleCreateOrder(input: PurchaseOrderInput) {
    const number = Math.max(...orders.map(({ id }) => Number(id.replace(/\D/g, '')))) + 1
    const id = `PO-${String(number).padStart(4, '0')}`
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
    setToast(`${id} saved as a draft`)
  }

  function handleReceiveOrder(id: string) {
    const order = orders.find((item) => item.id === id)!
    moveStock(
      order.lines.map(({ itemId, qty, unitCost }) => ({
        itemId,
        delta: qty,
        type: 'Stock received',
        reference: id,
        patch: { unitCost },
      })),
    )
    setOrders(orders.map((item) => (item.id === id ? { ...item, status: 'Received' } : item)))
    setToast(`${id} received in full; stock updated`)
  }

  function handleCreateItem(item: InventoryItem) {
    setItems([item, ...items])
    if (item.stock > 0) {
      setMovements([
        {
          at: new Date().toISOString(),
          itemId: item.id,
          type: 'Stock received',
          qty: item.stock,
          before: 0,
          after: item.stock,
          user: actor,
          reference: 'Opening balance',
        },
        ...movements,
      ])
    }
    setDialog(null)
    setToast(`${item.name} added as ${item.id}`)
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
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as OrderRole)}
            className={`${fieldClass} h-8 w-auto!`}
          >
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            onReceive={handleReceiveOrder}
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
          onSubmit={handleStockChange}
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
          onClose={() => setDialog(null)}
          onCreate={handleCreateItem}
        />
      )}
    </>
  )
}

export default InventoryPage
