import type { BadgeTone } from '../components/ui/Badge'
import type { OrderRole } from '../types/order'
import type {
  PricingModel,
  PromotionType,
  ServiceFilters,
  ServiceStatus,
  ServiceVisibility,
} from '../types/service'

export const SERVICE_STATUSES: {
  id: ServiceStatus
  label: string
  tone: BadgeTone
  help: string
}[] = [
  { id: 'active', label: 'Active', tone: 'success', help: 'Available for new orders' },
  { id: 'inactive', label: 'Inactive', tone: 'neutral', help: 'Not available for new orders' },
  { id: 'unavailable', label: 'Temporarily Unavailable', tone: 'danger', help: 'Paused by an operational constraint' },
  { id: 'draft', label: 'Draft', tone: 'warning', help: 'Saved but not published' },
]

export const PRICING_MODELS: { id: PricingModel; label: string; unit: string }[] = [
  { id: 'item', label: 'Per Item', unit: 'item' },
  { id: 'kg', label: 'Per Kilogram', unit: 'kg' },
  { id: 'piece', label: 'Per Piece', unit: 'piece' },
  { id: 'fixed', label: 'Fixed Price', unit: 'order' },
  { id: 'custom', label: 'Custom (item-specific)', unit: 'item' },
]

export const VISIBILITIES: { id: ServiceVisibility; label: string; help: string }[] = [
  { id: 'visible', label: 'Visible', help: 'Shown on customer order channels' },
  { id: 'hidden', label: 'Hidden', help: 'Internal only' },
  { id: 'comingSoon', label: 'Coming Soon', help: 'Shown but cannot be ordered yet' },
]

export const DEFAULT_CATEGORIES = [
  'Washing',
  'Dry Cleaning',
  'Ironing',
  'Folding',
  'Bedding',
  'Shoes',
  'Carpets',
  'Express',
  'Pickup & Delivery',
  'Specialty',
]

export const WORKFLOW_STAGES = [
  'Received',
  'Inspection',
  'Pre-spotting',
  'Washing',
  'Dry Cleaning',
  'Drying',
  'Ironing',
  'Steam Pressing',
  'Folding',
  'Finishing',
  'Quality Check',
  'Packaging',
  'Ready',
]

export const MACHINE_TYPES = [
  { name: 'Washing Machine', available: 8, capacity: '40 kg / load' },
  { name: 'Dryer', available: 5, capacity: '30 kg / load' },
  { name: 'Dry Cleaning Machine', available: 2, capacity: '15 kg / load' },
  { name: 'Steam Press', available: 3, capacity: '60 pieces / hour' },
  { name: 'Ozone Chamber', available: 1, capacity: '12 pairs / cycle' },
]

export const STAFF_SKILLS = [
  'Laundry Operator',
  'Dry Cleaning Specialist',
  'Pressing & Finishing',
  'Delivery Driver',
]

export const MATERIALS = [
  { name: 'Detergent', unit: 'ml' },
  { name: 'Fabric Softener', unit: 'ml' },
  { name: 'Dry Cleaning Solvent', unit: 'ml' },
  { name: 'Packaging Bag', unit: 'bag' },
  { name: 'Hanger', unit: 'piece' },
]

// Placeholder add-on catalog until add-ons are managed from Pricing
export const ADD_ONS = [
  { id: 'stain', name: 'Stain Treatment', price: 1_500, description: 'Spot pre-treatment before the main cycle' },
  { id: 'detergent', name: 'Premium Detergent', price: 800, description: 'Hypoallergenic formula' },
  { id: 'softener', name: 'Fabric Softener', price: 300, description: 'Lavender scent booster' },
  { id: 'folding', name: 'Extra Folding', price: 500, description: 'Each garment folded individually' },
  { id: 'packaging', name: 'Premium Packaging', price: 500, description: 'Garment bag or wooden hanger' },
  { id: 'delivery', name: 'Delivery', price: 1_500, description: 'Door delivery within the city' },
]

export const SERVICE_OPTIONS = [
  'Ironing',
  'Folding',
  'Fragrance',
  'Premium detergent',
  'Stain treatment',
  'Packaging',
  'Pickup',
  'Delivery',
]

export const PROMOTION_TYPES: PromotionType[] = [
  'Percentage discount',
  'Fixed discount',
  'Buy X get Y',
  'Free service',
  'Free delivery',
]

export const SERVICE_PACKAGES = [
  { name: 'Family Package', service: 'Wash & Fold', quantity: '20 kg', price: 35_000, validity: '30 days' },
  { name: 'Business Package', service: 'Ironing Only', quantity: '50 shirts', price: 45_000, validity: '30 days' },
  { name: 'Monthly Package', service: 'Wash & Fold', quantity: '100 kg', price: 150_000, validity: '1 month' },
]

export const SERVICE_ICONS = [
  'wash',
  'suit',
  'iron',
  'bed',
  'shoe',
  'gown',
  'sanitize',
  'carpet',
  'delivery',
  'premium',
]

// A service nearly out of room for the day gets a warning from this share of capacity
export const NEAR_CAPACITY_RATIO = 0.85

export const EMPTY_SERVICE_FILTERS: ServiceFilters = {
  query: '',
  category: '',
  status: '',
  branch: '',
  pricingModel: '',
  processing: '',
  express: '',
  visibility: '',
}

export type ServicePermissions = {
  // Create, edit, activate and deactivate services
  edit: boolean
  // See prices
  pricing: boolean
  // See orders, revenue and performance figures
  financials: boolean
}

export const SERVICE_PERMISSIONS: Record<OrderRole, ServicePermissions> = {
  admin: { edit: true, pricing: true, financials: true },
  manager: { edit: true, pricing: true, financials: true },
  receptionist: { edit: false, pricing: true, financials: false },
  staff: { edit: false, pricing: false, financials: false },
}
