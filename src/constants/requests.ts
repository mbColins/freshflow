import type { BadgeTone } from '../components/ui/Badge'
import type { AccountRequestStatus } from '../types/accountRequest'
import type { DemoRequestStatus, DemoWindow } from '../types/demoRequest'

export const ACCOUNT_REQUEST_STATUSES: Record<AccountRequestStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
}

export const DEMO_REQUEST_STATUSES: Record<DemoRequestStatus, { label: string; tone: BadgeTone }> = {
  NEW: { label: 'New', tone: 'brand' },
  CONTACTED: { label: 'Contacted', tone: 'warning' },
  SCHEDULED: { label: 'Scheduled', tone: 'brand' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

// The moves the backend allows (DemoRequestStatus.next()); it refuses any other
export const DEMO_NEXT_STATUSES: Record<DemoRequestStatus, DemoRequestStatus[]> = {
  NEW: ['CONTACTED', 'SCHEDULED', 'CANCELLED'],
  CONTACTED: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

// What the action that leads to each status is called on a button
export const DEMO_ACTION_LABELS: Record<DemoRequestStatus, string> = {
  NEW: 'Reopen',
  CONTACTED: 'Mark Contacted',
  SCHEDULED: 'Schedule Demo',
  COMPLETED: 'Mark Completed',
  CANCELLED: 'Cancel Request',
}

export const DEMO_BUSINESS_TYPES: Record<string, string> = {
  independent: 'Independent laundry shop',
  'multi-branch': 'Multi-branch chain',
  commercial: 'Commercial laundry',
  hotels: 'Hotel / hospitality',
  industrial: 'Industrial facility',
  other: 'Other',
}

export const DEMO_WINDOWS: Record<DemoWindow, string> = {
  ANY: 'Any time',
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
}

export const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Phone',
}

// Backend error keys for these two screens, in the admin's words. Anything not listed
// falls back to the key's own text or a generic line (see requestFailure).
export const REQUEST_ERRORS: Record<string, string> = {
  only_platform_admin: 'Only platform administrators can work on requests.',
  account_request_not_found: 'This account request no longer exists.',
  account_request_already_decided: 'This request was already approved or rejected.',
  'account_request.subscription_plan_required': 'Choose the plan the new tenant starts on.',
  'account_request.rejection_reason_required': 'Give a reason; the applicant sees it.',
  subscription_plan_not_found: 'That plan does not exist.',
  tenant_already_exist: 'A tenant with this business name already exists.',
  username_already_exist: 'That username is taken. Choose another one.',
  'user.already.exist': 'A user with this email or phone number already exists.',
  'invalid.email': 'The applicant’s email is not valid.',
  'invalid.phone.number': 'The applicant’s phone number is not valid.',
  demo_request_not_found: 'This demo request no longer exists.',
  demo_request_invalid_status_change: 'That status change is not allowed from the current status.',
  'demo_request.scheduled_for_must_be_future': 'Pick a date and time in the future.',
  'demo_request.status_required': 'Choose a status.',
}

export const PAGE_SIZE = 10
