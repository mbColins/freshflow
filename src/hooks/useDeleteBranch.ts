import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { useDeleteBranchMutation } from '../services/branchApi'
import type { Branch } from '../types/branch'
import { saveFailureMessage } from '../utils/apiErrors'

// The confirm step for DELETE /branch/{uuid}. `onResult` gets the message to
// show, and whether the branch is gone; the branch list reloads on its own.
export default function useDeleteBranch() {
  const [deleteBranch] = useDeleteBranchMutation()

  return (branch: Branch, onResult: (message: string, deleted: boolean) => void): ConfirmRequest => ({
    title: `Delete ${branch.name}?`,
    body: `${branch.id} is removed for good${
      branch.stats.activeOrders > 0 ? `, along with access to its ${branch.stats.activeOrders} active orders` : ''
    }. To stop new orders but keep the branch, deactivate it instead.`,
    confirmLabel: 'Delete Branch',
    destructive: true,
    onConfirm: async () => {
      try {
        await deleteBranch(branch.uuid).unwrap()
        onResult(`${branch.name} deleted`, true)
      } catch (error) {
        onResult(
          saveFailureMessage(error, `${branch.name} wasn’t deleted.`, 'It still has records that depend on it.'),
          false,
        )
      }
    },
  })
}
