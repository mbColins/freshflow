import type {
  InventoryItem,
  Movement,
  PurchaseOrder,
  StockTransfer,
} from '../types/inventory'
import { BRANCHES } from './orders'

// Sample stock data until the inventory API exists. Dates are relative to page
// load so expiry warnings and forecasts stay meaningful.
const DAY_MS = 86_400_000
const loadedAt = Date.now()
const days = (offset: number) => new Date(loadedAt + offset * DAY_MS).toISOString()
const minutes = (offset: number) => new Date(loadedAt + offset * 60_000).toISOString()

type Seed = [
  id: string,
  name: string,
  category: string,
  unit: string,
  stock: number,
  reserved: number,
  reorder: number,
  safety: number,
  max: number,
  unitCost: number,
  supplier: string,
  dailyUse: number,
  options?: {
    expires?: number
    idleDays?: number
    services?: string[]
    location?: string
    description?: string
  },
]

const SOLV = 'SolvChem West Africa'
const AFRI = 'AfriClean Pro Douala'
const PACK = 'PackPoly Douala'
const METAL = 'Douala Metalwork SARL'

const SEEDS: Seed[] = [
  ['DET-001', 'EcoClean Heavy-Duty Liquid Detergent', 'Laundry Chemicals', 'L', 84, 20, 30, 15, 120, 4_500, SOLV, 6.2, { expires: 210, services: ['Wash & Fold', 'Sanitize 60°C', 'Bedding & Duvet'], location: 'Tank A-01', description: 'Enzymatic liquid detergent for the main wash line.' }],
  ['SFT-004', 'Lavender Softener & Antistatic', 'Laundry Chemicals', 'L', 14.5, 8, 25, 10, 80, 3_200, AFRI, 3.8, { expires: 120, services: ['Wash & Fold'], location: 'Tank B-02', description: 'Liquid conditioner dosed on the final rinse.' }],
  ['BLC-006', 'Oxygen Bleach Booster', 'Laundry Chemicals', 'kg', 24, 2, 10, 5, 30, 2_800, AFRI, 1.1, { expires: 18, services: ['Sanitize 60°C'], location: 'Shelf B-02', description: 'Powder stain booster for heavy-soil loads.' }],
  ['STN-007', 'Enzyme Stain Remover', 'Laundry Chemicals', 'L', 9, 1, 8, 4, 30, 5_200, SOLV, 0.9, { expires: 25, location: 'Shelf B-03', description: 'Pre-spotting treatment.' }],
  ['CHM-009', 'Perchloroethylene Dry Solvent', 'Laundry Chemicals', 'L', 0, 0, 60, 30, 200, 18_000, SOLV, 12, { services: ['Dry Cleaning', 'Delicate Silk & Wedding Gown'], location: 'DryClean Bay 02', description: 'Stabilized perc for the dry-cleaning machines. UN 1897.' }],
  ['PKG-012', 'Heavy Duty Poly Garment Bags 40×60', 'Packaging', 'Bag', 85, 60, 250, 100, 1_000, 75, PACK, 110, { services: ['Dry Cleaning', 'Ironing Only'], location: 'Packaging Bay', description: 'Perforated roll of garment covers.' }],
  ['PKG-014', 'Laundry Bags — Large', 'Packaging', 'Piece', 0, 0, 80, 40, 400, 450, PACK, 14, { services: ['Wash & Fold', 'Pickup & Delivery'], location: 'Packaging Bay', description: 'Reusable drawstring bags for wash & fold orders.' }],
  ['HNG-002', 'Standard Wire Shirt Hangers', 'Packaging', 'Piece', 1_450, 250, 400, 200, 2_000, 25, METAL, 75, { location: 'Rack C-04', description: '16-gauge galvanized hangers, box of 500.' }],
  ['LBL-003', 'Garment Tag Labels', 'Packaging', 'Roll', 46, 0, 12, 6, 60, 1_800, PACK, 1.4, { location: 'Front desk store', description: 'Barcode tag rolls for intake.' }],
  ['GLV-021', 'Nitrile Gloves (Box of 100)', 'Cleaning Supplies', 'Box', 22, 0, 10, 5, 40, 3_500, AFRI, 0.8, { location: 'Shelf D-01' }],
  ['DIS-022', 'Surface Disinfectant', 'Cleaning Supplies', 'L', 38, 0, 6, 3, 30, 2_400, AFRI, 0.1, { idleDays: 84, location: 'Shelf D-02', description: 'For sorting tables and intake counters.' }],
  ['SPR-031', 'Washer Drive Belt', 'Spare Parts', 'Piece', 4, 0, 2, 1, 8, 14_500, METAL, 0.03, { idleDays: 41, location: 'Maintenance cage' }],
  ['SPR-033', 'Steam Press Valve Kit', 'Spare Parts', 'Piece', 1, 0, 2, 1, 4, 62_000, METAL, 0.02, { idleDays: 12, services: ['Ironing Only'], location: 'Maintenance cage' }],
  ['OFF-041', 'Thermal Receipt Paper', 'Consumables', 'Roll', 30, 0, 15, 8, 60, 900, PACK, 1.6, { location: 'Front desk store' }],
]

export const SAMPLE_ITEMS: InventoryItem[] = SEEDS.map(
  ([id, name, category, unit, stock, reserved, reorder, safety, max, unitCost, supplier, dailyUse, options = {}], index) => ({
    id,
    name,
    category,
    description: options.description ?? '',
    unit,
    location: options.location ?? 'Central storage',
    stock,
    reserved,
    reorder,
    safety,
    max,
    unitCost,
    supplier,
    dailyUse,
    batch: `LOT-${9_900 + index * 7}`,
    expiresAt: options.expires === undefined ? null : days(options.expires),
    lastMovementAt: days(-(options.idleDays ?? 0) - 0.1),
    services: options.services ?? [],
  }),
)

export const SAMPLE_MOVEMENTS: Movement[] = [
  { at: minutes(-12), itemId: 'DET-001', type: 'Consumption', qty: -2.5, before: 86.5, after: 84, user: 'Elena Rostova', reference: 'ORD-10452' },
  { at: minutes(-40), itemId: 'PKG-012', type: 'Consumption', qty: -15, before: 100, after: 85, user: 'David Kim', reference: 'Packing line' },
  { at: minutes(-75), itemId: 'SFT-004', type: 'Consumption', qty: -1.5, before: 16, after: 14.5, user: 'Elena Rostova', reference: 'ORD-10450' },
  { at: minutes(-130), itemId: 'HNG-002', type: 'Stock received', qty: 500, before: 950, after: 1_450, user: 'Marcus Vance', reference: 'PO-0401' },
  { at: minutes(-190), itemId: 'CHM-009', type: 'Consumption', qty: -6, before: 6, after: 0, user: 'David Kim', reference: 'DryClean Bay 02' },
  { at: minutes(-260), itemId: 'DET-001', type: 'Transfer', qty: -20, before: 106.5, after: 86.5, user: 'Marcus Vance', reference: 'TRF-020' },
  { at: minutes(-410), itemId: 'STN-007', type: 'Damage', qty: -1, before: 10, after: 9, user: 'Mary Ngono', reference: 'Spillage' },
  { at: minutes(-1_500), itemId: 'PKG-014', type: 'Consumption', qty: -12, before: 12, after: 0, user: 'Aisha Tamba', reference: 'Intake counter' },
]

export const SAMPLE_PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: 'PO-0405', supplier: SOLV, lines: [{ itemId: 'CHM-009', qty: 200, unitCost: 18_000 }], createdAt: days(-1), expectedAt: days(2), status: 'Ordered', createdBy: 'Marcus Vance' },
  { id: 'PO-0406', supplier: PACK, lines: [{ itemId: 'PKG-012', qty: 500, unitCost: 75 }, { itemId: 'PKG-014', qty: 200, unitCost: 450 }], createdAt: days(-0.5), expectedAt: days(1), status: 'Approved', createdBy: 'Marcus Vance' },
  { id: 'PO-0407', supplier: AFRI, lines: [{ itemId: 'SFT-004', qty: 100, unitCost: 3_200 }], createdAt: days(-0.1), expectedAt: days(1), status: 'Draft', createdBy: 'Mary Ngono' },
]

export const SAMPLE_TRANSFERS: StockTransfer[] = [
  { id: 'TRF-021', itemId: 'PKG-012', from: BRANCHES[1], to: BRANCHES[0], qty: 200, status: 'In Transit', requestedBy: 'Marcus Vance', at: minutes(-55) },
  { id: 'TRF-020', itemId: 'DET-001', from: BRANCHES[0], to: BRANCHES[2], qty: 20, status: 'Received', requestedBy: 'Marcus Vance', at: minutes(-260) },
]
