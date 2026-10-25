import { useListDeliveryZonesQuery } from '../services/deliveryZoneApi'
import type { ZoneListParams } from '../services/deliveryZoneApi'
import type { DeliveryZone } from '../types/deliveryZone'

// The same arguments as the delivery zones page, so both read one cached list
// TODO: page through the list once there are more zones than this
const ALL_ZONES: ZoneListParams = { filter: '', search: '', page: 0, size: 100 }
const NO_ZONES: DeliveryZone[] = []

// The delivery zones the signed-in user can see (a branch its own, a tenant
// owner every branch's), with the loading and error state of the request
function useDeliveryZones() {
  const { data, isLoading, isError, isFetching, refetch } = useListDeliveryZonesQuery(ALL_ZONES)
  return { zones: data?.items ?? NO_ZONES, isLoading, isError, isFetching, refetch }
}

export default useDeliveryZones
