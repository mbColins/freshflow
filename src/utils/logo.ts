import { LOGO_MAX_BYTES, LOGO_TYPES } from '../constants/tenants'

// Why a chosen file can't be used as a logo, or null when it can
export function logoProblem(file: File) {
  if (!LOGO_TYPES.includes(file.type)) return 'Use a PNG, JPEG or WebP image.'
  if (file.size > LOGO_MAX_BYTES) return `The logo must be ${LOGO_MAX_BYTES / 1024 / 1024} MB or smaller.`
  return null
}
