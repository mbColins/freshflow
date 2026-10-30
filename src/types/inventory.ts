export type StockStatus =
  | 'healthy'
  | 'low'
  | 'critical'
  | 'out'
  | 'overstocked'
  | 'expiring'
  | 'expired'

export type MovementType =
  | 'Stock received'
  | 'Consumption'
  | 'Transfer'
  | 'Adjustment'
  | 'Damage'
  | 'Expiry'
  | 'Loss'

export type PoStatus =
  | 'Draft'
  | 'Approved'
  | 'Ordered'
  | 'Partially Received'
  | 'Received'
  | 'Cancelled'

export type TransferStatus = 'Requested' | 'In Transit' | 'Received' | 'Cancelled'

export type InventoryItem = {
  // The item's uuid; the API has no SKU
  id: string
  name: string
  category: string
  description: string
  unit: string
  location: string
  stock: number
  reserved: number
  reorder: number
  safety: number
  max: number
  unitCost: number
  supplier: string
  // Average units consumed per day; drives the run-out forecast
  dailyUse: number
  batch: string
  expiresAt: string | null
  lastMovementAt: string
  // Services that cannot run without this item
  services: string[]
  // The branch holding the stock: the same product in two branches is two items
  branchId: string
  branchName: string
  // Uuids of `services`, in the same order
  serviceIds: string[]
}

export type Movement = {
  at: string
  itemId: string
  type: MovementType
  // Signed: negative leaves stock
  qty: number
  before: number
  after: number
  user: string
  reference: string
}

export type PurchaseOrder = {
  // The order's uuid
  id: string
  // PO-2026-0018
  code: string
  supplierId: string
  supplier: string
  branchId: string
  branchName: string
  lines: { itemId: string; itemName: string; unit: string; qty: number; received: number; unitCost: number }[]
  createdAt: string
  // yyyy-MM-dd
  expectedAt: string
  notes: string
  status: PoStatus
  createdBy: string
}

export type StockTransfer = {
  // The transfer's uuid
  id: string
  // TRF-0042
  code: string
  itemId: string
  itemName: string
  unit: string
  from: string
  to: string
  qty: number
  status: TransferStatus
  requestedBy: string
  receivedBy: string
  at: string
}

export type Supplier = {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  paymentTerms: string
  leadTimeDays: number
  active: boolean
  notes: string
}

export type InventoryFilters = {
  query: string
  category: string
  status: StockStatus | ''
  supplier: string
  // Quick views from the KPI cards
  view: '' | 'reorder' | 'reserved'
}
