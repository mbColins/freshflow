import {
  DEAD_STOCK_DAYS,
  EXPIRY_WARNING_DAYS,
  STOCK_STATUSES,
} from '../constants/inventory'
import type {
  InventoryFilters,
  InventoryItem,
  PurchaseOrder,
  StockStatus,
} from '../types/inventory'

const DAY_MS = 86_400_000

export function getAvailable(item: InventoryItem) {
  return Math.max(0, item.stock - item.reserved)
}

export function getValue(item: InventoryItem) {
  return item.stock * item.unitCost
}

export function getDaysToExpiry(item: InventoryItem, now: number) {
  if (!item.expiresAt) return null
  return Math.ceil((new Date(item.expiresAt).getTime() - now) / DAY_MS)
}

export function getStockStatus(item: InventoryItem, now: number): StockStatus {
  const expiry = getDaysToExpiry(item, now)
  if (item.stock <= 0) return 'out'
  if (expiry !== null && expiry <= 0) return 'expired'
  if (item.stock <= item.safety) return 'critical'
  if (item.stock <= item.reorder) return 'low'
  if (expiry !== null && expiry <= EXPIRY_WARNING_DAYS) return 'expiring'
  if (item.stock > item.max) return 'overstocked'
  return 'healthy'
}

export function getStatusInfo(status: StockStatus) {
  return STOCK_STATUSES.find(({ id }) => id === status)!
}

export function needsReorder(item: InventoryItem) {
  return item.stock <= item.reorder
}

// Days until available stock runs out at the average burn rate
export function getDaysLeft(item: InventoryItem) {
  if (item.dailyUse <= 0) return null
  return getAvailable(item) / item.dailyUse
}

// Order up to the maximum level
export function getRecommendedOrder(item: InventoryItem) {
  return Math.max(0, Math.ceil(item.max - item.stock))
}

export function getIdleDays(item: InventoryItem, now: number) {
  return Math.floor((now - new Date(item.lastMovementAt).getTime()) / DAY_MS)
}

export function isDeadStock(item: InventoryItem, now: number) {
  return item.stock > 0 && getIdleDays(item, now) >= DEAD_STOCK_DAYS
}

export function formatQty(value: number, unit: string) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toLocaleString('en-US')} ${unit}`
}

export function getPoTotal(order: PurchaseOrder) {
  return order.lines.reduce((sum, { qty, unitCost }) => sum + qty * unitCost, 0)
}

export function matchesInventoryFilters(
  item: InventoryItem,
  filters: InventoryFilters,
  now: number,
) {
  const needle = filters.query.trim().toLowerCase()
  if (
    needle &&
    ![item.name, item.id, item.category, item.supplier, item.batch, item.location].some(
      (field) => field.toLowerCase().includes(needle),
    )
  ) {
    return false
  }
  if (filters.category && item.category !== filters.category) return false
  if (filters.status && getStockStatus(item, now) !== filters.status) return false
  if (filters.supplier && item.supplier !== filters.supplier) return false
  if (filters.view === 'reorder' && !needsReorder(item)) return false
  if (filters.view === 'reserved' && item.reserved <= 0) return false
  return true
}

export function itemsToCsv(items: InventoryItem[], now: number, includeCosts: boolean) {
  const columns: [string, (item: InventoryItem) => string | number][] = [
    ['Item', (item) => item.name],
    ['SKU', (item) => item.id],
    ['Category', (item) => item.category],
    ['Current stock', (item) => item.stock],
    ['Unit', (item) => item.unit],
    ['Reserved', (item) => item.reserved],
    ['Available', getAvailable],
    ['Reorder level', (item) => item.reorder],
    ['Status', (item) => getStatusInfo(getStockStatus(item, now)).label],
    ['Supplier', (item) => item.supplier],
    ['Batch', (item) => item.batch],
    ['Location', (item) => item.location],
  ]
  if (includeCosts) {
    columns.push(
      ['Unit cost (XAF)', (item) => item.unitCost],
      ['Stock value (XAF)', getValue],
    )
  }
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map(([header]) => escape(header)).join(','),
    ...items.map((item) => columns.map(([, read]) => escape(read(item))).join(',')),
  ].join('\r\n')
}
