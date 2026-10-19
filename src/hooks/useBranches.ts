import { useCallback } from 'react'
import { branchApi, useListBranchesQuery, useUpdateBranchMutation } from '../services/branchApi'
import type { BranchListParams } from '../services/branchApi'
import { useAppDispatch } from '../store/hooks'
import type { Branch } from '../types/branch'
import { changedProfileFields } from '../utils/branches'

// One shared argument so every page reads the same cached list
// TODO: page through the list once there are more branches than this
const ALL_BRANCHES: BranchListParams = { page: 0, size: 100 }
const NO_BRANCHES: Branch[] = []

// The branch list with its loading / error state, for pages that show them
export function useBranchesQuery() {
  return useListBranchesQuery(ALL_BRANCHES)
}

// Applies a change to a branch: shown at once, and the profile fields it
// touches are sent as a PATCH. Resolves to false (with the change undone)
// when the server refuses it.
// Staff, machines and stock have no endpoints yet, so changes to them only
// live in the cached list and are lost when it reloads.
// TODO: send those too once the backend has endpoints for them
export function useChangeBranch() {
  const dispatch = useAppDispatch()
  const [updateBranch] = useUpdateBranchMutation()
  return useCallback(
    async (branch: Branch, apply: (branch: Branch) => Branch) => {
      const next = apply(branch)
      // Both cached copies: the list, and the detail page's own fetch
      const inList = dispatch(
        branchApi.util.updateQueryData('listBranches', ALL_BRANCHES, (page) => {
          page.items = page.items.map((current) => (current.id === branch.id ? apply(current) : current))
        }),
      )
      const single = dispatch(
        branchApi.util.updateQueryData('getBranch', branch.uuid, (current) => (current ? apply(current) : current)),
      )
      const local = {
        undo() {
          inList.undo()
          single.undo()
        },
      }
      const changes = changedProfileFields(branch, next)
      if (Object.keys(changes).length === 0) return true
      try {
        await updateBranch({ uuid: branch.uuid, changes }).unwrap()
        return true
      } catch {
        local.undo()
        return false
      }
    },
    [dispatch, updateBranch],
  )
}

// Just the branches; empty until GET /branch answers
function useBranches() {
  return useBranchesQuery().data?.items ?? NO_BRANCHES
}

export default useBranches
