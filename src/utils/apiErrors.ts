import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

type MutationError = FetchBaseQueryError | SerializedError | undefined

// The server understood the request and refused it (wrong password, bad code,
// unknown email…), as opposed to a network or server failure
export function isClientError(error: MutationError) {
  return (
    error !== undefined &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  )
}

export const NETWORK_ERROR_MESSAGE =
  'Could not reach the server. Try again in a moment.'

// One message per failure: `rejected` when the server refused the request,
// the generic network message otherwise
export function errorMessage(error: MutationError, rejected: string) {
  if (!error) return null
  return isClientError(error) ? rejected : NETWORK_ERROR_MESSAGE
}

// The backend's own error text, when it sent one in the response envelope
export function serverMessage(error: unknown) {
  const data = (error as { data?: { message?: unknown } } | undefined)?.data
  return typeof data?.message === 'string' && data.message !== '' ? data.message : null
}

// A failed save in the user's terms: what didn't happen, then why. The
// backend's own message wins when it sends one; `conflict` explains a 409.
export function saveFailureMessage(error: unknown, prefix: string, conflict = 'It clashes with an existing record.') {
  const fromServer = serverMessage(error)
  const status = (error as { status?: unknown } | undefined)?.status
  if (fromServer) return `${prefix} ${fromServer}`
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return `${prefix} ${NETWORK_ERROR_MESSAGE}`
  if (status === 401 || status === 403) return `${prefix} Your account isn’t allowed to do this.`
  if (status === 409) return `${prefix} ${conflict}`
  if (typeof status === 'number' && status >= 400 && status < 500) return `${prefix} Check the fields and try again.`
  return `${prefix} The server ran into a problem. Try again in a moment.`
}

// Only same-app paths, so a crafted link can't send users to another site
// after they sign in
export function safeRedirectPath(path: unknown) {
  return typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\')
    ? path
    : null
}
