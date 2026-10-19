import { SAMPLE_PLANS } from '../constants/subscriptions'
import type { SubscriptionPlan } from '../types/subscription'
import { createStore } from './createStore'

// In-memory subscription plans for the pricing pages.
// TODO: replace with the subscriptions API; changes are lost on reload.
const store = createStore<SubscriptionPlan[]>(SAMPLE_PLANS)

export const planStore = {
  // Adds the plan, or replaces the one with the same id
  save(plan: SubscriptionPlan) {
    const plans = store.get()
    store.set(
      plans.some(({ id }) => id === plan.id)
        ? plans.map((current) => (current.id === plan.id ? plan : current))
        : [plan, ...plans],
    )
  },
  update(id: string, change: (plan: SubscriptionPlan) => SubscriptionPlan) {
    store.set(store.get().map((plan) => (plan.id === id ? change(plan) : plan)))
  },
  remove(id: string) {
    store.set(store.get().filter((plan) => plan.id !== id))
  },
  nextId() {
    const highest = Math.max(0, ...store.get().map(({ id }) => Number(id.replace(/\D/g, '')) || 0))
    return `PLN-${String(highest + 1).padStart(3, '0')}`
  },
}

const useSubscriptionPlans = store.useValue

export default useSubscriptionPlans
