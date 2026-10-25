// Backend DriverStatus enum
export type DriverAvailability = 'AVAILABLE' | 'ON_ROUTE' | 'OFF_DUTY'

// Someone who does pickups and deliveries. A driver needn't have a login;
// one who uses the app is linked to a DELIVERY_AGENT user. A driver serves one
// branch, or every branch of the tenant.
export type DeliveryDriver = {
  // The uuid the API addresses the driver by
  id: string
  name: string
  phone: string
  email: string
  // The linked user's uuid; empty when the driver has no login
  userId: string
  // Branch uuid; empty when the driver serves every branch
  branchId: string
  branchName: string
  allBranches: boolean
  vehicleType: string
  vehiclePlate: string
  vehicleModel: string
  status: DriverAvailability
  latitude: number | null
  longitude: number | null
  locationUpdatedAt: string
  score: number | null
  createdAt: string
}

// POST / PATCH /logistics/drivers body (DriverRequest). PATCH applies only the
// non-null fields, so a field left out keeps its value.
export type DriverRequest = {
  name: string
  phoneNumber: string
  email?: string
  // Uuid of a DELIVERY_AGENT user to link as the driver's login
  user?: string
  // Branch uuid; or allBranches: true to serve every branch
  branch?: string
  allBranches?: boolean
  vehicleType?: string
  vehiclePlate?: string
  vehicleModel?: string
  status?: DriverAvailability
}
