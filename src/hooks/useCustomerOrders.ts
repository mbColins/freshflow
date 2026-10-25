import { useListCustomerOrdersQuery } from '../services/orderApi'
import type { Order } from '../types/order'

const NO_ORDERS: Order[] = []

// One customer's orders, newest first (GET /order/customer/{uuid})
function useCustomerOrders(customerId: string) {
  const query = useListCustomerOrdersQuery(customerId, { skip: !customerId })
  return { orders: query.data ?? NO_ORDERS, isLoading: query.isLoading, isError: query.isError }
}

export default useCustomerOrders
