import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from './apiErrors'

// What the backend's reason codes mean to the person at the counter
const REASONS: Record<string, string> = {
  // Orders
  invalid_status_transition: 'An order moves one step at a time. Only a manager can skip ahead or go back.',
  balance_outstanding: 'The order still has a balance. Record the payment first, or ask a manager to complete it.',
  cancel_not_allowed_after_washing: 'Front desk can only cancel an order before washing starts. Ask a manager.',
  order_already_completed: 'The order is already completed.',
  order_already_cancelled: 'The order is already cancelled.',
  quality_check_not_allowed: 'Your role can’t do quality checks.',
  order_not_in_qa: 'The order isn’t at the quality check stage.',
  all_checks_must_pass: 'Every check must be ticked to pass the order.',
  assignee_not_in_order_branch: 'That person works at another branch.',
  assignee_not_active: 'That person’s account isn’t active.',
  order_in_progress: 'The items can’t change once the order has left Received. Ask a manager.',
  delivery_address_required: 'A delivery order needs an address.',
  use_payments_to_change_amount_paid: 'This order has payment records; record payments on the Payments page.',
  order_not_found: 'The order wasn’t found.',
  // Payments
  no_open_cash_session: 'Open a cash register first; cash can only be recorded while one is open.',
  cash_session_other_branch: 'Your open register belongs to another branch.',
  cash_received_below_amount: 'The cash received is less than the amount.',
  amount_exceeds_balance: 'That is more than what is still owed on the order.',
  amount_invalid: 'Enter an amount above zero.',
  order_cancelled: 'The order was cancelled.',
  provider_required: 'Choose a payment provider.',
  reference_required: 'Enter the transaction reference.',
  provider_unavailable: 'That provider isn’t enabled for this branch.',
  duplicate_reference: 'That reference was already used for another payment.',
  no_credit_terms: 'This customer has no account credit terms.',
  insufficient_credit: 'The customer’s account credit isn’t enough.',
  payment_not_refundable: 'This payment can’t be refunded.',
  refund_exceeds_payment: 'That is more than is left to refund on the payment.',
  cannot_approve_own_refund: 'You can’t approve a refund you requested.',
  refund_already_decided: 'This refund was already decided.',
  payment_not_reconcilable: 'Only settled digital payments can be reconciled.',
  resolution_required: 'Say what was done to resolve it.',
  customer_not_reachable: 'The customer has no contact for that channel.',
  scheduled_for_must_be_in_the_future: 'Pick a time in the future.',
  permission_denied: 'Your role doesn’t allow this.',
}

// The server's message, with its reason code put in plain words
export function describeError(error: unknown, fallback: string) {
  const message =
    serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], fallback) ?? NETWORK_ERROR_MESSAGE
  const code = Object.keys(REASONS).find((key) => message.includes(key))
  return code ? REASONS[code] : message
}
