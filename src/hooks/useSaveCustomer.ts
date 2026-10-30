import { useState } from 'react'
import { useCreateCustomerMutation, useUpdateCustomerMutation } from '../services/customerApi'
import type { CrmCustomer } from '../types/customer'
import { saveFailureMessage } from '../utils/apiErrors'
import { changedCustomerFields, customerRequest, newCustomerRequest } from '../utils/customers'
import { useBranchLookup, useChangeCustomers } from './useCustomers'

type SaveResult = { ok: true; id: string | null } | { ok: false }

// Saves a customer from the form: POST for a new one, PATCH with only the
// changed CustomerRequest fields for an existing one. Fields the backend
// doesn't store (tags, preferences, notes…) are kept in the cached list.
// On failure `error` says why and the form stays open.
export default function useSaveCustomer() {
  const [createCustomer] = useCreateCustomerMutation()
  const [updateCustomer] = useUpdateCustomerMutation()
  const changeLocally = useChangeCustomers()
  const { uuidOf } = useBranchLookup()
  const [error, setError] = useState<string | null>(null)

  async function save(before: CrmCustomer | undefined, after: CrmCustomer): Promise<SaveResult> {
    setError(null)
    const branchId = uuidOf(after.branch) || after.branchId
    if (!branchId) {
      setError('Pick a branch for this customer. The branch list may still be loading.')
      return { ok: false }
    }
    try {
      if (!before) {
        // The list reloads on its own to show the new customer
        const id = await createCustomer(newCustomerRequest(after, branchId)).unwrap()
        return { ok: true, id }
      }
      const changes = changedCustomerFields(
        customerRequest(before, uuidOf(before.branch) || before.branchId),
        customerRequest(after, branchId),
      )
      if (Object.keys(changes).length > 0) await updateCustomer({ id: before.id, changes }).unwrap()
      // Keep the fields the backend doesn't store; nothing left to send
      void changeLocally([before], () => ({ ...after, branchId }))
      return { ok: true, id: before.id }
    } catch (failure) {
      setError(
        saveFailureMessage(
          failure,
          before ? 'The customer wasn’t saved.' : 'The customer wasn’t added.',
          'Another customer already has this phone number or email.',
        ),
      )
      return { ok: false }
    }
  }

  return { save, error, reset: () => setError(null) }
}
