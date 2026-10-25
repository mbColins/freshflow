// An area a branch collects from and delivers to, with what each trip costs
export type DeliveryZone = {
  // The uuid the API addresses the zone by
  id: string
  name: string
  // Charged for a pickup in this zone
  collectionFee: number
  // Charged for a delivery in this zone
  deliveryFee: number
  neighborhoods: string[]
  branchId: string
  branchName: string
  createdBy: string
  createdAt: string
}

// POST / PATCH /delivery-zones body (DeliveryZoneRequest). `createdBy` is
// left out: the backend takes it from the signed-in user.
export type DeliveryZoneRequest = {
  name: string
  collectionFee: number
  deliveryFee: number
  neighborhood: string[]
  branchId: string
}
