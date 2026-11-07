import { REQUEST_ERRORS } from '../constants/requests'
import { NETWORK_ERROR_MESSAGE, serverMessage } from './apiErrors'
import { formatDate } from './customers'

// Date and time of an ISO timestamp, in the app's date format
export function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const time = new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(iso)} · ${time}`
}

// A yyyy-MM-dd date (no time zone) shown as the visitor meant it
export function formatPlainDate(date: string | null) {
  return date ? formatDate(`${date}T12:00:00`) : '—'
}

// What went wrong, in the admin's words, after `prefix`. The backend sends a message
// key (account_request_already_decided); known keys are translated, others shown as sent.
export function requestFailure(error: unknown, prefix: string) {
  const key = serverMessage(error)
  const status = (error as { status?: unknown } | undefined)?.status
  if (key) return `${prefix} ${REQUEST_ERRORS[key] ?? key}`
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return `${prefix} ${NETWORK_ERROR_MESSAGE}`
  if (status === 401 || status === 403) return `${prefix} Your account isn’t allowed to do this.`
  if (status === 404) return `${prefix} The request no longer exists.`
  if (status === 409) return `${prefix} It clashes with an existing record.`
  if (typeof status === 'number' && status >= 400 && status < 500) return `${prefix} Check the fields and try again.`
  return `${prefix} The server ran into a problem. Try again in a moment.`
}

// Value of a <input type="datetime-local"> for a Date, in local time
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
