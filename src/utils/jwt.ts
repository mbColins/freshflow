// Reads the `exp` claim (seconds since epoch) without verifying the signature.
// Only used to avoid treating an expired session as signed in; the API still
// checks every token itself.
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

export function isTokenExpired(token: string, now = Date.now()) {
  const expiresAt = tokenExpiresAt(token)
  return expiresAt !== null && expiresAt <= now
}
