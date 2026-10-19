import { useListPlatformPlansQuery } from '../services/platformPlanApi'
import type { PlanListParams } from '../services/platformPlanApi'
import type { PlatformPlan } from '../types/platformPlan'

// One shared argument so every caller reads the same cached list
// TODO: page through the list if the platform ever has more than 100 plans
const ALL_PLANS: PlanListParams = { page: 0, size: 100 }
const NO_PLANS: PlatformPlan[] = []

// The plan list with its loading / error state, for pages that show them
export function usePlatformPlansQuery() {
  return useListPlatformPlansQuery(ALL_PLANS)
}

// Just the plans; empty until GET /subscription-plans answers
function usePlatformPlans() {
  return usePlatformPlansQuery().data?.items ?? NO_PLANS
}

export default usePlatformPlans
