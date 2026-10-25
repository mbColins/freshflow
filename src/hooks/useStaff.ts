import { useMemo } from 'react'
import { useListUsersQuery } from '../services/userApi'
import useCurrentUser from './useCurrentUser'

export type StaffOption = { uuid: string; name: string }

// TODO: page through the list if a tenant ever has more staff than this
const ALL_STAFF = { page: 0, size: 200 }

// The people an order can be assigned to: the connected user's tenant
// (GET /users, which leaves the caller out) plus the caller
function useStaff(): StaffOption[] {
  const { user } = useCurrentUser()
  const { data } = useListUsersQuery(ALL_STAFF)
  const people = data?.items
  return useMemo(() => {
    const everyone = [...(user ? [user] : []), ...(people ?? [])]
    return everyone
      .filter(({ uuid, active }) => uuid !== '' && active)
      .map(({ uuid, firstName, lastName, username }) => ({
        uuid,
        name: `${firstName} ${lastName}`.trim() || username,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [user, people])
}

export default useStaff
