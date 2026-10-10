import { useSyncExternalStore } from 'react'
import { SAMPLE_BRANCHES } from '../constants/sampleBranches'
import type { Branch } from '../types/branch'

// In-memory branch list shared by the list and detail pages.
// TODO: replace with the branches API; changes are lost on reload.
let branches = SAMPLE_BRANCHES
const listeners = new Set<() => void>()

function setBranches(next: Branch[]) {
  branches = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const branchStore = {
  add(added: Branch[]) {
    setBranches([...branches, ...added])
  },
  update(id: string, change: (branch: Branch) => Branch) {
    setBranches(branches.map((branch) => (branch.id === id ? change(branch) : branch)))
  },
}

function useBranches() {
  return useSyncExternalStore(subscribe, () => branches)
}

export default useBranches
