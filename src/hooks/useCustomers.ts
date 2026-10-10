import { useSyncExternalStore } from 'react'
import { SAMPLE_CUSTOMERS } from '../constants/sampleCustomers'
import type { CrmCustomer } from '../types/customer'

// In-memory customer store shared by the list and profile pages.
// TODO: replace with the customers API; changes are lost on reload.
let customers = SAMPLE_CUSTOMERS
const listeners = new Set<() => void>()

function setCustomers(next: CrmCustomer[]) {
  customers = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const customerStore = {
  add(added: CrmCustomer[]) {
    setCustomers([...added, ...customers])
  },
  update(ids: string[], change: (customer: CrmCustomer) => CrmCustomer) {
    setCustomers(
      customers.map((customer) =>
        ids.includes(customer.id) ? change(customer) : customer,
      ),
    )
  },
  nextId() {
    const highest = Math.max(
      ...customers.map(({ id }) => Number(id.replace(/\D/g, ''))),
    )
    return `CUS-${String(highest + 1).padStart(6, '0')}`
  },
}

function useCustomers() {
  return useSyncExternalStore(subscribe, () => customers)
}

export default useCustomers
