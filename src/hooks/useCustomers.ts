import { useCallback, useMemo } from 'react'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import { customerApi, useListCustomersQuery, useUpdateCustomerMutation } from '../services/customerApi'
import type { CustomerListParams } from '../services/customerApi'
import { useAppDispatch } from '../store/hooks'
import type { CrmCustomer } from '../types/customer'
import { changedCustomerFields, customerRequest } from '../utils/customers'

// One shared argument so every page reads the same cached list
// TODO: page through the list once there are more customers than this
const ALL_CUSTOMERS: CustomerListParams = { page: 0, size: 500 }
const NO_CUSTOMERS: CrmCustomer[] = []

// Branch name <-> uuid, from GET /branch/dropdown. Customers are shown and
// picked by branch name; the API wants the uuid.
export function useBranchLookup() {
  const { data } = useGetBranchDropdownQuery()
  return useMemo(() => {
    const options = data ?? []
    return {
      uuidOf: (name: string) => options.find((option) => option.name === name)?.uuid ?? '',
      nameOf: (uuid: string) => options.find((option) => option.uuid === uuid)?.name ?? '',
    }
  }, [data])
}

// The customer list with its loading / error state; branch names are filled
// in when the response only had branch uuids
export function useCustomersQuery() {
  const query = useListCustomersQuery(ALL_CUSTOMERS)
  const { nameOf } = useBranchLookup()
  const items = useMemo(
    () =>
      (query.data?.items ?? NO_CUSTOMERS).map((customer) =>
        customer.branch || !customer.branchId ? customer : { ...customer, branch: nameOf(customer.branchId) },
      ),
    [query.data, nameOf],
  )
  return { ...query, items }
}

// Applies a change to customers: shown at once, and the CustomerRequest fields
// it touches (name, phone, email, address, points, branch, referral source)
// are sent as a PATCH per customer. Resolves to how many the server refused;
// those are undone.
// Status, tags, notes, preferences and payments have no backend fields, so
// changes to them only live in the cached list and are lost when it reloads.
// TODO: send those too once the backend stores them
export function useChangeCustomers() {
  const dispatch = useAppDispatch()
  const [updateCustomer] = useUpdateCustomerMutation()
  const { uuidOf } = useBranchLookup()
  return useCallback(
    async (customers: CrmCustomer[], apply: (customer: CrmCustomer) => CrmCustomer) => {
      const ids = customers.map(({ id }) => id)
      const patchCaches = (change: (customer: CrmCustomer) => CrmCustomer, only: string[]) => {
        const inList = dispatch(
          customerApi.util.updateQueryData('listCustomers', ALL_CUSTOMERS, (page) => {
            page.items = page.items.map((current) => (only.includes(current.id) ? change(current) : current))
          }),
        )
        const singles = only.map((id) =>
          dispatch(
            customerApi.util.updateQueryData('getCustomer', id, (current) => (current ? change(current) : current)),
          ),
        )
        return () => {
          inList.undo()
          singles.forEach((single) => single.undo())
        }
      }
      patchCaches(apply, ids)

      let refused = 0
      for (const customer of customers) {
        const next = apply(customer)
        const branchOf = (current: CrmCustomer) => uuidOf(current.branch) || current.branchId
        const changes = changedCustomerFields(
          customerRequest(customer, branchOf(customer)),
          customerRequest(next, branchOf(next)),
        )
        if (Object.keys(changes).length === 0) continue
        try {
          await updateCustomer({ id: customer.id, changes }).unwrap()
        } catch {
          refused += 1
          // Put this customer back as it was
          patchCaches(() => customer, [customer.id])
        }
      }
      return refused
    },
    [dispatch, updateCustomer, uuidOf],
  )
}

// Just the customers; empty until the list answers
function useCustomers() {
  return useCustomersQuery().items
}

export default useCustomers
