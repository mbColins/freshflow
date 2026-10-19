import { USER_TYPES } from '../constants/users'
import { useGetMeQuery } from '../services/userApi'
import type { AppUser } from '../types/user'

// "Marcus Vance" -> "MV"; falls back to the username's first letters
function initialsOf(user: AppUser) {
  const fromName = [user.firstName, user.lastName].map((part) => part.trim()[0] ?? '').join('')
  return (fromName || user.username.slice(0, 2)).toUpperCase()
}

// The signed-in user from GET /users/me, with what the layout shows.
// Cached once per session; logging out resets the API cache.
function useCurrentUser() {
  const { data: user, isLoading, isError } = useGetMeQuery()
  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : ''
  return {
    user,
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
