import { ALLOWANCE_UNITS, BILLING_CYCLES } from '../constants/subscriptions'
import type { PlanFilters, SubscriptionPlan } from '../types/subscription'
import type { LaundryService } from '../types/service'

// The plan's price spread over one month, for comparing cycles
export function monthlyPrice({ price, cycle }: Pick<SubscriptionPlan, 'price' | 'cycle'>) {
  return price * BILLING_CYCLES[cycle].perMonth
}

// Monthly recurring revenue from everyone on the plan
export function planMrr(plan: SubscriptionPlan) {
  return monthlyPrice(plan) * plan.subscribers
}

export function allowanceLabel({ allowance, allowanceUnit, cycle }: Pick<SubscriptionPlan, 'allowance' | 'allowanceUnit' | 'cycle'>) {
  const unit = ALLOWANCE_UNITS[allowanceUnit].short
  return allowance === null
    ? `Unlimited ${unit}`
    : `${allowance.toLocaleString('en-US')} ${unit} / ${BILLING_CYCLES[cycle].per}`
}

// Price of the allowance at list prices, when the included services are all
// priced in the plan's unit; null when there's nothing to compare against
export function listValue(
  plan: Pick<SubscriptionPlan, 'allowance' | 'allowanceUnit' | 'serviceIds'>,
  services: LaundryService[],
) {
  if (plan.allowance === null || plan.allowanceUnit === 'orders') return null
  const model = plan.allowanceUnit === 'kg' ? ['kg'] : ['item', 'piece']
  const prices = services
    .filter(({ id, pricingModel }) => plan.serviceIds.includes(id) && model.includes(pricingModel))
    .map(({ basePrice }) => basePrice)
  if (prices.length === 0) return null
  // The cheapest included service, so the saving shown is never overstated
  return Math.min(...prices) * plan.allowance
}

export function matchesPlanFilters(plan: SubscriptionPlan, { query, status, cycle }: PlanFilters) {
  const text = query.trim().toLowerCase()
  return (
    (!text || [plan.id, plan.name, plan.description].some((value) => value.toLowerCase().includes(text))) &&
    (!status || plan.status === status) &&
    (!cycle || plan.cycle === cycle)
  )
}
