import { useGetBranchDropdownQuery } from '../services/branchApi'

const NO_NAMES: string[] = []

// Names of the branches the connected user can see (GET /branch/dropdown),
// for screens that record a branch by name
function useBranchNames() {
  const { data, isLoading, isError, refetch } = useGetBranchDropdownQuery()
  return { names: data?.map(({ name }) => name) ?? NO_NAMES, isLoading, isError, refetch }
}

export default useBranchNames
