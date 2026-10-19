import type { PlatformPlan } from '../types/platformPlan'

// Uppercase letters, digits and underscores, e.g. "SOLO" or "BUSINESS_PLUS"
export const PLAN_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/

export function findPlan(plans: PlatformPlan[], code: string) {
  return plans.find((plan) => plan.code === code)
}

// "Up to 5 shops" / "Unlimited shops"
export function limitLabel(limit: number | null, unit: string) {
  return limit === null ? `Unlimited ${unit}` : `Up to ${limit.toLocaleString('en-US')} ${unit}`
}

// Percent saved by paying yearly instead of 12 monthly payments, or null
export function annualSavingPct({ monthlyPrice, annualPrice }: PlatformPlan) {
  if (annualPrice === null || monthlyPrice <= 0) return null
  const pct = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
  return pct > 0 ? pct : null
}
