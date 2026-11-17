import { USER_TYPES } from '../constants/users'
import { useGetMeQuery } from '../services/userApi'
import type { AppUser } from '../types/user'

// Menus that belong to the platform operator, not to a business
export const PLATFORM_MENUS = new Set(['TENANTS', 'PLATFORM_PLANS', 'ACCOUNT_REQUESTS', 'DEMO_REQUESTS'])

// From the username, else the email's local part: "marcus.vance" or
// "marcus_vance@x.com" -> "MV", "admin" -> "AD"
function initialsOf(user: AppUser) {
  const handle = user.username.trim() || user.email.trim().split('@')[0]
  const words = handle.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)
  return letters.toUpperCase() || '?'
}

// The signed-in user from GET /users/me, with what the layout shows.
// Cached once per session; logging out resets the API cache.
function useCurrentUser() {
  const { data: user, isLoading, isError } = useGetMeQuery()
  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : ''
  const access = user?.access ?? null
  return {
    user,
    // Null until the profile says what the user may do. Until then nothing
    // is open: GET /users/me always sends it, so a missing value is an error
    access,
    // Whether a menu (ORDERS) is open to the user. Everything fails closed:
    // nothing opens while the profile is loading or if it lacks access info,
    // and platform-only menus open only for a confirmed platform admin.
    canOpen: (menu: string) =>
      PLATFORM_MENUS.has(menu)
        ? user?.userType === 'SYSTEM_ADMIN' || access?.platformAdmin === true
        : access !== null && access.menus.includes(menu),
    // Whether the user holds a permission code (PAYMENTS:REFUND)
    can: (code: string) => access !== null && (access.platformAdmin || access.permissions.includes(code)),
    isLoading,
    isError,
    name,
    initials: user ? initialsOf(user) : '',
    // The role name, else the user type, e.g. "Store manager"
    roleLabel: user ? user.role || (user.userType ? USER_TYPES[user.userType] : '') : '',
    // Where the user works: their branch, else their tenant's business name
    workplace: user ? user.branch || user.tenant : '',
    // TODO: confirm with the backend that SYSTEM_ADMIN is the platform admin,
    // then use this for the platform-only pages and the branch form's tenant picker
    isPlatformAdmin: user?.userType === 'SYSTEM_ADMIN',
  }
}

export default useCurrentUser
