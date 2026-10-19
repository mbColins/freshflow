import { useState } from 'react'
import { useCreateBranchMutation, useUpdateBranchMutation } from '../services/branchApi'
import type { Branch, BranchProfile } from '../types/branch'
import { saveFailureMessage } from '../utils/apiErrors'
import { changedProfileFields } from '../utils/branches'

// Sends a branch from the wizard to the backend as multipart/form-data:
// POST for a new branch, PATCH with only the changed fields (and any new logo)
// for an existing one. The branch list reloads on its own afterwards.
// Resolves to false when the server refused it; `error` then says why.
export default function useSaveBranch() {
  const [createBranch] = useCreateBranchMutation()
  const [updateBranch] = useUpdateBranchMutation()
  const [error, setError] = useState<string | null>(null)

  async function save(before: Branch | undefined, profile: BranchProfile, logo: File | null) {
    setError(null)
    try {
      if (!before) {
        await createBranch({ profile, logo }).unwrap()
      } else {
        const changes = changedProfileFields(before, profile)
        if (Object.keys(changes).length > 0 || logo) {
          await updateBranch({ uuid: before.uuid, changes: { ...changes, id: profile.id }, logo }).unwrap()
        }
      }
      return true
    } catch (failure) {
      setError(
        saveFailureMessage(
          failure,
          before ? 'The branch wasn’t saved.' : 'The branch wasn’t created.',
          `Branch code ${profile.id} is already in use.`,
        ),
      )
      return false
    }
  }

  return { save, error, reset: () => setError(null) }
}
