import { useCallback } from 'react'
import { orderApi, useListOrdersQuery } from '../services/orderApi'
import type { OrderListParams } from '../services/orderApi'
import { useAppDispatch } from '../store/hooks'
import type { Order } from '../types/order'

// One shared argument so every page reads the same cached list
// TODO: page through the list (server-side filters) once there are more orders than this
const ALL_ORDERS: OrderListParams = { page: 0, size: 200 }
const NO_ORDERS: Order[] = []

// The order list with its loading / error state
export function useOrdersQuery() {
  const query = useListOrdersQuery(ALL_ORDERS)
  return { ...query, items: query.data?.items ?? NO_ORDERS }
}

// Changes orders: shown at once, then `send` is called for each order that has
// a uuid. Resolves to how many the server refused; those are put back.
// Pass no `send` for changes the backend has no endpoint for yet (they're lost
// when the list reloads).
export function useChangeOrders() {
  const dispatch = useAppDispatch()
  return useCallback(
    async (orders: Order[], apply: (order: Order) => Order, send?: (order: Order) => Promise<unknown>) => {
      const patch = (only: Order[], change: (order: Order) => Order) => {
        const ids = only.map(({ id }) => id)
        dispatch(
          orderApi.util.updateQueryData('listOrders', ALL_ORDERS, (page) => {
            page.items = page.items.map((order) => (ids.includes(order.id) ? change(order) : order))
          }),
        )
        for (const order of only) {
          if (order.uuid) {
            dispatch(
              orderApi.util.updateQueryData('getOrder', order.uuid, (current) => (current ? change(current) : current)),
            )
          }
        }
      }
      patch(orders, apply)
      if (!send) return 0
      let refused = 0
      for (const order of orders) {
        if (!order.uuid) continue
        try {
          await send(order)
        } catch {
          refused += 1
          patch([order], () => order)
        }
      }
      return refused
    },
    [dispatch],
  )
}

export default function useOrders() {
  return useOrdersQuery().items
}
